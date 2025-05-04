/**
 * Unit tests for material-specific OCR module
 */

import { 
  extractValueFromOCR, 
  extractMetadataFromOCR,
  OcrExtractionResult
} from '../utils/material-specific-ocr';
import { 
  detectMaterialType,
  MaterialType,
  MaterialTypeDetectionResult
} from '../utils/material-type-detector';
import { 
  getMetadataFieldsByMaterialType,
  MetadataField
} from '../utils/metadata-field-utils';

// Mock dependencies
jest.mock('../utils/material-type-detector', () => ({
  detectMaterialType: jest.fn(),
  detectMaterialTypeFromText: jest.fn(),
  detectMaterialTypeFromImage: jest.fn()
}));

jest.mock('../utils/metadata-field-utils', () => ({
  getMetadataFieldsByMaterialType: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Material-Specific OCR Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractValueFromOCR', () => {
    it('should extract value using pattern', () => {
      // Arrange
      const field: MetadataField = {
        id: '1',
        name: 'thickness',
        displayName: 'Thickness',
        description: 'Thickness of the material in mm',
        fieldType: 'number',
        isRequired: false,
        order: 1,
        extractionPatterns: ['thickness:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm'],
        categories: ['tile'],
        isActive: true
      };

      const ocrText = 'Product specifications:\nThickness: 10.5 mm\nSize: 60x60 cm';

      // Act
      const result = extractValueFromOCR(field, ocrText);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.value).toBe(10.5);
      expect(result!.confidence).toBe(0.9);
      expect(result!.method).toBe('pattern');
    });

    it('should extract value using hint', () => {
      // Arrange
      const field: MetadataField = {
        id: '1',
        name: 'color',
        displayName: 'Color',
        description: 'Color of the material',
        fieldType: 'text',
        isRequired: false,
        order: 1,
        hint: 'Look for color information',
        categories: ['tile'],
        isActive: true
      };

      const ocrText = 'Product specifications:\nColor: Red\nSize: 60x60 cm';

      // Act
      const result = extractValueFromOCR(field, ocrText);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.value).toBe('Red');
      expect(result!.confidence).toBe(0.7);
      expect(result!.method).toBe('hint');
    });

    it('should return null if no pattern or hint matches', () => {
      // Arrange
      const field: MetadataField = {
        id: '1',
        name: 'nonexistent',
        displayName: 'Nonexistent',
        description: 'Nonexistent field',
        fieldType: 'text',
        isRequired: false,
        order: 1,
        extractionPatterns: ['nonexistent:?\\s*(.+)'],
        categories: ['tile'],
        isActive: true
      };

      const ocrText = 'Product specifications:\nThickness: 10.5 mm\nSize: 60x60 cm';

      // Act
      const result = extractValueFromOCR(field, ocrText);

      // Assert
      expect(result).toBeNull();
    });

    it('should convert value based on field type', () => {
      // Arrange
      const field: MetadataField = {
        id: '1',
        name: 'waterproof',
        displayName: 'Waterproof',
        description: 'Whether the material is waterproof',
        fieldType: 'boolean',
        isRequired: false,
        order: 1,
        extractionPatterns: ['waterproof:?\\s*(yes|no|true|false)'],
        categories: ['tile'],
        isActive: true
      };

      const ocrText = 'Product specifications:\nWaterproof: yes\nSize: 60x60 cm';

      // Act
      const result = extractValueFromOCR(field, ocrText);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.value).toBe(true);
      expect(result!.confidence).toBe(0.9);
      expect(result!.method).toBe('pattern');
    });

    it('should match dropdown options', () => {
      // Arrange
      const field: MetadataField = {
        id: '1',
        name: 'finish',
        displayName: 'Finish',
        description: 'Surface finish of the material',
        fieldType: 'dropdown',
        isRequired: false,
        order: 1,
        extractionPatterns: ['finish:?\\s*(.+)'],
        options: [
          { value: 'matte', label: 'Matte' },
          { value: 'glossy', label: 'Glossy' },
          { value: 'textured', label: 'Textured' }
        ],
        categories: ['tile'],
        isActive: true
      };

      const ocrText = 'Product specifications:\nFinish: Glossy\nSize: 60x60 cm';

      // Act
      const result = extractValueFromOCR(field, ocrText);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.value).toBe('glossy');
      expect(result!.confidence).toBe(0.9);
      expect(result!.method).toBe('pattern');
    });
  });

  describe('extractMetadataFromOCR', () => {
    it('should extract metadata from OCR text', async () => {
      // Arrange
      const ocrText = 'Product specifications:\nTile Type: Ceramic\nColor: Red\nFinish: Glossy\nThickness: 10.5 mm\nSize: 60x60 cm';
      const imagePath = '/path/to/image.jpg';

      // Mock material type detection
      const materialTypeResult: MaterialTypeDetectionResult = {
        materialType: 'tile' as MaterialType,
        confidence: 0.85,
        keywords: ['tile', 'ceramic']
      };
      (detectMaterialType as jest.Mock).mockResolvedValue(materialTypeResult);

      // Mock metadata fields
      const metadataFields: MetadataField[] = [
        {
          id: '1',
          name: 'color',
          displayName: 'Color',
          description: 'Color of the material',
          fieldType: 'text',
          isRequired: false,
          order: 1,
          extractionPatterns: ['color:?\\s*(.+)'],
          categories: ['tile'],
          isActive: true
        },
        {
          id: '2',
          name: 'finish',
          displayName: 'Finish',
          description: 'Surface finish of the material',
          fieldType: 'dropdown',
          isRequired: false,
          order: 2,
          extractionPatterns: ['finish:?\\s*(.+)'],
          options: [
            { value: 'matte', label: 'Matte' },
            { value: 'glossy', label: 'Glossy' },
            { value: 'textured', label: 'Textured' }
          ],
          categories: ['tile'],
          isActive: true
        },
        {
          id: '3',
          name: 'thickness',
          displayName: 'Thickness',
          description: 'Thickness of the material in mm',
          fieldType: 'number',
          isRequired: false,
          order: 3,
          extractionPatterns: ['thickness:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm'],
          categories: ['tile'],
          isActive: true
        },
        {
          id: '4',
          name: 'size',
          displayName: 'Size',
          description: 'Size of the material',
          fieldType: 'text',
          isRequired: false,
          order: 4,
          extractionPatterns: ['size:?\\s*(.+)'],
          categories: ['tile'],
          isActive: true
        }
      ];
      (getMetadataFieldsByMaterialType as jest.Mock).mockResolvedValue(metadataFields);

      // Act
      const result = await extractMetadataFromOCR(ocrText, imagePath);

      // Assert
      expect(result).toBeDefined();
      expect(result.materialType).toBe('tile');
      expect(result.materialTypeConfidence).toBe(0.85);
      expect(result.extractedFields).toBeDefined();
      expect(result.extractedFields.color).toBe('Red');
      expect(result.extractedFields.finish).toBe('glossy');
      expect(result.extractedFields.thickness).toBe(10.5);
      expect(result.extractedFields.size).toBe('60x60 cm');
      expect(result.extractionConfidence).toBeDefined();
      expect(result.extractionMethods).toBeDefined();
      expect(detectMaterialType).toHaveBeenCalledWith(ocrText, imagePath, undefined, undefined);
      expect(getMetadataFieldsByMaterialType).toHaveBeenCalledWith('tile', undefined, undefined);
    });

    it('should handle empty OCR text', async () => {
      // Arrange
      const ocrText = '';

      // Mock material type detection
      const materialTypeResult: MaterialTypeDetectionResult = {
        materialType: 'all' as MaterialType,
        confidence: 0.5
      };
      (detectMaterialType as jest.Mock).mockResolvedValue(materialTypeResult);

      // Mock metadata fields
      (getMetadataFieldsByMaterialType as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await extractMetadataFromOCR(ocrText);

      // Assert
      expect(result).toBeDefined();
      expect(result.materialType).toBe('all');
      expect(result.materialTypeConfidence).toBe(0.5);
      expect(result.extractedFields).toEqual({});
      expect(detectMaterialType).toHaveBeenCalledWith(ocrText, undefined, undefined, undefined);
      expect(getMetadataFieldsByMaterialType).toHaveBeenCalledWith('all', undefined, undefined);
    });
  });
});
