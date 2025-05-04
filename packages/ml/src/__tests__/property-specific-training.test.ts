/**
 * Unit tests for property-specific training module
 */

import * as path from 'path';
import * as fs from 'fs';
import { 
  trainModelForProperty, 
  prepareDatasetForProperty,
  predictPropertyFromImage,
  PropertySpecificTrainingOptions
} from '../property-specific-training';
import { MaterialType } from '../utils/material-type-detector';
import { getMetadataFieldsByMaterialType } from '../utils/metadata-field-utils';

// Mock dependencies
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify({
            accuracy: 0.85,
            loss: 0.15,
            trainingTime: 120,
            epochs: 10,
            modelPath: '/path/to/model.h5'
          })));
        }
      })
    },
    stderr: {
      on: jest.fn()
    },
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    })
  }))
}));

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true)
}));

jest.mock('../utils/metadata-field-utils', () => ({
  getMetadataFieldsByMaterialType: jest.fn(() => Promise.resolve([
    {
      id: '1',
      name: 'color',
      displayName: 'Color',
      description: 'Color of the material',
      fieldType: 'dropdown',
      isRequired: false,
      order: 1,
      options: [
        { value: 'red', label: 'Red' },
        { value: 'blue', label: 'Blue' },
        { value: 'green', label: 'Green' }
      ],
      categories: ['tile', 'all'],
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
      options: [
        { value: 'matte', label: 'Matte' },
        { value: 'glossy', label: 'Glossy' },
        { value: 'textured', label: 'Textured' }
      ],
      categories: ['tile', 'all'],
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
      validation: {
        min: 1,
        max: 50
      },
      categories: ['tile', 'all'],
      isActive: true
    }
  ]))
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Property-Specific Training Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trainModelForProperty', () => {
    it('should train a model for a specific property', async () => {
      // Arrange
      const options: PropertySpecificTrainingOptions = {
        propertyName: 'color',
        materialType: 'tile' as MaterialType,
        trainingDataDir: '/path/to/data',
        modelOutputDir: '/path/to/output',
        epochs: 20,
        batchSize: 32
      };

      // Act
      const result = await trainModelForProperty(options);

      // Assert
      expect(result).toBeDefined();
      expect(result.propertyName).toBe('color');
      expect(result.materialType).toBe('tile');
      expect(result.accuracy).toBe(0.85);
      expect(result.loss).toBe(0.15);
      expect(result.modelPath).toBe('/path/to/model.h5');
      expect(getMetadataFieldsByMaterialType).toHaveBeenCalledWith('tile', undefined, undefined);
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw an error if property not found', async () => {
      // Arrange
      const options: PropertySpecificTrainingOptions = {
        propertyName: 'nonexistent',
        materialType: 'tile' as MaterialType,
        trainingDataDir: '/path/to/data',
        modelOutputDir: '/path/to/output'
      };

      // Act & Assert
      await expect(trainModelForProperty(options)).rejects.toThrow('Property nonexistent not found for material type tile');
    });
  });

  describe('prepareDatasetForProperty', () => {
    it('should prepare a dataset for a specific property', async () => {
      // Mock the spawn implementation for this test
      const mockSpawn = require('child_process').spawn as jest.Mock;
      mockSpawn.mockImplementationOnce(() => ({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({
                numSamples: 100,
                classDistribution: {
                  'red': 30,
                  'blue': 40,
                  'green': 30
                }
              })));
            }
          })
        },
        stderr: {
          on: jest.fn()
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      }));

      // Arrange
      const propertyName = 'color';
      const materialType = 'tile' as MaterialType;
      const inputDir = '/path/to/input';
      const outputDir = '/path/to/output';

      // Act
      const result = await prepareDatasetForProperty(
        propertyName,
        materialType,
        inputDir,
        outputDir
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.propertyName).toBe('color');
      expect(result.materialType).toBe('tile');
      expect(result.numSamples).toBe(100);
      expect(result.classDistribution).toEqual({
        'red': 30,
        'blue': 40,
        'green': 30
      });
      expect(getMetadataFieldsByMaterialType).toHaveBeenCalledWith('tile', undefined, undefined);
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('predictPropertyFromImage', () => {
    it('should predict a property value from an image', async () => {
      // Mock the spawn implementation for this test
      const mockSpawn = require('child_process').spawn as jest.Mock;
      mockSpawn.mockImplementationOnce(() => ({
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify({
                value: 'red',
                confidence: 0.92,
                alternatives: [
                  { value: 'blue', confidence: 0.05 },
                  { value: 'green', confidence: 0.03 }
                ]
              })));
            }
          })
        },
        stderr: {
          on: jest.fn()
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      }));

      // Arrange
      const propertyName = 'color';
      const materialType = 'tile' as MaterialType;
      const imagePath = '/path/to/image.jpg';
      const modelDir = '/path/to/model';

      // Act
      const result = await predictPropertyFromImage(
        propertyName,
        materialType,
        imagePath,
        modelDir
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.propertyName).toBe('color');
      expect(result.materialType).toBe('tile');
      expect(result.value).toBe('red');
      expect(result.confidence).toBe(0.92);
      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives![0].value).toBe('blue');
      expect(result.alternatives![0].confidence).toBe(0.05);
    });

    it('should throw an error if model not found', async () => {
      // Mock fs.existsSync to return false
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      // Arrange
      const propertyName = 'color';
      const materialType = 'tile' as MaterialType;
      const imagePath = '/path/to/image.jpg';
      const modelDir = '/path/to/nonexistent';

      // Act & Assert
      await expect(predictPropertyFromImage(
        propertyName,
        materialType,
        imagePath,
        modelDir
      )).rejects.toThrow('Model not found for color (tile)');
    });
  });
});
