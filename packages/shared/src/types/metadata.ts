/**
 * Material Metadata Types
 * 
 * Type definitions for material metadata fields based on material categories.
 * These types provide structure for material metadata across the application.
 */

/**
 * Global metadata fields that apply to all material types
 */
export interface GlobalMetadata {
  manufacturer?: string;
  collection?: string;
  productCode?: string;
  year?: number;
  countryOfOrigin?: string;
  warranty?: string;
  certifications?: string;
  applicationArea?: string;
  price?: 'Budget' | 'Mid-range' | 'Premium' | 'Luxury';
  // Using string type to allow for different sustainability classifications per material type
  sustainability?: string;
}

/**
 * Tile-specific metadata fields
 */
export interface TileMetadata extends GlobalMetadata {
  vRating?: 'V1' | 'V2' | 'V3' | 'V4';
  rRating?: 'R9' | 'R10' | 'R11' | 'R12' | 'R13';
  size: string; // Format like "60x60", "30x60"
  thickness: number; // In mm
  waterAbsorption?: 'BIa (≤0.5%)' | 'BIb (0.5-3%)' | 'BIIa (3-6%)' | 'BIIb (6-10%)' | 'BIII (>10%)';
  frostResistance?: boolean;
  peiRating?: 'PEI I' | 'PEI II' | 'PEI III' | 'PEI IV' | 'PEI V';
  moh?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
  material: 'Ceramic' | 'Porcelain' | 'Marble' | 'Granite' | 'Terracotta' | 'Quartzite' | 'Limestone' | 'Slate' | 'Glass' | 'Cement';
  finish: 'Matte' | 'Glossy' | 'Polished' | 'Honed' | 'Textured' | 'Lappato' | 'Semi-polished' | 'Natural' | 'Structured' | 'Satin';
  color: string;
  usage: 'Floor' | 'Wall' | 'Floor & Wall' | 'Outdoor' | 'Indoor' | 'Bathroom' | 'Kitchen' | 'Living Room' | 'Commercial';
  rectified?: boolean;
  antibacterial?: boolean;
}

/**
 * Wood-specific metadata fields
 */
export interface WoodMetadata extends GlobalMetadata {
  woodType: string; // Oak, Maple, Walnut, etc.
  grade?: 'Prime' | 'Select' | 'Natural' | 'Rustic' | 'Character';
  construction: 'Solid' | 'Engineered' | 'Laminate' | 'Veneer';
  thickness: number; // In mm
  width: number; // In mm
  length: number; // In mm
  finish: 'Oiled' | 'Lacquered' | 'Waxed' | 'Brushed' | 'Untreated' | 'Smoked' | 'Distressed';
  color: string;
  hardness?: number; // Janka hardness rating
  installationSystem?: 'Tongue & Groove' | 'Click System' | 'Glue-Down' | 'Floating' | 'Nail-Down';
  moisture?: number; // Percentage
  stability?: 'Low' | 'Medium' | 'High';
  underfloorHeating?: boolean;
}

/**
 * Lighting-specific metadata fields
 */
export interface LightingMetadata extends GlobalMetadata {
  lightingType: 'Pendant' | 'Chandelier' | 'Wall Sconce' | 'Table Lamp' | 'Floor Lamp' | 'Ceiling Light' | 'Track Light' | 'Recessed Light' | 'LED Strip';
  bulbType: 'LED' | 'Incandescent' | 'Halogen' | 'Fluorescent' | 'CFL' | 'Smart Bulb';
  bulbIncluded?: boolean;
  wattage: number; // In watts
  lumens?: number;
  colorTemperature?: 'Warm White (2700K-3000K)' | 'Neutral White (3500K-4100K)' | 'Cool White (5000K-6500K)';
  cri?: number; // Color Rendering Index (70-100)
  dimmable?: boolean;
  ipRating?: 'IP20' | 'IP44' | 'IP54' | 'IP65' | 'IP67';
  material: string;
  dimensions: string; // Format like "30x20x15"
  weight?: number; // In kg
  voltage: number; // In volts
  energyClass?: 'A+++' | 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  controlSystem?: 'Switch' | 'Remote' | 'Smart App' | 'Voice' | 'Motion Sensor' | 'Touch';
}

/**
 * Furniture-specific metadata fields
 */
export interface FurnitureMetadata extends Omit<GlobalMetadata, 'sustainability'> {
  furnitureType: string; // Chair, Table, Sofa, etc.
  style: string; // Modern, Scandinavian, etc.
  material: string; // Wood, Metal, Glass, etc.
  color: string;
  dimensions: string; // Format like "80x60x120"
  weight?: number; // In kg
  weightCapacity?: number; // In kg
  assembly?: boolean;
  cushionFilling?: 'Foam' | 'Memory Foam' | 'Down' | 'Polyester' | 'Feather' | 'Spring';
  upholstery?: string;
  frameConstruction?: 'Solid Wood' | 'Plywood' | 'MDF' | 'Metal' | 'Particle Board';
  adjustable?: boolean;
  outdoor?: boolean;
  sustainability?: 'FSC Certified' | 'Recycled Materials' | 'Low-VOC' | 'GREENGUARD' | 'None';
  features?: string;
}

/**
 * Decoration-specific metadata fields
 */
export interface DecorationMetadata extends Omit<GlobalMetadata, 'sustainability'> {
  decorationType: string; // Wall Art, Vase, Sculpture, etc.
  style: string; // Modern, Scandinavian, etc.
  material: string; // Ceramic, Glass, Metal, etc.
  color: string;
  dimensions: string;
  theme?: string;
  technique?: string;
  occasion?: string;
  setSize?: number; // Number of pieces in a set
  careInstructions?: string;
  indoor?: 'Indoor Only' | 'Outdoor Only' | 'Indoor/Outdoor';
  mountingType?: 'Wall Mounted' | 'Tabletop' | 'Freestanding' | 'Hanging' | 'Floor Standing';
  fragile?: boolean;
  sustainability?: 'Recycled Materials' | 'Biodegradable' | 'Sustainable Source' | 'Fair Trade' | 'Handcrafted' | 'None';
}

/**
 * Union type representing all possible material metadata types
 */
export type MaterialMetadata = 
  | TileMetadata 
  | WoodMetadata 
  | LightingMetadata 
  | FurnitureMetadata 
  | DecorationMetadata;

/**
 * Type guard to check if metadata is for Tile
 */
export function isTileMetadata(metadata: any): metadata is TileMetadata {
  return metadata && 
    (metadata.rRating !== undefined || 
     metadata.vRating !== undefined || 
     (metadata.material && 
      ['Ceramic', 'Porcelain', 'Marble', 'Granite', 'Terracotta', 'Quartzite', 'Limestone', 'Slate', 'Glass', 'Cement'].includes(metadata.material)));
}

/**
 * Type guard to check if metadata is for Wood
 */
export function isWoodMetadata(metadata: any): metadata is WoodMetadata {
  return metadata && 
    (metadata.woodType !== undefined || 
     metadata.construction !== undefined ||
     (metadata.material && metadata.material.toLowerCase().includes('wood')));
}

/**
 * Type guard to check if metadata is for Lighting
 */
export function isLightingMetadata(metadata: any): metadata is LightingMetadata {
  return metadata && 
    (metadata.lightingType !== undefined || 
     metadata.bulbType !== undefined ||
     metadata.wattage !== undefined);
}

/**
 * Type guard to check if metadata is for Furniture
 */
export function isFurnitureMetadata(metadata: any): metadata is FurnitureMetadata {
  return metadata && 
    (metadata.furnitureType !== undefined || 
     metadata.cushionFilling !== undefined ||
     metadata.weightCapacity !== undefined);
}

/**
 * Type guard to check if metadata is for Decoration
 */
export function isDecorationMetadata(metadata: any): metadata is DecorationMetadata {
  return metadata && 
    (metadata.decorationType !== undefined || 
     metadata.mountingType !== undefined ||
     metadata.setSize !== undefined);
}

/**
 * Function to get metadata field type for the admin UI
 */
export function getMetadataFieldType(
  materialType: 'tile' | 'wood' | 'lighting' | 'furniture' | 'decoration',
  fieldName: string
): 'text' | 'number' | 'dropdown' | 'boolean' | 'textarea' | 'date' {
  // Global fields
  const globalFields: Record<string, 'text' | 'number' | 'dropdown' | 'boolean' | 'textarea' | 'date'> = {
    manufacturer: 'text',
    collection: 'text',
    productCode: 'text',
    year: 'number',
    countryOfOrigin: 'text',
    warranty: 'text',
    certifications: 'text',
    applicationArea: 'dropdown',
    price: 'dropdown',
    sustainability: 'dropdown'
  };

  if (fieldName in globalFields) {
    // Type assertion to ensure non-undefined return
    return globalFields[fieldName] as 'text' | 'number' | 'dropdown' | 'boolean' | 'textarea' | 'date';
  }

  // Material-specific fields
  const fieldTypes: Record<string, Record<string, 'text' | 'number' | 'dropdown' | 'boolean' | 'textarea' | 'date'>> = {
    tile: {
      vRating: 'dropdown',
      rRating: 'dropdown',
      size: 'text',
      thickness: 'number',
      waterAbsorption: 'dropdown',
      frostResistance: 'boolean',
      peiRating: 'dropdown',
      moh: 'dropdown',
      material: 'dropdown',
      finish: 'dropdown',
      color: 'dropdown',
      usage: 'dropdown',
      rectified: 'boolean',
      antibacterial: 'boolean'
    },
    wood: {
      woodType: 'dropdown',
      grade: 'dropdown',
      construction: 'dropdown',
      thickness: 'number',
      width: 'number',
      length: 'number',
      finish: 'dropdown',
      color: 'dropdown',
      hardness: 'number',
      installationSystem: 'dropdown',
      moisture: 'number',
      stability: 'dropdown',
      underfloorHeating: 'boolean'
    },
    lighting: {
      lightingType: 'dropdown',
      bulbType: 'dropdown',
      bulbIncluded: 'boolean',
      wattage: 'number',
      lumens: 'number',
      colorTemperature: 'dropdown',
      cri: 'number',
      dimmable: 'boolean',
      ipRating: 'dropdown',
      material: 'dropdown',
      dimensions: 'text',
      weight: 'number',
      voltage: 'number',
      energyClass: 'dropdown',
      controlSystem: 'dropdown'
    },
    furniture: {
      furnitureType: 'dropdown',
      style: 'dropdown',
      material: 'dropdown',
      color: 'dropdown',
      dimensions: 'text',
      weight: 'number',
      weightCapacity: 'number',
      assembly: 'boolean',
      cushionFilling: 'dropdown',
      upholstery: 'dropdown',
      frameConstruction: 'dropdown',
      adjustable: 'boolean',
      outdoor: 'boolean',
      sustainability: 'dropdown',
      features: 'textarea'
    },
    decoration: {
      decorationType: 'dropdown',
      style: 'dropdown',
      material: 'dropdown',
      color: 'dropdown',
      dimensions: 'text',
      theme: 'dropdown',
      technique: 'dropdown',
      occasion: 'dropdown',
      setSize: 'number',
      careInstructions: 'textarea',
      indoor: 'dropdown',
      mountingType: 'dropdown',
      fragile: 'boolean',
      sustainability: 'dropdown'
    }
  };

  // Check if the material type exists and get its field types
  const materialFieldTypes = materialType in fieldTypes ? fieldTypes[materialType] : null;
  
  // If we have field types for this material and the field exists, return its type
  if (materialFieldTypes && fieldName in materialFieldTypes) {
    return materialFieldTypes[fieldName] as 'text' | 'number' | 'dropdown' | 'boolean' | 'textarea' | 'date';
  }

  // Default to text if not found
  return 'text';
}