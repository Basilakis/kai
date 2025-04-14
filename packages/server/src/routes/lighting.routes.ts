import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { 
  authMiddleware, 
  tokenRefreshMiddleware,
  rateLimitMiddleware
} from '../middleware/auth.middleware';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// URL to the Python HDRNet service
const HDR_SERVICE_URL = process.env.HDR_SERVICE_URL || 'http://localhost:8000';

/**
 * @route   POST /api/lighting/environment-map
 * @desc    Generate an HDR environment map from a source image
 * @access  Private - Authenticated users only
 */
router.post(
  '/environment-map',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { imageUrl, quality, intensity, rotation, toneMapping } = req.body;

      if (!imageUrl) {
        throw new ApiError(400, 'Image URL is required');
      }

      // Validate parameters
      const validQuality = ['low', 'medium', 'high'].includes(quality || 'medium');
      if (!validQuality) {
        throw new ApiError(400, 'Quality must be low, medium, or high');
      }

      const validToneMapping = ['linear', 'reinhard', 'aces', 'cineon'].includes(toneMapping || 'aces');
      if (!validToneMapping) {
        throw new ApiError(400, 'Tone mapping must be linear, reinhard, aces, or cineon');
      }

      // Prepare form data for the Python service
      const formData = new URLSearchParams();
      formData.append('image_url', imageUrl);
      formData.append('quality', quality || 'medium');
      formData.append('intensity', String(intensity || 1.0));
      formData.append('rotation', String(rotation || 0.0));
      formData.append('tone_mapping', toneMapping || 'aces');

      // Call the Python HDRNet service
      const response = await fetch(`${HDR_SERVICE_URL}/hdrnet/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error from HDRNet service:', { error: errorText });
        throw new ApiError(response.status, 'Failed to generate environment map');
      }

      const result = await response.json();
      return res.json(result);
    } catch (error) {
      logger.error('Error generating environment map:', { error });
      throw error instanceof ApiError ? error : new ApiError(500, `Internal server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  })
);

/**
 * @route   POST /api/lighting/extract
 * @desc    Extract lighting information from an image
 * @access  Private - Authenticated users only
 */
router.post(
  '/extract',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        throw new ApiError(400, 'Image URL is required');
      }

      // Call the Python HDRNet service
      const response = await fetch(`${HDR_SERVICE_URL}/hdrnet/extract_lighting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error from HDRNet service:', { error: errorText });
        throw new ApiError(response.status, 'Failed to extract lighting information');
      }

      const result = await response.json();
      return res.json(result);
    } catch (error) {
      logger.error('Error extracting lighting information:', { error });
      throw error instanceof ApiError ? error : new ApiError(500, `Internal server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  })
);

/**
 * @route   POST /api/lighting/upload-and-generate
 * @desc    Upload an image and generate an environment map
 * @access  Private - Authenticated users only
 */
router.post(
  '/upload-and-generate',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No image file provided');
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const { quality, intensity, rotation, toneMapping } = req.body;

    try {
      // Get user ID for ownership tracking
      const userId = req.user?.id || 'anonymous';

      // Save the file to a location accessible by the Python service
      const publicPath = `/uploads/${fileName}`;
      const fullUrl = `${req.protocol}://${req.get('host')}${publicPath}`;

      // Prepare form data for the Python service
      const formData = new URLSearchParams();
      formData.append('image_url', fullUrl);
      formData.append('quality', quality || 'medium');
      formData.append('intensity', String(intensity || 1.0));
      formData.append('rotation', String(rotation || 0.0));
      formData.append('tone_mapping', toneMapping || 'aces');

      // Call the Python HDRNet service
      const response = await fetch(`${HDR_SERVICE_URL}/hdrnet/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Error from HDRNet service:', { error: errorText });
        
        // Clean up the uploaded file
        fs.unlink(filePath, (err) => {
          if (err) logger.error('Error deleting temporary file:', { error: err });
        });
        
        throw new ApiError(response.status, 'Failed to generate environment map');
      }

      const result = await response.json();
      
      // Add user ID to result for ownership tracking
      result.userId = userId;
      
      // Clean up the uploaded file after processing
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Error deleting temporary file:', { error: err });
      });
      
      return res.json(result);
    } catch (error) {
      // Clean up the uploaded file in case of error
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        logger.warn('Error deleting temporary file:', { error: cleanupErr });
      }
      
      logger.error('Error processing uploaded image:', { error });
      throw error instanceof ApiError ? error : new ApiError(500, `Internal server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  })
);

/**
 * @route   GET /api/lighting/health
 * @desc    Health check for the HDRNet service
 * @access  Public
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const response = await fetch(`${HDR_SERVICE_URL}/health`);
      if (!response.ok) {
        throw new ApiError(503, 'HDRNet service unavailable');
      }
      
      const health = await response.json();
      return res.json({ status: 'ok', serviceHealth: health });
    } catch (error) {
      logger.error('Error checking HDRNet service health:', { error });
      throw new ApiError(503, 'HDRNet service unavailable');
    }
  })
);

export default router;