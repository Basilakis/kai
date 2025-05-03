/**
 * Tile Field Descriptions
 * 
 * This file contains detailed descriptions for all tile metadata fields.
 * These descriptions are used for:
 * 1. Tooltips in the admin UI
 * 2. Documentation for API users
 * 3. Training data for AI models
 * 4. Context for OCR extraction
 */

export const tileFieldDescriptions: Record<string, string> = {
  // Physical properties
  size: "The dimensions of the tile, typically expressed as width x length in centimeters or inches (e.g., '60x60', '30x60'). For non-rectangular tiles, this may represent the primary dimensions.",
  thickness: "The thickness of the tile measured in millimeters. Standard tiles range from 6mm to 20mm, with thin tiles at 3-6mm and thick pavers at 20mm+.",
  material: "The primary material composition of the tile. Common types include Ceramic (clay-based, fired at lower temperatures), Porcelain (dense, less porous, fired at higher temperatures), and various natural stones.",
  color: "The primary color or color family of the tile. May include specific color names used by the manufacturer.",
  weight: "The weight of the tile per square meter (kg/m²). Important for structural considerations, especially for wall installations.",
  
  // Format/Shape
  format: "The geometric shape and size category of the tile. Affects installation patterns and visual impact.",
  
  // Appearance
  finish: "The surface treatment or texture of the tile. Affects appearance, slip resistance, and maintenance requirements.",
  pattern: "The decorative design or motif on the tile surface. May be printed, embossed, or created through material variations.",
  texture: "The tactile quality of the tile surface. Can be smooth, textured, embossed, or have other physical surface variations.",
  surface: "The overall surface quality and treatment. May include special coatings or technical surface treatments.",
  edgeType: "The treatment of the tile edges. Rectified edges are precisely cut for minimal grout lines, while other types may have bevels or irregular edges.",
  rectified: "Indicates whether the tile edges have been precisely cut at 90° angles after firing for exact dimensions and minimal grout lines.",
  
  // Technical properties
  vRating: "Shade Variation rating (V1-V4) indicating the degree of color and pattern variation between individual tiles. V1 is uniform, V4 has substantial variations.",
  rRating: "Slip Resistance rating (R9-R13) based on the German DIN standard. Higher numbers indicate greater slip resistance, with R9 for residential and R13 for industrial/wet areas.",
  waterAbsorption: "The amount of water a tile can absorb, expressed as a percentage of its weight. Lower absorption (BIa ≤0.5%) indicates greater density and frost resistance.",
  frostResistance: "Indicates whether the tile can withstand freezing conditions without cracking or damage. Essential for outdoor installations in cold climates.",
  peiRating: "Porcelain Enamel Institute rating (PEI I-V) indicating the tile's resistance to surface wear. Higher ratings indicate greater durability and suitability for high-traffic areas.",
  moh: "Mohs hardness scale (1-10) measuring scratch resistance. Higher numbers indicate harder materials (diamond=10). Most ceramic tiles range from 5-7.",
  chemicalResistance: "The tile's ability to resist damage from chemicals, cleaning agents, and staining substances. Important for kitchen and industrial applications.",
  stainResistance: "The tile's ability to resist permanent staining from common household substances. Important for kitchen and high-use areas.",
  fireRating: "Classification of the tile's fire resistance properties according to relevant standards. Important for commercial and high-rise applications.",
  heatResistance: "The tile's ability to withstand high temperatures without damage. Important for fireplace surrounds, kitchen backsplashes, and outdoor applications.",
  soundInsulation: "The tile's acoustic properties and ability to reduce sound transmission. Relevant for multi-story buildings and noise-sensitive environments.",
  
  // Usage and application
  usage: "The primary intended installation location or purpose of the tile. Determines suitability for specific applications.",
  applicationArea: "The specific environment where the tile is suitable for installation. Considers factors like moisture, traffic, and exposure.",
  installationType: "The recommended method for installing the tile. Affects preparation, materials needed, and installation complexity.",
  antibacterial: "Indicates whether the tile has been treated with antibacterial agents or has inherent antibacterial properties. Important for healthcare and food preparation areas.",
  lookType: "The visual style or material the tile is designed to resemble (e.g., wood-look, marble-look). Describes the aesthetic category.",
  specialtyType: "Indicates if the tile belongs to a specialty category with specific technical or design features beyond standard tiles.",
  
  // Commercial information
  batchNumber: "The production batch identifier. Important for ensuring color consistency when ordering, as slight variations can occur between batches.",
  packaging: "Information about how the tiles are packaged, including quantity per box, square meters per box, and box weight.",
  availability: "The current stock status or availability category of the tile. Helps manage customer expectations for ordering.",
  sku: "Stock Keeping Unit or product code. The manufacturer's unique identifier for the specific tile product.",
  barcode: "The machine-readable product identifier used for inventory and point-of-sale systems.",
  
  // Global metadata fields
  manufacturer: "The company that produced the tile. Important for sourcing, warranty, and quality expectations.",
  collection: "The product line or collection name assigned by the manufacturer. Tiles within a collection typically share design elements and are intended to work together.",
  productCode: "The manufacturer's code or identifier for the specific product. May differ from the SKU used by retailers.",
  year: "The year when the tile design was introduced or manufactured. Helps identify older products for replacements or renovations.",
  countryOfOrigin: "The country where the tile was manufactured. May affect pricing, quality perceptions, and import considerations.",
  warranty: "Details about the manufacturer's warranty terms, including duration and covered defects.",
  certifications: "Official quality, environmental, or performance certifications the tile has received. May include industry standards compliance.",
  applicationArea: "The recommended environments and spaces where the tile is suitable for installation.",
  price: "The price category or range of the tile. Helps with budgeting and comparing options.",
  sustainability: "Information about the tile's environmental impact, recycled content, or eco-friendly manufacturing processes."
};
