import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { 
  getMaterialById, 
  searchMaterials, 
  findSimilarMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial
} from '../models/material.model';
import { recognizeMaterial } from '../../ml/src';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
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
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * @route   GET /api/materials
 * @desc    Get all materials with pagination
 * @access  Public
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  
  const { materials, total } = await searchMaterials({
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
 * @route   GET /api/materials/:id
 * @desc    Get a material by ID
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const material = await getMaterialById(req.params.id);
  
  if (!material) {
    throw new ApiError(404, `Material not found with id ${req.params.id}`);
  }
  
  res.status(200).json({
    success: true,
    data: material
  });
}));

/**
 * @route   POST /api/materials/search
 * @desc    Search for materials with filters
 * @access  Public
 */
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
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
  
  const { materials, total } = await searchMaterials({
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
 * @access  Public
 */
router.post('/similar/:id', asyncHandler(async (req: Request, res: Response) => {
  const {
    limit = 10,
    threshold = 0.7,
    materialType
  } = req.body;
  
  const similarMaterials = await findSimilarMaterials(
    req.params.id,
    {
      limit,
      threshold,
      materialType
    }
  );
  
  res.status(200).json({
    success: true,
    count: similarMaterials.length,
    data: similarMaterials
  });
}));

/**
 * @route   POST /api/materials/recognition
 * @desc    Recognize materials from an uploaded image
 * @access  Public
 */
router.post(
  '/recognition',
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
      // Recognize materials in the image
      const recognitionResult = await recognizeMaterial(imagePath, {
        modelType: modelType as 'hybrid' | 'feature-based' | 'ml-based',
        confidenceThreshold,
        maxResults
      });
      
      // Get full material details for each match
      const materialPromises = recognitionResult.matches.map(async match => {
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
        data: matchesWithDetails,
        extractedFeatures: recognitionResult.extractedFeatures
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
    
    const material = await createMaterial(materialData);
    
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
    const material = await getMaterialById(req.params.id);
    
    if (!material) {
      throw new ApiError(404, `Material not found with id ${req.params.id}`);
    }
    
    const updatedMaterial = await updateMaterial(req.params.id, {
      ...req.body,
      updatedAt: new Date()
    });
    
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
    const material = await getMaterialById(req.params.id);
    
    if (!material) {
      throw new ApiError(404, `Material not found with id ${req.params.id}`);
    }
    
    await deleteMaterial(req.params.id);
    
    res.status(200).json({
      success: true,
      message: `Material ${req.params.id} deleted successfully`
    });
  })
);

export default router;