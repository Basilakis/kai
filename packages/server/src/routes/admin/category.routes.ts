import express, { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { ApiError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import {
  createCategory,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategoryTree,
  CategoryDocument
} from '../../models/category.model';

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
 * @route   POST /api/admin/category
 * @desc    Create a new category
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, parentId, slug, isActive } = req.body;
    
    if (!name) {
      throw new ApiError(400, 'Category name is required');
    }
    
    // Create the category
    const categoryData: Partial<CategoryDocument> = {
      name,
      description,
      slug,
      parentId,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: (req as any).user.id
    };
    
    try {
      const category = await createCategory(categoryData);
      
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        category
      });
    } catch (err) {
      logger.error(`Failed to create category: ${err}`);
      
      // Check for duplicate key error
      if (err instanceof Error && err.message.includes('duplicate key error')) {
        if (err.message.includes('slug')) {
          throw new ApiError(409, 'A category with this slug already exists');
        } else if (err.message.includes('name')) {
          throw new ApiError(409, 'A category with this name already exists');
        }
      }
      
      throw new ApiError(500, `Failed to create category: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/category
 * @desc    Get all categories
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parentId = req.query.parentId as string | undefined;
    const level = req.query.level ? parseInt(req.query.level as string) : undefined;
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
      const result = await getCategories({
        parentId,
        level,
        isActive,
        limit,
        skip,
        sort
      });
      
      res.status(200).json({
        success: true,
        categories: result.categories,
        total: result.total,
        limit,
        skip
      });
    } catch (err) {
      logger.error(`Failed to get categories: ${err}`);
      throw new ApiError(500, `Failed to get categories: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/category/tree
 * @desc    Get category tree
 * @access  Private (Admin only)
 */
router.get(
  '/tree',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const rootId = req.query.rootId as string | undefined;
    
    try {
      const tree = await getCategoryTree(rootId);
      
      res.status(200).json({
        success: true,
        tree
      });
    } catch (err) {
      logger.error(`Failed to get category tree: ${err}`);
      throw new ApiError(500, `Failed to get category tree: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/category/:id
 * @desc    Get a category by ID
 * @access  Private (Admin only)
 */
router.get(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    try {
      const category = await getCategoryById(id);
      
      if (!category) {
        throw new ApiError(404, 'Category not found');
      }
      
      res.status(200).json({
        success: true,
        category
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to get category: ${err}`);
      throw new ApiError(500, `Failed to get category: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   GET /api/admin/category/slug/:slug
 * @desc    Get a category by slug
 * @access  Private (Admin only)
 */
router.get(
  '/slug/:slug',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    
    if (!slug) {
      throw new ApiError(400, 'Category slug is required');
    }
    
    try {
      const category = await getCategoryBySlug(slug);
      
      if (!category) {
        throw new ApiError(404, 'Category not found');
      }
      
      res.status(200).json({
        success: true,
        category
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to get category by slug: ${err}`);
      throw new ApiError(500, `Failed to get category by slug: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   PUT /api/admin/category/:id
 * @desc    Update a category
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    const { name, description, parentId, slug, isActive, order } = req.body;
    
    // Check if the category exists
    const existingCategory = await getCategoryById(id);
    if (!existingCategory) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Create update data
    const updateData: Partial<CategoryDocument> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (slug !== undefined) updateData.slug = slug;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;
    
    try {
      const updatedCategory = await updateCategory(id, updateData);
      
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        category: updatedCategory
      });
    } catch (err) {
      logger.error(`Failed to update category: ${err}`);
      
      // Check for duplicate key error
      if (err instanceof Error && err.message.includes('duplicate key error')) {
        if (err.message.includes('slug')) {
          throw new ApiError(409, 'A category with this slug already exists');
        } else if (err.message.includes('name')) {
          throw new ApiError(409, 'A category with this name already exists');
        }
      }
      
      throw new ApiError(500, `Failed to update category: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

/**
 * @route   DELETE /api/admin/category/:id
 * @desc    Delete a category
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    try {
      const category = await deleteCategory(id);
      
      if (!category) {
        throw new ApiError(404, 'Category not found');
      }
      
      res.status(200).json({
        success: true,
        message: 'Category deleted successfully',
        category
      });
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      
      logger.error(`Failed to delete category: ${err}`);
      throw new ApiError(500, `Failed to delete category: ${err instanceof Error ? err.message : String(err)}`);
    }
  })
);

export default router;