import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import multer, { diskStorage } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { 
  recognizeMaterial, 
  recognizeMaterialEnhanced,
  generateImageEmbedding, 
  searchSimilarMaterials,
  visualizeSearchResults
} from '@kai/ml';
import { findSimilarMaterials } from '../models/material.model';

const router = express.Router();

// Configure multer for file uploads
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'recognition');
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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

/**
 * @route   POST /api/recognition/identify
 * @desc    Identify materials from an uploaded image
 * @access  Public
 */
router.post(
  '/identify',
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file uploaded');
    }
    
    const imagePath = req.file.path;
    const modelType = req.body.modelType || 'hybrid';
    const confidenceThreshold = parseFloat(req.body.confidenceThreshold) || 0.6;
    const maxResults = parseInt(req.body.maxResults) || 5;
    
    try {
      // Check if enhanced recognition with fusion is requested
      const useFusion = req.body.useFusion === 'true' || req.body.useFusion === true;
      const fusionMethod = req.body.fusionMethod || 'adaptive';
      const fusionAlpha = parseFloat(req.body.fusionAlpha) || 0.5;
      
      // Use enhanced recognition with optional fusion
      const recognitionResult = await recognizeMaterialEnhanced(imagePath, {
        useFusion,
        fusionMethod: fusionMethod as 'weighted' | 'adaptive' | 'max' | 'product',
        fusionAlpha,
        modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
        confidenceThreshold,
        maxResults
      });
      
      // Clean up the uploaded file after processing
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up uploaded file: ${err}`);
      }
      
      res.status(200).json({
        success: true,
        data: recognitionResult
      });
    } catch (err) {
      // Clean up the uploaded file in case of error
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up uploaded file: ${cleanupErr}`);
      }
      
      logger.error(`Recognition failed: ${err}`);
      throw new ApiError(500, `Recognition failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/recognition/similar-image
 * @desc    Find materials similar to an uploaded image
 * @access  Public
 */
router.post(
  '/similar-image',
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file uploaded');
    }
    
    const imagePath = req.file.path;
    const limit = parseInt(req.body.limit) || 10;
    const threshold = parseFloat(req.body.threshold) || 0.7;
    const materialType = req.body.materialType;
    
    try {
      // Generate vector embedding for the image
      const embedding = await generateImageEmbedding(imagePath);
      
      // Find similar materials based on the embedding
      const similarMaterials = await findSimilarMaterials(
        embedding.vector,
        {
          limit,
          threshold,
          materialType
        }
      );
      
      // Clean up the uploaded file after processing
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up uploaded file: ${err}`);
      }
      
      res.status(200).json({
        success: true,
        count: similarMaterials.length,
        data: similarMaterials
      });
    } catch (err) {
      // Clean up the uploaded file in case of error
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up uploaded file: ${cleanupErr}`);
      }
      
      logger.error(`Similar image search failed: ${err}`);
      throw new ApiError(500, `Similar image search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/recognition/url
 * @desc    Recognize materials from an image URL
 * @access  Public
 */
router.post(
  '/url',
  asyncHandler(async (req: Request, res: Response) => {
    const { imageUrl, modelType, confidenceThreshold, maxResults } = req.body;
    
    if (!imageUrl) {
      throw new ApiError(400, 'Image URL is required');
    }
    
    // Download the image to a temporary file
    const tempDir = path.join(process.cwd(), 'temp', 'url-recognition');
    fs.mkdirSync(tempDir, { recursive: true });
    
    const imagePath = path.join(tempDir, `${uuidv4()}.jpg`);
    
    try {
      // Download the image (in a real implementation, this would use a proper HTTP client)
      // For now, we'll just throw an error to indicate this is not implemented
      throw new ApiError(501, 'Image URL recognition not implemented yet');
      
      // The following code would be used in a real implementation:
      /*
      const response = await fetch(imageUrl);
      const buffer = await response.buffer();
      fs.writeFileSync(imagePath, buffer);
      
      // Recognize materials in the image
      const recognitionResult = await recognizeMaterial(imagePath, {
        modelType: modelType || 'hybrid',
        confidenceThreshold: parseFloat(confidenceThreshold) || 0.6,
        maxResults: parseInt(maxResults) || 5
      });
      
      // Clean up the temporary file
      fs.unlinkSync(imagePath);
      
      res.status(200).json({
        success: true,
        data: recognitionResult
      });
      */
    } catch (err) {
      // Clean up the temporary file in case it was created
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up temporary file: ${cleanupErr}`);
      }
      
      logger.error(`URL recognition failed: ${err}`);
      throw err instanceof ApiError ? err : new ApiError(500, `URL recognition failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/recognition/vector-search
 * @desc    Find similar materials using vector search
 * @access  Public
 */
router.post(
  '/vector-search',
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file uploaded');
    }
    
    const imagePath = req.file.path;
    const indexPath = req.body.indexPath || './data/vector-index/materials.index';
    const numResults = parseInt(req.body.numResults) || 5;
    const threshold = parseFloat(req.body.threshold) || 0.0;
    
    try {
      // Search for similar materials using the ML package's vector search
      const searchResult = await searchSimilarMaterials(
        indexPath,
        imagePath,
        {
          numResults,
          threshold
        }
      );
      
      // Clean up the uploaded file after processing
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up uploaded file: ${err}`);
      }
      
      res.status(200).json({
        success: true,
        query: searchResult.query,
        count: searchResult.results.length,
        searchTime: searchResult.searchTime,
        totalTime: searchResult.totalTime,
        results: searchResult.results
      });
    } catch (err) {
      // Clean up the uploaded file in case of error
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up uploaded file: ${cleanupErr}`);
      }
      
      logger.error(`Vector search failed: ${err}`);
      throw new ApiError(500, `Vector search failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/recognition/visualize
 * @desc    Create a visualization of search results
 * @access  Public
 */
router.post(
  '/visualize',
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file uploaded');
    }
    
    const imagePath = req.file.path;
    const indexPath = req.body.indexPath || './data/vector-index/materials.index';
    const numResults = parseInt(req.body.numResults) || 5;
    
    try {
      // Create a temporary directory for the visualization output
      const tempDir = path.join(process.cwd(), 'temp', 'visualizations');
      fs.mkdirSync(tempDir, { recursive: true });
      
      const outputPath = path.join(tempDir, `vis_${uuidv4()}.jpg`);
      
      // Generate the visualization
      const visualizationPath = await visualizeSearchResults(
        indexPath,
        imagePath,
        outputPath,
        numResults
      );
      
      // Return the visualization image as a response
      res.sendFile(visualizationPath, {}, (err) => {
        if (err) {
          logger.error(`Failed to send visualization: ${err}`);
        }
        
        // Clean up files after sending the response
        try {
          fs.unlinkSync(imagePath);
          fs.unlinkSync(visualizationPath);
        } catch (cleanupErr) {
          logger.warn(`Failed to clean up files: ${cleanupErr}`);
        }
      });
    } catch (err) {
      // Clean up the uploaded file in case of error
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up uploaded file: ${cleanupErr}`);
      }
      
      logger.error(`Visualization failed: ${err}`);
      throw new ApiError(500, `Visualization failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/recognition/batch
 * @desc    Process multiple images for recognition in batch
 * @access  Private (Admin, Manager)
 */
router.post(
  '/batch',
  authMiddleware,
  upload.array('images', 10), // Allow up to 10 images
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw new ApiError(400, 'No image files uploaded');
    }
    
    const modelType = req.body.modelType || 'hybrid';
    const confidenceThreshold = parseFloat(req.body.confidenceThreshold) || 0.6;
    const maxResults = parseInt(req.body.maxResults) || 5;
    
    const results: any[] = [];
    const errors: any[] = [];
    
    // Process each image
    for (const file of files) {
      try {
        // Check if enhanced recognition with fusion is requested
        const useFusion = req.body.useFusion === 'true' || req.body.useFusion === true;
        const fusionMethod = req.body.fusionMethod || 'adaptive';
        const fusionAlpha = parseFloat(req.body.fusionAlpha) || 0.5;
        
        // Use enhanced recognition with optional fusion
        const recognitionResult = await recognizeMaterialEnhanced(file.path, {
          useFusion,
          fusionMethod: fusionMethod as 'weighted' | 'adaptive' | 'max' | 'product',
          fusionAlpha,
          modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
          confidenceThreshold,
          maxResults
        });
        
        results.push({
          originalName: file.originalname,
          fileName: file.filename,
          result: recognitionResult
        });
        
        // Clean up the uploaded file after processing
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.warn(`Failed to clean up uploaded file: ${err}`);
        }
      } catch (err) {
        // Log the error and continue with the next file
        logger.error(`Recognition failed for ${file.originalname}: ${err}`);
        
        errors.push({
          originalName: file.originalname,
          fileName: file.filename,
          error: err instanceof Error ? err.message : String(err)
        });
        
        // Clean up the uploaded file in case of error
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupErr) {
          logger.warn(`Failed to clean up uploaded file: ${cleanupErr}`);
        }
      }
    }
    
    res.status(200).json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    });
  })
);

export default router;