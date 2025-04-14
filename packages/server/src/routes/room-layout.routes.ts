import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { asyncHandler } from '../middleware/error.middleware';
import { ApiError } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import creditMiddleware from '../middleware/credit.middleware';

// Initialize router
const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'room-layout-uploads');
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Define multer file type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

/**
 * @swagger
 * /api/room-layout/health:
 *   get:
 *     summary: Check health of room layout service
 *     tags: [Room Layout]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       500:
 *         description: Service is not healthy
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Simple health check that will be extended when we add more capabilities
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        spaceFormer: 'available'
      }
    });
  } catch (error) {
    throw new ApiError(500, 'Room layout service health check failed');
  }
}));

/**
 * @swagger
 * /api/room-layout/generate:
 *   post:
 *     summary: Generate optimized room layouts
 *     tags: [Room Layout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomDimensions
 *               - roomType
 *             properties:
 *               roomDimensions:
 *                 type: object
 *                 properties:
 *                   width: 
 *                     type: number
 *                   length:
 *                     type: number
 *                   height:
 *                     type: number
 *               roomType:
 *                 type: string
 *                 enum: [living_room, bedroom, kitchen, bathroom, office, dining_room]
 *               fixedElements:
 *                 type: array
 *                 items:
 *                   type: object
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Successfully generated room layouts
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/generate', 
  authMiddleware,
  creditMiddleware.checkCredits('room-layout', 1),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomDimensions, roomType, fixedElements, options } = req.body;

    if (!roomDimensions || !roomType) {
      throw new ApiError(400, 'Room dimensions and type are required');
    }

    if (!roomDimensions.width || !roomDimensions.length) {
      throw new ApiError(400, 'Room width and length are required');
    }

    try {
      // Call to the SpaceFormer service would typically happen here
      // For now we're just returning a mock response
      const layouts = Array(3).fill(0).map((_, i) => ({
        id: `layout-${i}`,
        name: `${roomType} Layout ${i+1}`,
        dimensions: roomDimensions,
        elements: [],
        metadata: {
          style: options?.style || 'modern',
          purpose: roomType,
          score: 0.8 - (i * 0.1)
        }
      }));

      res.status(200).json({ layouts });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, `Failed to generate room layout: ${message}`);
    }
  })
);

/**
 * @swagger
 * /api/room-layout/optimize-furniture:
 *   post:
 *     summary: Optimize furniture placement in a room
 *     tags: [Room Layout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - layout
 *               - furnitureItems
 *             properties:
 *               layout:
 *                 type: object
 *               furnitureItems:
 *                 type: array
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Successfully optimized furniture placement
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/optimize-furniture', 
  authMiddleware,
  creditMiddleware.checkCredits('room-layout', 2),
  asyncHandler(async (req: Request, res: Response) => {
    const { layout, furnitureItems, options } = req.body;

    if (!layout || !furnitureItems) {
      throw new ApiError(400, 'Layout and furniture items are required');
    }

    try {
      // Call to the SpaceFormer service would typically happen here
      // For now we're just returning a mock response
      const placementResult = {
        layout: {
          ...layout,
          metadata: {
            ...layout.metadata,
            flowScore: 0.85,
            occupancyRate: 0.65,
            accessibilityScore: 0.75
          }
        },
        placements: furnitureItems.map((item: any, index: number) => ({
          furniture_id: item.id || `furniture-${index}`,
          position: { 
            x: Math.random() * layout.dimensions.width,
            y: 0,
            z: Math.random() * layout.dimensions.length
          },
          rotation: Math.random() * Math.PI * 2,
          zone: options?.constraints?.zones?.[index] || 'general'
        })),
        metrics: {
          flow_score: 0.85,
          occupancy_rate: 0.65,
          accessibility_score: 0.75,
          design_principles_score: {
            balance: 0.8,
            harmony: 0.7,
            function: 0.9
          }
        }
      };

      res.status(200).json(placementResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, `Failed to optimize furniture placement: ${message}`);
    }
  })
);

/**
 * @swagger
 * /api/room-layout/analyze:
 *   post:
 *     summary: Analyze an existing room layout and provide suggestions
 *     tags: [Room Layout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - layout
 *             properties:
 *               layout:
 *                 type: object
 *               furnitureItems:
 *                 type: array
 *     responses:
 *       200:
 *         description: Successfully analyzed layout
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/analyze', 
  authMiddleware,
  creditMiddleware.checkCredits('room-layout', 1),
  asyncHandler(async (req: Request, res: Response) => {
    const { layout, furnitureItems } = req.body;

    if (!layout) {
      throw new ApiError(400, 'Layout is required');
    }

    try {
      // Call to the SpaceFormer service would typically happen here
      // For now we're just returning a mock response
      const analysisResult = {
        overall_score: 0.72,
        principle_scores: {
          flow: 0.65,
          balance: 0.7,
          function: 0.8,
          harmony: 0.75
        },
        suggestions: [
          {
            principle: 'flow',
            score: 0.65,
            suggestion: 'Consider moving the sofa away from the main pathway to improve circulation.',
            priority: 'medium'
          },
          {
            principle: 'balance',
            score: 0.7,
            suggestion: 'The room feels slightly weighted to one side. Try moving some furniture to create better balance.',
            priority: 'low'
          }
        ]
      };

      res.status(200).json(analysisResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, `Failed to analyze layout: ${message}`);
    }
  })
);

/**
 * @swagger
 * /api/room-layout/process-image:
 *   post:
 *     summary: Process an image to recognize room layout
 *     tags: [Room Layout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Successfully processed image
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/process-image', 
  authMiddleware,
  creditMiddleware.checkCredits('room-layout', 3),
  upload.single('image'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const file = req.file as MulterFile;
      const options = req.body.options ? JSON.parse(req.body.options) : {};
      
      if (!file) {
        throw new ApiError(400, 'No image file provided');
      }

      // Call to the SpaceFormer service would typically happen here
      // For now we're just returning a mock response
      const result = {
        dimensions: {
          width: 5.2,
          length: 4.8,
          height: 2.7
        },
        layout: {
          id: 'detected-layout-123',
          elements: [
            {
              type: 'wall',
              position: { x: 0, y: 0, z: 0 },
              dimensions: { width: 5.2, height: 2.7, depth: 0.2 }
            },
            {
              type: 'door',
              position: { x: 2.5, y: 0, z: 0 },
              dimensions: { width: 0.9, height: 2.1, depth: 0.1 }
            }
          ]
        },
        detectedFurniture: [
          {
            type: 'sofa',
            position: { x: 1.2, y: 0, z: 1.5 },
            dimensions: { width: 2.2, height: 0.8, depth: 0.9 }
          },
          {
            type: 'table',
            position: { x: 3.5, y: 0, z: 2.5 },
            dimensions: { width: 1.2, height: 0.75, depth: 0.8 }
          }
        ]
      };

      // Clean up the temporary file
      fs.unlink(file.path, (err) => {
        if (err) console.error(`Error deleting temporary file: ${err.message}`);
      });

      res.status(200).json(result);
    } catch (error) {
      // Clean up temp file if something went wrong
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, `Failed to process image: ${message}`);
    }
  })
);

/**
 * @swagger
 * /api/room-layout/optimize-existing:
 *   post:
 *     summary: Optimize an existing room layout
 *     tags: [Room Layout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - layout
 *               - optimizationGoals
 *             properties:
 *               layout:
 *                 type: object
 *               furnitureItems:
 *                 type: array
 *               optimizationGoals:
 *                 type: object
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Successfully optimized layout
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/optimize-existing', 
  authMiddleware,
  creditMiddleware.checkCredits('room-layout', 2),
  asyncHandler(async (req: Request, res: Response) => {
    const { layout, furnitureItems, optimizationGoals, options } = req.body;

    if (!layout || !optimizationGoals) {
      throw new ApiError(400, 'Layout and optimization goals are required');
    }

    try {
      // Call to the SpaceFormer service would typically happen here
      // For now we're just returning a mock response
      const optimizationResult = {
        original_layout: layout,
        optimized_layout: {
          ...layout,
          metadata: {
            ...layout.metadata,
            optimized: true,
            flowScore: 0.9,
            occupancyRate: 0.7,
            accessibilityScore: 0.85
          }
        },
        changes: furnitureItems?.map((item: any, index: number) => ({
          furniture_id: item.id || `furniture-${index}`,
          old_position: item.position,
          new_position: {
            x: item.position?.x ? item.position.x + (Math.random() * 0.5 - 0.25) : Math.random() * layout.dimensions.width,
            y: 0,
            z: item.position?.z ? item.position.z + (Math.random() * 0.5 - 0.25) : Math.random() * layout.dimensions.length
          },
          old_rotation: item.rotation || 0,
          new_rotation: (item.rotation || 0) + (Math.random() * Math.PI / 2 - Math.PI / 4)
        })) || [],
        improvement_metrics: {
          flow_score: 0.2,
          occupancy_rate: 0.1,
          accessibility_score: 0.15
        }
      };

      res.status(200).json(optimizationResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(500, `Failed to optimize existing layout: ${message}`);
    }
  })
);

export const roomLayoutRoutes = router;