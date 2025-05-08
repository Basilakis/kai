/**
 * Prompt Library Types
 *
 * Type definitions for the Prompt Library feature.
 */

/**
 * Prompt Category interface
 */
export interface PromptCategory {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Prompt Usage Type
 * Defines the different agent types a prompt can be used with
 */
export type PromptUsageType =
  | 'analytics_agent'
  | '3d_design_agent'
  | 'search_agent'
  | 'material_recognition_agent'
  | 'general';

/**
 * User Prompt interface
 */
export interface UserPrompt {
  id: string;
  userId: string;
  title: string;
  content: string;
  description?: string;
  categoryId?: string;
  usage: PromptUsageType;
  isPublic: boolean;
  viewsCount: number;
  importsCount: number;
  forkedFrom?: string;
  forkCount: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Prompt Rating interface
 */
export interface PromptRating {
  id: string;
  promptId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Prompt Rating Stats
 */
export interface PromptRatingStats {
  avgRating: number;
  ratingCount: number;
}

/**
 * Client-specific UserPrompt interface
 * Extends the base UserPrompt with UI-specific fields
 */
export interface ClientUserPrompt extends UserPrompt {
  // UI display properties
  categoryName?: string;

  // UI state
  isSelected?: boolean;
  isEditing?: boolean;

  // User information
  owner?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };

  // Rating information
  ratingStats?: PromptRatingStats;
  userRating?: number;

  // Fork information
  originalPrompt?: {
    id: string;
    title: string;
    owner?: {
      id: string;
      username: string;
    };
  };
}

/**
 * Prompt creation input
 */
export interface CreateUserPromptInput {
  title: string;
  content: string;
  description?: string;
  categoryId?: string;
  usage: PromptUsageType;
  isPublic?: boolean;
  forkedFrom?: string;
  tags?: string[];
}

/**
 * Prompt update input
 */
export interface UpdateUserPromptInput {
  title?: string;
  content?: string;
  description?: string;
  categoryId?: string;
  usage?: PromptUsageType;
  isPublic?: boolean;
  tags?: string[];
}

/**
 * Prompt import result
 */
export interface PromptImportResult {
  success: boolean;
  promptId?: string;
  error?: string;
}

/**
 * Rating input
 */
export interface RatePromptInput {
  promptId: string;
  rating: number;
  comment?: string;
}

/**
 * Sort options for prompt library
 */
export type PromptSortOption =
  | 'newest'
  | 'oldest'
  | 'most_viewed'
  | 'most_imported'
  | 'most_forked'
  | 'highest_rated';

/**
 * Prompt library filter options
 */
export interface PromptLibraryFilters {
  search?: string;
  categoryId?: string;
  usage?: PromptUsageType;
  isPublic?: boolean;
  tags?: string[];
  userId?: string;
  minRating?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: PromptSortOption;
  forkedFrom?: string;
}
