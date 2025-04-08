/**
 * Material Metadata Formatter
 * 
 * This utility extracts and formats material metadata to ensure comprehensive
 * information is included in agent responses.
 */

import { createLogger } from './logger';

// Define more precise types for material metadata with index signatures
interface MaterialData {
  type?: string;
  materialType?: string;
  name?: string;
  description?: string;
  manufacturer?: string;
  collectionId?: string;
  color?: string | { 
    primary?: string; 
    secondary?: string; 
    accent?: string; 
  };
  technicalSpecs?: Record<string, any>;
  finish?: string;
  pattern?: string;
  texture?: string;
  dimensions?: string | {
    width?: any;
    length?: any;
    height?: any;
    thickness?: any;
    availableSizes?: string[];
  };
  metadata?: {
    manufacturer?: string;
    collection?: string;
    color?: string[] | string;
    size?: string[] | string;
    width?: any;
    length?: any;
    height?: any;
    thickness?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

interface MaterialMetadata {
  [key: string]: any;
}

const logger = createLogger('MaterialMetadataFormatter');

// Type-safe checks for different material types
function isTileMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  
  const meta = metadata as Record<string, unknown>;
  return (
    'vRating' in meta || 
    'rRating' in meta || 
    ('material' in meta && 
     typeof meta.material === 'string' && 
     ['Ceramic', 'Porcelain', 'Marble', 'Granite', 'Terracotta', 'Quartzite', 'Limestone', 'Slate', 'Glass', 'Cement'].includes(meta.material))
  );
}

function isWoodMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  
  const meta = metadata as Record<string, unknown>;
  return (
    'woodType' in meta || 
    'construction' in meta ||
    ('material' in meta && 
     typeof meta.material === 'string' && 
     meta.material.toLowerCase().includes('wood'))
  );
}

function isLightingMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  
  const meta = metadata as Record<string, unknown>;
  return (
    'lightingType' in meta || 
    'bulbType' in meta ||
    'wattage' in meta
  );
}

function isFurnitureMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  
  const meta = metadata as Record<string, unknown>;
  return (
    'furnitureType' in meta || 
    'cushionFilling' in meta ||
    'weightCapacity' in meta
  );
}

function isDecorationMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  
  const meta = metadata as Record<string, unknown>;
  return (
    'decorationType' in meta || 
    'mountingType' in meta ||
    'setSize' in meta
  );
}

/**
 * Interface for a formatted material response
 */
export interface FormattedMaterialResponse {
  materialType: string;
  name: string;
  description?: string;
  manufacturer?: string;
  collection?: string;
  availableColors?: string[];
  availableSizes?: string[];
  finish?: string;
  pattern?: string;
  texture?: string;
  technicalSpecs?: Record<string, any>;
  additionalProperties?: Record<string, any>;
}

/**
 * Formats material data to ensure comprehensive metadata is included
 * 
 * @param materialData The raw material data from the API
 * @returns A formatted material response with comprehensive metadata
 */
export function formatMaterialMetadata(materialData: MaterialData): FormattedMaterialResponse {
  logger.debug(`Formatting metadata for material: ${materialData.name}`);
  
  // Initialize the formatted response with basic information
  const formattedResponse: FormattedMaterialResponse = {
    materialType: materialData.type || materialData.materialType || 'Unknown',
    name: materialData.name || 'Unknown',
    description: materialData.description,
    manufacturer: materialData.manufacturer,
    collection: materialData.collectionId,
    additionalProperties: {}
  };
  
  // Extract metadata based on available fields
  const metadata = materialData.metadata || {} as MaterialMetadata;
  
  // Extract global metadata (common across all material types)
  if (metadata.manufacturer) formattedResponse.manufacturer = metadata.manufacturer;
  if (metadata.collection) formattedResponse.collection = metadata.collection;
  
  // Process color information
  if (materialData.color) {
    if (typeof materialData.color === 'string') {
      formattedResponse.availableColors = [materialData.color];
    } else if (materialData.color.primary) {
      formattedResponse.availableColors = [materialData.color.primary];
      
      // Add secondary colors if available
      if (materialData.color.secondary) {
        formattedResponse.availableColors.push(materialData.color.secondary);
      }
      if (materialData.color.accent) {
        formattedResponse.availableColors.push(materialData.color.accent);
      }
    }
  } else if (metadata.color) {
    formattedResponse.availableColors = Array.isArray(metadata.color) 
      ? metadata.color 
      : [metadata.color];
  }
  
  // Extract technical specifications
  if (materialData.technicalSpecs) {
    formattedResponse.technicalSpecs = materialData.technicalSpecs;
  }
  
  // Extract finish, pattern, and texture
  if (materialData.finish) formattedResponse.finish = materialData.finish;
  if (materialData.pattern) formattedResponse.pattern = materialData.pattern;
  if (materialData.texture) formattedResponse.texture = materialData.texture;
  
  // Process dimensions/size information
  formattedResponse.availableSizes = extractSizeInformation(materialData);
  
  // Add material-specific metadata based on the material type
  addMaterialSpecificMetadata(formattedResponse, materialData, metadata);
  
  return formattedResponse;
}

/**
 * Extracts size information from material data
 */
function extractSizeInformation(materialData: MaterialData): string[] {
  const sizes: string[] = [];
  
  // Check if dimensions object exists
  if (materialData.dimensions) {
    if (typeof materialData.dimensions === 'string') {
      sizes.push(materialData.dimensions);
    } else if (typeof materialData.dimensions === 'object') {
      // Different materials may store dimensions differently
      if (materialData.dimensions.width && materialData.dimensions.length) {
        const width = materialData.dimensions.width;
        const length = materialData.dimensions.length;
        const height = materialData.dimensions.height || materialData.dimensions.thickness;
        
        if (height) {
          sizes.push(`${width}x${length}x${height}`);
        } else {
          sizes.push(`${width}x${length}`);
        }
      }
      
      // Some materials might have predefined size options
      if (materialData.dimensions.availableSizes && Array.isArray(materialData.dimensions.availableSizes)) {
        sizes.push(...materialData.dimensions.availableSizes);
      }
    }
  }
  
  // Check metadata for size information
  if (materialData.metadata) {
    if (materialData.metadata.size) {
      if (Array.isArray(materialData.metadata.size)) {
        sizes.push(...materialData.metadata.size);
      } else {
        sizes.push(materialData.metadata.size);
      }
    }
    
    // Some materials might store width/length separately
    if (materialData.metadata.width && materialData.metadata.length) {
      const width = materialData.metadata.width;
      const length = materialData.metadata.length;
      const height = materialData.metadata.height || materialData.metadata.thickness;
      
      if (height) {
        sizes.push(`${width}x${length}x${height}`);
      } else {
        sizes.push(`${width}x${length}`);
      }
    }
  }
  
  return sizes;
}

/**
 * Adds material-specific metadata to the formatted response
 */
function addMaterialSpecificMetadata(
  formattedResponse: FormattedMaterialResponse, 
  materialData: MaterialData, 
  metadata: MaterialMetadata
): void {
  // Determine the material type
  const materialType = formattedResponse.materialType.toLowerCase();
  
  // Use type guards if metadata is properly typed
  if (isTileMetadata(metadata)) {
    // Tile-specific metadata
    formattedResponse.additionalProperties = {
      ...formattedResponse.additionalProperties,
      vRating: metadata.vRating,
      rRating: metadata.rRating,
      waterAbsorption: metadata.waterAbsorption,
      frostResistance: metadata.frostResistance,
      peiRating: metadata.peiRating,
      moh: metadata.moh,
      rectified: metadata.rectified,
      antibacterial: metadata.antibacterial,
      usage: metadata.usage
    };
  } else if (isWoodMetadata(metadata)) {
    // Wood-specific metadata
    formattedResponse.additionalProperties = {
      ...formattedResponse.additionalProperties,
      woodType: metadata.woodType,
      grade: metadata.grade,
      construction: metadata.construction,
      hardness: metadata.hardness,
      installationSystem: metadata.installationSystem,
      moisture: metadata.moisture,
      stability: metadata.stability,
      underfloorHeating: metadata.underfloorHeating
    };
  } else if (isLightingMetadata(metadata)) {
    // Lighting-specific metadata
    formattedResponse.additionalProperties = {
      ...formattedResponse.additionalProperties,
      lightingType: metadata.lightingType,
      bulbType: metadata.bulbType,
      bulbIncluded: metadata.bulbIncluded,
      wattage: metadata.wattage,
      lumens: metadata.lumens,
      colorTemperature: metadata.colorTemperature,
      cri: metadata.cri,
      dimmable: metadata.dimmable,
      ipRating: metadata.ipRating,
      voltage: metadata.voltage,
      energyClass: metadata.energyClass,
      controlSystem: metadata.controlSystem
    };
  } else if (isFurnitureMetadata(metadata)) {
    // Furniture-specific metadata
    formattedResponse.additionalProperties = {
      ...formattedResponse.additionalProperties,
      furnitureType: metadata.furnitureType,
      style: metadata.style,
      weightCapacity: metadata.weightCapacity,
      assembly: metadata.assembly,
      cushionFilling: metadata.cushionFilling,
      upholstery: metadata.upholstery,
      frameConstruction: metadata.frameConstruction,
      adjustable: metadata.adjustable,
      outdoor: metadata.outdoor,
      features: metadata.features
    };
  } else if (isDecorationMetadata(metadata)) {
    // Decoration-specific metadata
    formattedResponse.additionalProperties = {
      ...formattedResponse.additionalProperties,
      decorationType: metadata.decorationType,
      style: metadata.style,
      theme: metadata.theme,
      technique: metadata.technique,
      occasion: metadata.occasion,
      setSize: metadata.setSize,
      careInstructions: metadata.careInstructions,
      indoor: metadata.indoor,
      mountingType: metadata.mountingType,
      fragile: metadata.fragile
    };
  } else {
    // Generic approach based on material type string when type guards don't work
    switch (materialType) {
      case 'tile':
      case 'ceramic':
      case 'porcelain':
      case 'stone':
        extractGenericTileMetadata(formattedResponse, materialData, metadata);
        break;
      case 'wood':
      case 'timber':
      case 'flooring':
        extractGenericWoodMetadata(formattedResponse, materialData, metadata);
        break;
      case 'lighting':
      case 'light':
      case 'lamp':
        extractGenericLightingMetadata(formattedResponse, materialData, metadata);
        break;
      case 'furniture':
        extractGenericFurnitureMetadata(formattedResponse, materialData, metadata);
        break;
      case 'decoration':
      case 'decor':
        extractGenericDecorationMetadata(formattedResponse, materialData, metadata);
        break;
    }
  }
  
  // Clean up the additionalProperties object by removing null/undefined values
  if (formattedResponse.additionalProperties) {
    Object.keys(formattedResponse.additionalProperties).forEach(key => {
      if (formattedResponse.additionalProperties![key] === null || 
          formattedResponse.additionalProperties![key] === undefined) {
        delete formattedResponse.additionalProperties![key];
      }
    });
  }
}

/**
 * Extracts generic tile metadata when type guards don't work
 */
function extractGenericTileMetadata(
  formattedResponse: FormattedMaterialResponse, 
  materialData: MaterialData, 
  metadata: MaterialMetadata
): void {
  // Extract common tile properties from both materialData and metadata
  const properties = {
    vRating: metadata.vRating || materialData.vRating,
    rRating: metadata.rRating || materialData.rRating,
    waterAbsorption: metadata.waterAbsorption || materialData.waterAbsorption,
    frostResistance: metadata.frostResistance || materialData.frostResistance,
    peiRating: metadata.peiRating || materialData.peiRating,
    moh: metadata.moh || materialData.moh,
    rectified: metadata.rectified || materialData.rectified,
    antibacterial: metadata.antibacterial || materialData.antibacterial,
    usage: metadata.usage || materialData.usage
  };
  
  // Add non-null properties to additionalProperties
  Object.entries(properties).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formattedResponse.additionalProperties![key] = value;
    }
  });
}

/**
 * Extracts generic wood metadata when type guards don't work
 */
function extractGenericWoodMetadata(
  formattedResponse: FormattedMaterialResponse, 
  materialData: MaterialData, 
  metadata: MaterialMetadata
): void {
  // Extract common wood properties from both materialData and metadata
  const properties = {
    woodType: metadata.woodType || materialData.woodType,
    grade: metadata.grade || materialData.grade,
    construction: metadata.construction || materialData.construction,
    hardness: metadata.hardness || materialData.hardness,
    installationSystem: metadata.installationSystem || materialData.installationSystem,
    moisture: metadata.moisture || materialData.moisture,
    stability: metadata.stability || materialData.stability,
    underfloorHeating: metadata.underfloorHeating || materialData.underfloorHeating
  };
  
  // Add non-null properties to additionalProperties
  Object.entries(properties).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formattedResponse.additionalProperties![key] = value;
    }
  });
}

/**
 * Extracts generic lighting metadata when type guards don't work
 */
function extractGenericLightingMetadata(
  formattedResponse: FormattedMaterialResponse, 
  materialData: MaterialData, 
  metadata: MaterialMetadata
): void {
  // Extract common lighting properties from both materialData and metadata
  const properties = {
    lightingType: metadata.lightingType || materialData.lightingType,
    bulbType: metadata.bulbType || materialData.bulbType,
    bulbIncluded: metadata.bulbIncluded || materialData.bulbIncluded,
    wattage: metadata.wattage || materialData.wattage,
    lumens: metadata.lumens || materialData.lumens,
    colorTemperature: metadata.colorTemperature || materialData.colorTemperature,
    cri: metadata.cri || materialData.cri,
    dimmable: metadata.dimmable || materialData.dimmable,
    ipRating: metadata.ipRating || materialData.ipRating,
    voltage: metadata.voltage || materialData.voltage,
    energyClass: metadata.energyClass || materialData.energyClass,
    controlSystem: metadata.controlSystem || materialData.controlSystem
  };
  
  // Add non-null properties to additionalProperties
  Object.entries(properties).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formattedResponse.additionalProperties![key] = value;
    }
  });
}

/**
 * Extracts generic furniture metadata when type guards don't work
 */
function extractGenericFurnitureMetadata(
  formattedResponse: FormattedMaterialResponse, 
  materialData: MaterialData, 
  metadata: MaterialMetadata
): void {
  // Extract common furniture properties from both materialData and metadata
  const properties = {
    furnitureType: metadata.furnitureType || materialData.furnitureType,
    style: metadata.style || materialData.style,
    weightCapacity: metadata.weightCapacity || materialData.weightCapacity,
    assembly: metadata.assembly || materialData.assembly,
    cushionFilling: metadata.cushionFilling || materialData.cushionFilling,
    upholstery: metadata.upholstery || materialData.upholstery,
    frameConstruction: metadata.frameConstruction || materialData.frameConstruction,
    adjustable: metadata.adjustable || materialData.adjustable,
    outdoor: metadata.outdoor || materialData.outdoor,
    features: metadata.features || materialData.features
  };
  
  // Add non-null properties to additionalProperties
  Object.entries(properties).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formattedResponse.additionalProperties![key] = value;
    }
  });
}

/**
 * Extracts generic decoration metadata when type guards don't work
 */
function extractGenericDecorationMetadata(
  formattedResponse: FormattedMaterialResponse, 
  materialData: MaterialData, 
  metadata: MaterialMetadata
): void {
  // Extract common decoration properties from both materialData and metadata
  const properties = {
    decorationType: metadata.decorationType || materialData.decorationType,
    style: metadata.style || materialData.style,
    theme: metadata.theme || materialData.theme,
    technique: metadata.technique || materialData.technique,
    occasion: metadata.occasion || materialData.occasion,
    setSize: metadata.setSize || materialData.setSize,
    careInstructions: metadata.careInstructions || materialData.careInstructions,
    indoor: metadata.indoor || materialData.indoor,
    mountingType: metadata.mountingType || materialData.mountingType,
    fragile: metadata.fragile || materialData.fragile
  };
  
  // Add non-null properties to additionalProperties
  Object.entries(properties).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formattedResponse.additionalProperties![key] = value;
    }
  });
}

/**
 * Generate a user-friendly description of a material based on its metadata
 * 
 * @param materialData The formatted material data
 * @returns A string with a comprehensive description of the material
 */
export function generateMaterialDescription(formattedMaterial: FormattedMaterialResponse): string {
  const parts: string[] = [];
  
  // Basic information
  parts.push(`**${formattedMaterial.name}** is a ${formattedMaterial.materialType.toLowerCase()} material`);
  
  // Add manufacturer if available
  if (formattedMaterial.manufacturer) {
    parts[0] += ` manufactured by ${formattedMaterial.manufacturer}`;
  }
  
  // Add collection if available
  if (formattedMaterial.collection) {
    parts[0] += ` from the ${formattedMaterial.collection} collection`;
  }
  
  parts[0] += '.';
  
  // Add description if available
  if (formattedMaterial.description) {
    parts.push(formattedMaterial.description);
  }
  
  // Add available colors
  if (formattedMaterial.availableColors && formattedMaterial.availableColors.length > 0) {
    if (formattedMaterial.availableColors.length === 1) {
      parts.push(`It comes in ${formattedMaterial.availableColors[0]}.`);
    } else {
      parts.push(`Available colors: ${formattedMaterial.availableColors.join(', ')}.`);
    }
  }
  
  // Add available sizes
  if (formattedMaterial.availableSizes && formattedMaterial.availableSizes.length > 0) {
    if (formattedMaterial.availableSizes.length === 1) {
      parts.push(`Available in size: ${formattedMaterial.availableSizes[0]}.`);
    } else {
      parts.push(`Available sizes: ${formattedMaterial.availableSizes.join(', ')}.`);
    }
  }
  
  // Add finish if available
  if (formattedMaterial.finish) {
    parts.push(`Finish: ${formattedMaterial.finish}.`);
  }
  
  // Add pattern if available
  if (formattedMaterial.pattern) {
    parts.push(`Pattern: ${formattedMaterial.pattern}.`);
  }
  
  // Add texture if available
  if (formattedMaterial.texture) {
    parts.push(`Texture: ${formattedMaterial.texture}.`);
  }
  
  // Add material-specific information
  if (formattedMaterial.additionalProperties && Object.keys(formattedMaterial.additionalProperties).length > 0) {
    parts.push("**Additional specifications:**");
    
    // Create a list of specifications
    const specsList: string[] = [];
    
    Object.entries(formattedMaterial.additionalProperties)
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Format the key to be more readable
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
          
          specsList.push(`- ${formattedKey}: ${value}`);
        }
      });
    
    parts.push(specsList.join('\n'));
  }
  
  // Add technical specifications if available
  if (formattedMaterial.technicalSpecs && Object.keys(formattedMaterial.technicalSpecs).length > 0) {
    parts.push("**Technical specifications:**");
    
    // Create a list of technical specifications
    const techSpecsList: string[] = [];
    
    Object.entries(formattedMaterial.technicalSpecs)
      .forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Format the key to be more readable
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
          
          techSpecsList.push(`- ${formattedKey}: ${value}`);
        }
      });
    
    parts.push(techSpecsList.join('\n'));
  }
  
  return parts.join('\n\n');
}

/**
 * Formats an array of material search results with comprehensive metadata
 * 
 * @param materials Array of material search results
 * @returns An array of formatted material responses
 */
export function formatMaterialSearchResults(materials: MaterialData[]): FormattedMaterialResponse[] {
  return materials.map(material => formatMaterialMetadata(material));
}

export default {
  formatMaterialMetadata,
  generateMaterialDescription,
  formatMaterialSearchResults
};