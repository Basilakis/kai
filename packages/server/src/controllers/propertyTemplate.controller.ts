/**
 * Property Template Controller
 * 
 * This controller handles API endpoints for property templates.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { propertyInheritanceService } from '../services/propertyInheritance/propertyInheritanceService';
import PropertyTemplate, { 
  PropertyTemplateDocument,
  createPropertyTemplate,
  getPropertyTemplateById,
  updatePropertyTemplate,
  deletePropertyTemplate,
  getPropertyTemplates
} from '../models/propertyTemplate.model';

/**
 * Create a new property template
 * 
 * @route POST /api/property-templates
 * @param req Request
 * @param res Response
 * @returns Created property template
 */
export async function createPropertyTemplateHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { body } = req;
    
    // Add createdBy from authenticated user
    body.createdBy = req.user?.id || 'system';
    
    const template = await createPropertyTemplate(body);
    
    return res.status(201).json({
      success: true,
      data: template
    });
  } catch (err) {
    logger.error(`Failed to create property template: ${err}`);
    return res.status(500).json({
      success: false,
      error: `Failed to create property template: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Get a property template by ID
 * 
 * @route GET /api/property-templates/:id
 * @param req Request
 * @param res Response
 * @returns Property template
 */
export async function getPropertyTemplateHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    
    const template = await getPropertyTemplateById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Property template not found: ${id}`
      });
    }
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (err) {
    logger.error(`Failed to get property template: ${err}`);
    return res.status(500).json({
      success: false,
      error: `Failed to get property template: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Update a property template
 * 
 * @route PUT /api/property-templates/:id
 * @param req Request
 * @param res Response
 * @returns Updated property template
 */
export async function updatePropertyTemplateHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { body } = req;
    
    const template = await updatePropertyTemplate(id, body);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Property template not found: ${id}`
      });
    }
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (err) {
    logger.error(`Failed to update property template: ${err}`);
    return res.status(500).json({
      success: false,
      error: `Failed to update property template: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Delete a property template
 * 
 * @route DELETE /api/property-templates/:id
 * @param req Request
 * @param res Response
 * @returns Deleted property template
 */
export async function deletePropertyTemplateHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    
    const template = await deletePropertyTemplate(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Property template not found: ${id}`
      });
    }
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (err) {
    logger.error(`Failed to delete property template: ${err}`);
    return res.status(500).json({
      success: false,
      error: `Failed to delete property template: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Get property templates
 * 
 * @route GET /api/property-templates
 * @param req Request
 * @param res Response
 * @returns Property templates
 */
export async function getPropertyTemplatesHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { 
      materialType,
      categoryId,
      parentTemplateId,
      isActive,
      limit = 100,
      skip = 0,
      sort = 'priority:-1,name:1'
    } = req.query;
    
    // Parse sort parameter
    const sortObj: Record<string, 1 | -1> = {};
    if (typeof sort === 'string') {
      sort.split(',').forEach(field => {
        const [key, order] = field.split(':');
        sortObj[key] = order === '-1' ? -1 : 1;
      });
    }
    
    const templates = await getPropertyTemplates({
      materialType: materialType as string,
      categoryId: categoryId as string,
      parentTemplateId: parentTemplateId as string,
      isActive: isActive === 'true',
      limit: Number(limit),
      skip: Number(skip),
      sort: sortObj
    });
    
    return res.status(200).json({
      success: true,
      data: templates.templates,
      meta: {
        total: templates.total,
        limit: Number(limit),
        skip: Number(skip)
      }
    });
  } catch (err) {
    logger.error(`Failed to get property templates: ${err}`);
    return res.status(500).json({
      success: false,
      error: `Failed to get property templates: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Apply property template to a material
 * 
 * @route POST /api/property-templates/:id/apply
 * @param req Request
 * @param res Response
 * @returns Material with template applied
 */
export async function applyPropertyTemplateHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { material, options } = req.body;
    
    // Get template
    const template = await getPropertyTemplateById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Property template not found: ${id}`
      });
    }
    
    // Apply template to material
    const result = await propertyInheritanceService.applyInheritance(material, options);
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    logger.error(`Failed to apply property template: ${err}`);
    return res.status(500).json({
      success: false,
      error: `Failed to apply property template: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}
