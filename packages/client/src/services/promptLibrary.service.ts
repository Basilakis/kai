/**
 * Prompt Library Service
 *
 * Provides functionality for managing user prompts.
 */

import { supabaseClient } from './supabase.service';
import {
  ClientUserPrompt,
  CreateUserPromptInput,
  PromptCategory,
  PromptImportResult,
  PromptLibraryFilters,
  PromptUsageType,
  UpdateUserPromptInput,
  UserPrompt
} from '@shared/types/promptLibrary';

/**
 * Map database prompt to client prompt
 */
const mapPromptFromDb = (data: any): ClientUserPrompt => {
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    content: data.content,
    description: data.description,
    categoryId: data.category_id,
    categoryName: data.categories?.name,
    usage: data.usage as PromptUsageType,
    isPublic: data.is_public,
    viewsCount: data.views_count,
    importsCount: data.imports_count,
    forkedFrom: data.forked_from,
    forkCount: data.fork_count,
    tags: data.tags,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    ratingStats: data.avg_rating !== undefined ? {
      avgRating: parseFloat(data.avg_rating) || 0,
      ratingCount: parseInt(data.rating_count) || 0
    } : undefined,
    userRating: data.user_rating
  };
};

/**
 * Get all prompt categories
 */
export const getPromptCategories = async (): Promise<PromptCategory[]> => {
  const { data, error } = await supabaseClient
    .from('prompt_categories')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Error fetching prompt categories: ${error.message}`);
  }

  return (data || []).map(category => ({
    id: category.id,
    name: category.name,
    description: category.description,
    isSystem: category.is_system,
    createdAt: category.created_at,
    updatedAt: category.updated_at
  }));
};

/**
 * Get user prompts
 */
export const getUserPrompts = async (filters?: PromptLibraryFilters): Promise<ClientUserPrompt[]> => {
  // Use the prompt_stats view to get rating information
  let query = supabaseClient
    .from('prompt_stats')
    .select(`
      id,
      title,
      user_id,
      content,
      description,
      category_id,
      usage,
      is_public,
      views_count,
      imports_count,
      forked_from,
      fork_count,
      tags,
      created_at,
      updated_at,
      avg_rating,
      rating_count,
      categories:category_id(name),
      user_ratings:prompt_ratings(rating)
    `);

  // Apply filters
  if (filters) {
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters.usage) {
      query = query.eq('usage', filters.usage);
    }

    if (filters.isPublic !== undefined) {
      query = query.eq('is_public', filters.isPublic);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.minRating) {
      query = query.gte('avg_rating', filters.minRating);
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    if (filters.forkedFrom) {
      query = query.eq('forked_from', filters.forkedFrom);
    }
  }

  // Apply sorting
  if (filters?.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'most_viewed':
        query = query.order('views_count', { ascending: false });
        break;
      case 'most_imported':
        query = query.order('imports_count', { ascending: false });
        break;
      case 'most_forked':
        query = query.order('fork_count', { ascending: false });
        break;
      case 'highest_rated':
        query = query.order('avg_rating', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching user prompts: ${error.message}`);
  }

  return (data || []).map(item => {
    // Extract user's own rating if available
    const userRating = item.user_ratings && item.user_ratings.length > 0
      ? item.user_ratings[0].rating
      : undefined;

    return mapPromptFromDb({
      ...item,
      user_rating: userRating
    });
  });
};

/**
 * Get public prompts
 */
export const getPublicPrompts = async (filters?: PromptLibraryFilters): Promise<ClientUserPrompt[]> => {
  // Use the prompt_stats view to get rating information
  let query = supabaseClient
    .from('prompt_stats')
    .select(`
      id,
      title,
      user_id,
      content,
      description,
      category_id,
      usage,
      is_public,
      views_count,
      imports_count,
      forked_from,
      fork_count,
      tags,
      created_at,
      updated_at,
      avg_rating,
      rating_count,
      categories:category_id(name),
      users:user_id(id, email, avatar_url),
      user_ratings:prompt_ratings(rating),
      original:forked_from(id, title, user_id, users:user_id(id, email))
    `)
    .eq('is_public', true);

  // Apply filters
  if (filters) {
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters.usage) {
      query = query.eq('usage', filters.usage);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.minRating) {
      query = query.gte('avg_rating', filters.minRating);
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    if (filters.forkedFrom) {
      query = query.eq('forked_from', filters.forkedFrom);
    }
  }

  // Apply sorting
  if (filters?.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'most_viewed':
        query = query.order('views_count', { ascending: false });
        break;
      case 'most_imported':
        query = query.order('imports_count', { ascending: false });
        break;
      case 'most_forked':
        query = query.order('fork_count', { ascending: false });
        break;
      case 'highest_rated':
        query = query.order('avg_rating', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error fetching public prompts: ${error.message}`);
  }

  return (data || []).map(prompt => {
    // Extract user's own rating if available
    const userRating = prompt.user_ratings && prompt.user_ratings.length > 0
      ? prompt.user_ratings[0].rating
      : undefined;

    // Extract original prompt info if this is a fork
    const originalPrompt = prompt.original && prompt.original.length > 0
      ? {
          id: prompt.original[0].id,
          title: prompt.original[0].title,
          owner: prompt.original[0].users
            ? {
                id: prompt.original[0].users.id,
                username: prompt.original[0].users.email.split('@')[0]
              }
            : undefined
        }
      : undefined;

    return {
      ...mapPromptFromDb({
        ...prompt,
        user_rating: userRating
      }),
      owner: prompt.users ? {
        id: prompt.users.id,
        username: prompt.users.email.split('@')[0],
        avatarUrl: prompt.users.avatar_url
      } : undefined,
      originalPrompt
    };
  });
};

/**
 * Get prompt by ID
 */
export const getPromptById = async (id: string): Promise<ClientUserPrompt> => {
  // Get the current user's ID for rating lookup
  const { data: userData } = await supabaseClient.auth.getUser();
  const userId = userData?.user?.id;

  // Use the prompt_stats view to get rating information
  const { data, error } = await supabaseClient
    .from('prompt_stats')
    .select(`
      id,
      title,
      user_id,
      content,
      description,
      category_id,
      usage,
      is_public,
      views_count,
      imports_count,
      forked_from,
      fork_count,
      tags,
      created_at,
      updated_at,
      avg_rating,
      rating_count,
      categories:category_id(name),
      users:user_id(id, email, avatar_url),
      original:forked_from(id, title, user_id, users:user_id(id, email)),
      forks:user_prompts!forked_from(id, title, user_id, is_public, users:user_id(id, email))
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Error fetching prompt: ${error.message}`);
  }

  // Get the user's rating for this prompt if they're logged in
  let userRating;
  if (userId) {
    const { data: ratingData } = await supabaseClient
      .from('prompt_ratings')
      .select('rating')
      .eq('prompt_id', id)
      .eq('user_id', userId)
      .single();

    userRating = ratingData?.rating;
  }

  // Extract original prompt info if this is a fork
  const originalPrompt = data.original
    ? {
        id: data.original.id,
        title: data.original.title,
        owner: data.original.users
          ? {
              id: data.original.users.id,
              username: data.original.users.email.split('@')[0]
            }
          : undefined
      }
    : undefined;

  // Process forks information
  const forks = data.forks && data.forks.length > 0
    ? data.forks
        .filter((fork: any) => fork.is_public) // Only include public forks
        .map((fork: any) => ({
          id: fork.id,
          title: fork.title,
          owner: fork.users
            ? {
                id: fork.users.id,
                username: fork.users.email.split('@')[0]
              }
            : undefined
        }))
    : [];

  return {
    ...mapPromptFromDb({
      ...data,
      user_rating: userRating
    }),
    owner: data.users ? {
      id: data.users.id,
      username: data.users.email.split('@')[0],
      avatarUrl: data.users.avatar_url
    } : undefined,
    originalPrompt,
    forks
  };
};

/**
 * Create a new prompt
 */
export const createPrompt = async (input: CreateUserPromptInput): Promise<ClientUserPrompt> => {
  const { data, error } = await supabaseClient
    .from('user_prompts')
    .insert({
      title: input.title,
      content: input.content,
      description: input.description,
      category_id: input.categoryId,
      usage: input.usage,
      is_public: input.isPublic || false,
      forked_from: input.forkedFrom,
      tags: input.tags || []
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating prompt: ${error.message}`);
  }

  // If this is a fork, increment the fork count of the original prompt
  if (input.forkedFrom) {
    await supabaseClient.rpc('increment_prompt_fork_count', { prompt_id: input.forkedFrom });
  }

  return mapPromptFromDb(data);
};

/**
 * Update a prompt
 */
export const updatePrompt = async (id: string, input: UpdateUserPromptInput): Promise<ClientUserPrompt> => {
  const { data, error } = await supabaseClient
    .from('user_prompts')
    .update({
      title: input.title,
      content: input.content,
      description: input.description,
      category_id: input.categoryId,
      usage: input.usage,
      is_public: input.isPublic,
      tags: input.tags,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating prompt: ${error.message}`);
  }

  return mapPromptFromDb(data);
};

/**
 * Delete a prompt
 */
export const deletePrompt = async (id: string): Promise<void> => {
  const { error } = await supabaseClient
    .from('user_prompts')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Error deleting prompt: ${error.message}`);
  }
};

/**
 * Fork a prompt
 * Creates a copy of a prompt as a new prompt with a reference to the original
 */
export const forkPrompt = async (id: string): Promise<PromptImportResult> => {
  try {
    // First get the prompt
    const prompt = await getPromptById(id);

    // Create a new prompt for the current user
    const newPrompt = await createPrompt({
      title: `Fork of: ${prompt.title}`,
      content: prompt.content,
      description: prompt.description,
      categoryId: prompt.categoryId,
      usage: prompt.usage,
      isPublic: false, // Default to private for forked prompts
      forkedFrom: id,
      tags: prompt.tags
    });

    return {
      success: true,
      promptId: newPrompt.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Import a prompt
 * Creates a copy of a prompt without tracking the relationship
 */
export const importPrompt = async (id: string): Promise<PromptImportResult> => {
  try {
    // First get the prompt
    const prompt = await getPromptById(id);

    // Create a new prompt for the current user
    const newPrompt = await createPrompt({
      title: prompt.title,
      content: prompt.content,
      description: prompt.description,
      categoryId: prompt.categoryId,
      usage: prompt.usage,
      isPublic: false, // Default to private for imported prompts
      tags: prompt.tags
    });

    // Increment the import count
    await supabaseClient
      .from('user_prompts')
      .update({ imports_count: prompt.importsCount + 1 })
      .eq('id', id);

    return {
      success: true,
      promptId: newPrompt.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Increment view count for a prompt
 */
export const incrementPromptViewCount = async (id: string): Promise<void> => {
  await supabaseClient
    .rpc('increment_prompt_view_count', { prompt_id: id });
};

/**
 * Rate a prompt
 */
export const ratePrompt = async (input: RatePromptInput): Promise<void> => {
  const { promptId, rating, comment } = input;

  // Get the current user
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error('You must be logged in to rate a prompt');
  }

  // Check if the user has already rated this prompt
  const { data: existingRating } = await supabaseClient
    .from('prompt_ratings')
    .select('id')
    .eq('prompt_id', promptId)
    .eq('user_id', userData.user.id)
    .single();

  if (existingRating) {
    // Update existing rating
    const { error } = await supabaseClient
      .from('prompt_ratings')
      .update({
        rating,
        comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingRating.id);

    if (error) {
      throw new Error(`Error updating rating: ${error.message}`);
    }
  } else {
    // Create new rating
    const { error } = await supabaseClient
      .from('prompt_ratings')
      .insert({
        prompt_id: promptId,
        user_id: userData.user.id,
        rating,
        comment
      });

    if (error) {
      throw new Error(`Error creating rating: ${error.message}`);
    }
  }
};

/**
 * Get prompt rating stats
 */
export const getPromptRatingStats = async (promptId: string): Promise<PromptRatingStats> => {
  const { data, error } = await supabaseClient
    .rpc('get_prompt_rating', { prompt_id: promptId });

  if (error) {
    throw new Error(`Error fetching prompt rating: ${error.message}`);
  }

  return {
    avgRating: parseFloat(data[0].avg_rating) || 0,
    ratingCount: parseInt(data[0].rating_count) || 0
  };
};

/**
 * Get user's rating for a prompt
 */
export const getUserRating = async (promptId: string): Promise<number | null> => {
  // Get the current user
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData?.user?.id) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('prompt_ratings')
    .select('rating')
    .eq('prompt_id', promptId)
    .eq('user_id', userData.user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Record not found
      return null;
    }
    throw new Error(`Error fetching user rating: ${error.message}`);
  }

  return data.rating;
};
