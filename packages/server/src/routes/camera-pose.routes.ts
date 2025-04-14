import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { asyncHandler } from '../middleware/error.middleware';
import fs from 'fs';
import * as os from 'os';

// Configure temporary storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'colmap-uploads');
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

/**
 * @swagger
 * /api/camera-pose/health:
 *   get:
 *     summary: Check COLMAP service health
 *     tags: [Camera Pose]
 *     responses:
 *       200:
 *         description: COLMAP service is healthy
 *       500:
 *         description: COLMAP service is not healthy
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check if COLMAP service is available
    const response = await fetch(`${process.env.COLMAP_ENDPOINT}/health`);
    
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        status: 'healthy',
        details: data
      });
    } else {
      throw new Error(`COLMAP service returned status: ${response.status}`);
    }
  } catch (error) {
    return res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @swagger
 * /api/camera-pose/estimate:
 *   post:
 *     summary: Estimate camera poses from multiple images
 *     tags: [Camera Pose]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: images
 *         type: array
 *         items:
 *           type: file
 *         required: true
 *         description: The images to estimate camera poses from
 *       - in: formData
 *         name: featureExtractor
 *         type: string
 *         enum: [sift, superpoint]
 *         default: sift
 *         description: Feature extraction method
 *       - in: formData
 *         name: matcher
 *         type: string
 *         enum: [exhaustive, sequential]
 *         default: exhaustive
 *         description: Feature matching method
 *       - in: formData
 *         name: quality
 *         type: string
 *         enum: [low, medium, high]
 *         default: high
 *         description: Quality setting
 *       - in: formData
 *         name: visualize
 *         type: boolean
 *         default: false
 *         description: Whether to generate a visualization
 *       - in: formData
 *         name: convertToNeRF
 *         type: boolean
 *         default: false
 *         description: Whether to convert to NeRF format
 *     responses:
 *       200:
 *         description: Camera poses estimated successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Processing error
 */
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

router.post('/estimate', upload.array('images'), asyncHandler(async (req: Request, res: Response) => {
  // Check if we have at least 2 images
  const files = req.files as MulterFile[];
  if (!files || files.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'At least 2 images are required for camera pose estimation'
    });
  }
  
  try {
    // Get image paths
    const imagePaths = files.map(file => file.path);
    
    // Prepare options
    const options = {
      featureExtractor: req.body.featureExtractor || 'sift',
      matcher: req.body.matcher || 'exhaustive',
      quality: req.body.quality || 'high',
      visualize: req.body.visualize === 'true',
      convertToNeRF: req.body.convertToNeRF === 'true',
    };
    
    // Call COLMAP service
    const payload = {
      type: 'sfm_pipeline',
      image_paths: imagePaths,
      feature_extractor: options.featureExtractor,
      matcher: options.matcher,
      quality: options.quality,
      cleanup: true
    };
    
    const response = await fetch(`${process.env.COLMAP_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`COLMAP service request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'COLMAP processing failed');
    }
    
    // Prepare result with proper typing
    const result: {
      success: boolean;
      cameraPoses: any;
      cameras: any;
      points: any;
      stats: {
        numCameras: any;
        numPoses: any;
        numPoints: any;
      };
      visualizationPath?: string;
      nerfData?: any;
    } = {
      success: true,
      cameraPoses: data.poses,
      cameras: data.cameras,
      points: data.points,
      stats: {
        numCameras: data.num_cameras,
        numPoses: data.num_poses,
        numPoints: data.num_points
      }
    };
    
    // Generate visualization if requested
    if (options.visualize) {
      const visPayload = {
        type: 'visualization',
        work_dir: data.work_dir,
        output_path: `${Date.now()}_reconstruction.png`
      };
      
      const visResponse = await fetch(`${process.env.COLMAP_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(visPayload)
      });
      
      if (visResponse.ok) {
        const visData = await visResponse.json();
        if (visData.success) {
          result['visualizationPath'] = visData.visualization_path;
        }
      }
    }
    
    // Convert to NeRF format if requested
    if (options.convertToNeRF) {
      const nerfPayload = {
        type: 'nerf_conversion',
        work_dir: data.work_dir
      };
      
      const nerfResponse = await fetch(`${process.env.COLMAP_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nerfPayload)
      });
      
      if (nerfResponse.ok) {
        const nerfData = await nerfResponse.json();
        if (nerfData.success) {
          result['nerfData'] = nerfData.nerf_data;
        }
      }
    }
    
    return res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  } finally {
    // Clean up uploaded files
    for (const file of files) {
      fs.unlink(file.path, (err) => {
        if (err) console.error(`Failed to delete temporary file ${file.path}:`, err);
      });
    }
  }
}));

/**
 * @swagger
 * /api/camera-pose/enhance-nerf:
 *   post:
 *     summary: Enhance NeRF reconstruction with camera poses
 *     tags: [Camera Pose]
 *     consumes:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: data
 *         schema:
 *           type: object
 *           required:
 *             - nerfData
 *             - cameraPoses
 *           properties:
 *             nerfData:
 *               type: object
 *               description: NeRF data to enhance
 *             cameraPoses:
 *               type: object
 *               description: Camera poses to incorporate
 *     responses:
 *       200:
 *         description: NeRF data enhanced successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Processing error
 */
router.post('/enhance-nerf', asyncHandler(async (req: Request, res: Response) => {
  const { nerfData, cameraPoses } = req.body;
  
  // Validate input
  if (!nerfData) {
    return res.status(400).json({
      success: false,
      error: 'No NeRF data provided'
    });
  }
  
  if (!cameraPoses || Object.keys(cameraPoses).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No camera poses provided'
    });
  }
  
  try {
    // Call COLMAP service
    const payload = {
      type: 'enhance_nerf',
      nerf_data: nerfData,
      camera_poses: cameraPoses
    };
    
    const response = await fetch(`${process.env.COLMAP_ENDPOINT}/enhance_nerf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`NeRF enhancement request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'NeRF enhancement failed');
    }
    
    return res.status(200).json({
      success: true,
      data: data.enhanced_nerf
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}));

export default router;