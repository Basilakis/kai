// Test file for MaterialRecognizerService with enhanced TilePatternProcessor integration

import { MaterialRecognizerService, MaterialRecognitionResult } from '../src/services/recognition/material-recognizer-service';
import { TilePatternProcessor, TilePatternResult } from '../src/services/recognition/tile-pattern-processor';
import { PDFTileExtractor, PDFExtractionResult } from '../src/services/recognition/pdf-tile-extractor';

// Mock the TilePatternProcessor
jest.mock('../src/services/recognition/tile-pattern-processor', () => {
  return {
    TilePatternProcessor: jest.fn().mockImplementation(() => {
      return {
        processPattern: jest.fn().mockImplementation(async (imageData: Buffer, metadata?: any) => {
          return {
            patternType: 'marble-tile',
            confidence: 0.85,
            similarPatterns: ['granite-tile', 'quartz-composite'],
            qualityAssessment: {
              overall: 0.75,
              resolution: 0.8,
              contrast: 0.7,
              noise: 0.65,
              texture: 0.85
            }
          };
        })
      };
    })
  };
});

// Mock the PDFTileExtractor
jest.mock('../src/services/recognition/pdf-tile-extractor', () => {
  return {
    PDFTileExtractor: jest.fn().mockImplementation(() => {
      return {
        extractTilePatterns: jest.fn().mockImplementation(async (pdfData: Buffer, options?: any) => {
          // Return a mock extraction result
          return {
            images: [
              Buffer.from('fake tile image 1'),
              Buffer.from('fake tile image 2')
            ],
            metadata: [
              {
                pageNumber: 1,
                regionId: 'r1p1',
                dimensions: { width: 30, height: 30, unit: 'cm' },
                specifications: {
                  'Material': 'Ceramic',
                  'Finish': 'Matte'
                },
                manufacturer: 'TileCorp',
                productCode: 'TC-101'
              },
              {
                pageNumber: 2,
                regionId: 'r1p2',
                dimensions: { width: 20, height: 20, unit: 'cm' },
                specifications: {
                  'Material': 'Porcelain',
                  'Finish': 'Glossy'
                },
                manufacturer: 'TileCorp',
                productCode: 'TC-102'
              }
            ],
            processingStats: {
              pagesProcessed: 2,
              imagesExtracted: 2,
              averageImageQuality: 0.82,
              processingTimeMs: 1200
            }
          };
        })
      };
    })
  };
});

describe('MaterialRecognizerService', () => {
  let service: MaterialRecognizerService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (MaterialRecognizerService as any).instance = null;
    service = MaterialRecognizerService.getInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = MaterialRecognizerService.getInstance();
      const instance2 = MaterialRecognizerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('preprocessImage', () => {
    it('should correctly preprocess image data', async () => {
      const imageData = Buffer.from('fake image data');
      
      // Access the private method using Type assertion
      const preprocessedImageData = await (service as any).preprocessImage(imageData);
      
      expect(preprocessedImageData).toBeDefined();
      expect(preprocessedImageData).toBeInstanceOf(Buffer);
    });
  });

  describe('isTilePattern', () => {
    it('should determine if an image contains a tile pattern', async () => {
      const imageData = Buffer.from('fake tile pattern image');
      
      // Mock Math.random to ensure consistent test results
      const originalRandom = Math.random;
      // Use a direct function assignment rather than jest.fn() to avoid type issues
      Math.random = () => 0.8; // Will return true in implementation
      
      // Access the private method
      const isTile = await (service as any).isTilePattern(imageData);
      
      expect(isTile).toBeDefined();
      expect(typeof isTile).toBe('boolean');
      expect(isTile).toBe(true);
      
      // Restore original Math.random
      Math.random = originalRandom;
    });
    
    it('should handle errors gracefully', async () => {
      // Force an error by passing undefined
      const result = await (service as any).isTilePattern(undefined);
      
      // Should return false on error
      expect(result).toBe(false);
    });
  });

  describe('recognizeTilePattern', () => {
    it('should use TilePatternProcessor to recognize tile patterns', async () => {
      const imageData = Buffer.from('fake tile pattern image');
      
      // Test the private method
      const result = await (service as any).recognizeTilePattern(imageData);
      
      expect(result).toBeDefined();
      expect(result.materialType).toBe('marble-tile');
      expect(result.confidence).toBe(0.85);
      expect(result.alternativeSuggestions).toEqual(['granite-tile', 'quartz-composite']);
      expect(result.qualityAssessment).toBeDefined();
      expect(result.qualityAssessment.overall).toBe(0.75);
      expect(result.properties.patternFamily).toBe('marble');
    });
    
    it('should handle errors gracefully', async () => {
      // Mock TilePatternProcessor to throw an error
      const mockProcessor = {
        processPattern: jest.fn().mockRejectedValue(new Error('Test error'))
      };
      (service as any).tilePatternProcessor = mockProcessor;
      
      const result = await (service as any).recognizeTilePattern(Buffer.from(''));
      
      expect(result.materialType).toBe('unknown-tile');
      expect(result.confidence).toBe(0.1);
    });
  });

  describe('determinePatternFamily', () => {
    it('should identify pattern families correctly', () => {
      expect((service as any).determinePatternFamily('marble-white')).toBe('marble');
      expect((service as any).determinePatternFamily('granite-black')).toBe('granite');
      expect((service as any).determinePatternFamily('ceramic-glazed')).toBe('ceramic');
      expect((service as any).determinePatternFamily('porcelain-tile')).toBe('porcelain');
      expect((service as any).determinePatternFamily('quartz-countertop')).toBe('engineered-stone');
      expect((service as any).determinePatternFamily('wood-look-tile')).toBe('wood-look');
      expect((service as any).determinePatternFamily('concrete-tile')).toBe('concrete');
      expect((service as any).determinePatternFamily('mosaic-pattern')).toBe('mosaic');
      expect((service as any).determinePatternFamily('unknown-pattern')).toBe('other');
    });
  });

  describe('recognizeMaterial', () => {
    it('should recognize tile patterns and return enhanced results', async () => {
      const imageData = Buffer.from('fake tile pattern image');
      
      // Mock isTilePattern to always return true for this test
      (service as any).isTilePattern = jest.fn().mockResolvedValue(true);
      
      const result = await service.recognizeMaterial(imageData);
      
      expect(result).toBeDefined();
      expect(result.materialType).toBe('marble-tile');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.qualityAssessment).toBeDefined();
      expect(result.alternativeSuggestions?.length).toBeGreaterThan(0);
    });
    
    it('should handle non-tile materials', async () => {
      const imageData = Buffer.from('fake non-tile image');
      
      // Mock isTilePattern to always return false for this test
      (service as any).isTilePattern = jest.fn().mockResolvedValue(false);
      
      const result = await service.recognizeMaterial(imageData);
      
      expect(result).toBeDefined();
      expect(result.materialType).toBe('general-material');
      expect(result.confidence).toBeGreaterThan(0);
    });
    
    it('should handle errors gracefully', async () => {
      // Force an error by making isTilePattern throw
      (service as any).isTilePattern = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await service.recognizeMaterial(Buffer.from(''));
      
      expect(result.materialType).toBe('unknown');
      expect(result.confidence).toBe(0.1);
    });
  });

  describe('extractTilePatternsFromPDF', () => {
    it('should extract tile patterns from PDF data', async () => {
      const pdfData = Buffer.from('fake PDF data');
      
      // Test the private method
      const result = await (service as any).extractTilePatternsFromPDF(pdfData);
      
      expect(result).toBeDefined();
      expect(result.images.length).toBe(2);
      expect(result.metadata.length).toBe(2);
      expect(result.processingStats.pagesProcessed).toBe(2);
      expect(result.processingStats.imagesExtracted).toBe(2);
    });
    
    it('should handle errors gracefully', async () => {
      // Mock PDFTileExtractor to throw an error
      (service as any).pdfTileExtractor = {
        extractTilePatterns: jest.fn().mockRejectedValue(new Error('PDF extraction error'))
      };
      
      const result = await (service as any).extractTilePatternsFromPDF(Buffer.from(''));
      
      expect(result.images.length).toBe(0);
      expect(result.metadata.length).toBe(0);
      expect(result.processingStats.pagesProcessed).toBe(0);
    });
  });

  describe('recognizeInput', () => {
    it('should automatically detect and process PDFs', async () => {
      // Create a fake PDF buffer with PDF signature
      const pdfSignature = Buffer.from('%PDF-1.5');
      const pdfContent = Buffer.concat([pdfSignature, Buffer.from('fake PDF content')]);
      
      // Test the unified entry point with auto-detection
      const results = await service.recognizeInput(pdfContent);
      
      // Should be treated as a PDF and return an array of results
      expect(Array.isArray(results)).toBe(true);
      expect((results as MaterialRecognitionResult[]).length).toBe(2);
    });
    
    it('should process images directly', async () => {
      // Create a fake image buffer without PDF signature
      const imageData = Buffer.from('fake image data');
      
      // Test the unified entry point with auto-detection
      const result = await service.recognizeInput(imageData);
      
      // Should be treated as an image and return a single result
      expect(Array.isArray(result)).toBe(false);
      expect((result as MaterialRecognitionResult).materialType).toBe('marble-tile');
    });
    
    it('should respect explicit type specification', async () => {
      // Create an ambiguous buffer
      const ambiguousData = Buffer.from('ambiguous data');
      
      // Test with explicit PDF specification
      const pdfResults = await service.recognizeInput(ambiguousData, { isPDF: true });
      expect(Array.isArray(pdfResults)).toBe(true);
      
      // Test with explicit image specification
      const imageResult = await service.recognizeInput(ambiguousData, { isPDF: false });
      expect(Array.isArray(imageResult)).toBe(false);
    });
    
    it('should handle detection errors gracefully', async () => {
      // Mock detectPdfFormat to throw an error
      (service as any).detectPdfFormat = jest.fn().mockImplementation(() => {
        throw new Error('Detection error');
      });
      
      // Should default to image processing on detection error
      const result = await service.recognizeInput(Buffer.from('error data'));
      expect((result as MaterialRecognitionResult).materialType).toBe('marble-tile');
    });
    
    it('should handle processing errors gracefully', async () => {
      // Mock both PDF and image processing to throw errors
      (service as any).recognizeMaterialFromPDF = jest.fn().mockRejectedValue(new Error('PDF processing error'));
      (service as any).recognizeMaterial = jest.fn().mockRejectedValue(new Error('Image processing error'));
      
      // Should return an error result
      const result = await service.recognizeInput(Buffer.from('data'));
      expect((result as MaterialRecognitionResult).materialType).toBe('unknown');
      expect((result as MaterialRecognitionResult).confidence).toBe(0.1);
      expect((result as MaterialRecognitionResult).properties?.error).toBeDefined();
    });
  });

  describe('detectPdfFormat', () => {
    it('should detect PDF format from signature', async () => {
      // Create a buffer with PDF signature
      const pdfData = Buffer.from('%PDF-1.5 fake PDF content');
      
      // Test the private method
      const isPdf = await (service as any).detectPdfFormat(pdfData);
      
      expect(isPdf).toBe(true);
    });
    
    it('should reject non-PDF data', async () => {
      // Create a buffer without PDF signature
      const imageData = Buffer.from('JFIF fake JPEG content');
      
      // Test the private method
      const isPdf = await (service as any).detectPdfFormat(imageData);
      
      expect(isPdf).toBe(false);
    });
    
    it('should handle errors gracefully', async () => {
      // Test with undefined to force an error
      const isPdf = await (service as any).detectPdfFormat(undefined);
      
      expect(isPdf).toBe(false);
    });
  });
  
  describe('recognizeMaterialFromPDF', () => {
    it('should process a PDF and return recognized materials', async () => {
      const pdfData = Buffer.from('fake PDF data');
      
      // Test the public method
      const results = await service.recognizeMaterialFromPDF(pdfData);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      // Check first result
      expect(results[0].materialType).toBe('marble-tile');
      expect(results[0].confidence).toBeGreaterThan(0.5);
      expect(results[0].properties?.pdfSource?.pageNumber).toBe(1);
      expect(results[0].properties?.dimensions?.width).toBe(30);
      
      // Check second result
      expect(results[1].materialType).toBe('marble-tile');
      expect(results[1].properties?.pdfSource?.pageNumber).toBe(2);
      expect(results[1].properties?.specifications?.Material).toBe('Porcelain');
    });
    
    it('should handle PDFs with no tile patterns', async () => {
      // Mock extractTilePatternsFromPDF to return empty results
      (service as any).extractTilePatternsFromPDF = jest.fn().mockResolvedValue({
        images: [],
        metadata: [],
        processingStats: { pagesProcessed: 0, imagesExtracted: 0, averageImageQuality: 0, processingTimeMs: 0 }
      });
      
      const results = await service.recognizeMaterialFromPDF(Buffer.from('empty PDF'));
      
      expect(results.length).toBe(1);
      expect(results[0].materialType).toBe('unknown');
      expect(results[0].confidence).toBe(0.1);
      expect(results[0].properties?.reason).toBe('No tile patterns found in PDF');
    });
    
    it('should handle errors gracefully', async () => {
      // Force a top-level error in the PDF processing
      (service as any).extractTilePatternsFromPDF = jest.fn().mockRejectedValue(new Error('Catastrophic PDF error'));
      
      const results = await service.recognizeMaterialFromPDF(Buffer.from('broken PDF'));
      
      expect(results.length).toBe(1);
      expect(results[0].materialType).toBe('unknown');
      expect(results[0].confidence).toBe(0.1);
      expect(results[0].properties?.error).toBe('Error processing PDF document');
    });
  });
});