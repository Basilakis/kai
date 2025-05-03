import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import {
  authMiddleware,
  authorizeRoles,
  tokenRefreshMiddleware,
  rateLimitMiddleware
} from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import {
  getMaterialById,
  searchMaterials,
  findSimilarMaterials,
  deleteMaterial
} from '../models/material.model';
import { materialService } from '../services/material/materialService';
import { recognizeMaterial } from '@kai/ml';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
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
 * @openapi
 * /api/materials:
 *   get:
 *     tags:
 *       - Materials
 *     summary: Get all materials with pagination
 *     description: Retrieves a paginated list of materials with optional filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: A paginated list of materials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 10
 *                 total:
 *                   type: integer
 *                   example: 50
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Material'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - not authorized to access these materials
 *       500:
 *         description: Server error
 */
router.get('/',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 20 }), // 20 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Get user ID for filtering
  const userId = req.user?.id;

  // Include user-specific filters if not admin
  const isAdmin = req.user?.role === 'admin';
  const userFilter = !isAdmin && userId ? { createdBy: userId } : {};

  const { materials, total } = await searchMaterials({
    ...userFilter,
    limit,
    skip,
    sort: { updatedAt: -1 }
  });

  res.status(200).json({
    success: true,
    count: materials.length,
    total,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit
    },
    data: materials
  });
}));

/**
 * @openapi
 * /api/materials/{id}:
 *   get:
 *     tags:
 *       - Materials
 *     summary: Get a material by ID
 *     description: Retrieves a specific material by its unique identifier
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the material
 *     responses:
 *       200:
 *         description: Material details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Material'
 *       400:
 *         description: Bad request - missing ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - not authorized to access this material
 *       404:
 *         description: Material not found
 *       500:
 *         description: Server error
 */
router.get('/:id',
  authMiddleware,
  tokenRefreshMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
  const materialId = req.params.id;
  if (!materialId) {
    throw new ApiError(400, 'Material ID is required');
  }

  const material = await getMaterialById(materialId);

  if (!material) {
    throw new ApiError(404, `Material not found with id ${req.params.id}`);
  }

  // Check if user has access to this material (admins can access all)
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && material.createdBy && material.createdBy !== userId) {
    logger.warn(`User ${userId} attempted to access material ${req.params.id} created by ${material.createdBy}`);
    throw new ApiError(403, 'You do not have permission to access this material');
  }

  res.status(200).json({
    success: true,
    data: material
  });
}));

/**
 * @route   POST /api/materials/search
 * @desc    Search for materials with filters
 * @access  Private - Authenticated users only
 */
router.post('/search',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 20 }), // 20 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
  const {
    query,
    materialType,
    manufacturer,
    color,
    finish,
    dimensions,
    tags,
    limit = 10,
    page = 1,
    sort = { updatedAt: -1 }
  } = req.body;

  const skip = (page - 1) * limit;

  // Get user ID for filtering
  const userId = req.user?.id;

  // Include user-specific filters if not admin
  const isAdmin = req.user?.role === 'admin';
  const userFilter = !isAdmin && userId ? { createdBy: userId } : {};

  const { materials, total } = await searchMaterials({
    ...userFilter,
    query,
    materialType,
    manufacturer,
    color,
    finish,
    dimensions,
    tags,
    limit,
    skip,
    sort
  });

  res.status(200).json({
    success: true,
    count: materials.length,
    total,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit
    },
    data: materials
  });
}));

/**
 * @route   POST /api/materials/similar/:id
 * @desc    Find similar materials to a given material
 * @access  Private - Authenticated users only
 */
router.post('/similar/:id',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
  const {
    limit = 10,
    threshold = 0.7,
    materialType
  } = req.body;

  // First check if user has access to the reference material
  const materialId = req.params.id;
  if (!materialId) {
    throw new ApiError(400, 'Material ID is required');
  }

  const referenceMaterial = await getMaterialById(materialId);

  if (!referenceMaterial) {
    throw new ApiError(404, `Material not found with id ${req.params.id}`);
  }

  // Check user's permission to access this material (admins can access all)
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && referenceMaterial.createdBy && referenceMaterial.createdBy !== userId) {
    logger.warn(`User ${userId} attempted to access material ${req.params.id} created by ${referenceMaterial.createdBy}`);
    throw new ApiError(403, 'You do not have permission to access this material');
  }

  // Add user filter for similar materials
  const userFilter = !isAdmin && userId ? { createdBy: userId } : {};

  const similarMaterials = await findSimilarMaterials(
    materialId,
    {
      limit,
      threshold,
      materialType,
      ...userFilter
    }
  );

  res.status(200).json({
    success: true,
    count: similarMaterials.length,
    data: similarMaterials
  });
}));

/**
 * @openapi
 * /api/materials/recognition:
 *   post:
 *     tags:
 *       - Materials
 *       - Recognition
 *     summary: Recognize materials from an uploaded image
 *     description: |
 *       Analyzes an uploaded image to identify materials.
 *       Uses machine learning models to detect material types and properties.
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
 *                 description: Image file to analyze (JPG, PNG)
 *               modelType:
 *                 type: string
 *                 enum: [hybrid, feature-based, ml-based]
 *                 default: hybrid
 *                 description: Recognition model type to use
 *               confidenceThreshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.6
 *                 description: Minimum confidence threshold for results (0-1)
 *               maxResults:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 5
 *                 description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Successful recognition
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 processingTime:
 *                   type: number
 *                   example: 2.45
 *                   description: Processing time in seconds
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       materialId:
 *                         type: string
 *                         example: "5f8c7d5e9b8f7e6d5c4b3a2b"
 *                       confidence:
 *                         type: number
 *                         example: 0.92
 *                       material:
 *                         $ref: '#/components/schemas/Material'
 *                 extractedFeatures:
 *                   type: object
 *                   description: Technical features extracted from the image
 *                 userId:
 *                   type: string
 *                   example: "user_12345"
 *       400:
 *         description: Bad request - missing image or invalid parameters
 *       401:
 *         description: Not authenticated
 *       413:
 *         description: Request entity too large - image exceeds size limit
 *       415:
 *         description: Unsupported media type - not an image file
 *       429:
 *         description: Too many requests - rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post(
  '/recognition',
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

      // Recognize materials in the image
      const recognitionResult = await recognizeMaterial(imagePath, {
        modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
        confidenceThreshold,
        maxResults
      });

      // Get full material details for each match
      const materialPromises = recognitionResult.matches.map(async (match: any) => {
        const material = await getMaterialById(match.materialId);
        return {
          ...match,
          material
        };
      });

      const matchesWithDetails = await Promise.all(materialPromises);

      res.status(200).json({
        success: true,
        processingTime: recognitionResult.processingTime,
        count: matchesWithDetails.length,
        data: matchesWithDetails.filter((match: any) => {
          // Filter out materials the user doesn't have access to
          const isAdmin = req.user?.role === 'admin';
          const createdBy = match.material?.createdBy;

          // Include if admin, or if no creator (public), or if created by this user
          return isAdmin || !createdBy || createdBy === userId;
        }),
        extractedFeatures: recognitionResult.extractedFeatures,
        userId: userId // Add user ID to result for ownership tracking
      });
    } catch (err) {
      logger.error(`Recognition error: ${err}`);
      throw new ApiError(500, `Recognition failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Clean up the uploaded file
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        logger.warn(`Failed to clean up uploaded file: ${err}`);
      }
    }
  })
);

/**
 * @route   POST /api/materials
 * @desc    Create a new material
 * @access  Private (Admin, Manager)
 */
router.post(
  '/',
  authMiddleware,
  authorizeRoles(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const materialData = {
      ...req.body,
      createdBy: req.user?.id
    };

    const material = await materialService.createMaterial(materialData, {
      applyInheritance: true,
      applyDefaults: true,
      overrideExisting: false
    });

    res.status(201).json({
      success: true,
      data: material
    });
  })
);

/**
 * @route   PUT /api/materials/:id
 * @desc    Update a material
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params.id;
    if (!materialId) {
      throw new ApiError(400, 'Material ID is required');
    }

    const material = await getMaterialById(materialId);

    if (!material) {
      throw new ApiError(404, `Material not found with id ${req.params.id}`);
    }

    const updatedMaterial = await materialService.updateMaterial(materialId, {
      ...req.body,
      updatedAt: new Date()
    }, {
      applyInheritance: true,
      applyDefaults: true,
      overrideExisting: false
    });

    res.status(200).json({
      success: true,
      data: updatedMaterial
    });
  })
);

/**
 * @route   POST /api/materials/:id/apply-inheritance
 * @desc    Apply property inheritance to a material
 * @access  Private (Admin, Manager)
 */
router.post(
  '/:id/apply-inheritance',
  authMiddleware,
  authorizeRoles(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params.id;
    if (!materialId) {
      throw new ApiError(400, 'Material ID is required');
    }

    const material = await getMaterialById(materialId);

    if (!material) {
      throw new ApiError(404, `Material not found with id ${req.params.id}`);
    }

    const options = {
      applyDefaults: req.body.applyDefaults !== undefined ? req.body.applyDefaults : true,
      overrideExisting: req.body.overrideExisting !== undefined ? req.body.overrideExisting : false
    };

    const updatedMaterial = await materialService.applyInheritance(materialId, options);

    res.status(200).json({
      success: true,
      data: updatedMaterial
    });
  })
);

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete a material
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const materialId = req.params.id;
    if (!materialId) {
      throw new ApiError(400, 'Material ID is required');
    }

    const material = await getMaterialById(materialId);

    if (!material) {
      throw new ApiError(404, `Material not found with id ${req.params.id}`);
    }

    await deleteMaterial(materialId);

    res.status(200).json({
      success: true,
      message: `Material ${req.params.id} deleted successfully`
    });
  })
);

export default router;