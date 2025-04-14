import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Removed spawn import
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/error.middleware';
import { runMlScript } from '../utils/mlScriptRunner'; // Import the utility
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware
} from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { 
  uploadToStorage, 
  generateUniqueStorageKey 
} from '../services/storage/supabaseStorageService';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Create user-specific directory to segregate uploads
    const userId = req.user?.id || 'anonymous';
    const uploadDir = path.join(process.cwd(), 'uploads', 'material-properties', userId);
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

// Define expected result type
interface MaterialNetResult {
  // Define properties expected from the Python script's JSON output
  // Example:
  properties?: Record<string, string>; // Map of property type to file path/URL
  error?: string;
}

// Removed runMaterialNetExtraction function

/**
 * @route   POST /api/material-properties/extract
 * @desc    Extract PBR properties from an uploaded material image
 * @access  Private - Authenticated users only
 */
router.post(
  '/extract',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 5 }), // 5 requests per minute
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file uploaded');
    }
    
    const imagePath = req.file.path;
    const propertyType = req.body.propertyType; // Optional: specific property to extract
    const quality = req.body.quality || 'medium'; // Optional: quality level (low, medium, high)
    const format = req.body.format || 'png'; // Optional: output format
    
    try {
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Upload file to Supabase storage with user ID in path for ownership
      const fileName = req.file.originalname ? path.basename(req.file.originalname) : 'upload.jpg';
      const storagePath = await generateUniqueStorageKey('uploads', 'material-properties', fileName);
      const uploadResult = await uploadToStorage(imagePath, storagePath, {
        isPublic: true, // Make public since this is user-facing content
        metadata: {
          originalName: req.file.originalname,
          size: req.file.size.toString(),
          mimetype: req.file.mimetype,
          userId: userId // Add user ID to metadata for ownership tracking
        }
      });
      
      // Extract PBR properties using MaterialNet via runMlScript utility
      const scriptArgs = [
        '--image_path', imagePath,
        '--output_format', 'json',
        ...(propertyType ? ['--property_type', propertyType] : []),
        ...(quality ? ['--quality', quality] : []),
        ...(format ? ['--format', format] : [])
      ];
      
      const extractionResult = await runMlScript<MaterialNetResult>({
        scriptPath: 'packages.ml.python.material_net_service', // Use module path
        args: scriptArgs
      });
      
      // Add storage information to the result
      const resultWithStorage = {
        ...extractionResult,
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
      
      logger.error(`PBR property extraction failed: ${err}`);
      // Let the errorHandler middleware handle ApiErrors thrown by runMlScript
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(500, `PBR property extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/material-properties/extract-url
 * @desc    Extract PBR properties from a material image URL
 * @access  Private - Authenticated users only
 */
router.post(
  '/extract-url',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 5 }), // 5 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      throw new ApiError(400, 'Image URL is required');
    }
    
    // Download the image to a temporary file
    const tempDir = path.join(process.cwd(), 'temp', 'material-properties');
    fs.mkdirSync(tempDir, { recursive: true });
    
    const imagePath = path.join(tempDir, `${uuidv4()}.jpg`);
    
    try {
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Download the image using fetch API
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new ApiError(400, `Failed to download image from URL: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(imagePath, buffer);
      
      // Get parameters from request
      const propertyType = req.body.propertyType; // Optional: specific property to extract
      const quality = req.body.quality || 'medium'; // Optional: quality level (low, medium, high)
      const format = req.body.format || 'png'; // Optional: output format
      
      // Extract PBR properties using MaterialNet via runMlScript utility
      const scriptArgs = [
        '--image_path', imagePath,
        '--output_format', 'json',
        ...(propertyType ? ['--property_type', propertyType] : []),
        ...(quality ? ['--quality', quality] : []),
        ...(format ? ['--format', format] : [])
      ];
      
      const extractionResult = await runMlScript<MaterialNetResult>({
        scriptPath: 'packages.ml.python.material_net_service', // Use module path
        args: scriptArgs
      });
      
      // Clean up the temporary file
      fs.unlinkSync(imagePath);
      
      res.status(200).json({
        success: true,
        data: { 
          ...extractionResult,
          sourceUrl: imageUrl,
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
      
      logger.error(`URL PBR property extraction failed: ${err}`);
      // Let the errorHandler middleware handle ApiErrors thrown by runMlScript
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(500, `URL PBR property extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/material-properties/supported
 * @desc    Get a list of supported PBR properties
 * @access  Public
 */
router.get(
  '/supported',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      // These are the standard PBR properties supported by MaterialNet
      const supportedProperties = [
        { id: 'albedo', name: 'Albedo/Base Color', description: 'The base color of the material' },
        { id: 'roughness', name: 'Roughness', description: 'How rough or smooth the material appears' },
        { id: 'metalness', name: 'Metalness', description: 'How metallic the material is' },
        { id: 'normal', name: 'Normal Map', description: 'Surface normal details for bump mapping' },
        { id: 'height', name: 'Height Map', description: 'Displacement information' },
        { id: 'ao', name: 'Ambient Occlusion', description: 'Self-shadowing information' }
      ];
      
      res.status(200).json({
        success: true,
        properties: supportedProperties
      });
    } catch (err) {
      logger.error(`Failed to get supported properties: ${err}`);
      throw new ApiError(500, `Failed to get supported properties: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/material-properties/enhance
 * @desc    Enhance PBR properties of an existing material
 * @access  Private - Authenticated users only
 */
router.post(
  '/enhance',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 5 }), // 5 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
    const { materialId, propertyType, enhancementOptions } = req.body;
    
    if (!materialId) {
      throw new ApiError(400, 'Material ID is required');
    }
    
    try {
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';
      
      // Fetch material information
      // This would be implemented to retrieve material info from the database
      
      // For now, return a mock response
      res.status(200).json({
        success: true,
        message: 'PBR property enhancement is not yet implemented',
        data: {
          materialId,
          propertyType,
          enhancementOptions,
          userId
        }
      });
    } catch (err) {
      logger.error(`PBR property enhancement failed: ${err}`);
      throw new ApiError(500, `PBR property enhancement failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

export default router;