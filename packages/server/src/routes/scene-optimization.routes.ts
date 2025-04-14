import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

// Define multer file type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Configure storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'scene-optimization-uploads');
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const router = express.Router();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 20                   // Allow up to 20 files per request
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * @swagger
 * /api/scene-optimization/health:
 *   get:
 *     summary: Check health of DiffusionNeRF service
 *     tags: [Scene Optimization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health status of the DiffusionNeRF service
 */
router.get('/health', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${process.env.ML_SERVICE_URL}/diffusionnerf/health`);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        status: 'error', 
        message: `Service health check failed with status: ${response.status}`
      });
    }
    
    const result = await response.json();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during health check'
    });
  }
}));

/**
 * @swagger
 * /api/scene-optimization/assess:
 *   post:
 *     summary: Assess quality of input images for reconstruction
 *     tags: [Scene Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Quality assessment results
 */
router.post('/assess', authMiddleware, upload.array('images', 20), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No images provided'
      });
    }
    
    // Extract file paths
    const files = req.files as MulterFile[];
    const imagePaths = files.map(file => file.path);
    
    // Call DiffusionNeRF service
    const response = await fetch(`${process.env.ML_SERVICE_URL}/diffusionnerf/assess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ images: imagePaths })
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        status: 'error',
        message: `Assessment failed with status: ${response.status}`
      });
    }
    
    const result = await response.json();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during assessment'
    });
  }
}));

/**
 * @swagger
 * /api/scene-optimization/reconstruct:
 *   post:
 *     summary: Reconstruct a 3D scene with adaptive optimization
 *     tags: [Scene Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               quality:
 *                 type: string
 *                 enum: [low, medium, high]
 *               forceDiffusion:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Reconstruction results
 */
router.post('/reconstruct', authMiddleware, upload.array('images', 20), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No images provided'
      });
    }
    
    // Extract file paths
    const files = req.files as MulterFile[];
    const imagePaths = files.map(file => file.path);
    
    // Create unique output directory
    const outputDir = path.join(os.tmpdir(), `reconstruction-${uuidv4()}`);
    
    // Prepare request parameters
    const requestParams: Record<string, any> = {
      images: imagePaths,
      output_dir: outputDir
    };
    
    // Add optional parameters if provided
    if (req.body.quality) requestParams.quality = req.body.quality;
    if (req.body.forceDiffusion === 'true') requestParams.force_diffusion = true;
    
    // Call DiffusionNeRF service
    const response = await fetch(`${process.env.ML_SERVICE_URL}/diffusionnerf/reconstruct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestParams)
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        status: 'error',
        message: `Reconstruction failed with status: ${response.status}`
      });
    }
    
    const result = await response.json();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during reconstruction'
    });
  }
}));

/**
 * @swagger
 * /api/scene-optimization/novel-views:
 *   post:
 *     summary: Generate novel views from a reconstructed model
 *     tags: [Scene Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *               views:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Generated view results
 */
router.post('/novel-views', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { model, views } = req.body;
    
    if (!model || !views || !Array.isArray(views)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters. Required: model (string) and views (array)'
      });
    }
    
    // Create unique output directory
    const outputDir = path.join(os.tmpdir(), `views-${uuidv4()}`);
    
    // Call DiffusionNeRF service
    const response = await fetch(`${process.env.ML_SERVICE_URL}/diffusionnerf/novel-views`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        views,
        output_dir: outputDir
      })
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        status: 'error',
        message: `View generation failed with status: ${response.status}`
      });
    }
    
    const result = await response.json();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during view generation'
    });
  }
}));

/**
 * @swagger
 * /api/scene-optimization/enhance:
 *   post:
 *     summary: Enhance existing NeRF reconstruction with diffusion model
 *     tags: [Scene Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reconstruction:
 *                 type: string
 *               quality:
 *                 type: string
 *                 enum: [low, medium, high]
 *     responses:
 *       200:
 *         description: Enhanced reconstruction results
 */
router.post('/enhance', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { reconstruction, ...options } = req.body;
    
    if (!reconstruction) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: reconstruction'
      });
    }
    
    // Call DiffusionNeRF service
    const response = await fetch(`${process.env.ML_SERVICE_URL}/diffusionnerf/enhance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reconstruction,
        ...options
      })
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        status: 'error',
        message: `Enhancement failed with status: ${response.status}`
      });
    }
    
    const result = await response.json();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during enhancement'
    });
  }
}));

export const sceneOptimizationRoutes = router;