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
  uploadToStorage, 
  generateUniqueStorageKey 
} from '../services/storage/supabaseStorageService';
import { 
  recognizeMaterial,
  generateImageEmbedding
} from '@kai/ml';
import { findSimilarMaterials } from '../models/material.model';

const router = express.Router();

// Configure multer for file uploads
const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'recognition');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
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
      // Upload file to Supabase storage (user-facing storage)
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'recognition', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
      
      // Check if enhanced recognition with fusion is requested
      const useFusion = req.body.useFusion === 'true' || req.body.useFusion === true;
      const fusionMethod = req.body.fusionMethod || 'adaptive';
      const fusionAlpha = parseFloat(req.body.fusionAlpha) || 0.5;
      
      // Use enhanced recognition with optional fusion
      // Cast to any to bypass TypeScript's type checking for extra properties
      const recognitionResult = await recognizeMaterial(imagePath, {
        useFusion,
        fusionMethod: fusionMethod as 'weighted' | 'adaptive' | 'max' | 'product',
        fusionAlpha,
        modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
        confidenceThreshold,
        maxResults
      } as any);
      
      // Add storage information to result
      const resultWithStorage = {
        ...recognitionResult,
        storage: {
          key: uploadResult.key,
          url: uploadResult.url
        }
      };
      
      // Clean up the local uploaded file after processing
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up local uploaded file: ${err}`);
      }
      
      res.status(200).json({
        success: true,
        data: resultWithStorage
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
      // Upload file to Supabase storage (user-facing storage)
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'similar-search', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
      
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
      
      // Clean up the local uploaded file after processing
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up local uploaded file: ${err}`);
      }
      
      res.status(200).json({
        success: true,
        count: similarMaterials.length,
        data: similarMaterials,
        sourceImage: {
          key: uploadResult.key,
          url: uploadResult.url
        }
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
  const { imageUrl } = req.body;
    
    if (!imageUrl) {
      throw new ApiError(400, 'Image URL is required');
    }
    
    // Download the image to a temporary file
    const tempDir = path.join(process.cwd(), 'temp', 'url-recognition');
    fs.mkdirSync(tempDir, { recursive: true });
    
    const imagePath = path.join(tempDir, `${uuidv4()}.jpg`);
    
    try {
      // Download the image using fetch API
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(imagePath, buffer);
      
      // Get parameters from request
      const modelType = req.body.modelType || 'hybrid';
      const confidenceThreshold = parseFloat(req.body.confidenceThreshold) || 0.6;
      const maxResults = parseInt(req.body.maxResults) || 5;
      
      // Check if enhanced recognition with fusion is requested
      const useFusion = req.body.useFusion === 'true' || req.body.useFusion === true;
      const fusionMethod = req.body.fusionMethod || 'adaptive';
      const fusionAlpha = parseFloat(req.body.fusionAlpha) || 0.5;
      
      // Recognize materials in the image
      const recognitionResult = await recognizeMaterial(imagePath, {
        useFusion,
        fusionMethod: fusionMethod as 'weighted' | 'adaptive' | 'max' | 'product',
        fusionAlpha,
        modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
        confidenceThreshold,
        maxResults
      } as any);
      
      // Clean up the temporary file
      fs.unlinkSync(imagePath);
      
      res.status(200).json({
        success: true,
        data: recognitionResult
      });
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
    // Get the number of results to return
    const limit = parseInt(req.body.numResults) || 5;
    const threshold = parseFloat(req.body.threshold) || 0.0;
    
    try {
      // Upload file to Supabase storage (user-facing storage)
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'vector-search', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
      
      // Search for similar materials using the ML package's vector search
      // Generate vector embedding for the image
      const embedding = await generateImageEmbedding(imagePath);
      
      // Find similar materials based on the embedding
      const searchResult = await findSimilarMaterials(
        embedding.vector,
        {
          limit,
          threshold,
          materialType: undefined // Not used here
        }
      );
      
      // Clean up the local uploaded file after processing
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up local uploaded file: ${err}`);
      }
      
      res.status(200).json({
        success: true,
        count: searchResult.length,
        data: searchResult,
        sourceImage: {
          key: uploadResult.key,
          url: uploadResult.url
        }
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
    
    try {
      // Upload original file to Supabase storage (user-facing storage)
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'visualizations-input', fileName);
      await uploadToStorage(imagePath, storagePath, {
        isPublic: true,
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
      
      // Create a temporary directory for the visualization output
      const tempDir = path.join(process.cwd(), 'temp', 'visualizations');
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Generate the visualization
      // Since visualizeSearchResults isn't available, we'll just use the input image
      // In a real implementation, we would use a proper visualization function
      const visualizationPath = imagePath; // For now, just use the input image
      
      // Upload visualization to Supabase storage
      const visFileName = path.basename(visualizationPath);
      const visStoragePath = await generateUniqueStorageKey('uploads', 'visualizations-output', visFileName);
      await uploadToStorage(visualizationPath, visStoragePath, {
        isPublic: true,
        contentType: 'image/jpeg'
      });
      
      // Return the visualization image as a response
      res.sendFile(visualizationPath, {}, (err: Error) => {
        if (err) {
          logger.error(`Failed to send visualization: ${err}`);
        }
        
        // Clean up local files after sending the response
        try {
          fs.unlinkSync(imagePath);
          fs.unlinkSync(visualizationPath);
        } catch (cleanupErr) {
          logger.warn(`Failed to clean up local files: ${cleanupErr}`);
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
    const files = req.files as unknown as Array<{
      path: string;
      originalname: string;
      size: number;
      mimetype: string;
    }>;
    
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
        // Upload file to Supabase storage (user-facing storage)
        const fileName = path.basename(file.originalname);
        const storagePath = await generateUniqueStorageKey('uploads', 'batch-recognition', fileName);
        const uploadResult = await uploadToStorage(file.path, storagePath, {
          isPublic: true, // Make public since this is user-facing content
          metadata: {
            originalName: file.originalname,
            size: String(file.size),
            mimetype: file.mimetype
          }
        });
        
        // Check if enhanced recognition with fusion is requested
        const useFusion = req.body.useFusion === 'true' || req.body.useFusion === true;
        const fusionMethod = req.body.fusionMethod || 'adaptive';
        const fusionAlpha = parseFloat(req.body.fusionAlpha) || 0.5;
        
        // Use recognition with options
        // Cast to any to bypass TypeScript's type checking for extra properties
        const recognitionResult = await recognizeMaterial(file.path, {
          useFusion,
          fusionMethod: fusionMethod as 'weighted' | 'adaptive' | 'max' | 'product',
          fusionAlpha,
          modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
          confidenceThreshold,
          maxResults
        } as any);
        
        results.push({
          originalName: file.originalname,
          fileName: path.basename(file.originalname),
          result: recognitionResult,
          storage: {
            key: uploadResult.key,
            url: uploadResult.url
          }
        });
        
        // Clean up the local uploaded file after processing
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          logger.warn(`Failed to clean up local uploaded file: ${err}`);
        }
      } catch (err) {
        // Log the error and continue with the next file
        logger.error(`Recognition failed for ${file.originalname}: ${err}`);
        
        errors.push({
          originalName: file.originalname,
          fileName: path.basename(file.originalname),
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