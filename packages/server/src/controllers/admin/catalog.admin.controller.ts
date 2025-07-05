timport { Request, Response } from 'express';
import { getCatalogs, getCatalogById } from '../../models/catalog.model';
import { getMaterialsByCatalogId } from '../../models/material.model';
import { ApiError } from '../../middleware/error.middleware';
import { XMLBuilder } from 'fast-xml-builder';
import { logger } from '../../utils/logger';

/**
 * List catalogs by factory ID
 * 
 * @param req Request object
 * @param res Response object
 */
export async function listCatalogsByFactory(req: Request, res: Response) {
  try {
    const { factoryId } = req.params;
    
    if (!factoryId) {
      throw new ApiError(400, 'Factory ID is required');
    }
    
    // Get page and limit from query params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    // Get catalogs for the specified factory
    const { catalogs, total } = await getCatalogs({
      limit,
      skip,
      sort: { updatedAt: -1 },
      filter: { factoryId }
    });
    
    res.status(200).json({
      success: true,
      count: catalogs.length,
      total,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit
      },
      data: catalogs
    });
  } catch (error) {
    logger.error(`Error listing catalogs by factory: ${error}`);
    throw error;
  }
}

/**
 * Generate XML for a catalog
 * 
 * @param req Request object
 * @param res Response object
 */
export async function generateCatalogXml(req: Request, res: Response) {
  try {
    const { catalogId } = req.params;
    
    if (!catalogId) {
      throw new ApiError(400, 'Catalog ID is required');
    }
    
    // Get catalog details
    const catalog = await getCatalogById(catalogId);
    
    if (!catalog) {
      throw new ApiError(404, `Catalog not found with id ${catalogId}`);
    }
    
    // Generate XML from catalog data
    const builder = new XMLBuilder({
      format: true,
      declaration: {
        encoding: 'UTF-8',
        version: '1.0'
      },
      dtd: {
        name: 'catalog'
      }
    });
    
    const catalogData = {
      catalog: {
        '@id': catalog.id,
        name: catalog.name,
        manufacturer: catalog.manufacturer || 'Unknown',
        factoryId: catalog.factoryId || 'Unknown',
        totalPages: catalog.totalPages,
        status: catalog.status,
        createdAt: catalog.createdAt.toISOString(),
        updatedAt: catalog.updatedAt.toISOString()
      }
    };
    
    const xml = builder.build(catalogData);
    
    // Set headers for XML download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="catalog-${catalogId}.xml"`);
    
    // Send XML response
    res.status(200).send(xml);
  } catch (error) {
    logger.error(`Error generating catalog XML: ${error}`);
    throw error;
  }
}

/**
 * Generate XML for materials in a catalog
 * 
 * @param req Request object
 * @param res Response object
 */
export async function generateMaterialsXml(req: Request, res: Response) {
  try {
    const { catalogId } = req.params;
    
    if (!catalogId) {
      throw new ApiError(400, 'Catalog ID is required');
    }
    
    // Get materials for the specified catalog
    const materials = await getMaterialsByCatalogId(catalogId);
    
    if (materials.length === 0) {
      throw new ApiError(404, `No materials found for catalog ${catalogId}`);
    }
    
    // Generate XML from materials data
    const builder = new XMLBuilder({
      format: true,
      declaration: {
        encoding: 'UTF-8',
        version: '1.0'
      },
      dtd: {
        name: 'materials'
      }
    });
    
    // Filter materials by query parameters if provided
    let filteredMaterials = materials;
    
    if (req.query.materialType) {
      filteredMaterials = filteredMaterials.filter(m => m.materialType === req.query.materialType);
    }
    
    if (req.query.color) {
      filteredMaterials = filteredMaterials.filter(m => m.color?.name === req.query.color);
    }
    
    if (req.query.finish) {
      filteredMaterials = filteredMaterials.filter(m => m.finish === req.query.finish);
    }
    
    // Prepare materials data for XML
    const materialsData = {
      materials: {
        '@catalogId': catalogId,
        '@count': filteredMaterials.length,
        material: filteredMaterials.map(material => ({
          '@id': material.id,
          name: material.name,
          description: material.description || '',
          materialType: material.materialType || 'unknown',
          manufacturer: material.manufacturer || 'Unknown',
          dimensions: {
            width: material.dimensions?.width || 0,
            height: material.dimensions?.height || 0,
            unit: material.dimensions?.unit || 'mm'
          },
          color: {
            name: material.color?.name || 'Unknown',
            primary: material.color?.primary || false
          },
          finish: material.finish || 'unknown',
          pattern: material.pattern || '',
          texture: material.texture || '',
          technicalSpecs: material.technicalSpecs || {},
          images: {
            image: material.images?.map(img => ({
              '@id': img.id,
              '@type': img.type,
              url: img.url,
              width: img.width,
              height: img.height
            })) || []
          },
          tags: {
            tag: material.tags || []
          }
        }))
      }
    };
    
    const xml = builder.build(materialsData);
    
    // Set headers for XML download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="materials-${catalogId}.xml"`);
    
    // Send XML response
    res.status(200).send(xml);
  } catch (error) {
    logger.error(`Error generating materials XML: ${error}`);
    throw error;
  }
}

/**
 * Generate XML for filtered materials across all catalogs
 * 
 * @param req Request object
 * @param res Response object
 */
export async function generateFilteredMaterialsXml(req: Request, res: Response) {
  try {
    // Get filter parameters from query
    const { materialType, color, finish, manufacturer, factoryId } = req.query;
    
    // Build filter object
    const filter: Record<string, any> = {};
    
    if (materialType) filter.materialType = materialType;
    if (color) filter['color.name'] = color;
    if (finish) filter.finish = finish;
    if (manufacturer) filter.manufacturer = manufacturer;
    if (factoryId) filter.factoryId = factoryId;
    
    if (Object.keys(filter).length === 0) {
      throw new ApiError(400, 'At least one filter parameter is required');
    }
    
    // Get all materials matching the filters
    // This assumes a function to get materials by filter exists
    // If not, you'd need to implement it or modify this approach
    const materials = await getMaterialsByFilter(filter);
    
    if (materials.length === 0) {
      throw new ApiError(404, 'No materials found matching the specified filters');
    }
    
    // Generate XML from filtered materials
    const builder = new XMLBuilder({
      format: true,
      declaration: {
        encoding: 'UTF-8',
        version: '1.0'
      },
      dtd: {
        name: 'filtered-materials'
      }
    });
    
    // Prepare materials data for XML
    const materialsData = {
      'filtered-materials': {
        '@count': materials.length,
        '@filters': JSON.stringify(filter),
        material: materials.map(material => ({
          '@id': material.id,
          '@catalogId': material.catalogId,
          name: material.name,
          description: material.description || '',
          materialType: material.materialType || 'unknown',
          manufacturer: material.manufacturer || 'Unknown',
          dimensions: {
            width: material.dimensions?.width || 0,
            height: material.dimensions?.height || 0,
            unit: material.dimensions?.unit || 'mm'
          },
          color: {
            name: material.color?.name || 'Unknown',
            primary: material.color?.primary || false
          },
          finish: material.finish || 'unknown',
          pattern: material.pattern || '',
          texture: material.texture || '',
          technicalSpecs: material.technicalSpecs || {},
          images: {
            image: material.images?.map(img => ({
              '@id': img.id,
              '@type': img.type,
              url: img.url,
              width: img.width,
              height: img.height
            })) || []
          },
          tags: {
            tag: material.tags || []
          }
        }))
      }
    };
    
    const xml = builder.build(materialsData);
    
    // Set headers for XML download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="filtered-materials.xml"');
    
    // Send XML response
    res.status(200).send(xml);
  } catch (error) {
    logger.error(`Error generating filtered materials XML: ${error}`);
    throw error;
  }
}

// Helper function to get materials by filter using Supabase material service
async function getMaterialsByFilter(filter: Record<string, any>): Promise<any[]> {
  try {
    // Map filter parameters to search options for the Supabase material service
    const searchOptions = {
      manufacturer: filter.manufacturer || undefined,
      finish: filter.finish || undefined,
      materialType: filter.materialType || undefined,
      color: filter.color || undefined,
      tags: filter.tags || undefined,
      query: filter.query || undefined
    };

    // Use the Supabase material service to search for materials
    const materials = await SupabaseMaterialService.searchMaterials(searchOptions);
    
    console.log(`Found ${materials.length} materials matching filter criteria`);
    return materials;
  } catch (error) {
    console.error('Error in getMaterialsByFilter:', error);
    throw error;
  }
}