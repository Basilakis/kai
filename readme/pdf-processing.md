# PDF Processing System

The PDF Processing System is a specialized component of Kai that extracts images, text, and structured data from material catalogs. This document details the system's capabilities, architecture, and implementation.

## Features

### Image Extraction

The PDF Processing System can extract high-quality images of materials from catalogs:

1. **Intelligent Image Extraction**
   - Identification of material images vs. decorative elements
   - Boundary detection for separating merged images
   - Resolution enhancement for low-quality images
   - Background removal and transparency handling
   - Image deduplication across multiple pages

2. **Image Processing**
   - Color normalization for consistent representation
   - Perspective correction for angled views
   - Artifact removal (watermarks, text overlays)
   - Multi-resolution output generation
   - Image metadata extraction (dimensions, resolution)

3. **Image Classification**
   - Categorization of images (product, environment, detail)
   - Primary vs. secondary image identification
   - Texture and pattern extraction
   - Feature extraction for recognition

### Text Extraction & OCR

The system includes advanced OCR capabilities:

1. **Enhanced OCR**
   - Region-based OCR optimization
   - Multi-language support
   - Domain-specific vocabulary enhancement
   - Handwritten text recognition for notes
   - Table structure recognition

2. **Text Processing**
   - Cleaning and normalization
   - Entity recognition (product codes, dimensions)
   - Technical specification parsing
   - Unit standardization
   - Language detection and translation

3. **OCR Confidence Scoring**
   - Accuracy estimation for extracted text
   - Confidence heatmaps for verification
   - Alternative readings for uncertain text
   - Human verification flagging

### Layout Analysis

The system performs comprehensive page layout analysis:

1. **Page Segmentation**
   - Logical region identification (headers, body, footnotes)
   - Multi-column detection and ordering
   - Table structure recognition
   - List and bullet point identification
   - Caption and label association

2. **Document Structure**
   - Table of contents parsing
   - Section and chapter detection
   - Cross-reference identification
   - Hierarchical document mapping
   - Logical flow reconstruction

3. **Visual Element Analysis**
   - Chart and graph detection
   - Diagram interpretation
   - Icon and symbol recognition
   - Color palette extraction
   - Design element identification

### Text-Image Association

The system connects extracted text with corresponding images:

1. **Association Methods**
   - Spatial proximity analysis
   - Reference identification (figure numbers)
   - Caption-to-image matching
   - Visual element correlation
   - Cross-page reference tracking

2. **Metadata Mapping**
   - Product code to image mapping
   - Specification text to image linking
   - Dimension text to image correlation
   - Color name to visual color matching
   - Technical data to visual feature association

3. **Validation Techniques**
   - Consistency checking across associations
   - Probability scoring for uncertain matches
   - Pattern-based validation
   - Cross-reference confirmation
   - Human verification flagging

### Structured Data Extraction

The system extracts structured material specifications:

1. **Specification Extraction**
   - Technical property identification
   - Dimension and measurement parsing
   - Material composition detection
   - Application and usage extraction
   - Performance rating identification

2. **Field Mapping**
   - Knowledge base schema alignment
   - Field normalization and standardization
   - Unit conversion to standard formats
   - Vocabulary mapping to controlled terminology
   - Missing value inference

3. **Validation and Quality Control**
   - Range checking for numeric values
   - Format validation for standard fields
   - Cross-reference checking
   - Completeness assessment
   - Confidence scoring

## Technical Implementation

### Processing Pipeline

The PDF processing pipeline consists of several stages:

1. **Document Preprocessing**
   - PDF validation and metadata extraction
   - Page count and structure analysis
   - Resolution assessment
   - Text layer detection
   - Encryption and permission handling

2. **Page Analysis**
   - Page segmentation into logical regions
   - Layout analysis and region classification
   - Text extraction from native PDF text layer (if available)
   - OCR preparation for image-based content
   - Visual element identification

3. **Image Processing**
   - Image extraction from PDF elements
   - Image boundary detection and cropping
   - Enhancement and normalization
   - Deduplication and variant identification
   - Feature extraction for classification

4. **Text Processing**
   - OCR for image-based text
   - Text cleaning and normalization
   - Entity recognition and classification
   - Table and structured content parsing
   - Language detection and processing

5. **Association and Mapping**
   - Text-image association
   - Structured data extraction
   - Knowledge base schema mapping
   - Validation and confidence scoring
   - Output generation

### Enhanced Preprocessing

The system includes specialized preprocessing techniques:

```typescript
interface PreprocessingOptions {
  enhanceResolution: boolean;   // Apply super-resolution to low-quality images
  removeBackground: boolean;    // Detect and remove background elements
  deskew: boolean;              // Correct page skew and orientation
  detectBoundaries: boolean;    // Enhance boundary detection between elements
  denoise: boolean;             // Remove noise artifacts
  colorNormalize: boolean;      // Standardize color representation
}

interface PreprocessingResult {
  enhancedPages: Array<{
    pageNumber: number;
    enhancedImagePath: string;
    enhancementMetrics: Record<string, number>;
    regions: Array<{
      type: 'text' | 'image' | 'table' | 'diagram' | 'mixed';
      bbox: [number, number, number, number];  // x, y, width, height
      confidence: number;
    }>;
  }>;
  metadata: {
    enhancementApplied: string[];
    originalQuality: Record<string, number>;
    enhancedQuality: Record<string, number>;
  };
}
```

### Region-Based OCR

The system optimizes OCR for different types of regions:

```typescript
interface OCROptions {
  mode: 'standard' | 'dense' | 'sparse' | 'technical' | 'handwritten';
  languages: string[];
  enhanceText: boolean;
  recognizeHandwriting: boolean;
  detectOrientation: boolean;
  recognizeTables: boolean;
  confidenceThreshold: number;
  outputFormats: Array<'text' | 'hocr' | 'alto' | 'json'>;
}

interface OCRResult {
  regions: Array<{
    regionId: string;
    regionType: 'paragraph' | 'heading' | 'table' | 'caption' | 'list' | 'technical';
    content: string;
    bbox: [number, number, number, number];
    confidence: number;
    wordData?: Array<{
      word: string;
      bbox: [number, number, number, number];
      confidence: number;
    }>;
    alternatives?: Array<{
      content: string;
      confidence: number;
    }>;
    metadata?: Record<string, any>;
  }>;
  pageMetadata: {
    pageNumber: number;
    dimensions: [number, number];
    dpi: number;
    orientation: 'portrait' | 'landscape';
    languages: Array<{
      language: string;
      confidence: number;
    }>;
  };
  statistics: {
    characterCount: number;
    wordCount: number;
    meanConfidence: number;
    processingTimeMs: number;
  };
}
```

### Text-Image Association

The system links extracted text with corresponding images:

```typescript
interface AssociationOptions {
  associationMethods: Array<'spatial' | 'reference' | 'caption' | 'content'>;
  minConfidence: number;
  resolveConflicts: 'highest_confidence' | 'multiple' | 'none';
  maxDistance: number;  // Maximum spatial distance for association
  enableCrossPage: boolean;  // Whether to look for associations across pages
}

interface AssociationResult {
  associations: Array<{
    imageId: string;
    textRegions: string[];
    associationType: 'direct' | 'caption' | 'reference' | 'inferred';
    confidence: number;
    metadata: Record<string, any>;
  }>;
  unmatchedImages: string[];
  unmatchedTextRegions: string[];
  statistics: {
    associationCount: number;
    meanConfidence: number;
    conflictCount: number;
    crossPageAssociations: number;
  };
}
```

### Form Field Extraction

The system can extract data from structured form fields:

```typescript
interface FormFieldExtractionOptions {
  fieldTypes: Array<'text' | 'checkbox' | 'radio' | 'table' | 'signature'>;
  namedFields: Record<string, {
    type: string;
    pattern?: string;
    required?: boolean;
    validation?: 'numeric' | 'alphanumeric' | 'email' | 'date' | 'custom';
    validationPattern?: string;
  }>;
  detectUnlabeled: boolean;
  extractSignatures: boolean;
}

interface FormFieldExtractionResult {
  fields: Array<{
    name: string;
    value: string | boolean | string[][];
    type: string;
    bbox: [number, number, number, number];
    pageNumber: number;
    confidence: number;
    validated: boolean;
    validationMessage?: string;
  }>;
  statistics: {
    totalFields: number;
    filledFields: number;
    validFields: number;
    emptyFields: number;
    invalidFields: number;
  };
}
```

## Integration with Knowledge Base

The PDF Processing System integrates with the Knowledge Base:

1. **Data Transformation**
   - Mapping extracted data to knowledge base schema
   - Entity resolution for existing materials
   - Relationship identification and creation
   - Collection and series mapping
   - Duplicate detection and handling

2. **Quality Assurance**
   - Validation against knowledge base constraints
   - Confidence thresholds for automatic import
   - Human verification workflow for low-confidence data
   - Anomaly detection for unusual values
   - Cross-reference checking with existing data

3. **Incremental Updates**
   - Version management for updated materials
   - Change tracking and attribution
   - Selective updating of specific fields
   - Catalog version correlation
   - Update propagation to related entities

## Queue System Integration

The PDF Processing System is integrated with the queue system:

1. **Job Management**
   - Job creation for PDF processing
   - Priority setting for urgent catalogs
   - Progress tracking and reporting
   - Error handling and recovery
   - Resource allocation

2. **Pipeline Stages**
   - Parallel processing of independent stages
   - Results aggregation and validation
   - Stage-specific error handling
   - Progress reporting for each stage
   - Smart retries for failed stages

3. **Event-Based Coordination**
   - Status updates via the message broker
   - Knowledge base notifications for new data
   - Admin panel updates for monitoring
   - Error alerts and notifications
   - Completion events for dependent processes

## API Usage

### Basic PDF Processing

```typescript
import { extractFromPDF } from '@kai/ml';

async function processPDF() {
  try {
    const result = await extractFromPDF('path/to/catalog.pdf', 'output/directory', {
      extractImages: true,
      extractText: true,
      enhanceResolution: true,
      associateTextWithImages: true,
      extractStructuredData: true
    });
    
    console.log(`Processed ${result.pageCount} pages`);
    console.log(`Extracted ${result.images.length} images and ${result.textRegions.length} text regions`);
    console.log(`Found ${result.materials.length} potential materials`);
  } catch (error) {
    console.error('PDF processing failed:', error);
  }
}
```

### Enhanced OCR Processing

```typescript
import { performEnhancedOCR } from '@kai/ml';

async function processOCR() {
  try {
    const result = await performEnhancedOCR('path/to/page.jpg', {
      mode: 'technical',
      languages: ['en', 'es', 'fr'],
      enhanceText: true,
      recognizeTables: true,
      confidenceThreshold: 0.75
    });
    
    console.log(`Extracted ${result.regions.length} text regions`);
    console.log(`Overall confidence: ${result.statistics.meanConfidence.toFixed(2)}`);
    
    // Find high-value information like product codes
    const productCodes = result.regions
      .filter(region => region.content.match(/[A-Z]{2,}-\d{3,}/))
      .map(region => region.content.trim());
    
    console.log('Potential product codes:', productCodes);
  } catch (error) {
    console.error('OCR processing failed:', error);
  }
}
```

### Text-Image Association

```typescript
import { associateTextWithImages } from '@kai/ml';

async function linkTextAndImages() {
  try {
    const result = await associateTextWithImages({
      images: ['path/to/image1.jpg', 'path/to/image2.jpg'],
      textRegions: ocrResults.regions,
      associationMethods: ['spatial', 'caption', 'reference'],
      minConfidence: 0.6
    });
    
    console.log(`Created ${result.associations.length} text-image associations`);
    
    // Process the associations
    result.associations.forEach(assoc => {
      console.log(`Image ${assoc.imageId} is associated with ${assoc.textRegions.length} text regions`);
      console.log(`Association confidence: ${assoc.confidence.toFixed(2)}`);
    });
  } catch (error) {
    console.error('Text-image association failed:', error);
  }
}
```

### Material Extraction

```typescript
import { extractMaterialsFromPDF } from '@kai/ml';

async function extractMaterials() {
  try {
    const result = await extractMaterialsFromPDF('path/to/catalog.pdf', {
      extractImages: true,
      enhanceResolution: true,
      recognizeText: true,
      identifyMaterials: true,
      mapToKnowledgeBase: true,
      confidence: 'high'
    });
    
    console.log(`Extracted ${result.materials.length} materials`);
    
    // Example of processing the extracted materials
    result.materials.forEach(material => {
      console.log(`Material: ${material.name}`);
      console.log(`Type: ${material.materialType}`);
      console.log(`Product Code: ${material.productCode}`);
      console.log(`Dimensions: ${JSON.stringify(material.dimensions)}`);
      console.log(`Images: ${material.images.length}`);
    });
    
    // Example of importing to knowledge base
    if (result.materials.length > 0) {
      const importResult = await knowledgeBaseService.bulkImportMaterials(
        result.materials,
        'system',
        {
          updateExisting: true,
          detectDuplicates: true,
          collectionId: 'catalog-collection-id'
        }
      );
      
      console.log(`Imported ${importResult.imported} materials`);
      console.log(`Updated ${importResult.updated} existing materials`);
      console.log(`Failed to import ${importResult.failed} materials`);
    }
  } catch (error) {
    console.error('Material extraction failed:', error);
  }
}
```

## Performance Considerations

1. **Processing Optimization**
   - Parallel processing of pages for faster throughput
   - GPU acceleration for image processing and OCR
   - Caching of intermediate results
   - Progressive processing (quick first pass, then detailed)
   - Resource-adaptive processing based on document complexity

2. **Resource Requirements**
   - CPU: Multiple cores recommended for parallel processing
   - Memory: 8GB+ for large catalogs (scales with page count and complexity)
   - GPU: Recommended for OCR and image enhancement
   - Storage: Temporary space for extracted assets (5-10x the PDF size)
   - Network: Required for knowledge base integration

3. **Scaling Considerations**
   - Horizontal scaling for processing multiple documents
   - Job priority system for urgent processing
   - Batch processing for large catalogs
   - Sequential processing for memory-constrained environments
   - Distributed processing for multi-stage pipeline