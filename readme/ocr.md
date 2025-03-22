# Optical Character Recognition (OCR) System

The OCR System is a specialized component of Kai that extracts and processes text from images, PDFs, and material catalogs. This document details the system's capabilities, architecture, and implementation.

## Features

### Specialized OCR for Material Datasheets

The OCR system includes specialized capabilities for material datasheets:

1. **Domain-Specific Optimization**
   - Technical vocabulary enhancement for materials (tile, stone, wood, etc.)
   - Specification format recognition
   - Material code and identification extraction
   - Dimensional data parsing
   - Technical symbol recognition

2. **Region-Based OCR**
   - Context-aware processing for different document regions
   - Optimal parameter selection based on content type
   - Region-specific preprocessing techniques
   - Custom dictionaries for different document sections
   - Text block classification (headings, specifications, captions)

3. **Enhanced Preprocessing**
   - Image deskewing and orientation correction
   - Noise reduction and artifact removal
   - Contrast enhancement for low-quality scans
   - Background removal and text isolation
   - Resolution optimization for OCR accuracy

### Multi-Language and Text Recognition

The system supports advanced text recognition across languages:

1. **Language Support**
   - Multi-language detection and processing
   - Primary language identification
   - Mixed language document handling
   - Language-specific optimization
   - Character set and encoding management

2. **Handwriting Recognition**
   - Handwritten note extraction from technical documents
   - Signature identification and processing
   - Margin annotation recognition
   - Confidence scoring for handwritten content
   - Context-based interpretation

3. **Special Content Processing**
   - Table structure recognition
   - Form field extraction
   - List and bullet point processing
   - Symbol and icon detection
   - Mathematical formula recognition

### Confidence Scoring and Quality Assurance

The system includes comprehensive quality assessment:

1. **OCR Confidence Metrics**
   - Character-level confidence scoring
   - Word and phrase reliability assessment
   - Region-specific quality evaluation
   - Alternative interpretations for low-confidence text
   - Statistical analysis of extraction quality

2. **Post-Processing Rules**
   - Domain-specific error correction
   - Common OCR error pattern resolution
   - Technical term standardization
   - Unit format normalization
   - Contextual validation and correction

3. **Validation Techniques**
   - Pattern-based verification
   - Dictionary matching
   - Contextual analysis
   - Format validation
   - Human-in-the-loop verification flags

## Technical Implementation

### OCR Engine Integration

The OCR system leverages Tesseract with enhancements:

1. **Core Engine**
   - Tesseract OCR as primary engine
   - Custom parameter optimization
   - Page segmentation mode selection
   - Engine mode configuration
   - Language pack integration

2. **Enhancement Layer**
   - Specialized dictionaries and training data
   - Custom preprocessing pipeline
   - Post-processing rules engine
   - Confidence scoring system
   - Result validation framework

3. **Python Components**
   - Enhanced OCR orchestration (`enhanced_ocr.py`)
   - Specialized material OCR (`specialized_ocr.py`)
   - Confidence scoring (`ocr_confidence_scoring.py`)
   - Handwriting recognition (`handwriting_recognition.py`)
   - Form field extraction (`form_field_extraction.py`)

### OCR Service Implementation

The system provides TypeScript services for OCR processing:

```typescript
interface OCROptions {
  language?: string;
  ocrEngine?: number;
  preprocess?: boolean;
  confidenceThreshold?: number;
}

interface OCRResult {
  text: string;
  confidence: number;
  words?: Array<{
    word: string;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
  bbox?: [number, number, number, number];
}

// Perform OCR on an image
async function performOCR(
  imagePath: string,
  options: OCROptions = {}
): Promise<SimpleOCRResult> {
  // Implementation details...
}

// Extract text with detailed information
async function extractTextFromImage(
  imagePath: string,
  options: OCROptions = {}
): Promise<OCRResult[]> {
  // Implementation details...
}
```

### Region-Based OCR

The system optimizes OCR for different types of regions:

```typescript
interface RegionType {
  type: 'text' | 'heading' | 'specification' | 'table' | 'caption' | 'technical';
  options?: {
    psm?: number;
    oem?: number;
    preprocessingLevel?: 'none' | 'basic' | 'advanced';
  };
}

interface TextRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: RegionType;
  page: number;
}

interface RegionBasedOCRResult {
  imagePath: string;
  regions: Array<{
    region: TextRegion;
    text: string;
    confidence: number;
    options: any;
  }>;
  processingTimeMs: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

// Process image with region-based OCR
async function processImageWithRegions(
  imagePath: string,
  regions?: TextRegion[]
): Promise<RegionBasedOCRResult> {
  // Implementation details...
}
```

### Enhanced Preprocessing

The system includes specialized preprocessing techniques:

```typescript
interface PreprocessingOptions {
  deskew?: boolean;
  denoise?: boolean;
  contrast?: boolean;
  binarize?: boolean;
  removeBackground?: boolean;
  resolution?: 'original' | 'enhanced' | 'reduced';
}

// Preprocess an image to improve OCR accuracy
async function preprocessImage(
  imagePath: string,
  options: PreprocessingOptions = {}
): Promise<string> {
  // Implementation details...
}
```

### OCR Confidence Scoring

The system evaluates and improves OCR quality:

```python
class OCRConfidenceScorer:
    """Class for evaluating OCR quality and improving results"""
    
    def __init__(self, config):
        """Initialize the OCR confidence scorer"""
        self.config = {
            'min_confidence': 0.5,
            'post_processing_enabled': True,
            'use_language_model': True,
            'domain_specific_correction': True,
            'correction_level': 'aggressive'
        }
        
        # Override defaults with provided config
        if config:
            self.config.update(config)
            
        # Initialize rules engine
        self.rules_engine = RulesEngine(self.config)
    
    def process_ocr_results(self, ocr_data):
        """
        Process OCR results to improve quality and provide confidence metrics
        
        Args:
            ocr_data: Dictionary containing OCR results
            
        Returns:
            Enhanced OCR results with confidence metrics
        """
        # Implementation details...
```

## Integration with Other Systems

### PDF Processing Pipeline

The OCR system is integrated with the PDF processing pipeline:

1. **Processing Flow**
   - PDF parsing and image extraction
   - Page segmentation and layout analysis
   - Region identification and classification
   - Region-based OCR processing
   - Text consolidation and association

2. **Error Handling**
   - OCR-specific error recovery strategies
   - Alternative OCR approaches based on retry count
   - Preprocessing adjustments for failed regions
   - Resolution adaptation for better results
   - Fallback mechanisms for critical failures

3. **Result Integration**
   - Text extraction results merged with document structure
   - OCR confidence data attached to extracted text
   - Region information preserved for downstream processing
   - OCR metadata included for quality assessment
   - Processing statistics for performance monitoring

### Text-Image Association

The OCR system feeds into text-image association:

```typescript
// Associate text with images based on OCR results
async function associateTextWithImages(
  imagePaths: string[],
  imagePositions: { x: number; y: number; width: number; height: number; page: number }[],
  ocrResults: TextBlock[]
): Promise<ImageTextAssociation[]> {
  // Implementation details...
}
```

### Metadata Field Extraction

The OCR system supports structured data extraction:

```typescript
// Extract value for a metadata field from OCR text
export function extractValueFromOCR(field: MetadataFieldDocument, ocrText: string): any {
  if (!field.hint && (!field.extractionPatterns || field.extractionPatterns.length === 0)) {
    return null;
  }
  
  // Try extraction patterns if defined
  if (field.extractionPatterns && field.extractionPatterns.length > 0) {
    for (const pattern of field.extractionPatterns) {
      const regex = new RegExp(pattern, 'i');
      const match = ocrText.match(regex);
      if (match && match[1]) {
        return {
          value: match[1].trim(),
          extractionMethod: 'pattern',
          extractionPattern: pattern,
          extractionQuality: 'high',
          confidence: 0.9
        };
      }
    }
  }
  
  // Implementation details...
}
```

## API Usage Examples

### Basic OCR Processing

```typescript
import { performOCR, OCROptions } from '@kai/server/services/pdf/ocrService';

async function extractTextFromImage() {
  try {
    // Configure OCR options
    const options: OCROptions = {
      language: 'eng',
      ocrEngine: 3, // LSTM engine
      preprocess: true,
      confidenceThreshold: 65
    };
    
    // Perform OCR on an image
    const result = await performOCR('path/to/image.jpg', options);
    
    console.log(`Extracted text: ${result.text}`);
    console.log(`Confidence: ${result.confidence}%`);
    
    // Process the extracted text
    if (result.confidence > 80) {
      // High confidence text processing
      console.log('High confidence text detected');
    } else {
      // Low confidence text may need verification
      console.log('Text may need verification');
    }
  } catch (error) {
    console.error('OCR processing failed:', error);
  }
}
```

### Region-Based OCR

```typescript
import { processImageWithRegions, TextRegion } from '@kai/server/services/pdf/regionBasedOCR';

async function extractStructuredContent() {
  try {
    // Define regions for targeted OCR
    const regions: TextRegion[] = [
      {
        x: 100, y: 200, width: 400, height: 100,
        type: { type: 'heading' },
        page: 1
      },
      {
        x: 100, y: 300, width: 400, height: 300,
        type: { 
          type: 'specification',
          options: {
            psm: 6, // Assume single uniform block of text
            preprocessingLevel: 'advanced'
          }
        },
        page: 1
      }
    ];
    
    // Process image with region-based OCR
    const result = await processImageWithRegions('path/to/catalog_page.jpg', regions);
    
    console.log(`Processing status: ${result.status}`);
    console.log(`Processing time: ${result.processingTimeMs}ms`);
    
    // Process extracted regions
    result.regions.forEach(region => {
      console.log(`Region type: ${region.region.type.type}`);
      console.log(`Extracted text: ${region.text}`);
      console.log(`Confidence: ${region.confidence}%`);
    });
    
    // Extract specifications from the relevant region
    const specRegion = result.regions.find(r => r.region.type.type === 'specification');
    if (specRegion) {
      console.log('Material specifications:', specRegion.text);
      // Further process specifications
    }
  } catch (error) {
    console.error('Region-based OCR failed:', error);
  }
}
```

### Enhanced OCR with Python Components

```typescript
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function runEnhancedOCR(imagePath: string, options = {}) {
  try {
    // Prepare options for enhanced OCR
    const enhancedOptions = {
      language: 'eng',
      materialType: 'tile',
      confidenceThreshold: 70,
      enablePostProcessing: true,
      ...options
    };
    
    // Convert options to command line arguments
    const args = [
      path.join(__dirname, '../../../ml/python/enhanced_ocr.py'),
      imagePath,
      '--language', enhancedOptions.language,
      '--material-type', enhancedOptions.materialType,
      '--confidence-threshold', enhancedOptions.confidenceThreshold.toString()
    ];
    
    if (enhancedOptions.enablePostProcessing) {
      args.push('--enable-post-processing');
    }
    
    // Run the Python script
    const result = spawnSync('python', args, { encoding: 'utf8' });
    
    if (result.error) {
      throw new Error(`Enhanced OCR process failed: ${result.error.message}`);
    }
    
    if (result.status !== 0) {
      throw new Error(`Enhanced OCR process exited with code ${result.status}: ${result.stderr}`);
    }
    
    // Parse the result JSON
    const outputPath = path.join(
      path.dirname(imagePath),
      'ocr_results',
      `${path.basename(imagePath, path.extname(imagePath))}_enhanced_ocr.json`
    );
    
    if (fs.existsSync(outputPath)) {
      const ocrData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      console.log('Enhanced OCR processing completed successfully');
      return ocrData;
    } else {
      throw new Error('Enhanced OCR output file not found');
    }
  } catch (error) {
    console.error('Enhanced OCR processing failed:', error);
    throw error;
  }
}
```

## Performance Considerations

1. **Processing Time**
   - Basic OCR: 1-2 seconds per page for standard resolution
   - Enhanced OCR: 3-5 seconds per page with full preprocessing
   - Region-based OCR: Varies based on region count and complexity
   - Full pipeline: 5-10 seconds per page for complete processing

2. **Resource Requirements**
   - CPU: Multi-core recommended for parallel processing
   - Memory: 4GB+ for large images or multi-page documents
   - GPU: Optional but beneficial for enhanced preprocessing
   - Storage: Temporary space for intermediate files (2-3x input size)
   - Dependencies: Tesseract OCR 4.1+, Python 3.7+

3. **Accuracy Factors**
   - Image quality has the highest impact on accuracy
   - Resolution should be at least 300 DPI for optimal results
   - Text contrast significantly affects recognition quality
   - Font type and size impact character recognition
   - Background complexity can reduce accuracy

4. **Optimization Strategies**
   - Parallel processing of multiple images
   - Region-based processing to focus on high-value content
   - Resolution tuning for optimal accuracy/speed balance
   - Language-specific model selection
   - Memory-efficient processing for large documents

5. **Scalability Considerations**
   - Queue-based processing for bulk documents
   - Worker pool for parallel OCR tasks
   - Concurrency limits to prevent resource exhaustion
   - Prioritization for time-sensitive processing
   - Incremental processing for very large documents