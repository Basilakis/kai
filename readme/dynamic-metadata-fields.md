# Dynamic Metadata Fields and Categories

This document explains how dynamic categories and metadata fields are implemented in the KAI platform and how they are used for OCR extraction, ML training, and other AI-related features.

## Overview

The KAI platform uses a flexible metadata system that allows administrators to define custom fields for different material types. These fields can be used to:

1. Store and display material properties in a structured way
2. Extract information from OCR text using pattern matching
3. Train ML models to recognize specific material properties
4. Provide structured data for search and filtering

## Components

### 1. Metadata Fields

Metadata fields are defined in the `MetadataField` model and can be managed through the admin dashboard at `/metadata-fields`. Each field has:

- **Basic Properties**: name, display name, description, field type
- **Validation Rules**: min/max values, regex patterns, etc.
- **Material Type Association**: which material type(s) the field applies to
- **OCR Extraction Patterns**: regex patterns for extracting values from OCR text
- **AI Extraction Hints**: natural language hints for AI-based extraction

### 2. Categories

Categories define the types of materials in the system and are managed through the admin dashboard. Each category can have:

- **Hierarchical Structure**: parent-child relationships
- **Description**: detailed explanation of the category
- **Metadata**: additional properties specific to the category

## Material-Specific Metadata Fields

A key concept in the system is that metadata fields are bound to specific material categories. This binding is crucial for:

### 1. Database Structure

- Each metadata field has a `material_type` property in the database
- The field can be associated with a specific type (tile, wood, etc.) or 'all' for common fields
- The `categories` array in the metadata field model allows for multiple category associations

```sql
CREATE TABLE IF NOT EXISTS public.material_metadata_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'dropdown')),
  material_type TEXT NOT NULL CHECK (material_type IN ('tile', 'wood', 'lighting', 'furniture', 'decoration', 'all')),
  category TEXT NOT NULL,
  -- other fields...
);
```

### 2. Training and Processing

- When training ML models, only metadata fields relevant to the specific material type should be used
- Different material types have different visual and physical properties requiring specialized processing
- Feature extraction should adapt based on material type

```typescript
// Example of material-specific training
async function trainModelForMaterialType(materialType: string) {
  // Get metadata fields specific to this material type
  const metadataFields = await getMetadataFieldsByCategory(materialType);

  // Use these fields to structure training data
  const trainingData = await prepareTrainingData(materialType, metadataFields);

  // Train model using material-specific fields
  return trainModel(trainingData, {
    materialType,
    fields: metadataFields.map(field => field.name)
  });
}
```

### 3. OCR Processing

- Different material types require different extraction patterns
- For example, "thickness" has different patterns and valid ranges for tiles vs. wood
- Material type detection should be the first step in processing

```typescript
// Example of material-specific OCR extraction
async function extractMetadataFromOCR(ocrText: string, materialType: string) {
  // Get metadata fields for this material type
  const metadataFields = await getMetadataFieldsByCategory(materialType);

  // Extract values using material-specific fields
  const extractedValues = {};
  for (const field of metadataFields) {
    const extractedValue = extractValueFromOCR(field, ocrText);
    if (extractedValue) {
      extractedValues[field.name] = extractedValue.value;
    }
  }

  return extractedValues;
}
```

### 4. UI Display

- The UI should only show fields relevant to the material type being viewed or edited
- This filtering happens in components like `MaterialMetadataPanel.tsx`

## Integration with OCR

When OCR is performed on material documents (like catalogs or spec sheets), the system uses the extraction patterns defined in metadata fields to automatically extract relevant information:

1. OCR text is processed through the `extractValueFromOCR` function
2. For each metadata field, the system tries to match the defined extraction patterns
3. Extracted values are stored with confidence scores
4. Administrators can review and correct extracted values

Example extraction pattern for tile thickness:
```
(?i)thickness:?\s*(\d+(?:\.\d+)?)\s*mm
```

## Integration with ML Training

The metadata fields provide structured data for ML model training:

1. **Feature Engineering**: Metadata fields define the features that ML models should learn to recognize
2. **Training Data**: Extracted and validated metadata values serve as labeled training data
3. **Category-Specific Models**: The system can train specialized models for different material categories
4. **Hybrid Embeddings**: Material categories are used to generate specialized embeddings for better search results

## Material Type Relationships

Metadata fields can be associated with specific material types (tile, wood, lighting, etc.) through the categories field. This relationship enables:

1. **Type-Specific UI**: Only showing relevant fields for each material type
2. **Specialized Extraction**: Using different extraction patterns based on material type
3. **Hierarchical Properties**: Inheriting properties from parent categories
4. **Cross-Type Search**: Finding materials with similar properties across different types

## Admin Dashboard Integration

The admin dashboard provides interfaces for managing both categories and metadata fields:

1. **Category Manager**: `/dashboard/categories` - For managing material categories
2. **Metadata Field Manager**: `/metadata-fields` - For managing metadata field definitions
3. **Material Editor**: Displays the appropriate metadata fields based on material type

## Usage in Code

### OCR Extraction

```typescript
// Extract value for a metadata field from OCR text
export function extractValueFromOCR(field: MetadataFieldDocument, ocrText: string): any {
  if (!field.extractionPatterns || field.extractionPatterns.length === 0) {
    return null;
  }

  // Try extraction patterns
  for (const pattern of field.extractionPatterns) {
    const regex = new RegExp(pattern, 'i');
    const match = ocrText.match(regex);
    if (match && match[1]) {
      return {
        value: match[1].trim(),
        extractionMethod: 'pattern',
        extractionPattern: pattern,
        confidence: 0.9
      };
    }
  }

  return null;
}
```

### ML Integration

```typescript
// Generate embeddings with material category context
const embeddings = await mcpClientService.generateTextEmbedding(
  userId,
  text,
  {
    model: 'text-embedding-3-small',
    materialCategory: material.type // Use material type for specialized embeddings
  }
);
```

## Current Implementation Status

The current implementation status of metadata fields in the system:

### Fully Implemented
- Database schema for metadata fields
- TypeScript interfaces for metadata types
- Admin UI for managing metadata fields
- Basic OCR extraction using metadata field patterns

### Partially Implemented
- Property-specific ML model training
- Visual reference library for property recognition
- Advanced validation rules for metadata fields

### Actively Used Metadata Fields
1. **Physical Properties**:
   - Size/Dimensions, Thickness, Width/Length
   - Material, Color
2. **Technical Properties**:
   - PEI Rating, Finish, Resistance ratings
3. **Common Properties**:
   - Manufacturer, Collection/Series, Product Code

## Implementation Roadmap

The following enhancements are planned for the metadata field system:

### 1. Update ML Training Pipeline
- Modify training code to explicitly filter metadata fields by material type
- Create material-specific feature extractors for each material type
- Implement specialized training pipelines for different property types

### 2. Enhance OCR Processing
- Update OCR pipeline to use material-specific extraction patterns
- Implement material type detection as a first step in processing
- Add context-aware extraction for complex fields

### 3. Improve UI Components
- Ensure all UI components consistently filter metadata fields by material type
- Add material type indicators in the admin dashboard
- Implement better visualization of field relationships

### 4. Complete Visual Reference Library
- Implement property-specific model training for all relevant fields
- Create a comprehensive dataset for training visual property recognition
- Develop a visual property browser in the admin dashboard

### 5. Enhance ML Integration
- Implement specialized embeddings for all material types
- Develop property-specific feature extraction for all relevant fields
- Create a unified API for property-based material search

### 6. Expand OCR Capabilities
- Add extraction patterns for all defined metadata fields
- Implement advanced context-aware extraction for complex fields
- Develop an extraction pattern testing tool in the admin dashboard

### 7. Implement Property Relationships
- Develop the property relationship graph
- Implement property inheritance based on material type hierarchies
- Create a visual editor for property relationships

## Best Practices

1. **Descriptive Names**: Use clear, descriptive names for metadata fields
2. **Detailed Descriptions**: Provide thorough descriptions to help users understand each field
3. **Extraction Patterns**: Define multiple extraction patterns to handle different text formats
4. **Material Type Association**: Associate fields with the appropriate material types
5. **Validation Rules**: Define validation rules to ensure data quality
6. **Material-Specific Training**: Always filter metadata fields by material type when training models
7. **Consistent Field Usage**: Use the same field names consistently across the system
