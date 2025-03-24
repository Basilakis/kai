# Material Metadata Extraction System

This document explains how the material metadata fields are defined, extracted, and used throughout the system.

## Overview

The material metadata system is designed to capture specific properties for different types of materials (Tiles, Wood, Lighting, Furniture, Decoration). These properties are used in several ways:

1. **Admin Panel Display**: Organizing and displaying material metadata in a structured way
2. **Data Extraction**: Automatically extracting metadata from PDF documents and websites using AI
3. **Filtering and Search**: Allowing users to filter materials based on specific properties
4. **AI Training**: Providing structured data for training material recognition models

## Material Categories and Their Metadata

The system supports the following material categories, each with specific metadata fields:

### Tiles

- **Physical Properties**: Size (e.g., 60x60, 90x90), Thickness, Material
- **Technical Properties**: 
  - V-Rating (V1-V4): Pattern variation
  - R-Rating (R9-R13): Slip resistance 
  - Water Absorption
  - Frost Resistance
  - PEI Rating
- **Appearance**: Finish, Rectified
- **Usage**: Usage Area, Antibacterial properties

### Wood

- **Physical Properties**: Wood Type, Construction, Thickness, Width, Length
- **Technical Properties**: Grade, Hardness, Moisture Content, Stability
- **Appearance & Installation**: Finish, Installation System, Underfloor Heating compatibility

### Lighting

- **General Properties**: Lighting Type, Material, Dimensions, Weight
- **Technical Specifications**: Bulb Type, Wattage, Voltage, Lumens, Color Temperature, Energy Class
- **Features**: IP Rating, Control System

### Furniture

- **General Properties**: Furniture Type, Style, Material, Dimensions
- **Physical Attributes**: Weight, Weight Capacity, Assembly Required
- **Construction**: Frame Construction, Cushion Filling, Upholstery
- **Features**: Adjustable, Outdoor Use, Sustainability

### Decoration

- **General Properties**: Decoration Type, Style, Material, Dimensions
- **Design & Composition**: Theme, Technique, Set Size
- **Usage & Care**: Occasion, Indoor/Outdoor, Mounting Type, Fragility, Care Instructions
- **Additional Information**: Sustainability

## System Components

The metadata system consists of the following components:

### 1. Database Schema (`004_material_metadata_fields.sql`)

- `material_metadata_fields` table: Stores definitions of all metadata fields
- Extraction hints: Regex patterns for automatic extraction
- Functions: Automatic processing of text to extract metadata values
- Triggers: Automatically update metadata when descriptions change

### 2. TypeScript Interfaces (`metadata.ts`)

- Base `MaterialMetadata` interface with common properties
- Specialized interfaces for each material type
- Type guards for safely working with different material types
- Helper functions for accessing and validating metadata

### 3. Admin Panel Component (`MaterialMetadataPanel.tsx`)

- React component for displaying and editing metadata
- Organized by category and field groups
- Support for different field types (text, number, dropdown, boolean)
- Read and edit modes

## Extraction Process

The system is designed to automatically extract metadata from text descriptions using pattern matching:

1. When a material description is added/updated, the database trigger activates
2. The `extract_metadata_fields` function is called with the text and material type
3. For each registered field, it tries to match the text using extraction patterns
4. When a match is found, the value is extracted and converted to the appropriate type
5. The material's metadata JSON is updated with the extracted values

### Example Extraction Patterns

```sql
-- For V-Rating (Tiles)
(?i)(?:shade|color) variation:?\\s*(V\\d)
(?i)(V\\d)\\s*(?:shade|color) variation
(?i)variation:?\\s*(V\\d)

-- For R-Rating (Tiles)
(?i)slip resistance:?\\s*(R\\d{1,2})
(?i)(R\\d{1,2})\\s*slip resistance
(?i)(?:slip|resistance) rating:?\\s*(R\\d{1,2})

-- For Size (common)
(?i)(?:size|dimensions):?\\s*(\\d+\\s*[x×]\\s*\\d+)(?:\\s*cm)?
(?i)(\\d+\\s*[x×]\\s*\\d+)(?:\\s*cm)
```

## Integration with AI/ML

The extraction patterns and field definitions provide essential training data for machine learning models. When the system processes PDFs or crawls websites, it:

1. Uses OCR and text extraction to obtain raw text
2. Applies the extraction patterns to identify key metadata
3. Builds vector representations of materials with their metadata
4. Uses this structured data to improve recognition accuracy

## How to Extend the System

To add new metadata fields:

1. Add the field to the appropriate TypeScript interface in `metadata.ts`
2. Update the `getFieldGroups` function in `MaterialMetadataPanel.tsx`
3. Add extraction patterns to the SQL migration file
4. Run the migration to update the database schema

## Using Metadata in the Frontend

The metadata fields are automatically displayed in the admin panel using the `MaterialMetadataPanel` component. This component:

1. Receives a material type and metadata object
2. Renders appropriate fields based on the material type
3. Provides editing capabilities if not in read-only mode
4. Updates the parent component when metadata changes

Example usage:

```tsx
<MaterialMetadataPanel 
  materialType="tile" 
  metadata={tileData.metadata}
  onMetadataChange={handleMetadataChange}
/>
```

## Conclusion

The material metadata system provides a comprehensive solution for handling different material types and their unique properties. By using a combination of database schema, TypeScript interfaces, and React components, it offers a consistent and type-safe way to work with material metadata throughout the application.

The automatic extraction capabilities make it particularly powerful for processing large volumes of material data from external sources, significantly improving the efficiency of the data import process and helping to build more accurate AI models.