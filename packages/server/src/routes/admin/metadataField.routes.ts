import express, { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { ApiError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import {
  createMetadataField,
  getMetadataFieldById,
  getMetadataFieldByName,
  updateMetadataField,
  deleteMetadataField,
  getMetadataFields,
  getMetadataFieldsByCategory,
  MetadataFieldDocument,
  extractValueFromOCR
} from '../../models/metadataField.model';

const router = express.Router();

// Admin-only middleware - ensures user has admin role
const adminMiddleware = (req: Request, res: Response, next: Function) => {
  // Get user from request (set by authMiddleware)
  const user = (req as any).user;
  
  if (!user || user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  
  next();
};

/**
 * @route   POST /api/admin/metadata-field
 * @desc    Create a new metadata field
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      name,
      displayName,
      description,
      fieldType,
      isRequired,
      order,
      defaultValue,
      validation,
      options,
      unit,
      hint,
      extractionPatterns,
      extractionExamples,
      categories,
      isActive
    } = req.body;
    
    if (!name) {
      throw new ApiError(400, 'Field name is required');
    }
    
    if (!displayName) {
      throw new ApiError(400, 'Display name is required');
    }
    
    if (!fieldType) {
      throw new ApiError(400, 'Field type is required');
    }
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      throw new ApiError(400, 'At least one category must be assigned to this field');
    }
    
    // Validate dropdown fields have options
    if (fieldType === 'dropdown' && (!options || !Array.isArray(options) || options.length === 0)) {
      throw new ApiError(400, 'Dropdown fields must have at least one option');
    }
    
    // Create the metadata field
    const fieldData: Partial<MetadataFieldDocument> = {
      name,
      displayName,
      description,
      fieldType: fieldType as 'text' | 'textarea' | 'number' | 'dropdown' | 'boolean' | 'date',
      isRequired: !!isRequired,
      order: order !== undefined ? order : 0,
      defaultValue,
      validation,
      options,
      unit,
      hint,
      extractionPatterns,
      extractionExamples,
      categories,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: (req as any).user.id
    };
    
    try {
      const field = await createMetadataField(fieldData);
      
      res.status(201).json({
        success: true,
        message: 'Metadata field created successfully',
        field
      });
    } catch (err) {
      logger.error(`Failed to create metadata field: ${err}`);
      
      // Check for duplicate key error
      if (err instanceof Error && err.message.includes('duplicate key error')) {
        if (err.message.includes('name')) {
          throw new ApiError(409, 'A field with this name already exists');
        }
      }
      
      throw new ApiError(500, `Failed to create metadata field: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/metadata-field
 * @desc    Get all metadata fields with optional filters
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const fieldType = req.query.fieldType as string | string[] | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : 
                     req.query.isActive === 'false' ? false : 
                     undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    
    // Sort options
    const sortField = (req.query.sortField || 'order') as string;
    const sortOrder = req.query.sortOrder === 'desc' ? -1 as -1 : 1 as 1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };
    
    try {
      const result = await getMetadataFields({
        fieldType,
        categoryId,
        isActive,
        limit,
        skip,
        sort
      });
      
      res.status(200).json({
        success: true,
        fields: result.fields,
        total: result.total,
        limit,
        skip
      });
    } catch (err) {
      logger.error(`Failed to get metadata fields: ${err}`);
      throw new ApiError(500, `Failed to get metadata fields: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/metadata-field/category/:categoryId
 * @desc    Get metadata fields for a specific category
 * @access  Private (Admin only)
 */
router.get(
  '/category/:categoryId',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    
    if (!categoryId) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    const isActive = req.query.isActive === 'true' ? true : 
                     req.query.isActive === 'false' ? false : 
                     undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    
    // Sort options
    const sortField = (req.query.sortField || 'order') as string;
    const sortOrder = req.query.sortOrder === 'desc' ? -1 as -1 : 1 as 1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortOrder };
    
    try {
      const result = await getMetadataFieldsByCategory(categoryId, {
        isActive,
        limit,
        skip,
        sort
      });
      
      res.status(200).json({
        success: true,
        categoryId,
        fields: result.fields,
        total: result.total,
        limit,
        skip
      });
    } catch (err) {
      logger.error(`Failed to get metadata fields by category: ${err}`);
      throw new ApiError(500, `Failed to get metadata fields by category: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/metadata-field/:id
 * @desc    Get a metadata field by ID
 * @access  Private (Admin only)
 */
router.get(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new ApiError(400, 'Metadata field ID is required');
    }
    
    try {
      const field = await getMetadataFieldById(id);
      
      if (!field) {
        throw new ApiError(404, 'Metadata field not found');
      }
      
      res.status(200).json({
        success: true,
        field
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to get metadata field: ${err}`);
      throw new ApiError(500, `Failed to get metadata field: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/metadata-field/name/:name
 * @desc    Get a metadata field by name
 * @access  Private (Admin only)
 */
router.get(
  '/name/:name',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.params;
    
    if (!name) {
      throw new ApiError(400, 'Metadata field name is required');
    }
    
    try {
      const field = await getMetadataFieldByName(name);
      
      if (!field) {
        throw new ApiError(404, 'Metadata field not found');
      }
      
      res.status(200).json({
        success: true,
        field
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to get metadata field by name: ${err}`);
      throw new ApiError(500, `Failed to get metadata field by name: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   PUT /api/admin/metadata-field/:id
 * @desc    Update a metadata field
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new ApiError(400, 'Metadata field ID is required');
    }
    
    const {
      name,
      displayName,
      description,
      fieldType,
      isRequired,
      order,
      defaultValue,
      validation,
      options,
      unit,
      hint,
      extractionPatterns,
      extractionExamples,
      categories,
      isActive
    } = req.body;
    
    // Check if the field exists
    const existingField = await getMetadataFieldById(id);
    if (!existingField) {
      throw new ApiError(404, 'Metadata field not found');
    }
    
    // Validate dropdown fields have options
    if (fieldType === 'dropdown' && (!options || !Array.isArray(options) || options.length === 0)) {
      throw new ApiError(400, 'Dropdown fields must have at least one option');
    }
    
    // Validate categories
    if (categories && (!Array.isArray(categories) || categories.length === 0)) {
      throw new ApiError(400, 'At least one category must be assigned to this field');
    }
    
    // Create update data
    const updateData: Partial<MetadataFieldDocument> = {};
    
    if (name !== undefined) updateData.name = name;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (fieldType !== undefined) updateData.fieldType = fieldType as 'text' | 'textarea' | 'number' | 'dropdown' | 'boolean' | 'date';
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (order !== undefined) updateData.order = order;
    if (defaultValue !== undefined) updateData.defaultValue = defaultValue;
    if (validation !== undefined) updateData.validation = validation;
    if (options !== undefined) updateData.options = options;
    if (unit !== undefined) updateData.unit = unit;
    if (hint !== undefined) updateData.hint = hint;
    if (extractionPatterns !== undefined) updateData.extractionPatterns = extractionPatterns;
    if (extractionExamples !== undefined) updateData.extractionExamples = extractionExamples;
    if (categories !== undefined) updateData.categories = categories;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    try {
      const updatedField = await updateMetadataField(id, updateData);
      
      res.status(200).json({
        success: true,
        message: 'Metadata field updated successfully',
        field: updatedField
      });
    } catch (err) {
      logger.error(`Failed to update metadata field: ${err}`);
      
      // Check for duplicate key error
      if (err instanceof Error && err.message.includes('duplicate key error')) {
        if (err.message.includes('name')) {
          throw new ApiError(409, 'A field with this name already exists');
        }
      }
      
      throw new ApiError(500, `Failed to update metadata field: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   DELETE /api/admin/metadata-field/:id
 * @desc    Delete a metadata field
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new ApiError(400, 'Metadata field ID is required');
    }
    
    try {
      const field = await deleteMetadataField(id);
      
      if (!field) {
        throw new ApiError(404, 'Metadata field not found');
      }
      
      res.status(200).json({
        success: true,
        message: 'Metadata field deleted successfully',
        field
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to delete metadata field: ${err}`);
      throw new ApiError(500, `Failed to delete metadata field: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   POST /api/admin/metadata-field/:id/test-extraction
 * @desc    Test the hint extraction on sample text
 * @access  Private (Admin only)
 */
router.post(
  '/:id/test-extraction',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sampleText } = req.body;
    
    if (!id) {
      throw new ApiError(400, 'Metadata field ID is required');
    }
    
    if (!sampleText) {
      throw new ApiError(400, 'Sample text is required for extraction testing');
    }
    
    try {
      // Get the field definition
      const field = await getMetadataFieldById(id);
      
      if (!field) {
        throw new ApiError(404, 'Metadata field not found');
      }
      
      // Perform the extraction using the function imported at the top
      const extractedValue = extractValueFromOCR(field, sampleText);
      
      res.status(200).json({
        success: true,
        field: {
          id: field.id,
          name: field.name,
          displayName: field.displayName,
          fieldType: field.fieldType
        },
        sampleText,
        extractedValue,
        extractionSucceeded: extractedValue !== undefined
      });
    } catch (err) {
      logger.error(`Failed to test extraction: ${err}`);
      throw new ApiError(500, `Failed to test extraction: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

export default router;