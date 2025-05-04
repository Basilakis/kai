import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  trainModelForProperty,
  prepareDatasetForProperty,
  predictPropertyFromImage,
  MaterialType
} from '@kai/ml';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { validateRequestSchema } from '../../middleware/validate-request-schema.middleware';
import { body, param, query } from 'express-validator';
import { getMetadataFieldsByMaterialType } from '@kai/ml';
import { prisma } from '../../services/prisma';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'visual-references');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @route GET /api/ai/visual-reference/properties
 * @desc Get all properties with visual references
 * @access Admin
 */
router.get(
  '/properties',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const materialType = req.query.materialType as MaterialType | undefined;

      // Get properties from database
      const properties = await prisma.visualPropertyReference.findMany({
        where: {
          materialType: materialType || undefined
        },
        distinct: ['propertyName', 'materialType'],
        select: {
          id: true,
          propertyName: true,
          materialType: true,
          displayName: true,
          description: true,
          previewImage: true,
          _count: {
            select: {
              references: true
            }
          }
        }
      });

      // Format response
      const formattedProperties = properties.map(property => ({
        id: property.id,
        name: property.propertyName,
        materialType: property.materialType,
        displayName: property.displayName,
        description: property.description,
        previewImage: property.previewImage,
        referenceCount: property._count.references
      }));

      res.json({
        success: true,
        properties: formattedProperties
      });
    } catch (error) {
      console.error('Error getting properties:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting properties',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route GET /api/ai/visual-reference/properties/:propertyName/references
 * @desc Get visual references for a property
 * @access Admin
 */
router.get(
  '/properties/:propertyName/references',
  authMiddleware,
  adminMiddleware,
  [
    param('propertyName').isString().notEmpty().withMessage('Property name is required'),
    query('materialType').optional().isString()
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName } = req.params;
      const materialType = req.query.materialType as MaterialType | undefined;

      // Get references from database
      const references = await prisma.visualPropertyReferenceItem.findMany({
        where: {
          reference: {
            propertyName,
            materialType: materialType || undefined
          }
        },
        include: {
          reference: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.json({
        success: true,
        references
      });
    } catch (error) {
      console.error('Error getting references:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting references',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/visual-reference/upload
 * @desc Upload visual references for a property
 * @access Admin
 */
router.post(
  '/upload',
  authMiddleware,
  adminMiddleware,
  upload.array('files', 20),
  [
    body('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('propertyValue').isString().notEmpty().withMessage('Property value is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName, propertyValue, materialType } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      // Get metadata field for this property
      const metadataFields = await getMetadataFieldsByMaterialType(materialType as MaterialType);
      const propertyField = metadataFields.find(field => field.name === propertyName);

      // Get or create visual property reference
      let reference = await prisma.visualPropertyReference.findFirst({
        where: {
          propertyName,
          materialType: materialType as MaterialType
        }
      });

      if (!reference) {
        reference = await prisma.visualPropertyReference.create({
          data: {
            propertyName,
            materialType: materialType as MaterialType,
            displayName: propertyField?.displayName || propertyName,
            description: propertyField?.description || '',
            previewImage: files[0].path
          }
        });
      }

      // Create reference items
      const referenceItems = await Promise.all(
        files.map(async (file) => {
          return prisma.visualPropertyReferenceItem.create({
            data: {
              referenceId: reference!.id,
              imagePath: file.path,
              propertyValue,
              metadata: {
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype
              }
            }
          });
        })
      );

      res.json({
        success: true,
        message: `Uploaded ${files.length} files`,
        reference,
        referenceItems
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading files',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/visual-reference/train
 * @desc Train a model for a property
 * @access Admin
 */
router.post(
  '/train',
  authMiddleware,
  adminMiddleware,
  [
    body('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required'),
    body('options').optional().isObject().withMessage('Options must be an object')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName, materialType, options } = req.body;

      // Parse optimization options
      const trainingOptions = {
        epochs: options?.epochs || 20,
        batchSize: options?.batchSize || 32,
        learningRate: options?.learningRate || 0.001,
        validationSplit: options?.validationSplit || 0.2,
        augmentation: options?.useDataAugmentation !== undefined ? options.useDataAugmentation : true,
        transferLearning: options?.useTransferLearning !== undefined ? options.useTransferLearning : true
      };

      // Start training in background
      const trainingJob = {
        id: uuidv4(),
        propertyName,
        materialType,
        status: 'pending',
        startTime: new Date(),
        options: trainingOptions
      };

      // Return immediately with job ID
      res.json({
        success: true,
        message: 'Training job started',
        job: trainingJob
      });

      // Prepare dataset and train model in background
      try {
        // Create directories
        const dataDir = path.join(process.cwd(), 'data', 'visual-references', materialType, propertyName);
        const modelDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName);

        fs.mkdirSync(dataDir, { recursive: true });
        fs.mkdirSync(modelDir, { recursive: true });

        // Get references from database
        const references = await prisma.visualPropertyReferenceItem.findMany({
          where: {
            reference: {
              propertyName,
              materialType: materialType as MaterialType
            }
          },
          include: {
            reference: true
          }
        });

        if (references.length === 0) {
          console.error('No references found for property:', propertyName, materialType);
          return;
        }

        // Prepare dataset
        await prepareDatasetForProperty(
          propertyName,
          materialType as MaterialType,
          path.join(process.cwd(), 'uploads', 'visual-references'),
          dataDir
        );

        // Train model with optimization options
        const result = await trainModelForProperty({
          propertyName,
          materialType: materialType as MaterialType,
          trainingDataDir: dataDir,
          modelOutputDir: modelDir,
          ...trainingOptions
        });

        // Update training job status
        console.log('Training completed:', result);

        // Update reference with model info
        await prisma.visualPropertyReference.update({
          where: {
            id: references[0].reference.id
          },
          data: {
            modelPath: result.modelPath,
            modelAccuracy: result.accuracy,
            lastTrainedAt: new Date(),
            // Store training parameters for future reference
            metadata: {
              trainingOptions,
              trainingResult: {
                accuracy: result.accuracy,
                loss: result.loss,
                trainingTime: result.trainingTime,
                completedAt: new Date()
              }
            }
          }
        });
      } catch (error) {
        console.error('Error in background training:', error);

        // Update reference with error info if possible
        try {
          const reference = await prisma.visualPropertyReference.findFirst({
            where: {
              propertyName,
              materialType: materialType as MaterialType
            }
          });

          if (reference) {
            await prisma.visualPropertyReference.update({
              where: {
                id: reference.id
              },
              data: {
                metadata: {
                  ...reference.metadata,
                  lastError: {
                    message: error instanceof Error ? error.message : String(error),
                    timestamp: new Date()
                  }
                }
              }
            });
          }
        } catch (updateError) {
          console.error('Error updating reference with error info:', updateError);
        }
      }
    } catch (error) {
      console.error('Error starting training:', error);
      res.status(500).json({
        success: false,
        message: 'Error starting training',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/visual-reference/predict
 * @desc Predict property value from image
 * @access Private
 */
router.post(
  '/predict',
  authMiddleware,
  upload.single('image'),
  [
    body('propertyName').isString().notEmpty().withMessage('Property name is required'),
    body('materialType').isString().notEmpty().withMessage('Material type is required')
  ],
  validateRequestSchema,
  async (req, res) => {
    try {
      const { propertyName, materialType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No image uploaded'
        });
      }

      // Get reference from database
      const reference = await prisma.visualPropertyReference.findFirst({
        where: {
          propertyName,
          materialType: materialType as MaterialType
        }
      });

      if (!reference || !reference.modelPath) {
        return res.status(404).json({
          success: false,
          message: 'No trained model found for this property'
        });
      }

      // Predict property value
      const modelDir = path.join(process.cwd(), 'models', 'visual-references', materialType, propertyName);

      const prediction = await predictPropertyFromImage(
        propertyName,
        materialType as MaterialType,
        file.path,
        modelDir
      );

      res.json({
        success: true,
        prediction
      });
    } catch (error) {
      console.error('Error predicting property:', error);
      res.status(500).json({
        success: false,
        message: 'Error predicting property',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route POST /api/ai/visual-reference/import
 * @desc Import visual references from a file
 * @access Admin
 */
router.post(
  '/import',
  authMiddleware,
  adminMiddleware,
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Read file content
      const fileContent = fs.readFileSync(file.path, 'utf8');
      let importData: any;
      let importedCount = 0;

      // Parse file based on extension
      if (file.originalname.endsWith('.json')) {
        // Parse JSON
        importData = JSON.parse(fileContent);

        // Process each property
        for (const key in importData) {
          const { property, references } = importData[key];

          // Get or create visual property reference
          let reference = await prisma.visualPropertyReference.findFirst({
            where: {
              propertyName: property.name,
              materialType: property.materialType
            }
          });

          if (!reference) {
            reference = await prisma.visualPropertyReference.create({
              data: {
                propertyName: property.name,
                materialType: property.materialType,
                displayName: property.displayName || property.name,
                description: property.description || '',
                previewImage: property.previewImage || null
              }
            });
          }

          // Create reference items
          for (const item of references) {
            // Check if image exists
            const imagePath = item.imagePath;
            const imageExists = fs.existsSync(imagePath);

            if (!imageExists) {
              console.warn(`Image not found: ${imagePath}`);
              continue;
            }

            // Create reference item
            await prisma.visualPropertyReferenceItem.create({
              data: {
                referenceId: reference.id,
                imagePath: imagePath,
                propertyValue: item.propertyValue,
                metadata: item.metadata || {}
              }
            });

            importedCount++;
          }
        }
      } else if (file.originalname.endsWith('.csv')) {
        // Parse CSV
        const lines = fileContent.split('\n');
        const headers = lines[0].split(',');

        // Validate headers
        const requiredHeaders = ['material_type', 'property_name', 'property_value', 'image_path'];
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));

        if (missingHeaders.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Missing required headers: ${missingHeaders.join(', ')}`
          });
        }

        // Process each line
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',');
          const materialType = values[headers.indexOf('material_type')];
          const propertyName = values[headers.indexOf('property_name')];
          const propertyValue = values[headers.indexOf('property_value')];
          const imagePath = values[headers.indexOf('image_path')];

          // Check if image exists
          const imageExists = fs.existsSync(imagePath);

          if (!imageExists) {
            console.warn(`Image not found: ${imagePath}`);
            continue;
          }

          // Get or create visual property reference
          let reference = await prisma.visualPropertyReference.findFirst({
            where: {
              propertyName,
              materialType
            }
          });

          if (!reference) {
            reference = await prisma.visualPropertyReference.create({
              data: {
                propertyName,
                materialType,
                displayName: propertyName,
                description: '',
                previewImage: null
              }
            });
          }

          // Create reference item
          await prisma.visualPropertyReferenceItem.create({
            data: {
              referenceId: reference.id,
              imagePath: imagePath,
              propertyValue: propertyValue,
              metadata: {}
            }
          });

          importedCount++;
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported file format. Please upload a JSON or CSV file.'
        });
      }

      res.json({
        success: true,
        message: `Imported ${importedCount} references`,
        importedCount
      });
    } catch (error) {
      console.error('Error importing references:', error);
      res.status(500).json({
        success: false,
        message: 'Error importing references',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;
