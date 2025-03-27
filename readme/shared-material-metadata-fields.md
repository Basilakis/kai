# Material Metadata Fields

This document defines metadata fields for different material categories in the system. These fields will be used in the admin panel for displaying, filtering and sorting materials, as well as providing extraction hints for AI processing when importing materials from PDFs or websites.

## Global Fields

These fields apply to all material types:

| Field Name | Display Name | Type | Required | Description | Extraction Hints |
|------------|--------------|------|----------|-------------|------------------|
| manufacturer | Manufacturer | text | yes | Company that produces the material | Look for company logo, "manufactured by", or prominent branding |
| collection | Collection | text | no | Product collection or series name | Near "collection", "series", or as a prominent subtitle |
| productCode | Product Code | text | no | Manufacturer's product code/reference | Pattern "Ref:", "Code:", "Art. Nr.", alphanumeric code |
| year | Year | number | no | Year of production/release | Four-digit year, often near copyright or catalog information |
| countryOfOrigin | Country of Origin | text | no | Manufacturing country | "Made in", "Produced in", "Origin:" |
| warranty | Warranty | text | no | Warranty information | Near "warranty", "guarantee", often as "X years" |
| certifications | Certifications | text | no | Product certifications | Look for certification logos, "Certified by", certification codes |
| applicationArea | Application Area | dropdown | no | Where the material can be used | "Suitable for", "Application:", "Recommended use:" |
| price | Price Range | dropdown | no | Price category | Look for price indicators, "$", "€", "price category" |
| sustainability | Sustainability | dropdown | no | Environmental friendliness rating | "Eco-rating", "Environmental impact", "Green score" |

## Tile-specific Fields

| Field Name | Display Name | Type | Required | Description | Extraction Hints | Validation/Options |
|------------|--------------|------|----------|-------------|------------------|-------------------|
| vRating | V-Rating | dropdown | no | Version/variation of patterns | "V Rating:", "Variation:", "V2", "V3", "V4" | Options: V1, V2, V3, V4 |
| rRating | R-Rating | dropdown | no | Slip resistance rating (Ramp Test) | "R Rating:", "Slip resistance:", "R9", "R10", "R11", "R12", "R13" | Options: R9, R10, R11, R12, R13 |
| size | Size | text | yes | Dimensions in cm or mm | "Format:", "Size:", "Dimensions:", patterns like "60x60", "30x60" | Regex: ^\d+x\d+(\.\d+)?$ |
| thickness | Thickness | number | yes | Material thickness in mm | "Thickness:", "Height:", often followed by "mm" | Min: 3, Max: 30, Unit: mm |
| waterAbsorption | Water Absorption | dropdown | no | Water absorption class | "Water absorption:", "Absorption class:", "E ≤ 0.5%" | Options: BIa (≤0.5%), BIb (0.5-3%), BIIa (3-6%), BIIb (6-10%), BIII (>10%) |
| frostResistance | Frost Resistance | boolean | no | Whether the tile is frost resistant | "Frost resistant:", "Suitable for outdoors", "Frost proof" | |
| peiRating | PEI Rating | dropdown | no | Surface abrasion resistance | "PEI:", "Abrasion class:", "PEI II", "Class 3" | Options: PEI I, PEI II, PEI III, PEI IV, PEI V |
| moh | Mohs Hardness | dropdown | no | Surface hardness | "Mohs:", "Hardness:", "Mohs scale" | Options: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 |
| material | Material | dropdown | yes | Type of tile material | "Material:", "Type:" | Options: Ceramic, Porcelain, Marble, Granite, Terracotta, Quartzite, Limestone, Slate, Glass, Cement |
| finish | Finish | dropdown | yes | Surface finish | "Finish:", "Surface:" | Options: Matte, Glossy, Polished, Honed, Textured, Lappato, Semi-polished, Natural, Structured, Satin |
| color | Color | dropdown | yes | Predominant color | Look for color descriptions, often prominently displayed | Options: White, Black, Gray, Beige, Brown, Red, Blue, Green, Yellow, Multicolor, etc. |
| usage | Usage Area | dropdown | yes | Recommended installation areas | "Application:", "Suitable for:", "Usage:" | Options: Floor, Wall, Floor & Wall, Outdoor, Indoor, Bathroom, Kitchen, Living Room, Commercial |
| rectified | Rectified | boolean | no | Whether the tile edges are precisely cut | "Rectified:", "Calibrated edges:" | |
| antibacterial | Antibacterial | boolean | no | Has antibacterial properties | "Antibacterial:", "Hygienic properties:" | |

## Wood-specific Fields

| Field Name | Display Name | Type | Required | Description | Extraction Hints | Validation/Options |
|------------|--------------|------|----------|-------------|------------------|-------------------|
| woodType | Wood Type | dropdown | yes | Type of wood | "Species:", "Wood type:", "Material:" | Options: Oak, Maple, Cherry, Walnut, Pine, Birch, Ash, Mahogany, Teak, Bamboo, etc. |
| grade | Grade | dropdown | no | Quality/appearance grade | "Grade:", "Quality:", "Class:" | Options: Prime, Select, Natural, Rustic, Character |
| construction | Construction | dropdown | yes | How the wood is constructed | "Construction:", "Structure:" | Options: Solid, Engineered, Laminate, Veneer |
| thickness | Thickness | number | yes | Material thickness in mm | "Thickness:", "Height:" | Min: 7, Max: 22, Unit: mm |
| width | Width | number | yes | Plank width in mm | "Width:", "Plank width:" | Min: 80, Max: 300, Unit: mm |
| length | Length | number | yes | Plank length in mm | "Length:", "Plank length:" | Min: 300, Max: 2500, Unit: mm |
| finish | Finish | dropdown | yes | Surface treatment | "Finish:", "Surface treatment:" | Options: Oiled, Lacquered, Waxed, Brushed, Untreated, Smoked, Distressed |
| color | Color | dropdown | yes | Predominant color/tone | Look for color descriptions | Options: Light, Medium, Dark, White, Golden, Brown, Gray, Black, etc. |
| hardness | Hardness (Janka) | number | no | Janka hardness rating | "Janka hardness:", "Hardness rating:" | Min: 300, Max: 4000 |
| installationSystem | Installation System | dropdown | no | How planks connect | "Installation:", "Fitting system:" | Options: Tongue & Groove, Click System, Glue-Down, Floating, Nail-Down |
| moisture | Moisture Content | number | no | Wood moisture percentage | "Moisture content:", "Humidity:" | Min: 5, Max: 12, Unit: % |
| stability | Dimensional Stability | dropdown | no | How stable under humidity changes | "Stability:", "Dimensional changes:" | Options: Low, Medium, High |
| underfloorHeating | Suitable for Underfloor Heating | boolean | no | Compatible with heated floors | "Underfloor heating:", "UFH compatible:" | |

## Lighting-specific Fields

| Field Name | Display Name | Type | Required | Description | Extraction Hints | Validation/Options |
|------------|--------------|------|----------|-------------|------------------|-------------------|
| lightingType | Lighting Type | dropdown | yes | Type of lighting fixture | "Type:", "Product type:" | Options: Pendant, Chandelier, Wall Sconce, Table Lamp, Floor Lamp, Ceiling Light, Track Light, Recessed Light, LED Strip |
| bulbType | Bulb Type | dropdown | yes | Type of bulb required | "Bulb:", "Light source:", "Lamp type:" | Options: LED, Incandescent, Halogen, Fluorescent, CFL, Smart Bulb |
| bulbIncluded | Bulb Included | boolean | no | Whether bulbs come with the fixture | "Bulbs included:", "Includes bulb:" | |
| wattage | Wattage | number | yes | Power consumption in watts | "Wattage:", "Power:", "...W" | Min: 1, Max: 1000, Unit: W |
| lumens | Lumens | number | no | Brightness output | "Lumens:", "Light output:", "Brightness:" | Min: 10, Max: 50000, Unit: lm |
| colorTemperature | Color Temperature | dropdown | no | Light warmth/coolness | "Color temperature:", "Kelvin:", "Warm white" | Options: Warm White (2700K-3000K), Neutral White (3500K-4100K), Cool White (5000K-6500K) |
| cri | CRI | number | no | Color Rendering Index | "CRI:", "Color rendering index:" | Min: 70, Max: 100 |
| dimmable | Dimmable | boolean | no | Whether light can be dimmed | "Dimmable:", "Dimming:" | |
| ipRating | IP Rating | dropdown | no | Dust/water resistance | "IP rating:", "Protection class:" | Options: IP20, IP44, IP54, IP65, IP67 |
| material | Material | dropdown | yes | Primary material of fixture | "Material:", "Made of:" | Options: Metal, Glass, Plastic, Wood, Fabric, Ceramic, Concrete, Crystal |
| dimensions | Dimensions | text | yes | Size of the fixture | "Dimensions:", "Size:", "Measurements:" | Regex: ^(\d+(\.\d+)? *x *\d+(\.\d+)? *x *\d+(\.\d+)?)$|
| weight | Weight | number | no | Weight of the fixture in kg | "Weight:", "...kg" | Min: 0.1, Max: 100, Unit: kg |
| voltage | Voltage | number | yes | Operating voltage | "Voltage:", "...V" | Min: 12, Max: 240, Unit: V |
| energyClass | Energy Efficiency Class | dropdown | no | Energy efficiency rating | "Energy class:", "Energy rating:" | Options: A+++, A++, A+, A, B, C, D, E, F, G |
| controlSystem | Control System | dropdown | no | How the light is controlled | "Control:", "Operation:" | Options: Switch, Remote, Smart App, Voice, Motion Sensor, Touch |

## Furniture-specific Fields

| Field Name | Display Name | Type | Required | Description | Extraction Hints | Validation/Options |
|------------|--------------|------|----------|-------------|------------------|-------------------|
| furnitureType | Furniture Type | dropdown | yes | Category of furniture | "Type:", "Category:" | Options: Chair, Table, Sofa, Bed, Shelf, Cabinet, Desk, Stool, Armchair, Dresser, Wardrobe, Bookcase, Ottoman |
| style | Style | dropdown | yes | Design style | "Style:", "Design:" | Options: Modern, Scandinavian, Industrial, Traditional, Mid-Century, Rustic, Minimalist, Contemporary, Bohemian, Art Deco |
| material | Primary Material | dropdown | yes | Main material | "Material:", "Made of:" | Options: Wood, Metal, Glass, Plastic, Fabric, Leather, Rattan, Stone, Marble, Composite |
| color | Color | dropdown | yes | Predominant color | Look for color descriptions | Options: White, Black, Gray, Beige, Brown, Blue, Green, Red, Yellow, Orange, Multicolor |
| dimensions | Dimensions | text | yes | Size (Width x Depth x Height) | "Dimensions:", "Measurements:", "Size:" | Regex: ^(\d+(\.\d+)? *x *\d+(\.\d+)? *x *\d+(\.\d+)?)$|
| weight | Weight | number | no | Weight in kg | "Weight:", "...kg" | Min: 0.5, Max: 500, Unit: kg |
| weightCapacity | Weight Capacity | number | no | Maximum load capacity | "Weight capacity:", "Max load:", "Supports up to:" | Min: 1, Max: 1000, Unit: kg |
| assembly | Assembly Required | boolean | no | Whether product needs assembly | "Assembly required:", "Self-assembly:" | |
| cushionFilling | Cushion Filling | dropdown | no | Type of filling in cushions | "Filling:", "Cushion material:" | Options: Foam, Memory Foam, Down, Polyester, Feather, Spring |
| upholstery | Upholstery Material | dropdown | no | Fabric covering type | "Upholstery:", "Cover material:" | Options: Cotton, Linen, Polyester, Velvet, Leather, Faux Leather, Wool, Microfiber |
| frameConstruction | Frame Construction | dropdown | no | Frame material/construction | "Frame:", "Structure:" | Options: Solid Wood, Plywood, MDF, Metal, Particle Board |
| adjustable | Adjustable | boolean | no | Has adjustable features | "Adjustable:", "Configurable:" | |
| outdoor | Suitable for Outdoor | boolean | no | Can be used outdoors | "Outdoor:", "Weather resistant:", "Indoor/Outdoor:" | |
| sustainability | Sustainability | dropdown | no | Environmental certification | "Sustainability:", "Eco-friendly:", "Environmental:" | Options: FSC Certified, Recycled Materials, Low-VOC, GREENGUARD, None |
| features | Special Features | text | no | Additional notable features | "Features:", "Special:", "Also includes:" | |

## Decoration-specific Fields

| Field Name | Display Name | Type | Required | Description | Extraction Hints | Validation/Options |
|------------|--------------|------|----------|-------------|------------------|-------------------|
| decorationType | Decoration Type | dropdown | yes | Type of decorative item | "Type:", "Category:" | Options: Wall Art, Vase, Sculpture, Mirror, Candle Holder, Rug, Cushion, Throw, Clock, Bookend, Plant Pot, Figurine |
| style | Style | dropdown | yes | Design style | "Style:", "Design:" | Options: Modern, Scandinavian, Industrial, Traditional, Mid-Century, Rustic, Minimalist, Contemporary, Bohemian, Art Deco |
| material | Material | dropdown | yes | Primary material | "Material:", "Made of:" | Options: Ceramic, Glass, Metal, Wood, Textile, Paper, Plastic, Stone, Resin, Concrete |
| color | Color | dropdown | yes | Predominant color | Look for color descriptions | Options: White, Black, Gray, Beige, Brown, Blue, Green, Red, Yellow, Gold, Silver, Multicolor |
| dimensions | Dimensions | text | yes | Size in cm | "Dimensions:", "Size:", "Measurements:" | |
| theme | Theme | dropdown | no | Thematic design element | "Theme:", "Inspiration:" | Options: Geometric, Floral, Abstract, Nature, Animal, Architectural, Seasonal, Coastal, Ethnic, Typography |
| technique | Technique | dropdown | no | Production technique | "Technique:", "Process:", "Handmade:" | Options: Handmade, Machine-made, Hand-painted, Printed, Carved, Woven, Cast, Blown, Embroidered |
| occasion | Occasion | dropdown | no | If specific to an occasion | "Occasion:", "Perfect for:" | Options: Everyday, Holiday, Christmas, Halloween, Wedding, Birthday, Anniversary, Housewarming |
| setSize | Set Size | number | no | Number of pieces in a set | "Set of:", "Pieces:", "Quantity:" | Min: 1, Max: 100 |
| careInstructions | Care Instructions | text | no | How to clean/maintain | "Care:", "Cleaning:", "Maintenance:" | |
| indoor | Indoor/Outdoor | dropdown | no | Where it can be used | "Indoor/Outdoor:", "Suitable for:" | Options: Indoor Only, Outdoor Only, Indoor/Outdoor |
| mountingType | Mounting Type | dropdown | no | How to install/display | "Mounting:", "Installation:", "Hanging:" | Options: Wall Mounted, Tabletop, Freestanding, Hanging, Floor Standing |
| fragile | Fragile | boolean | no | Whether item is delicate | "Fragile:", "Delicate:", "Handle with care:" | |
| sustainability | Eco-Friendly | dropdown | no | Environmental aspects | "Eco-friendly:", "Sustainable:", "Recycled:" | Options: Recycled Materials, Biodegradable, Sustainable Source, Fair Trade, Handcrafted, None |

## Extraction Strategy

When extracting metadata from PDFs or websites, the system will use:

1. **Field Names**: Look for exact field names or display names in the text
2. **Extraction Hints**: Use provided hints to locate information in context
3. **Pattern Matching**: Use regular expressions to extract structured information like dimensions
4. **Visual Context**: For images, look for text near product images
5. **Common Formats**: Recognize standard industry formatting (e.g., "60x60" for tile sizes)

## Integration with Admin Panel

In the admin panel, these fields should be:

1. **Searchable**: Allow filtering and searching by field values
2. **Sortable**: Allow sorting by numeric fields (e.g., thickness, weight)
3. **Groupable**: Allow grouping by categorical fields (e.g., material type, color)
4. **Editable**: Allow admins to edit field values with appropriate validation
5. **Exportable**: Include in data exports

## Implementation Notes

When implementing these fields:

1. Create appropriate validation rules for each field type
2. Define extraction patterns for automatic import
3. Set up appropriate indexes for search performance
4. Ensure field descriptions are accessible in the UI for clarity
5. Consider localization needs for international deployments