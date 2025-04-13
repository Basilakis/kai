/**
 * MoodBoard Types
 * 
 * Type definitions for MoodBoard data structures with extension
 * mechanisms for package-specific customization.
 */

import * as z from 'zod';

// --------------------------
// Base Types
// --------------------------

/**
 * MoodBoard interface
 */
export interface MoodBoard {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isPublic: boolean;
  viewPreference: 'grid' | 'list';
  createdAt: string;
  updatedAt: string;
}

/**
 * MoodBoardItem interface
 */
export interface MoodBoardItem {
  id: string;
  boardId: string;
  materialId: string;
  notes?: string;
  position: number;
  addedAt: string;
}

// --------------------------
// Zod Schemas
// --------------------------

/**
 * MoodBoard Zod schema
 */
export const moodBoardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  userId: z.string().uuid(),
  isPublic: z.boolean().default(false),
  viewPreference: z.enum(['grid', 'list']).default('grid'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * MoodBoardItem Zod schema
 */
export const moodBoardItemSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  materialId: z.string(),
  notes: z.string().optional(),
  position: z.number().int().default(0),
  addedAt: z.string().datetime(),
});

// --------------------------
// Extension Mechanism
// --------------------------

/**
 * Extension type for MoodBoard
 */
export type ExtendMoodBoard<T> = MoodBoard & T;

/**
 * Extension type for MoodBoardItem
 */
export type ExtendMoodBoardItem<T> = MoodBoardItem & T;

// --------------------------
// Client-specific Types
// --------------------------

/**
 * Client-specific MoodBoard base type
 */
export interface ClientMoodBoardBase extends MoodBoard {
  // UI display properties
  thumbnailUrl?: string;
  itemCount?: number;
  
  // UI state
  isSelected?: boolean;
  isEditing?: boolean;
  
  // Client-side caching
  lastViewedAt?: string;
}

/**
 * Client-specific MoodBoardItem base type
 */
export interface ClientMoodBoardItemBase extends MoodBoardItem {
  // UI display properties
  materialName?: string;
  materialThumbnailUrl?: string;
  materialType?: string;
  
  // UI state
  isSelected?: boolean;
  isEditing?: boolean;
}
