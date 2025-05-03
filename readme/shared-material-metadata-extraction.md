# Material Metadata Extraction System

This document explains how the material metadata fields are defined, extracted, and used throughout the system.

## Overview

The material metadata system is designed to capture specific properties for different types of materials (Tiles, Wood, Lighting, Furniture, Decoration). These properties are used in several ways:

1. **Admin Panel Display**: Organizing and displaying material metadata in a structured way
2. **Data Extraction**: Automatically extracting metadata from PDF documents and websites using AI
3. **Filtering and Search**: Allowing users to filter materials based on specific properties
4. **AI Training**: Providing structured data for training material recognition models
5. **User Education**: Help users understand what each property value looks like in practice
6. **Object Identification**: Enhance the system's ability to identify objects and their properties

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

## Visual Reference Library

The Visual Reference Library is a comprehensive database of images that illustrate different property values for materials. For example, it provides visual examples of different tile finishes (matte, glossy, etc.), R-ratings, material types, and more.

### Accessing the Visual Reference Library

#### In the Admin Panel

The Visual Reference Library is integrated directly into the Material Metadata Panel in the admin interface. When editing material properties, you'll see a gallery icon next to dropdown fields that have visual references available.

To view or add visual references:
1. Open a material for editing in the admin panel
2. In the Material Metadata Panel, look for dropdown fields with a gallery icon
3. Click the icon to open the Visual Reference Gallery
4. View existing references or add new ones

#### Via the API

You can also access the Visual Reference Library programmatically via the API:

```typescript
// Get visual references for a specific property value
const references = await fetch('/api/property-references?propertyName=finish&propertyValue=matte&materialType=tile');

// Add a new visual reference
const formData = new FormData();
formData.append('file', imageFile);
formData.append('propertyName', 'finish');
formData.append('propertyValue', 'matte');
formData.append('materialType', 'tile');
formData.append('description', 'Example of matte finish on porcelain tile');

await fetch('/api/property-references', {
  method: 'POST',
  body: formData
});
```

### Adding Visual References

When adding visual references, follow these guidelines:

1. **Image Quality**: Use high-quality images that clearly show the property value
2. **Isolation**: Try to isolate the property being illustrated (e.g., for finish, show a close-up of the surface)
3. **Variety**: Add multiple examples of each property value to show variation
4. **Description**: Include a detailed description of what the image shows
5. **Primary Reference**: Mark one image as the primary reference for each property value

### Best Practices for Different Properties

#### Finish
- Show close-ups of the surface to clearly illustrate the finish
- Include images under different lighting conditions
- For reflective finishes (glossy, polished), show reflection characteristics

#### R-Rating (Slip Resistance)
- Show the surface texture that provides the slip resistance
- Include images of the surface when wet if possible
- Add context about typical applications for each rating

#### Material Type
- Show the characteristic appearance of each material
- Include close-ups of texture and grain
- Show how the material responds to light

#### Shape/Format
- Show the entire tile to illustrate the shape
- Include a scale reference if possible
- Show installation patterns typical for the format

### Visual Reference AI Integration

The Visual Reference Library not only serves as a visual database for property values but also provides powerful capabilities for:

1. **AI Model Training**: Train computer vision models to recognize different property values from images
2. **OCR Enhancement**: Improve OCR extraction accuracy by providing visual context for extracted text

These integrations enable more accurate property identification and extraction, improving the overall system's ability to understand and work with materials.

#### AI Model Training

The AI model training integration allows you to:

1. Create training datasets from the Visual Reference Library
2. Train computer vision models to recognize property values
3. Use the trained models for automated property identification

##### API Endpoints for AI Model Training

The following API endpoints are available for AI model training:

**Create a Training Dataset**

```
POST /api/ai/visual-reference/datasets
```

**Request Body:**
```json
{
  "propertyName": "finish",
  "materialType": "tile"
}
```

**Train a Model**

```
POST /api/ai/visual-reference/models
```

**Request Body:**
```json
{
  "datasetId": "550e8400-e29b-41d4-a716-446655440000",
  "modelType": "classification",
  "options": {
    "epochs": 10,
    "batchSize": 16,
    "learningRate": 0.001
  }
}
```

**Create Dataset and Train Model in One Step**

```
POST /api/ai/visual-reference/train
```

**Request Body:**
```json
{
  "propertyName": "finish",
  "materialType": "tile",
  "modelType": "classification",
  "options": {
    "epochs": 10,
    "batchSize": 16,
    "learningRate": 0.001
  }
}
```

##### Usage Examples for AI Training

**Training a Model for Finish Recognition**

```typescript
// Create a dataset and train a model for finish recognition
const response = await fetch('/api/ai/visual-reference/train', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    propertyName: 'finish',
    materialType: 'tile',
    modelType: 'classification',
    options: {
      epochs: 20,
      batchSize: 32
    }
  })
});

const result = await response.json();
console.log(`Model ID: ${result.modelId}`);
```

**Training Models for Multiple Properties**

```typescript
// Properties to train models for
const properties = ['finish', 'rRating', 'material', 'lookType'];

// Train models for each property
for (const propertyName of properties) {
  await fetch('/api/ai/visual-reference/train', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      propertyName,
      materialType: 'tile',
      modelType: 'classification'
    })
  });

  console.log(`Trained model for ${propertyName}`);
}
```

##### Best Practices for AI Model Training

1. **Sufficient Examples**: Ensure you have at least 10-20 examples for each property value
2. **Diverse Examples**: Include examples with different lighting, angles, and contexts
3. **Balanced Dataset**: Try to have a similar number of examples for each property value
4. **Regular Retraining**: Retrain models as you add more visual references
5. **Validation**: Test models with new images to ensure they generalize well

#### OCR Enhancement

The OCR enhancement integration allows you to:

1. Verify OCR-extracted property values using visual references
2. Get alternative suggestions when extracted values don't match visual references
3. Generate extraction patterns based on visual references

##### API Endpoints for OCR Enhancement

The following API endpoints are available for OCR enhancement:

**Enhance OCR Extraction**

```
POST /api/ocr/visual-reference/enhance
```

**Request Body:**
```json
{
  "propertyName": "finish",
  "extractedValue": "matte",
  "imageUrl": "https://example.com/image.jpg",
  "materialType": "tile"
}
```

**Enhance Multiple OCR Extractions**

```
POST /api/ocr/visual-reference/enhance-multiple
```

**Request Body:**
```json
{
  "extractedProperties": {
    "finish": "matte",
    "rRating": "R10",
    "material": "porcelain"
  },
  "imageUrl": "https://example.com/image.jpg",
  "materialType": "tile"
}
```

**Get Extraction Patterns**

```
GET /api/ocr/visual-reference/patterns/:propertyName/:materialType
```

##### Usage Examples for OCR Enhancement

**Enhancing OCR Extraction**

```typescript
// Enhance OCR extraction for a finish value
const response = await fetch('/api/ocr/visual-reference/enhance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    propertyName: 'finish',
    extractedValue: 'matte',
    imageUrl: 'https://example.com/image.jpg',
    materialType: 'tile'
  })
});

const result = await response.json();

if (result.success) {
  const { extractedValue, confidence, visuallyVerified } = result.result;

  if (visuallyVerified) {
    console.log(`Verified: ${extractedValue} (${confidence.toFixed(2)})`);
  } else {
    console.log(`Not verified: ${extractedValue} (${confidence.toFixed(2)})`);

    // Check for alternative suggestions
    if (result.result.alternativeSuggestions) {
      console.log('Suggestions:');
      result.result.alternativeSuggestions.forEach(suggestion => {
        console.log(`- ${suggestion.value} (${suggestion.confidence.toFixed(2)})`);
      });
    }
  }
}
```

**Enhancing Multiple OCR Extractions**

```typescript
// Enhance multiple OCR extractions
const response = await fetch('/api/ocr/visual-reference/enhance-multiple', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    extractedProperties: {
      finish: 'matte',
      rRating: 'R10',
      material: 'porcelain'
    },
    imageUrl: 'https://example.com/image.jpg',
    materialType: 'tile'
  })
});

const result = await response.json();

if (result.success) {
  const { results } = result;

  // Process each property result
  Object.entries(results).forEach(([propertyName, propertyResult]) => {
    const { extractedValue, confidence, visuallyVerified } = propertyResult;

    console.log(`${propertyName}: ${extractedValue} (${confidence.toFixed(2)}, ${visuallyVerified ? 'verified' : 'not verified'})`);
  });
}
```

**Using Extraction Patterns**

```typescript
// Get extraction patterns for finish
const response = await fetch('/api/ocr/visual-reference/patterns/finish/tile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();

if (result.success) {
  const { patterns } = result.patterns;

  // Use patterns for regex extraction
  const text = 'The tile has a matte finish and R10 slip rating.';

  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i');
    const match = regex.exec(text);

    if (match) {
      console.log(`Matched pattern: ${pattern}`);
      console.log(`Extracted value: ${match[1]}`);
      break;
    }
  }
}
```

##### Best Practices for OCR Enhancement

1. **Comprehensive References**: Ensure you have visual references for all common property values
2. **High-Quality Images**: Use clear, well-lit images for both references and extraction
3. **Confidence Thresholds**: Set appropriate confidence thresholds based on your needs
4. **Fallback Strategies**: Have fallback strategies when visual verification fails
5. **Feedback Loop**: Use verification results to improve OCR extraction over time

#### Integration with Existing Systems

##### Integration with OCR Pipeline

The Visual Reference OCR enhancement can be integrated into your existing OCR pipeline:

```typescript
// Example OCR pipeline with visual reference enhancement
async function processDocument(documentUrl) {
  // 1. Extract text from document using OCR
  const extractedText = await performOcr(documentUrl);

  // 2. Extract properties from text using regex patterns
  const extractedProperties = extractPropertiesFromText(extractedText);

  // 3. Extract image from document
  const imageUrl = await extractImageFromDocument(documentUrl);

  // 4. Enhance OCR extraction with visual reference verification
  const enhancedProperties = await enhanceWithVisualReferences(
    extractedProperties,
    imageUrl,
    'tile'
  );

  // 5. Return the enhanced properties
  return enhancedProperties;
}

// Helper function to enhance properties with visual references
async function enhanceWithVisualReferences(properties, imageUrl, materialType) {
  const response = await fetch('/api/ocr/visual-reference/enhance-multiple', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      extractedProperties: properties,
      imageUrl,
      materialType
    })
  });

  const result = await response.json();

  if (result.success) {
    return result.results;
  }

  return properties; // Fallback to original properties if enhancement fails
}
```

##### Integration with Computer Vision Pipeline

The Visual Reference AI training can be integrated into your computer vision pipeline:

```typescript
// Example computer vision pipeline with visual reference training
async function setupPropertyRecognition() {
  // 1. Define properties to recognize
  const properties = ['finish', 'material', 'lookType'];

  // 2. Train models for each property
  const modelIds = await trainModelsForProperties(properties);

  // 3. Set up recognition pipeline
  setupRecognitionPipeline(modelIds);
}

// Helper function to train models for properties
async function trainModelsForProperties(properties) {
  const modelIds = {};

  for (const propertyName of properties) {
    const response = await fetch('/api/ai/visual-reference/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        propertyName,
        materialType: 'tile',
        modelType: 'classification'
      })
    });

    const result = await response.json();

    if (result.success) {
      modelIds[propertyName] = result.modelId;
    }
  }

  return modelIds;
}
```

### Maintaining the Visual Reference Library

To keep the Visual Reference Library valuable and up-to-date:

1. **Regular Review**: Periodically review existing references for quality and relevance
2. **Expand Coverage**: Add references for new property values as they are introduced
3. **User Feedback**: Incorporate feedback from users about the usefulness of references
4. **Quality Control**: Remove or replace low-quality or misleading images
5. **Consistency**: Ensure consistent representation across different properties

## Field Descriptions for AI and API Integration

The system includes detailed descriptions for each metadata field that explain what the field means, its importance, and how it should be used. These descriptions serve multiple purposes:

1. **User Guidance**: Help users understand what each field means in the admin panel
2. **API Documentation**: Provide context for developers using the API
3. **OCR AI Training**: Assist in training AI models to extract these properties from documents
4. **Agent Context**: Give AI agents the necessary context to understand and work with material data

### Using Descriptions for OCR AI

When training OCR AI models to extract material properties from documents, catalogs, or technical sheets, these descriptions provide valuable context:

1. **Field Identification**: The descriptions help the AI understand what to look for in the document. For example, when looking for "R-Rating", the AI knows to search for slip resistance ratings following the R9-R13 pattern.

2. **Value Validation**: The descriptions often include information about valid values or formats, which helps the AI validate extracted data. For example, knowing that V-Rating ranges from V1 to V4 helps the AI correctly interpret and normalize extracted values.

3. **Contextual Clues**: The descriptions provide contextual information that helps the AI identify fields even when they're not explicitly labeled. For example, if a document mentions "frost resistance" without using that exact term, the AI can use the description to recognize related terms like "freeze-thaw resistance" or "suitable for outdoor use in cold climates".

### Using Descriptions for API Integration

The field descriptions are valuable for API documentation and integration:

1. **API Documentation**: The descriptions can be used to generate comprehensive API documentation that explains each field in detail.

2. **Request Validation**: The descriptions provide context for validating API requests, ensuring that clients provide valid values for each field.

3. **Response Enrichment**: API responses can include field descriptions to help clients understand the data they're receiving.

### Using Descriptions for AI Agents

AI agents can use the field descriptions to better understand and work with material data:

1. **Context Understanding**: The descriptions provide the necessary context for agents to understand what each field means and how it relates to other fields.

2. **User Assistance**: Agents can use the descriptions to explain fields to users in natural language.

3. **Data Extraction**: When extracting information from unstructured text, agents can use the descriptions to identify relevant information.

## Conclusion

The material metadata system provides a comprehensive solution for handling different material types and their unique properties. By using a combination of database schema, TypeScript interfaces, and React components, it offers a consistent and type-safe way to work with material metadata throughout the application.

The automatic extraction capabilities make it particularly powerful for processing large volumes of material data from external sources, significantly improving the efficiency of the data import process and helping to build more accurate AI models.

The Visual Reference Library enhances this system by providing visual examples that improve understanding, training, and identification capabilities. The AI integration capabilities further extend the system's power by enabling:

1. Automated property recognition through trained AI models
2. Enhanced OCR extraction with visual verification
3. Improved accuracy through multi-modal analysis (combining text and image data)
4. Seamless integration with existing OCR and computer vision pipelines

Together, these components create a robust foundation for working with material metadata across the entire platform, enabling more accurate and efficient material recognition, classification, and data extraction.