import express, { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../utils/network';
import { ApiError } from '../../middleware/error.middleware';
import multer, { diskStorage } from 'multer';
import path from 'path';
import fs from 'fs';

// Extended interface for Stats to include birthtime
interface StatsWithBirthtime extends fs.Stats {
  birthtime: Date;
}

// Extended interface for Dirent to ensure TypeScript recognizes its properties
interface DirentWithMethods extends fs.Dirent {
  isDirectory(): boolean;
  name: string;
}
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { 
  trainModel,
  generateFeatureDescriptors,
  trainNeuralNetwork,
  createVectorSearchIndex
} from '@kai/ml';

const router = express.Router();

// Admin access with internal-only restriction
const adminAccessMiddleware = authorize({
  roles: ['admin'],
  accessType: NetworkAccessType.INTERNAL_ONLY
});

// Configure multer for dataset uploads
const storage = diskStorage({
  destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'training-data');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for training datasets
  }
});

/**
 * @route   POST /api/admin/model/train
 * @desc    Train a material recognition model
 * @access  Private (Admin only)
 */
router.post(
  '/train',
  authMiddleware,
  adminAccessMiddleware,
  upload.single('dataset'),
  asyncHandler(async (req: Request, res: Response) => {
    const datasetPath = req.file?.path || req.body.datasetPath;
    
    if (!datasetPath) {
      throw new ApiError(400, 'No dataset provided. Upload a file or specify a dataset path.');
    }
    
    const modelOutputDir = req.body.outputDir || path.join(process.cwd(), 'models', 'material-recognition');
    const modelType = req.body.modelType || 'hybrid';
    const epochs = parseInt(req.body.epochs) || 10;
    const batchSize = parseInt(req.body.batchSize) || 32;
    const learningRate = parseFloat(req.body.learningRate) || 0.001;
    
    // Create the output directory if it doesn't exist
    fs.mkdirSync(modelOutputDir, { recursive: true });
    
    try {
      // Start the training process
      const trainingResult = await trainModel(
        datasetPath,
        modelOutputDir,
        {
          modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
          epochs,
          batchSize,
          learningRate
        }
      );
      
      // If dataset was uploaded, clean it up (optional)
      if (req.file && req.body.cleanupDataset === 'true') {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.warn(`Failed to clean up dataset file: ${err}`);
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Model training completed successfully',
        modelPath: trainingResult.modelPath,
        accuracy: trainingResult.accuracy,
        loss: trainingResult.loss
      });
    } catch (err) {
      logger.error(`Model training failed: ${err}`);
      throw new ApiError(500, `Model training failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/admin/model/features
 * @desc    Generate feature descriptors from a dataset
 * @access  Private (Admin only)
 */
router.post(
  '/features',
  authMiddleware,
  adminAccessMiddleware,
  upload.single('dataset'),
  asyncHandler(async (req: Request, res: Response) => {
    const datasetPath = req.file?.path || req.body.datasetPath;
    
    if (!datasetPath) {
      throw new ApiError(400, 'No dataset provided. Upload a file or specify a dataset path.');
    }
    
    const outputFile = req.body.outputFile || path.join(process.cwd(), 'models', 'descriptors', 'feature_descriptors.npz');
    
    // Create the output directory if it doesn't exist
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    
    try {
      // Generate feature descriptors
      const result = await generateFeatureDescriptors(
        datasetPath,
        outputFile
      );
      
      // If dataset was uploaded, clean it up (optional)
      if (req.file && req.body.cleanupDataset === 'true') {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.warn(`Failed to clean up dataset file: ${err}`);
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Feature descriptors generated successfully',
        descriptorsFile: result.descriptors_file,
        metadataFile: result.metadata_file,
        materialCount: result.material_count,
        totalDescriptors: result.total_descriptors
      });
    } catch (err) {
      logger.error(`Feature descriptor generation failed: ${err}`);
      throw new ApiError(500, `Feature descriptor generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/admin/model/neural-network
 * @desc    Train a neural network model for material recognition
 * @access  Private (Admin only)
 */
router.post(
  '/neural-network',
  authMiddleware,
  adminAccessMiddleware,
  upload.single('dataset'),
  asyncHandler(async (req: Request, res: Response) => {
    const datasetPath = req.file?.path || req.body.datasetPath;
    
    if (!datasetPath) {
      throw new ApiError(400, 'No dataset provided. Upload a file or specify a dataset path.');
    }
    
    const modelOutputDir = req.body.outputDir || path.join(process.cwd(), 'models', 'neural-networks');
    const framework = req.body.framework || 'tensorflow';
    const model = req.body.model || 'mobilenetv2';
    const epochs = parseInt(req.body.epochs) || 10;
    const batchSize = parseInt(req.body.batchSize) || 32;
    const imgSize = parseInt(req.body.imgSize) || 224;
    const learningRate = parseFloat(req.body.learningRate) || 0.001;
    
    // Create the output directory if it doesn't exist
    fs.mkdirSync(modelOutputDir, { recursive: true });
    
    try {
      // Train the neural network model
      const result = await trainNeuralNetwork(
        datasetPath,
        modelOutputDir,
        {
          framework: framework as 'tensorflow' | 'pytorch',
          model,
          epochs,
          batchSize,
          imgSize,
          learningRate
        }
      );
      
      // If dataset was uploaded, clean it up (optional)
      if (req.file && req.body.cleanupDataset === 'true') {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.warn(`Failed to clean up dataset file: ${err}`);
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Neural network model trained successfully',
        modelPath: result.model_path,
        metadataPath: result.metadata_path,
        classMappingPath: result.class_mapping_path,
        numClasses: result.num_classes,
        trainingTime: result.training_time,
        accuracy: result.final_accuracy,
        validationAccuracy: result.final_val_accuracy
      });
    } catch (err) {
      logger.error(`Neural network training failed: ${err}`);
      throw new ApiError(500, `Neural network training failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/admin/model/vector-index
 * @desc    Create a vector search index from embeddings
 * @access  Private (Admin only)
 */
router.post(
  '/vector-index',
  authMiddleware,
  adminAccessMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const embeddingsDir = req.body.embeddingsDir;
    
    if (!embeddingsDir) {
      throw new ApiError(400, 'No embeddings directory provided');
    }
    
    const indexPath = req.body.indexPath || path.join(process.cwd(), 'models', 'vector-index', 'materials.index');
    
    // Create the output directory if it doesn't exist
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    
    try {
      // Create the vector search index
      const result = await createVectorSearchIndex(
        embeddingsDir,
        indexPath
      );
      
      res.status(200).json({
        success: true,
        message: 'Vector search index created successfully',
        indexPath: result.index_path,
        metadataPath: result.metadata_path,
        numEmbeddings: result.num_embeddings,
        dimension: result.dimension
      });
    } catch (err) {
      logger.error(`Vector search index creation failed: ${err}`);
      throw new ApiError(500, `Vector search index creation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/model/list
 * @desc    List all available models
 * @access  Private (Admin only)
 */
router.get(
  '/list',
  authMiddleware,
  adminAccessMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const modelsDir = path.join(process.cwd(), 'models');
      
      // Create the models directory if it doesn't exist
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }
      
      // Get all directories in the models directory with proper typing
      // Using two-step type assertion with 'unknown' intermediate type for safety
      const dirents = fs.readdirSync(modelsDir, { withFileTypes: true }) as unknown as fs.Dirent[];
      const modelTypes = dirents
        .filter(dirent => dirent.isDirectory && dirent.isDirectory())
        .map(dirent => dirent.name);
      
      // For each model type, get the models inside
      const models: Record<string, any[]> = {};
      
      for (const modelType of modelTypes) {
        const modelTypeDir = path.join(modelsDir, modelType);
        
        // Get all files in the model type directory with proper typing
        // Using two-step type assertion with 'unknown' intermediate type for safety
        const modelFiles = fs.readdirSync(modelTypeDir, { withFileTypes: true }) as unknown as fs.Dirent[];
        
        // Extract model info from files
        models[modelType] = modelFiles.map(file => {
          const filePath = path.join(modelTypeDir, file.name);
          // Use proper typing for fs.Stats with birthtime
          const stats = fs.statSync(filePath) as fs.Stats & { birthtime: Date };
          
          return {
            name: file.name,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isDirectory: file.isDirectory()
          };
        });
      }
      
      res.status(200).json({
        success: true,
        modelTypes,
        models
      });
    } catch (err) {
      logger.error(`Failed to list models: ${err}`);
      throw new ApiError(500, `Failed to list models: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   DELETE /api/admin/model/:type/:name
 * @desc    Delete a model
 * @access  Private (Admin only)
 */
router.delete(
  '/:type/:name',
  authMiddleware,
  adminAccessMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, name } = req.params;
    
    if (!type || !name) {
      throw new ApiError(400, 'Model type and name are required');
    }
    
    const modelPath = path.join(process.cwd(), 'models', type, name);
    
    try {
      // Check if the model exists
      if (!fs.existsSync(modelPath)) {
        throw new ApiError(404, 'Model not found');
      }
      
      // Delete the model
      if (fs.lstatSync(modelPath).isDirectory()) {
        // Recursively delete directory
        fs.rmdirSync(modelPath, { recursive: true });
      } else {
        // Delete file
        fs.unlinkSync(modelPath);
      }
      
      res.status(200).json({
        success: true,
        message: 'Model deleted successfully',
        modelPath
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to delete model: ${err}`);
      throw new ApiError(500, `Failed to delete model: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

export default router;