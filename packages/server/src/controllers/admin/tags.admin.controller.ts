import { Request, Response } from 'express';
import { ApiError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { supabaseClient } from '../../services/supabase/supabaseClient';

/**
 * TypeScript interfaces for predefined tag system
 */
interface PredefinedTagCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface PredefinedTag {
  id: string;
  category_id: string;
  name: string;
  normalized_name: string;
  synonyms: string[];
  description?: string;
  is_active: boolean;
  confidence_threshold: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface TagMatchingLog {
  id: string;
  material_id?: string;
  extracted_text: string;
  matched_tag_id?: string;
  confidence_score?: number;
  matching_method: string;
  category_name: string;
  created_at: string;
}

interface CreateTagCategoryRequest {
  name: string;
  description?: string;
  sort_order?: number;
}

interface UpdateTagCategoryRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

interface CreateTagRequest {
  category_id: string;
  name: string;
  synonyms?: string[];
  description?: string;
  confidence_threshold?: number;
}

interface UpdateTagRequest {
  name?: string;
  synonyms?: string[];
  description?: string;
  is_active?: boolean;
  confidence_threshold?: number;
}

/**
 * Get all tag categories with optional filtering
 * 
 * @param req Request object
 * @param res Response object
 */
export async function getTagCategories(req: Request, res: Response): Promise<void> {
  try {
    const { active_only = 'false', sort_by = 'sort_order' } = req.query;
    
    let query = supabaseClient
      .from('predefined_tag_categories')
      .select('*');
    
    // Filter by active status if requested
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }
    
    // Apply sorting
    const validSortFields = ['sort_order', 'name', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by as string : 'sort_order';
    query = query.order(sortField, { ascending: true });
    
    const { data: categories, error } = await query;
    
    if (error) {
      logger.error(`Error fetching tag categories: ${error.message}`);
      throw new ApiError(500, `Failed to fetch tag categories: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      count: categories?.length || 0,
      data: categories || []
    });
  } catch (error) {
    logger.error(`Error in getTagCategories: ${error}`);
    throw error;
  }
}

/**
 * Get a specific tag category by ID
 * 
 * @param req Request object
 * @param res Response object
 */
export async function getTagCategoryById(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;
    
    if (!categoryId) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    const { data: category, error } = await supabaseClient
      .from('predefined_tag_categories')
      .select('*')
      .eq('id', categoryId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, `Tag category not found with id ${categoryId}`);
      }
      logger.error(`Error fetching tag category: ${error.message}`);
      throw new ApiError(500, `Failed to fetch tag category: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error(`Error in getTagCategoryById: ${error}`);
    throw error;
  }
}

/**
 * Create a new tag category
 * 
 * @param req Request object
 * @param res Response object
 */
export async function createTagCategory(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, sort_order = 0 }: CreateTagCategoryRequest = req.body;
    
    if (!name || name.trim().length === 0) {
      throw new ApiError(400, 'Category name is required');
    }
    
    // Check if category with this name already exists
    const { data: existingCategory } = await supabaseClient
      .from('predefined_tag_categories')
      .select('id')
      .eq('name', name.trim())
      .single();
    
    if (existingCategory) {
      throw new ApiError(409, `Tag category with name "${name}" already exists`);
    }
    
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || null,
      sort_order,
      is_active: true,
      created_by: req.user?.id || null
    };
    
    const { data: newCategory, error } = await supabaseClient
      .from('predefined_tag_categories')
      .insert([categoryData])
      .select()
      .single();
    
    if (error) {
      logger.error(`Error creating tag category: ${error.message}`);
      throw new ApiError(500, `Failed to create tag category: ${error.message}`);
    }
    
    logger.info(`Created new tag category: ${newCategory.name} (ID: ${newCategory.id})`);
    
    res.status(201).json({
      success: true,
      message: 'Tag category created successfully',
      data: newCategory
    });
  } catch (error) {
    logger.error(`Error in createTagCategory: ${error}`);
    throw error;
  }
}

/**
 * Update an existing tag category
 * 
 * @param req Request object
 * @param res Response object
 */
export async function updateTagCategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;
    const { name, description, is_active, sort_order }: UpdateTagCategoryRequest = req.body;
    
    if (!categoryId) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabaseClient
      .from('predefined_tag_categories')
      .select('*')
      .eq('id', categoryId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new ApiError(404, `Tag category not found with id ${categoryId}`);
      }
      throw new ApiError(500, `Failed to fetch tag category: ${fetchError.message}`);
    }
    
    // If name is being updated, check for conflicts
    if (name && name.trim() !== existingCategory.name) {
      const { data: conflictCategory } = await supabaseClient
        .from('predefined_tag_categories')
        .select('id')
        .eq('name', name.trim())
        .neq('id', categoryId)
        .single();
      
      if (conflictCategory) {
        throw new ApiError(409, `Tag category with name "${name}" already exists`);
      }
    }
    
    const updateData: Partial<PredefinedTagCategory> = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || undefined;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    
    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
    }
    
    const { data: updatedCategory, error } = await supabaseClient
      .from('predefined_tag_categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single();
    
    if (error) {
      logger.error(`Error updating tag category: ${error.message}`);
      throw new ApiError(500, `Failed to update tag category: ${error.message}`);
    }
    
    logger.info(`Updated tag category: ${updatedCategory.name} (ID: ${categoryId})`);
    
    res.status(200).json({
      success: true,
      message: 'Tag category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    logger.error(`Error in updateTagCategory: ${error}`);
    throw error;
  }
}

/**
 * Delete a tag category (soft delete by setting is_active to false)
 * 
 * @param req Request object
 * @param res Response object
 */
export async function deleteTagCategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;
    const { hard_delete = 'false' } = req.query;
    
    if (!categoryId) {
      throw new ApiError(400, 'Category ID is required');
    }
    
    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabaseClient
      .from('predefined_tag_categories')
      .select('*')
      .eq('id', categoryId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new ApiError(404, `Tag category not found with id ${categoryId}`);
      }
      throw new ApiError(500, `Failed to fetch tag category: ${fetchError.message}`);
    }
    
    if (hard_delete === 'true') {
      // Hard delete - remove the category and all associated tags
      const { error } = await supabaseClient
        .from('predefined_tag_categories')
        .delete()
        .eq('id', categoryId);
      
      if (error) {
        logger.error(`Error deleting tag category: ${error.message}`);
        throw new ApiError(500, `Failed to delete tag category: ${error.message}`);
      }
      
      logger.info(`Hard deleted tag category: ${existingCategory.name} (ID: ${categoryId})`);
      
      res.status(200).json({
        success: true,
        message: 'Tag category permanently deleted'
      });
    } else {
      // Soft delete - set is_active to false
      const { data: updatedCategory, error } = await supabaseClient
        .from('predefined_tag_categories')
        .update({ is_active: false })
        .eq('id', categoryId)
        .select()
        .single();
      
      if (error) {
        logger.error(`Error deactivating tag category: ${error.message}`);
        throw new ApiError(500, `Failed to deactivate tag category: ${error.message}`);
      }
      
      logger.info(`Deactivated tag category: ${existingCategory.name} (ID: ${categoryId})`);
      
      res.status(200).json({
        success: true,
        message: 'Tag category deactivated successfully',
        data: updatedCategory
      });
    }
  } catch (error) {
    logger.error(`Error in deleteTagCategory: ${error}`);
    throw error;
  }
}

/**
 * Get all tags with optional filtering by category
 * 
 * @param req Request object
 * @param res Response object
 */
export async function getTags(req: Request, res: Response): Promise<void> {
  try {
    const { 
      category_id, 
      category_name, 
      active_only = 'false', 
      sort_by = 'usage_count',
      page = '1',
      limit = '50'
    } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;
    
    let query = supabaseClient
      .from('predefined_tags')
      .select(`
        *,
        predefined_tag_categories!inner(
          id,
          name,
          description
        )
      `);
    
    // Filter by category
    if (category_id) {
      query = query.eq('category_id', category_id);
    } else if (category_name) {
      query = query.eq('predefined_tag_categories.name', category_name);
    }
    
    // Filter by active status
    if (active_only === 'true') {
      query = query.eq('is_active', true);
      query = query.eq('predefined_tag_categories.is_active', true);
    }
    
    // Apply sorting
    const validSortFields = ['usage_count', 'name', 'created_at', 'updated_at', 'confidence_threshold'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by as string : 'usage_count';
    const ascending = sortField === 'name';
    
    query = query.order(sortField, { ascending });
    
    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);
    
    const { data: tags, error, count } = await query;
    
    if (error) {
      logger.error(`Error fetching tags: ${error.message}`);
      throw new ApiError(500, `Failed to fetch tags: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      count: tags?.length || 0,
      total: count || 0,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil((count || 0) / limitNum),
        limit: limitNum
      },
      data: tags || []
    });
  } catch (error) {
    logger.error(`Error in getTags: ${error}`);
    throw error;
  }
}

/**
 * Get a specific tag by ID
 * 
 * @param req Request object
 * @param res Response object
 */
export async function getTagById(req: Request, res: Response): Promise<void> {
  try {
    const { tagId } = req.params;
    
    if (!tagId) {
      throw new ApiError(400, 'Tag ID is required');
    }
    
    const { data: tag, error } = await supabaseClient
      .from('predefined_tags')
      .select(`
        *,
        predefined_tag_categories(
          id,
          name,
          description
        )
      `)
      .eq('id', tagId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, `Tag not found with id ${tagId}`);
      }
      logger.error(`Error fetching tag: ${error.message}`);
      throw new ApiError(500, `Failed to fetch tag: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      data: tag
    });
  } catch (error) {
    logger.error(`Error in getTagById: ${error}`);
    throw error;
  }
}

/**
 * Create a new predefined tag
 * 
 * @param req Request object
 * @param res Response object
 */
export async function createTag(req: Request, res: Response): Promise<void> {
  try {
    const { 
      category_id, 
      name, 
      synonyms = [], 
      description, 
      confidence_threshold = 0.7 
    }: CreateTagRequest = req.body;
    
    if (!category_id || !name || name.trim().length === 0) {
      throw new ApiError(400, 'Category ID and tag name are required');
    }
    
    if (confidence_threshold < 0 || confidence_threshold > 1) {
      throw new ApiError(400, 'Confidence threshold must be between 0 and 1');
    }
    
    // Verify category exists and is active
    const { data: category, error: categoryError } = await supabaseClient
      .from('predefined_tag_categories')
      .select('id, name, is_active')
      .eq('id', category_id)
      .single();
    
    if (categoryError) {
      if (categoryError.code === 'PGRST116') {
        throw new ApiError(404, `Tag category not found with id ${category_id}`);
      }
      throw new ApiError(500, `Failed to verify category: ${categoryError.message}`);
    }
    
    if (!category.is_active) {
      throw new ApiError(400, 'Cannot create tags in inactive category');
    }
    
    // Check for duplicate tag name within the same category
    const { data: existingTag } = await supabaseClient
      .from('predefined_tags')
      .select('id')
      .eq('category_id', category_id)
      .eq('normalized_name', name.trim().toLowerCase())
      .single();
    
    if (existingTag) {
      throw new ApiError(409, `Tag with name "${name}" already exists in this category`);
    }
    
    const tagData = {
      category_id,
      name: name.trim(),
      synonyms: Array.isArray(synonyms) ? synonyms.filter(s => s.trim().length > 0) : [],
      description: description?.trim() || null,
      confidence_threshold,
      is_active: true,
      usage_count: 0,
      created_by: req.user?.id || null
    };
    
    const { data: newTag, error } = await supabaseClient
      .from('predefined_tags')
      .insert([tagData])
      .select(`
        *,
        predefined_tag_categories(
          id,
          name,
          description
        )
      `)
      .single();
    
    if (error) {
      logger.error(`Error creating tag: ${error.message}`);
      throw new ApiError(500, `Failed to create tag: ${error.message}`);
    }
    
    logger.info(`Created new tag: ${newTag.name} in category ${category.name} (ID: ${newTag.id})`);
    
    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      data: newTag
    });
  } catch (error) {
    logger.error(`Error in createTag: ${error}`);
    throw error;
  }
}

/**
 * Update an existing predefined tag
 * 
 * @param req Request object
 * @param res Response object
 */
export async function updateTag(req: Request, res: Response): Promise<void> {
  try {
    const { tagId } = req.params;
    const { 
      name, 
      synonyms, 
      description, 
      is_active, 
      confidence_threshold 
    }: UpdateTagRequest = req.body;
    
    if (!tagId) {
      throw new ApiError(400, 'Tag ID is required');
    }
    
    if (confidence_threshold !== undefined && (confidence_threshold < 0 || confidence_threshold > 1)) {
      throw new ApiError(400, 'Confidence threshold must be between 0 and 1');
    }
    
    // Check if tag exists
    const { data: existingTag, error: fetchError } = await supabaseClient
      .from('predefined_tags')
      .select('*')
      .eq('id', tagId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new ApiError(404, `Tag not found with id ${tagId}`);
      }
      throw new ApiError(500, `Failed to fetch tag: ${fetchError.message}`);
    }
    
    // If name is being updated, check for conflicts within the same category
    if (name && name.trim() !== existingTag.name) {
      const { data: conflictTag } = await supabaseClient
        .from('predefined_tags')
        .select('id')
        .eq('category_id', existingTag.category_id)
        .eq('normalized_name', name.trim().toLowerCase())
        .neq('id', tagId)
        .single();
      
      if (conflictTag) {
        throw new ApiError(409, `Tag with name "${name}" already exists in this category`);
      }
    }
    
    const updateData: Partial<PredefinedTag> = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (synonyms !== undefined) {
      updateData.synonyms = Array.isArray(synonyms) ? synonyms.filter(s => s.trim().length > 0) : [];
    }
    if (description !== undefined) updateData.description = description?.trim() || undefined;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (confidence_threshold !== undefined) updateData.confidence_threshold = confidence_threshold;
    
    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
    }
    
    const { data: updatedTag, error } = await supabaseClient
      .from('predefined_tags')
      .update(updateData)
      .eq('id', tagId)
      .select(`
        *,
        predefined_tag_categories(
          id,
          name,
          description
        )
      `)
      .single();
    
    if (error) {
      logger.error(`Error updating tag: ${error.message}`);
      throw new ApiError(500, `Failed to update tag: ${error.message}`);
    }
    
    logger.info(`Updated tag: ${updatedTag.name} (ID: ${tagId})`);
    
    res.status(200).json({
      success: true,
      message: 'Tag updated successfully',
      data: updatedTag
    });
  } catch (error) {
    logger.error(`Error in updateTag: ${error}`);
    throw error;
  }
}

/**
 * Delete a predefined tag (soft delete by setting is_active to false)
 * 
 * @param req Request object
 * @param res Response object
 */
export async function deleteTag(req: Request, res: Response): Promise<void> {
  try {
    const { tagId } = req.params;
    const { hard_delete = 'false' } = req.query;
    
    if (!tagId) {
      throw new ApiError(400, 'Tag ID is required');
    }
    
    // Check if tag exists
    const { data: existingTag, error: fetchError } = await supabaseClient
      .from('predefined_tags')
      .select('*')
      .eq('id', tagId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new ApiError(404, `Tag not found with id ${tagId}`);
      }
      throw new ApiError(500, `Failed to fetch tag: ${fetchError.message}`);
    }
    
    if (hard_delete === 'true') {
      // Hard delete - remove the tag permanently
      const { error } = await supabaseClient
        .from('predefined_tags')
        .delete()
        .eq('id', tagId);
      
      if (error) {
        logger.error(`Error deleting tag: ${error.message}`);
        throw new ApiError(500, `Failed to delete tag: ${error.message}`);
      }
      
      logger.info(`Hard deleted tag: ${existingTag.name} (ID: ${tagId})`);
      
      res.status(200).json({
        success: true,
        message: 'Tag permanently deleted'
      });
    } else {
      // Soft delete - set is_active to false
      const { data: updatedTag, error } = await supabaseClient
        .from('predefined_tags')
        .update({ is_active: false })
        .eq('id', tagId)
        .select()
        .single();
      
      if (error) {
        logger.error(`Error deactivating tag: ${error.message}`);
        throw new ApiError(500, `Failed to deactivate tag: ${error.message}`);
      }
      
      logger.info(`Deactivated tag: ${existingTag.name} (ID: ${tagId})`);
      
      res.status(200).json({
        success: true,
        message: 'Tag deactivated successfully',
        data: updatedTag
      });
    }
  } catch (error) {
    logger.error(`Error in deleteTag: ${error}`);
    throw error;
  }
}

/**
 * Get tag matching logs with filtering options
 * 
 * @param req Request object
 * @param res Response object
 */
export async function getTagMatchingLogs(req: Request, res: Response): Promise<void> {
  try {
    const { 
      material_id,
      category_name,
      matching_method,
      start_date,
      end_date,
      page = '1',
      limit = '50'
    } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offset = (pageNum - 1) * limitNum;
    
    let query = supabaseClient
      .from('tag_matching_logs')
      .select(`
        *,
        predefined_tags(
          id,
          name,
          predefined_tag_categories(
            name
          )
        )
      `);
    
    // Apply filters
    if (material_id) {
      query = query.eq('material_id', material_id);
    }
    
    if (category_name) {
      query = query.eq('category_name', category_name);
    }
    
    if (matching_method) {
      query = query.eq('matching_method', matching_method);
    }
    
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    
    // Apply sorting and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    
    const { data: logs, error, count } = await query;
    
    if (error) {
      logger.error(`Error fetching tag matching logs: ${error.message}`);
      throw new ApiError(500, `Failed to fetch tag matching logs: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      count: logs?.length || 0,
      total: count || 0,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil((count || 0) / limitNum),
        limit: limitNum
      },
      data: logs || []
    });
  } catch (error) {
    logger.error(`Error in getTagMatchingLogs: ${error}`);
    throw error;
  }
}

/**
 * Test tag matching against extracted text
 * 
 * @param req Request object
 * @param res Response object
 */
export async function testTagMatching(req: Request, res: Response): Promise<void> {
  try {
    const { extracted_text, category_name, min_confidence = 0.7 } = req.body;
    
    if (!extracted_text || !category_name) {
      throw new ApiError(400, 'Extracted text and category name are required');
    }
    
    if (min_confidence < 0 || min_confidence > 1) {
      throw new ApiError(400, 'Minimum confidence must be between 0 and 1');
    }
    
    // Call the PostgreSQL function for tag matching
    const { data: matches, error } = await supabaseClient
      .rpc('find_matching_tags', {
        extracted_text,
        category_name,
        min_confidence
      });
    
    if (error) {
      logger.error(`Error testing tag matching: ${error.message}`);
      throw new ApiError(500, `Failed to test tag matching: ${error.message}`);
    }
    
    res.status(200).json({
      success: true,
      extracted_text,
      category_name,
      min_confidence,
      matches: matches || [],
      match_count: matches?.length || 0
    });
  } catch (error) {
    logger.error(`Error in testTagMatching: ${error}`);
    throw error;
  }
}

/**
 * Get tag usage statistics
 * 
 * @param req Request object
 * @param res Response object
 */
export async function getTagStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { category_id, category_name } = req.query;
    
    let query = supabaseClient
      .from('predefined_tags')
      .select(`
        id,
        name,
        usage_count,
        confidence_threshold,
        is_active,
        predefined_tag_categories!inner(
          id,
          name
        )
      `);
    
    // Filter by category if specified
    if (category_id) {
      query = query.eq('category_id', category_id);
    } else if (category_name) {
      query = query.eq('predefined_tag_categories.name', category_name);
    }
    
    query = query.eq('is_active', true);
    query = query.order('usage_count', { ascending: false });
    
    const { data: tags, error } = await query;
    
    if (error) {
      logger.error(`Error fetching tag statistics: ${error.message}`);
      throw new ApiError(500, `Failed to fetch tag statistics: ${error.message}`);
    }
    
    // Calculate statistics
    const totalTags = tags?.length || 0;
    const totalUsage = tags?.reduce((sum: number, tag: any) => sum + tag.usage_count, 0) || 0;
    const averageUsage = totalTags > 0 ? totalUsage / totalTags : 0;
    const mostUsedTag = tags?.[0] || null;
    const unusedTags = tags?.filter((tag: any) => tag.usage_count === 0).length || 0;
    
    res.status(200).json({
      success: true,
      statistics: {
        total_tags: totalTags,
        total_usage: totalUsage,
        average_usage: Math.round(averageUsage * 100) / 100,
        unused_tags: unusedTags,
        most_used_tag: mostUsedTag
      },
      data: tags || []
    });
  } catch (error) {
    logger.error(`Error in getTagStatistics: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    throw new ApiError(500, 'Failed to get tag statistics');
  }
};