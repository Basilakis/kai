-- Migration: 004_material_metadata_fields.sql
-- Purpose: Add metadata field definitions for materials of different types

-- Create material_metadata_fields table to store field definitions
CREATE TABLE IF NOT EXISTS public.material_metadata_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'dropdown')),
  material_type TEXT NOT NULL CHECK (material_type IN ('tile', 'wood', 'lighting', 'furniture', 'decoration', 'all')),
  category TEXT NOT NULL,
  description TEXT,
  options JSONB,
  extraction_hints JSONB,
  validation_rules JSONB,
  ui_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS material_metadata_fields_material_type_idx ON material_metadata_fields (material_type);
CREATE INDEX IF NOT EXISTS material_metadata_fields_category_idx ON material_metadata_fields (category);

-- Add RLS policies
ALTER TABLE material_metadata_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Material metadata fields are viewable by everyone" 
  ON material_metadata_fields FOR SELECT USING (true);

-- Trigger to update timestamp
CREATE TRIGGER update_material_metadata_fields_timestamp
BEFORE UPDATE ON material_metadata_fields
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- Function to find field definitions by material type
CREATE OR REPLACE FUNCTION get_metadata_fields_by_material_type(material_type_param TEXT)
RETURNS SETOF material_metadata_fields AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM material_metadata_fields
  WHERE material_type = material_type_param OR material_type = 'all'
  ORDER BY category, ui_order;
END;
$$ LANGUAGE plpgsql;

-- Function to extract metadata from text (for use with AI/ML)
CREATE OR REPLACE FUNCTION extract_metadata_fields(
  text_content TEXT,
  material_type_param TEXT
)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  field RECORD;
  extracted_value TEXT;
  pattern TEXT;
BEGIN
  -- Get all fields for this material type
  FOR field IN (
    SELECT *
    FROM material_metadata_fields
    WHERE material_type = material_type_param OR material_type = 'all'
  )
  LOOP
    -- Check if field has extraction patterns
    IF field.extraction_hints IS NOT NULL AND field.extraction_hints ? 'patterns' THEN
      -- For each pattern, try to extract value
      FOR pattern IN (
        SELECT jsonb_array_elements_text(field.extraction_hints->'patterns')
      )
      LOOP
        -- Try to extract using regex pattern
        BEGIN
          SELECT substring(text_content FROM pattern) INTO extracted_value;
          
          IF extracted_value IS NOT NULL AND extracted_value != '' THEN
            -- Handle different field types
            CASE field.field_type
              WHEN 'number' THEN
                result := jsonb_set(result, ARRAY[field.field_name], to_jsonb(extracted_value::numeric));
              WHEN 'boolean' THEN
                result := jsonb_set(result, ARRAY[field.field_name], to_jsonb(
                  CASE 
                    WHEN extracted_value ILIKE 'yes' OR extracted_value ILIKE 'true' OR extracted_value = '1' THEN true
                    ELSE false
                  END
                ));
              ELSE
                result := jsonb_set(result, ARRAY[field.field_name], to_jsonb(extracted_value));
            END CASE;
            
            -- We found a value, break out of pattern loop
            EXIT;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            -- If regex fails, try next pattern
            CONTINUE;
        END;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insert common fields for all material types
INSERT INTO material_metadata_fields (field_name, display_name, field_type, material_type, category, description, options, extraction_hints, ui_order)
VALUES
  ('manufacturer', 'Manufacturer', 'text', 'all', 'Common Properties', 'Company that manufactures the material', NULL, 
   '{"patterns": ["(?i)manufacturer:?\\s*([\\w\\s&\\.\\-]+)(?:\\n|\\r|$)", "(?i)by\\s*([\\w\\s&\\.\\-]+)(?:\\n|\\r|$)"]}', 10),
  
  ('collection', 'Collection', 'text', 'all', 'Common Properties', 'Product collection or series name', NULL, 
   '{"patterns": ["(?i)collection:?\\s*([\\w\\s&\\.\\-]+)(?:\\n|\\r|$)", "(?i)series:?\\s*([\\w\\s&\\.\\-]+)(?:\\n|\\r|$)"]}', 20),
  
  ('productCode', 'Product Code', 'text', 'all', 'Common Properties', 'Unique product identifier', NULL, 
   '{"patterns": ["(?i)product code:?\\s*([\\w\\-\\.]+)(?:\\n|\\r|$)", "(?i)item (?:code|number|#):?\\s*([\\w\\-\\.]+)(?:\\n|\\r|$)", "(?i)sku:?\\s*([\\w\\-\\.]+)(?:\\n|\\r|$)"]}', 30),
  
  ('countryOfOrigin', 'Country of Origin', 'text', 'all', 'Common Properties', 'Country where the material was produced', NULL, 
   '{"patterns": ["(?i)(?:made in|country of origin|origin):?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 40),
  
  ('warranty', 'Warranty', 'text', 'all', 'Common Properties', 'Warranty period and conditions', NULL, 
   '{"patterns": ["(?i)warranty:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 50);

-- Insert tile-specific fields
INSERT INTO material_metadata_fields (field_name, display_name, field_type, material_type, category, description, options, extraction_hints, ui_order)
VALUES
  -- Physical Properties
  ('size', 'Size', 'text', 'tile', 'Physical Properties', 'Dimensions of the tile, typically in cm', NULL, 
   '{"patterns": ["(?i)(?:size|dimensions):?\\s*(\\d+\\s*[x×]\\s*\\d+)(?:\\s*cm)?", "(?i)(\\d+\\s*[x×]\\s*\\d+)(?:\\s*cm)"]}', 100),
  
  ('thickness', 'Thickness (mm)', 'number', 'tile', 'Physical Properties', 'Thickness of the tile in mm', NULL, 
   '{"patterns": ["(?i)thickness:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm", "(?i)(\\d+(?:\\.\\d+)?)\\s*mm thick"]}', 110),
  
  ('material', 'Material', 'dropdown', 'tile', 'Physical Properties', 'Primary material of the tile', 
   '["Porcelain", "Ceramic", "Natural Stone", "Glass", "Cement", "Metal", "Terracotta"]', 
   '{"patterns": ["(?i)material:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 120),
  
  -- Technical Properties
  ('vRating', 'V-Rating', 'dropdown', 'tile', 'Technical Properties', 'Shade variation rating', 
   '["V1", "V2", "V3", "V4"]',
   '{"patterns": ["(?i)(?:shade|color) variation:?\\s*(V\\d)", "(?i)(V\\d)\\s*(?:shade|color) variation", "(?i)variation:?\\s*(V\\d)"]}', 200),
  
  ('rRating', 'R-Rating', 'dropdown', 'tile', 'Technical Properties', 'Slip resistance rating', 
   '["R9", "R10", "R11", "R12", "R13"]',
   '{"patterns": ["(?i)slip resistance:?\\s*(R\\d{1,2})", "(?i)(R\\d{1,2})\\s*slip resistance", "(?i)(?:slip|resistance) rating:?\\s*(R\\d{1,2})"]}', 210),
  
  ('waterAbsorption', 'Water Absorption', 'dropdown', 'tile', 'Technical Properties', 'Water absorption classification', 
   '["BIa (≤0.5%)", "BIb (0.5-3%)", "BIIa (3-6%)", "BIIb (6-10%)", "BIII (>10%)"]',
   '{"patterns": ["(?i)water absorption:?\\s*([^\\n\\r]+)%", "(?i)absorption\\s*(?:class|group|rating)?:?\\s*(B[I]{1,3}[a-b]?)"]}', 220),
  
  ('frostResistance', 'Frost Resistance', 'boolean', 'tile', 'Technical Properties', 'Resistant to freezing conditions', NULL, 
   '{"patterns": ["(?i)frost resistant", "(?i)frost-resistant", "(?i)frost resistance:?\\s*(yes|no|true|false)"]}', 230),
  
  ('peiRating', 'PEI Rating', 'dropdown', 'tile', 'Technical Properties', 'Porcelain Enamel Institute rating for wear resistance', 
   '["PEI I", "PEI II", "PEI III", "PEI IV", "PEI V"]',
   '{"patterns": ["(?i)PEI:?\\s*(I{1,5}|IV|V)", "(?i)PEI:?\\s*(\\d)", "(?i)wear rating:?\\s*(\\d)"]}', 240),

  -- Appearance
  ('finish', 'Finish', 'dropdown', 'tile', 'Appearance', 'Surface finish of the tile', 
   '["Matte", "Glossy", "Polished", "Honed", "Textured", "Lappato", "Semi-polished", "Natural", "Structured", "Satin"]',
   '{"patterns": ["(?i)finish:?\\s*([\\w\\-]+)(?:\\n|\\r|$)", "(?i)surface:?\\s*([\\w\\-]+)(?:\\n|\\r|$)"]}', 300),
  
  ('rectified', 'Rectified', 'boolean', 'tile', 'Appearance', 'Edges have been precisely cut for minimal grout lines', NULL, 
   '{"patterns": ["(?i)rectified", "(?i)rectified:?\\s*(yes|no|true|false)"]}', 310),
  
  -- Usage
  ('usage', 'Usage Area', 'dropdown', 'tile', 'Usage', 'Recommended installation areas', 
   '["Floor", "Wall", "Floor & Wall", "Outdoor", "Indoor", "Bathroom", "Kitchen", "Living Room", "Commercial"]',
   '{"patterns": ["(?i)recommended for:?\\s*([^\\n\\r]+)", "(?i)suitable for:?\\s*([^\\n\\r]+)", "(?i)application:?\\s*([^\\n\\r]+)"]}', 400),
  
  ('antibacterial', 'Antibacterial', 'boolean', 'tile', 'Usage', 'Has antibacterial properties', NULL, 
   '{"patterns": ["(?i)antibacterial", "(?i)anti-bacterial", "(?i)antibacterial:?\\s*(yes|no|true|false)"]}', 410);

-- Insert wood-specific fields
INSERT INTO material_metadata_fields (field_name, display_name, field_type, material_type, category, description, options, extraction_hints, ui_order)
VALUES
  -- Physical Properties
  ('woodType', 'Wood Type', 'dropdown', 'wood', 'Physical Properties', 'Type of wood', 
   '["Oak", "Maple", "Pine", "Walnut", "Cherry", "Birch", "Ash", "Hickory", "Mahogany", "Teak", "Bamboo"]', 
   '{"patterns": ["(?i)wood type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)species:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 100),
  
  ('construction', 'Construction', 'dropdown', 'wood', 'Physical Properties', 'Construction method', 
   '["Solid", "Engineered", "Laminate", "Veneer"]', 
   '{"patterns": ["(?i)construction:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 110),
  
  ('thickness', 'Thickness (mm)', 'number', 'wood', 'Physical Properties', 'Thickness in mm', NULL, 
   '{"patterns": ["(?i)thickness:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm", "(?i)(\\d+(?:\\.\\d+)?)\\s*mm thick"]}', 120),
  
  ('width', 'Width (mm)', 'number', 'wood', 'Physical Properties', 'Width in mm', NULL, 
   '{"patterns": ["(?i)width:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm", "(?i)(\\d+(?:\\.\\d+)?)\\s*mm wide"]}', 130),
  
  ('length', 'Length (mm)', 'number', 'wood', 'Physical Properties', 'Length in mm', NULL, 
   '{"patterns": ["(?i)length:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm", "(?i)(\\d+(?:\\.\\d+)?)\\s*mm long"]}', 140),
  
  -- Technical Properties
  ('grade', 'Grade', 'dropdown', 'wood', 'Technical Properties', 'Quality grade of the wood', 
   '["Prime", "Select", "Natural", "Rustic", "Character"]',
   '{"patterns": ["(?i)grade:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)quality:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 200),
  
  ('hardness', 'Janka Hardness', 'number', 'wood', 'Technical Properties', 'Janka hardness rating', NULL, 
   '{"patterns": ["(?i)janka(?:\\s*hardness)?:?\\s*(\\d+)", "(?i)hardness:?\\s*(\\d+)\\s*janka"]}', 210),
  
  ('moisture', 'Moisture Content (%)', 'number', 'wood', 'Technical Properties', 'Moisture content percentage', NULL, 
   '{"patterns": ["(?i)moisture(?:\\s*content)?:?\\s*(\\d+(?:\\.\\d+)?)%", "(?i)(\\d+(?:\\.\\d+)?)%\\s*moisture"]}', 220),
  
  ('stability', 'Dimensional Stability', 'dropdown', 'wood', 'Technical Properties', 'Resistance to dimensional changes', 
   '["Low", "Medium", "High"]',
   '{"patterns": ["(?i)dimensional\\s*stability:?\\s*([\\w]+)(?:\\n|\\r|$)", "(?i)stability:?\\s*([\\w]+)(?:\\n|\\r|$)"]}', 230),
  
  -- Appearance & Installation
  ('finish', 'Finish', 'dropdown', 'wood', 'Appearance & Installation', 'Surface finish type', 
   '["Oiled", "Lacquered", "Waxed", "Brushed", "Untreated", "Smoked", "Distressed"]',
   '{"patterns": ["(?i)finish:?\\s*([\\w\\-]+)(?:\\n|\\r|$)", "(?i)surface:?\\s*([\\w\\-]+)(?:\\n|\\r|$)"]}', 300),
  
  ('installationSystem', 'Installation System', 'dropdown', 'wood', 'Appearance & Installation', 'Method of installation', 
   '["Tongue & Groove", "Click System", "Glue-Down", "Floating", "Nail-Down"]',
   '{"patterns": ["(?i)installation:?\\s*([\\w\\s&\\-]+)(?:\\n|\\r|$)", "(?i)fitting:?\\s*([\\w\\s&\\-]+)(?:\\n|\\r|$)"]}', 310),
  
  ('underfloorHeating', 'Suitable for Underfloor Heating', 'boolean', 'wood', 'Appearance & Installation', 'Can be used with underfloor heating', NULL, 
   '{"patterns": ["(?i)underfloor heating", "(?i)suitable for underfloor heating", "(?i)ufh compatible"]}', 320);

-- Insert lighting-specific fields
INSERT INTO material_metadata_fields (field_name, display_name, field_type, material_type, category, description, options, extraction_hints, ui_order)
VALUES
  -- General Properties
  ('lightingType', 'Lighting Type', 'dropdown', 'lighting', 'General Properties', 'Type of lighting fixture', 
   '["Pendant", "Chandelier", "Wall Sconce", "Table Lamp", "Floor Lamp", "Ceiling Light", "Track Light", "Recessed Light", "LED Strip"]',
   '{"patterns": ["(?i)lighting type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)fixture type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 100),
  
  ('material', 'Material', 'dropdown', 'lighting', 'General Properties', 'Primary material', 
   '["Metal", "Glass", "Crystal", "Wood", "Plastic", "Fabric", "Ceramic", "Concrete"]', 
   '{"patterns": ["(?i)material:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 110),
  
  ('dimensions', 'Dimensions', 'text', 'lighting', 'General Properties', 'Overall dimensions', NULL, 
   '{"patterns": ["(?i)dimensions:?\\s*([\\d\\sx×*]+)(?:\\s*cm)?", "(?i)size:?\\s*([\\d\\sx×*]+)(?:\\s*cm)?"]}', 120),
  
  ('weight', 'Weight (kg)', 'number', 'lighting', 'General Properties', 'Weight in kg', NULL, 
   '{"patterns": ["(?i)weight:?\\s*(\\d+(?:\\.\\d+)?)\\s*kg", "(?i)(\\d+(?:\\.\\d+)?)\\s*kg"]}', 130),
  
  -- Technical Specifications
  ('bulbType', 'Bulb Type', 'dropdown', 'lighting', 'Technical Specifications', 'Type of bulb required', 
   '["LED", "Incandescent", "Halogen", "Fluorescent", "CFL", "Smart Bulb"]',
   '{"patterns": ["(?i)bulb type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)lamp type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 200),
  
  ('bulbIncluded', 'Bulb Included', 'boolean', 'lighting', 'Technical Specifications', 'Bulbs included with purchase', NULL, 
   '{"patterns": ["(?i)bulb(?:s)? included", "(?i)bulb(?:s)? included:?\\s*(yes|no|true|false)"]}', 210),
  
  ('wattage', 'Wattage (W)', 'number', 'lighting', 'Technical Specifications', 'Maximum wattage', NULL, 
   '{"patterns": ["(?i)wattage:?\\s*(\\d+(?:\\.\\d+)?)\\s*W", "(?i)(\\d+(?:\\.\\d+)?)\\s*W", "(?i)(\\d+(?:\\.\\d+)?)\\s*watt"]}', 220),
  
  ('voltage', 'Voltage (V)', 'number', 'lighting', 'Technical Specifications', 'Operating voltage', NULL, 
   '{"patterns": ["(?i)voltage:?\\s*(\\d+(?:\\.\\d+)?)\\s*V", "(?i)(\\d+(?:\\.\\d+)?)\\s*V", "(?i)(\\d+(?:\\.\\d+)?)\\s*volt"]}', 230),
  
  ('lumens', 'Lumens', 'number', 'lighting', 'Technical Specifications', 'Light output in lumens', NULL, 
   '{"patterns": ["(?i)lumens:?\\s*(\\d+(?:\\.\\d+)?)", "(?i)(\\d+(?:\\.\\d+)?)\\s*lm", "(?i)brightness:?\\s*(\\d+(?:\\.\\d+)?)"]}', 240),
  
  ('colorTemperature', 'Color Temperature', 'dropdown', 'lighting', 'Technical Specifications', 'Color temperature in Kelvin', 
   '["Warm White (2700K-3000K)", "Neutral White (3500K-4100K)", "Cool White (5000K-6500K)"]',
   '{"patterns": ["(?i)color temperature:?\\s*([\\w\\s\\(\\)\\-]+)(?:\\n|\\r|$)", "(?i)(\\d+K)\\s*color", "(?i)temperature:?\\s*(\\d+)\\s*K"]}', 250),
  
  ('energyClass', 'Energy Class', 'dropdown', 'lighting', 'Technical Specifications', 'Energy efficiency rating', 
   '["A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G"]',
   '{"patterns": ["(?i)energy class:?\\s*([A-G][+]{0,3})", "(?i)energy rating:?\\s*([A-G][+]{0,3})"]}', 260),
  
  -- Features
  ('ipRating', 'IP Rating', 'dropdown', 'lighting', 'Features', 'Ingress Protection rating', 
   '["IP20", "IP44", "IP54", "IP65", "IP67"]',
   '{"patterns": ["(?i)IP(?:\\s*rating)?:?\\s*(\\d{2})", "(?i)IP(\\d{2})"]}', 300),
  
  ('controlSystem', 'Control System', 'dropdown', 'lighting', 'Features', 'Method of control', 
   '["Switch", "Remote", "Smart App", "Voice", "Motion Sensor", "Touch"]',
   '{"patterns": ["(?i)control(?:led)? by:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)control:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 310);

-- Insert furniture-specific fields
INSERT INTO material_metadata_fields (field_name, display_name, field_type, material_type, category, description, options, extraction_hints, ui_order)
VALUES
  -- General Properties
  ('furnitureType', 'Furniture Type', 'dropdown', 'furniture', 'General Properties', 'Type of furniture', 
   '["Chair", "Table", "Sofa", "Bed", "Shelf", "Cabinet", "Desk", "Stool", "Armchair", "Dresser", "Wardrobe", "Bookcase", "Ottoman"]',
   '{"patterns": ["(?i)furniture type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)product type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 100),
  
  ('style', 'Style', 'dropdown', 'furniture', 'General Properties', 'Design style', 
   '["Modern", "Scandinavian", "Industrial", "Traditional", "Mid-Century", "Rustic", "Minimalist", "Contemporary", "Bohemian", "Art Deco"]',
   '{"patterns": ["(?i)style:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)", "(?i)design:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)"]}', 110),
  
  ('material', 'Material', 'dropdown', 'furniture', 'General Properties', 'Primary material', 
   '["Wood", "Metal", "Glass", "Plastic", "Fabric", "Leather", "Rattan", "Stone", "MDF", "Particleboard"]', 
   '{"patterns": ["(?i)material:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 120),
  
  ('dimensions', 'Dimensions', 'text', 'furniture', 'General Properties', 'Overall dimensions', NULL, 
   '{"patterns": ["(?i)dimensions:?\\s*([\\d\\sx×*]+)(?:\\s*cm)?", "(?i)size:?\\s*([\\d\\sx×*]+)(?:\\s*cm)?"]}', 130),
  
  -- Physical Attributes
  ('weight', 'Weight (kg)', 'number', 'furniture', 'Physical Attributes', 'Weight in kg', NULL, 
   '{"patterns": ["(?i)weight:?\\s*(\\d+(?:\\.\\d+)?)\\s*kg", "(?i)(\\d+(?:\\.\\d+)?)\\s*kg"]}', 200),
  
  ('weightCapacity', 'Weight Capacity (kg)', 'number', 'furniture', 'Physical Attributes', 'Maximum weight capacity', NULL, 
   '{"patterns": ["(?i)weight capacity:?\\s*(\\d+(?:\\.\\d+)?)\\s*kg", "(?i)capacity:?\\s*(\\d+(?:\\.\\d+)?)\\s*kg", "(?i)maximum weight:?\\s*(\\d+(?:\\.\\d+)?)\\s*kg"]}', 210),
  
  ('assembly', 'Assembly Required', 'boolean', 'furniture', 'Physical Attributes', 'Requires assembly', NULL, 
   '{"patterns": ["(?i)assembly required", "(?i)self assembly", "(?i)comes assembled"]}', 220),
  
  -- Construction
  ('frameConstruction', 'Frame Construction', 'dropdown', 'furniture', 'Construction', 'Frame material', 
   '["Solid Wood", "Plywood", "MDF", "Metal", "Particle Board"]',
   '{"patterns": ["(?i)frame:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)frame construction:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 300),
  
  ('cushionFilling', 'Cushion Filling', 'dropdown', 'furniture', 'Construction', 'Type of cushion filling', 
   '["Foam", "Memory Foam", "Down", "Polyester", "Feather", "Spring"]',
   '{"patterns": ["(?i)filling:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)cushion:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 310),
  
  ('upholstery', 'Upholstery Material', 'text', 'furniture', 'Construction', 'Upholstery fabric or material', NULL, 
   '{"patterns": ["(?i)upholstery:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)cover:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 320),
  
  -- Features
  ('adjustable', 'Adjustable', 'boolean', 'furniture', 'Features', 'Has adjustable features', NULL, 
   '{"patterns": ["(?i)adjustable", "(?i)adjustable:?\\s*(yes|no|true|false)"]}', 400),
  
  ('outdoor', 'Suitable for Outdoor', 'boolean', 'furniture', 'Features', 'Can be used outdoors', NULL, 
   '{"patterns": ["(?i)outdoor", "(?i)suitable for outdoor", "(?i)weather resistant"]}', 410),
  
  ('sustainability', 'Sustainability', 'dropdown', 'furniture', 'Features', 'Sustainability certifications', 
   '["FSC Certified", "Recycled Materials", "Low-VOC", "GREENGUARD", "None"]',
   '{"patterns": ["(?i)sustainability:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)", "(?i)eco-friendly:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)", "(?i)certified:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)"]}', 420);

-- Insert decoration-specific fields
INSERT INTO material_metadata_fields (field_name, display_name, field_type, material_type, category, description, options, extraction_hints, ui_order)
VALUES
  -- General Properties
  ('decorationType', 'Decoration Type', 'dropdown', 'decoration', 'General Properties', 'Type of decoration', 
   '["Wall Art", "Vase", "Sculpture", "Mirror", "Candle Holder", "Rug", "Cushion", "Throw", "Clock", "Bookend", "Plant Pot", "Figurine"]',
   '{"patterns": ["(?i)decoration type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)product type:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 100),
  
  ('style', 'Style', 'dropdown', 'decoration', 'General Properties', 'Design style', 
   '["Modern", "Scandinavian", "Industrial", "Traditional", "Mid-Century", "Rustic", "Minimalist", "Contemporary", "Bohemian", "Art Deco"]',
   '{"patterns": ["(?i)style:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)", "(?i)design:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)"]}', 110),
  
  ('material', 'Material', 'dropdown', 'decoration', 'General Properties', 'Primary material', 
   '["Wood", "Metal", "Glass", "Ceramic", "Fabric", "Plastic", "Stone", "Paper", "Acrylic", "Clay"]', 
   '{"patterns": ["(?i)material:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 120),
  
  ('dimensions', 'Dimensions', 'text', 'decoration', 'General Properties', 'Overall dimensions', NULL, 
   '{"patterns": ["(?i)dimensions:?\\s*([\\d\\sx×*]+)(?:\\s*cm)?", "(?i)size:?\\s*([\\d\\sx×*]+)(?:\\s*cm)?"]}', 130),
  
  -- Design & Composition
  ('theme', 'Theme', 'dropdown', 'decoration', 'Design & Composition', 'Decorative theme', 
   '["Geometric", "Floral", "Abstract", "Nature", "Animal", "Architectural", "Seasonal", "Coastal", "Ethnic", "Typography"]',
   '{"patterns": ["(?i)theme:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)motif:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 200),
  
  ('technique', 'Technique', 'dropdown', 'decoration', 'Design & Composition', 'Production technique', 
   '["Handmade", "Machine-made", "Hand-painted", "Printed", "Carved", "Woven", "Cast", "Blown", "Embroidered"]',
   '{"patterns": ["(?i)technique:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)", "(?i)made by:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)"]}', 210),
  
  ('setSize', 'Set Size', 'number', 'decoration', 'Design & Composition', 'Number of pieces in set', NULL, 
   '{"patterns": ["(?i)set of (\\d+)", "(?i)(\\d+)\\s*piece set", "(?i)pieces:?\\s*(\\d+)"]}', 220),
  
  -- Usage & Care
  ('occasion', 'Occasion', 'dropdown', 'decoration', 'Usage & Care', 'Suitable occasion', 
   '["Everyday", "Holiday", "Christmas", "Halloween", "Wedding", "Birthday", "Anniversary", "Housewarming"]',
   '{"patterns": ["(?i)occasion:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)for:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 300),
  
  ('indoor', 'Indoor/Outdoor', 'dropdown', 'decoration', 'Usage & Care', 'Suitable environment', 
   '["Indoor Only", "Outdoor Only", "Indoor/Outdoor"]',
   '{"patterns": ["(?i)indoor", "(?i)outdoor", "(?i)indoor/outdoor"]}', 310),
  
  ('mountingType', 'Mounting Type', 'dropdown', 'decoration', 'Usage & Care', 'How the item is mounted/displayed', 
   '["Wall Mounted", "Tabletop", "Freestanding", "Hanging", "Floor Standing"]',
   '{"patterns": ["(?i)mounting:?\\s*([\\w\\s]+)(?:\\n|\\r|$)", "(?i)display:?\\s*([\\w\\s]+)(?:\\n|\\r|$)"]}', 320),
  
  ('fragile', 'Fragile', 'boolean', 'decoration', 'Usage & Care', 'Requires careful handling', NULL, 
   '{"patterns": ["(?i)fragile", "(?i)handle with care"]}', 330),
  
  ('careInstructions', 'Care Instructions', 'textarea', 'decoration', 'Usage & Care', 'Cleaning and maintenance instructions', NULL, 
   '{"patterns": ["(?i)care:?\\s*([\\w\\s\\.\\-,]+)(?:\\n|\\r|$)", "(?i)cleaning:?\\s*([\\w\\s\\.\\-,]+)(?:\\n|\\r|$)"]}', 340),
  
  -- Additional Information
  ('sustainability', 'Eco-Friendly', 'dropdown', 'decoration', 'Additional Information', 'Sustainability aspects', 
   '["Recycled Materials", "Biodegradable", "Sustainable Source", "Fair Trade", "Handcrafted", "None"]',
   '{"patterns": ["(?i)eco-friendly:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)", "(?i)sustainable:?\\s*([\\w\\s\\-]+)(?:\\n|\\r|$)"]}', 400);

-- Add function to update material table with extraction trigger
CREATE OR REPLACE FUNCTION update_material_metadata_from_description()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.description IS NOT NULL AND NEW.description != '' AND NEW.material_type IS NOT NULL THEN
    -- Extract metadata using AI function
    NEW.metadata = jsonb_merge(NEW.metadata, extract_metadata_fields(NEW.description, NEW.material_type));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic metadata extraction
CREATE TRIGGER extract_material_metadata
BEFORE INSERT OR UPDATE OF description ON materials
FOR EACH ROW EXECUTE PROCEDURE update_material_metadata_from_description();

-- Helper function to merge jsonb objects without overwriting existing keys
CREATE OR REPLACE FUNCTION jsonb_merge(a jsonb, b jsonb)
RETURNS jsonb AS $$
BEGIN
  RETURN a || b - array(SELECT jsonb_object_keys(a) INTERSECT SELECT jsonb_object_keys(b));
END;
$$ LANGUAGE plpgsql;