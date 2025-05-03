/**
 * Visual References Routes
 * 
 * API routes for the Visual Reference Library.
 */

import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { visualReferenceService } from '@kai/shared/src/services/visualReference/visualReferenceService';
import { logger } from '../utils/logger';
import {
  VisualReferenceCreateInputSchema,
  VisualReferenceUpdateInputSchema,
  VisualReferenceImageCreateInputSchema,
  VisualReferenceImageUpdateInputSchema,
  VisualReferenceAnnotationCreateInputSchema,
  VisualReferenceAnnotationUpdateInputSchema,
  VisualReferenceTagCreateInputSchema,
  VisualReferenceSearchInputSchema
} from '@kai/shared/src/types/visualReference';
import { getImageDimensions } from '../utils/imageUtils';
import { uploadToStorage, deleteFromStorage } from '../utils/storageUtils';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @route   GET /api/visual-references
 * @desc    Get all visual references with optional filtering
 * @access  Admin only
 */
router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, propertyValue, materialType, activeOnly } = req.query;
      
      const references = await visualReferenceService.getVisualReferences(
        propertyName as string | undefined,
        propertyValue as string | undefined,
        materialType as string | undefined,
        activeOnly !== 'false'
      );
      
      res.json({
        success: true,
        references
      });
    } catch (error) {
      logger.error('Error getting visual references', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/:id
 * @desc    Get a visual reference by ID
 * @access  Admin only
 */
router.get(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const reference = await visualReferenceService.getVisualReferenceById(id);
      
      res.json({
        success: true,
        reference
      });
    } catch (error) {
      logger.error('Error getting visual reference', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/:id/with-images
 * @desc    Get a visual reference with its images
 * @access  Admin only
 */
router.get(
  '/:id/with-images',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const reference = await visualReferenceService.getVisualReferenceWithImages(id);
      
      res.json({
        success: true,
        reference
      });
    } catch (error) {
      logger.error('Error getting visual reference with images', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/visual-references
 * @desc    Create a new visual reference
 * @access  Admin only
 */
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = VisualReferenceCreateInputSchema.parse(req.body);
      
      const reference = await visualReferenceService.createVisualReference(
        validatedData,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        reference
      });
    } catch (error) {
      logger.error('Error creating visual reference', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/visual-references/:id
 * @desc    Update a visual reference
 * @access  Admin only
 */
router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = VisualReferenceUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const reference = await visualReferenceService.updateVisualReference(validatedData);
      
      res.json({
        success: true,
        reference
      });
    } catch (error) {
      logger.error('Error updating visual reference', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/visual-references/:id
 * @desc    Delete a visual reference
 * @access  Admin only
 */
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await visualReferenceService.deleteVisualReference(id);
      
      res.json({
        success: true,
        message: 'Visual reference deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting visual reference', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/:id/images
 * @desc    Get images for a visual reference
 * @access  Admin only
 */
router.get(
  '/:id/images',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const images = await visualReferenceService.getVisualReferenceImages(id);
      
      res.json({
        success: true,
        images
      });
    } catch (error) {
      logger.error('Error getting visual reference images', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/visual-references/:id/images
 * @desc    Add an image to a visual reference
 * @access  Admin only
 */
router.post(
  '/:id/images',
  authMiddleware,
  adminMiddleware,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided'
        });
      }
      
      // Get image dimensions
      const dimensions = await getImageDimensions(file.path);
      
      // Upload to storage
      const url = await uploadToStorage(file.path, `visual-references/${id}/${file.filename}`);
      
      // Create image record
      const validatedData = VisualReferenceImageCreateInputSchema.parse({
        referenceId: id,
        caption: req.body.caption,
        isPrimary: req.body.isPrimary === 'true'
      });
      
      const image = await visualReferenceService.createVisualReferenceImage(
        validatedData,
        {
          url,
          width: dimensions.width,
          height: dimensions.height,
          fileSize: file.size,
          fileType: file.mimetype
        },
        req.user.id
      );
      
      // Clean up temporary file
      fs.unlinkSync(file.path);
      
      res.status(201).json({
        success: true,
        image
      });
    } catch (error) {
      logger.error('Error adding image to visual reference', { error });
      
      // Clean up temporary file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/images/:id
 * @desc    Get a visual reference image by ID
 * @access  Admin only
 */
router.get(
  '/images/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const image = await visualReferenceService.getVisualReferenceImageById(id);
      
      res.json({
        success: true,
        image
      });
    } catch (error) {
      logger.error('Error getting visual reference image', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/images/:id/with-annotations
 * @desc    Get a visual reference image with its annotations
 * @access  Admin only
 */
router.get(
  '/images/:id/with-annotations',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const image = await visualReferenceService.getVisualReferenceImageWithAnnotations(id);
      
      res.json({
        success: true,
        image
      });
    } catch (error) {
      logger.error('Error getting visual reference image with annotations', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/visual-references/images/:id
 * @desc    Update a visual reference image
 * @access  Admin only
 */
router.put(
  '/images/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = VisualReferenceImageUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const image = await visualReferenceService.updateVisualReferenceImage(validatedData);
      
      res.json({
        success: true,
        image
      });
    } catch (error) {
      logger.error('Error updating visual reference image', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/visual-references/images/:id
 * @desc    Delete a visual reference image
 * @access  Admin only
 */
router.delete(
  '/images/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get the image to get the URL
      const image = await visualReferenceService.getVisualReferenceImageById(id);
      
      // Delete from storage
      await deleteFromStorage(image.url);
      
      // Delete from database
      await visualReferenceService.deleteVisualReferenceImage(id);
      
      res.json({
        success: true,
        message: 'Visual reference image deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting visual reference image', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/images/:id/annotations
 * @desc    Get annotations for a visual reference image
 * @access  Admin only
 */
router.get(
  '/images/:id/annotations',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const annotations = await visualReferenceService.getVisualReferenceAnnotations(id);
      
      res.json({
        success: true,
        annotations
      });
    } catch (error) {
      logger.error('Error getting visual reference annotations', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/visual-references/images/:id/annotations
 * @desc    Add an annotation to a visual reference image
 * @access  Admin only
 */
router.post(
  '/images/:id/annotations',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = VisualReferenceAnnotationCreateInputSchema.parse({
        imageId: id,
        ...req.body
      });
      
      const annotation = await visualReferenceService.createVisualReferenceAnnotation(
        validatedData,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        annotation
      });
    } catch (error) {
      logger.error('Error adding annotation to visual reference image', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/visual-references/annotations/:id
 * @desc    Update a visual reference annotation
 * @access  Admin only
 */
router.put(
  '/annotations/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = VisualReferenceAnnotationUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const annotation = await visualReferenceService.updateVisualReferenceAnnotation(validatedData);
      
      res.json({
        success: true,
        annotation
      });
    } catch (error) {
      logger.error('Error updating visual reference annotation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/visual-references/annotations/:id
 * @desc    Delete a visual reference annotation
 * @access  Admin only
 */
router.delete(
  '/annotations/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await visualReferenceService.deleteVisualReferenceAnnotation(id);
      
      res.json({
        success: true,
        message: 'Visual reference annotation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting visual reference annotation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/:id/tags
 * @desc    Get tags for a visual reference
 * @access  Admin only
 */
router.get(
  '/:id/tags',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const tags = await visualReferenceService.getVisualReferenceTags(id);
      
      res.json({
        success: true,
        tags
      });
    } catch (error) {
      logger.error('Error getting visual reference tags', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/visual-references/:id/tags
 * @desc    Add a tag to a visual reference
 * @access  Admin only
 */
router.post(
  '/:id/tags',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = VisualReferenceTagCreateInputSchema.parse({
        referenceId: id,
        tag: req.body.tag
      });
      
      const tag = await visualReferenceService.createVisualReferenceTag(
        validatedData,
        req.user.id
      );
      
      res.status(201).json({
        success: true,
        tag
      });
    } catch (error) {
      logger.error('Error adding tag to visual reference', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/visual-references/tags/:id
 * @desc    Delete a visual reference tag
 * @access  Admin only
 */
router.delete(
  '/tags/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await visualReferenceService.deleteVisualReferenceTag(id);
      
      res.json({
        success: true,
        message: 'Visual reference tag deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting visual reference tag', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/visual-references/search
 * @desc    Search for visual references
 * @access  Admin only
 */
router.post(
  '/search',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = VisualReferenceSearchInputSchema.parse(req.body);
      
      const references = await visualReferenceService.searchVisualReferences(validatedData);
      
      res.json({
        success: true,
        references
      });
    } catch (error) {
      logger.error('Error searching visual references', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/property/:propertyName
 * @desc    Get visual references for a property
 * @access  Admin only
 */
router.get(
  '/property/:propertyName',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName } = req.params;
      
      const references = await visualReferenceService.getVisualReferences(propertyName);
      
      res.json({
        success: true,
        references
      });
    } catch (error) {
      logger.error('Error getting visual references for property', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/visual-references/property/:propertyName/value/:propertyValue
 * @desc    Get visual references for a property value
 * @access  Admin only
 */
router.get(
  '/property/:propertyName/value/:propertyValue',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, propertyValue } = req.params;
      
      const references = await visualReferenceService.getVisualReferences(propertyName, propertyValue);
      
      res.json({
        success: true,
        references
      });
    } catch (error) {
      logger.error('Error getting visual references for property value', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;
