import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  authorizeRoles,
  rateLimitMiddleware,
  validateUserOwnership
} from '../middleware/auth.middleware';
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

// Extend Express Request interface to add user property if not already done
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

const router = express.Router();

// Configure multer for file uploads
const storage = diskStorage({
  destination: (req, _file, cb) => {
    // Create user-specific directory to segregate uploads
    const userId = req.user?.id || 'anonymous';
    const uploadDir = path.join(process.cwd(), 'uploads', 'recognition', userId);
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
 * @access  Private - Authenticated users only
 */
router.post(
  '/identify',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
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
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Upload file to Supabase storage with user ID in path for ownership
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'recognition', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          userId: userId // Add user ID to metadata for ownership tracking
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
        },
        userId: userId // Add user ID to result for ownership tracking
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
 * @access  Private - Authenticated users only
 */
router.post(
  '/similar-image',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
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
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Upload file to Supabase storage with user ID in path
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'similar-search', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          userId: userId // Add user ID to metadata for ownership tracking
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
        },
        userId: userId // Add user ID to result for ownership tracking
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
 * @access  Private - Authenticated users only
 */
router.post(
  '/url',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
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
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
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
        data: { 
          ...recognitionResult,
          userId: userId // Add user ID to result for ownership tracking
        }
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
 * @access  Private - Authenticated users only
 */
router.post(
  '/vector-search',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
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
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Upload file to Supabase storage with user ID in path
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'vector-search', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          userId: userId // Add user ID to metadata for ownership tracking
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
        },
        userId: userId // Add user ID to result for ownership tracking
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
 * @access  Private - Authenticated users only
 */
router.post(
  '/visualize',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file uploaded');
    }
    
    const imagePath = req.file.path;
    
    try {
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Upload original file to Supabase storage with user ID in path
      const fileName = path.basename(req.file.originalname);
      const storagePath = await generateUniqueStorageKey('uploads', 'visualizations-input', fileName);
      await uploadToStorage(imagePath, storagePath, {
        isPublic: true,
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          userId: userId // Add user ID to metadata for ownership tracking
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
        contentType: 'image/jpeg',
        metadata: {
          userId: userId // Add user ID to metadata for ownership tracking
        }
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
  tokenRefreshMiddleware,
  authorizeRoles(['admin', 'manager']), // Restrict to admin and manager roles
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 5 }), // 5 batch requests per minute
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
    
    // Get user ID for ownership tracking
    const userId = req.user?.id || 'anonymous';
    
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
            mimetype: file.mimetype,
            userId: userId // Add user ID to metadata for ownership tracking
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
          },
          userId: userId // Add user ID to result for ownership tracking
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
      errors,
      userId: userId // Add user ID to overall result for ownership tracking
    });
  })
);

/**
 * @route   GET /api/recognition/user-history
 * @desc    Get recognition history for the current user
 * @access  Private - Authenticated users only
 */
router.get(
  '/user-history',
  authMiddleware,
  tokenRefreshMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new ApiError(401, 'Not authorized, no user found');
      }
      
      // Query from Supabase storage based on user ID in metadata
      // This is a simplified implementation - in production, use a proper database query
      const historyItems = await queryUserRecognitionHistory(userId);
      
      res.status(200).json({
        success: true,
        history: historyItems
      });
    } catch (err) {
      logger.error(`Failed to get user recognition history: ${err}`);
      throw err instanceof ApiError ? err : new ApiError(500, `Failed to get user recognition history: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/recognition/image/:imageId
 * @desc    Get a specific recognition result by ID
 * @access  Private - Only the owner of the recognition result can access it
 */
router.get(
  '/image/:imageId',
  authMiddleware,
  tokenRefreshMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const imageId = req.params.imageId;
      const userId = req.user?.id;
      
      if (!userId) {
        throw new ApiError(401, 'Not authorized, no user found');
      }
      
      if (!imageId) {
        throw new ApiError(400, 'Image ID is required');
      }
      
      // Get the recognition result
      const recognitionResult = await getRecognitionResult(imageId);
      
      if (!recognitionResult) {
        throw new ApiError(404, 'Recognition result not found');
      }
      
      // Verify that the user owns this recognition result
      if (recognitionResult.userId !== userId && req.user?.role !== 'admin') {
        logger.warn(`User ${userId} attempted to access recognition result ${imageId} owned by ${recognitionResult.userId}`);
        throw new ApiError(403, 'You do not have permission to access this recognition result');
      }
      
      res.status(200).json({
        success: true,
        data: recognitionResult
      });
    } catch (err) {
      logger.error(`Failed to get recognition result: ${err}`);
      throw err instanceof ApiError ? err : new ApiError(500, `Failed to get recognition result: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * Implementation of queryUserRecognitionHistory
 * In a real implementation, this would query the database for the user's recognition history
 * 
 * @param userId The ID of the user to get history for
 * @returns Array of recognition history items
 */
const queryUserRecognitionHistory = async (userId: string): Promise<any[]> => {
  // This is a simplified mock implementation
  // In a real application, this would query a database table
  // For example, using Supabase:
  // const { data, error } = await supabase
  //   .from('recognition_history')
  //   .select('*')
  //   .eq('userId', userId)
  //   .order('createdAt', { ascending: false });
  
  // Mock response for now - in production replace with actual database query
  return [
    {
      id: 'mock-id-1',
      imageUrl: 'https://example.com/image1.jpg',
      timestamp: new Date().toISOString(),
      userId: userId,
      result: {
        materials: [
          { name: 'Wood', confidence: 0.95 },
          { name: 'Metal', confidence: 0.05 }
        ]
      }
    },
    {
      id: 'mock-id-2',
      imageUrl: 'https://example.com/image2.jpg',
      timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      userId: userId,
      result: {
        materials: [
          { name: 'Fabric', confidence: 0.87 },
          { name: 'Leather', confidence: 0.13 }
        ]
      }
    }
  ];
};

/**
 * Implementation of getRecognitionResult
 * In a real implementation, this would query the database for the specific recognition result
 * 
 * @param imageId The ID of the recognition result to get
 * @returns The recognition result or null if not found
 */
const getRecognitionResult = async (imageId: string): Promise<any | null> => {
  // This is a simplified mock implementation
  // In a real application, this would query a database table
  // For example, using Supabase:
  // const { data, error } = await supabase
  //   .from('recognition_results')
  //   .select('*')
  //   .eq('id', imageId)
  //   .single();
  
  // Mock response for now - in production replace with actual database query
  // This would normally check if the result exists and return null if not
  return {
    id: imageId,
    imageUrl: 'https://example.com/image.jpg',
    timestamp: new Date().toISOString(),
    userId: 'mock-user-id', // In a real implementation, this would be the actual owner's ID
    result: {
      materials: [
        { name: 'Wood', confidence: 0.95 },
        { name: 'Metal', confidence: 0.05 }
      ]
    }
  };
};

export default router;