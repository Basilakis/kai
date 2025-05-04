# Material-Specific OCR Processing

This document describes the material-specific OCR processing system implemented in the platform. The system enhances OCR extraction by using material type detection and material-specific metadata fields.

## Overview

The material-specific OCR processing system consists of the following components:

1. **Material Type Detector**: Detects the material type from OCR text and/or images
2. **Metadata Field Utilities**: Retrieves metadata fields specific to a material type
3. **Material-Specific OCR Extractor**: Extracts metadata using material-specific patterns and context-aware processing

## Material Type Detection

The system first detects the material type from the OCR text and/or image. This is a crucial first step that determines which metadata fields should be used for extraction.

### Detection Methods

- **Text-based detection**: Uses keyword matching and pattern recognition to identify material types from text
- **Image-based detection**: Uses ML models to classify images into material types
- **Hybrid detection**: Combines text and image detection for higher accuracy

### Supported Material Types

- `tile`: Ceramic, porcelain, mosaic, and other tile materials
- `wood`: Hardwood, engineered wood, laminate, and other wood materials
- `lighting`: Lamps, fixtures, and other lighting products
- `furniture`: Chairs, tables, sofas, and other furniture
- `decoration`: Decorative items like vases, artwork, and rugs
- `all`: Common fields applicable to all material types

## Metadata Field Filtering

Once the material type is detected, the system retrieves metadata fields specific to that material type. This ensures that only relevant fields are used for extraction.

### Field Selection Process

1. Get all metadata fields for the detected material type
2. Include common fields applicable to all material types
3. Filter out inactive or irrelevant fields

## Material-Specific Extraction

The system uses material-specific extraction patterns and context-aware processing to extract metadata from OCR text.

### Extraction Methods

- **Pattern-based extraction**: Uses regular expressions specific to each field and material type
- **Hint-based extraction**: Uses field hints to locate and extract values
- **Context-aware extraction**: Uses context and relationships between fields to enhance extraction

### Context-Aware Processing

The system implements material-specific context-aware processing to enhance extraction:

- For tiles:
  - Extract size from dimensions and vice versa
  - Validate thickness values against typical ranges for tiles

- For wood:
  - Extract width and length from dimensions
  - Validate thickness values against typical ranges for wood

- For lighting:
  - Extract wattage and lumens from technical specifications
  - Convert between different units (e.g., watts to lumens)

## API Endpoints

The system exposes the following API endpoints:

### Detect Material Type

```
POST /api/ocr/detect-material-type
```

Request body:
```json
{
  "text": "OCR text content",
  "imagePath": "optional/path/to/image.jpg"
}
```

Response:
```json
{
  "success": true,
  "materialType": "tile",
  "confidence": 0.85,
  "keywords": ["ceramic", "porcelain", "glazed"]
}
```

### Extract Metadata

```
POST /api/ocr/extract-metadata
```

Request body:
```json
{
  "text": "OCR text content",
  "imagePath": "optional/path/to/image.jpg"
}
```

Response:
```json
{
  "success": true,
  "materialType": "tile",
  "materialTypeConfidence": 0.85,
  "extractedFields": {
    "manufacturer": "Example Tile Co.",
    "collection": "Modern Series",
    "size": "60x60",
    "thickness": 10,
    "color": "White"
  },
  "extractionConfidence": {
    "manufacturer": 0.9,
    "collection": 0.8,
    "size": 0.95,
    "thickness": 0.85,
    "color": 0.7
  },
  "extractionMethods": {
    "manufacturer": "pattern",
    "collection": "hint",
    "size": "pattern",
    "thickness": "pattern",
    "color": "context"
  },
  "processingTime": 235
}
```

### Test Extraction Pattern

```
POST /api/ocr/test-extraction-pattern
```

Request body:
```json
{
  "pattern": "thickness:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm",
  "text": "Product specifications: thickness: 10.5 mm",
  "fieldType": "number"
}
```

Response:
```json
{
  "success": true,
  "matched": true,
  "value": 10.5,
  "confidence": 0.9,
  "method": "pattern"
}
```

## Integration with ML Training

The material-specific OCR system is integrated with the ML training pipeline:

1. ML training uses material-specific metadata fields
2. Training data is filtered by material type
3. Models are trained to recognize material-specific properties

This integration ensures that the ML models are optimized for each material type, improving recognition accuracy.

## Future Enhancements

Planned enhancements for the material-specific OCR system:

1. **Improved material type detection**: Enhance detection accuracy with more advanced ML models
2. **More material types**: Add support for additional material types like fabric, metal, and glass
3. **Enhanced context-aware processing**: Implement more sophisticated context-aware extraction rules
4. **Feedback loop**: Incorporate user feedback to improve extraction patterns and rules
5. **Multi-language support**: Add support for extracting metadata from OCR text in multiple languages
