import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import creditMiddleware from '../middleware/credit.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// Define interfaces for type safety
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'point-cloud-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Get service status
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // Check if Point-E service is running
      const result = await fetch(`${process.env.POINT_E_SERVICE_URL}/status`);
      
      if (!result.ok) {
        return res.status(503).json({
          success: false,
          message: 'Point-E service is unavailable'
        });
      }
      
      const status = await result.json();
      
      return res.status(200).json({
        success: true,
        message: 'Point-E service is running',
        data: status
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'Point-E service is unavailable',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// Process a point cloud for noise reduction
router.post(
  '/process',
  authMiddleware,
  creditMiddleware.checkCredits,
  asyncHandler(async (req: Request, res: Response) => {
    const { pointCloudData, options } = req.body;
    
    if (!pointCloudData || !Array.isArray(pointCloudData)) {
      throw new ApiError(400, 'Point cloud data is required and must be an array');
    }
    
    try {
      const response = await fetch(`${process.env.POINT_E_SERVICE_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          point_cloud_data: pointCloudData,
          options: options || {}
        })
      });
      
      if (!response.ok) {
        throw new ApiError(response.status, `Failed to process point cloud: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Deduct credits after successful processing
      await creditMiddleware.deductCredits('point_cloud_processing')(req, res, () => {});
      
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error processing point cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Generate a point cloud from text
router.post(
  '/generate',
  authMiddleware,
  creditMiddleware.checkCredits,
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, options } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      throw new ApiError(400, 'Prompt is required and must be a string');
    }
    
    try {
      const response = await fetch(`${process.env.POINT_E_SERVICE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          options: options || {}
        })
      });
      
      if (!response.ok) {
        throw new ApiError(response.status, `Failed to generate point cloud: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Deduct credits after successful generation
      await creditMiddleware.deductCredits('point_cloud_generation')(req, res, () => {});
      
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error generating point cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Complete a partial point cloud
router.post(
  '/complete',
  authMiddleware,
  creditMiddleware.checkCredits,
  asyncHandler(async (req: Request, res: Response) => {
    const { partialData, options } = req.body;
    
    if (!partialData || !Array.isArray(partialData)) {
      throw new ApiError(400, 'Partial point cloud data is required and must be an array');
    }
    
    try {
      const response = await fetch(`${process.env.POINT_E_SERVICE_URL}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partial_data: partialData,
          options: options || {}
        })
      });
      
      if (!response.ok) {
        throw new ApiError(response.status, `Failed to complete point cloud: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Deduct credits after successful completion
      await creditMiddleware.deductCredits('point_cloud_completion')(req, res, () => {});
      
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error completing point cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Improve mesh geometry
router.post(
  '/improve-mesh',
  authMiddleware,
  creditMiddleware.checkCredits,
  asyncHandler(async (req: Request, res: Response) => {
    const { vertices, faces, options } = req.body;
    
    if (!vertices || !Array.isArray(vertices) || !faces || !Array.isArray(faces)) {
      throw new ApiError(400, 'Vertices and faces are required and must be arrays');
    }
    
    try {
      const response = await fetch(`${process.env.POINT_E_SERVICE_URL}/improve-mesh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vertices,
          faces,
          options: options || {}
        })
      });
      
      if (!response.ok) {
        throw new ApiError(response.status, `Failed to improve mesh: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Deduct credits after successful mesh improvement
      await creditMiddleware.deductCredits('mesh_improvement')(req, res, () => {});
      
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error improving mesh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

// Process image to extract point cloud
router.post(
  '/process-image',
  authMiddleware,
  creditMiddleware.checkCredits,
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'Image file is required');
    }
    
    const file = req.file as MulterFile;
    const optionsStr = req.body.options || '{}';
    let options;
    
    try {
      options = JSON.parse(optionsStr);
    } catch (error) {
      throw new ApiError(400, 'Invalid options format');
    }
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', new Blob([fs.readFileSync(file.path)]), file.originalname);
      formData.append('options', JSON.stringify(options));
      
      // Send request to Point-E service
      const response = await fetch(`${process.env.POINT_E_SERVICE_URL}/process-image`, {
        method: 'POST',
        body: formData
      });
      
      // Clean up temporary file
      fs.unlinkSync(file.path);
      
      if (!response.ok) {
        throw new ApiError(response.status, `Failed to process image: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Deduct credits after successful processing
      await creditMiddleware.deductCredits('image_to_point_cloud')(req, res, () => {});
      
      return res.status(200).json(result);
    } catch (error) {
      // Clean up temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })
);

export default router;