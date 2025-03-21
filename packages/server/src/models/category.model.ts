/**
 * Category Model
 * 
 * This model represents categories for materials in the system.
 * It supports hierarchical structures through parent/child relationships.
 */

import mongoose from 'mongoose';
import { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Category document interface
 */
export interface CategoryDocument extends Document {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parentId?: string;
  path: string[];
  level: number;
  isActive: boolean;
  order: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Category schema
 */
const categorySchema = new Schema<CategoryDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    parentId: {
      type: String,
      default: null
    },
    path: {
      type: [String],
      default: []
    },
    level: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
categorySchema.index({ id: 1 }, { unique: true });
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ order: 1 });

/**
 * Pre-save middleware to create slug if not provided
 */
categorySchema.pre('save', function(this: any, next: any) {
  if (!this.isModified('name')) {
    return next();
  }

  // Generate slug from name if not provided
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  next();
});

/**
 * Category model
 */
const Category = mongoose.model<CategoryDocument>('Category', categorySchema);

/**
 * Create a new category
 * 
 * @param categoryData Category data
 * @returns Created category document
 */
export async function createCategory(categoryData: Partial<CategoryDocument>): Promise<CategoryDocument> {
  try {
    // Set path and level based on parent
    if (categoryData.parentId) {
      const parent = await Category.findOne({ id: categoryData.parentId });
      if (!parent) {
        throw new Error(`Parent category not found: ${categoryData.parentId}`);
      }
      
      categoryData.path = [...parent.path, categoryData.parentId];
      categoryData.level = parent.level + 1;
    } else {
      categoryData.path = [];
      categoryData.level = 0;
    }
    
    const category = new Category(categoryData);
    await category.save();
    return category;
  } catch (err) {
    logger.error(`Failed to create category: ${err}`);
    throw new Error(`Failed to create category: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a category by ID
 * 
 * @param id Category ID
 * @returns Category document
 */
export async function getCategoryById(id: string): Promise<CategoryDocument | null> {
  try {
    return await Category.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get category: ${err}`);
    throw new Error(`Failed to get category: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a category by slug
 * 
 * @param slug Category slug
 * @returns Category document
 */
export async function getCategoryBySlug(slug: string): Promise<CategoryDocument | null> {
  try {
    return await Category.findOne({ slug });
  } catch (err) {
    logger.error(`Failed to get category by slug: ${err}`);
    throw new Error(`Failed to get category by slug: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a category
 * 
 * @param id Category ID
 * @param updateData Update data
 * @returns Updated category document
 */
export async function updateCategory(id: string, updateData: Partial<CategoryDocument>): Promise<CategoryDocument | null> {
  try {
    // Handle path and level updates if parentId is changing
    if (updateData.parentId !== undefined) {
      if (updateData.parentId) {
        const parent = await Category.findOne({ id: updateData.parentId });
        if (!parent) {
          throw new Error(`Parent category not found: ${updateData.parentId}`);
        }
        
        updateData.path = [...parent.path, updateData.parentId];
        updateData.level = parent.level + 1;
      } else {
        updateData.path = [];
        updateData.level = 0;
      }
      
      // Update child categories
      const childCategories = await Category.find({ path: id });
      for (const child of childCategories) {
        await updateChildCategoryPath(child, id);
      }
    }
    
    return await Category.findOneAndUpdate(
      { id },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
  } catch (err) {
    logger.error(`Failed to update category: ${err}`);
    throw new Error(`Failed to update category: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a category
 * 
 * @param id Category ID
 * @returns Deleted category document
 */
export async function deleteCategory(id: string): Promise<CategoryDocument | null> {
  try {
    // Check for child categories
    const childCategories = await Category.find({ parentId: id });
    if (childCategories.length > 0) {
      throw new Error(`Cannot delete category with children. Delete child categories first or reassign them.`);
    }
    
    return await Category.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete category: ${err}`);
    throw new Error(`Failed to delete category: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all categories
 * 
 * @param options Query options
 * @returns Array of category documents
 */
export async function getCategories(options: {
  parentId?: string;
  level?: number;
  isActive?: boolean;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
} = {}): Promise<{
  categories: CategoryDocument[];
  total: number;
}> {
  try {
    const { 
      parentId,
      level,
      isActive,
      limit = 100, 
      skip = 0, 
      sort = { order: 1, name: 1 } 
    } = options;
    
    // Build filter
    const filter: Record<string, any> = {};
    if (parentId !== undefined) {
      filter.parentId = parentId;
    }
    if (level !== undefined) {
      filter.level = level;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    const categories = await Category.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await Category.countDocuments(filter);
    
    return { categories, total };
  } catch (err) {
    logger.error(`Failed to get categories: ${err}`);
    throw new Error(`Failed to get categories: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get category tree
 * 
 * @param rootId Root category ID (optional)
 * @returns Hierarchical tree of categories
 */
export async function getCategoryTree(rootId?: string): Promise<any[]> {
  try {
    // Get all categories or categories under a specific root
    const filter: Record<string, any> = {};
    if (rootId) {
      filter.path = rootId;
    }
    
    const allCategories = await Category.find(filter).sort({ order: 1, name: 1 });
    
    // Function to build tree recursively
    const buildCategoryTree = (parentId: string | null) => {
      return allCategories
        .filter((category: CategoryDocument) => category.parentId === parentId)
        .map((category: CategoryDocument) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          slug: category.slug,
          level: category.level,
          isActive: category.isActive,
          order: category.order,
          children: buildCategoryTree(category.id)
        }));
    };
    
    // Start building tree from root categories (parentId is null)
    return buildCategoryTree(rootId || null);
  } catch (err) {
    logger.error(`Failed to get category tree: ${err}`);
    throw new Error(`Failed to get category tree: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update child category paths recursively
 * 
 * @param childCategory Child category document
 * @param changedParentId ID of the parent category that changed
 */
async function updateChildCategoryPath(childCategory: CategoryDocument, changedParentId: string): Promise<void> {
  try {
    // Get the updated parent category
    const updatedParent = await Category.findOne({ id: childCategory.parentId });
    if (!updatedParent) {
      throw new Error(`Parent category not found: ${childCategory.parentId}`);
    }
    
    // Update the child's path and level
    const updatedPath = [...updatedParent.path, updatedParent.id];
    const updatedLevel = updatedParent.level + 1;
    
    await Category.updateOne(
      { id: childCategory.id },
      {
        path: updatedPath,
        level: updatedLevel,
        updatedAt: new Date()
      }
    );
    
    // Recursively update this child's children
    const childrenOfChild = await Category.find({ parentId: childCategory.id });
    for (const child of childrenOfChild) {
      await updateChildCategoryPath(child, childCategory.id);
    }
  } catch (err) {
    logger.error(`Failed to update child category path: ${err}`);
    throw new Error(`Failed to update child category path: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default Category;