/**
 * Client-specific MoodBoard types
 */

import { 
  ExtendMoodBoard, 
  ExtendMoodBoardItem, 
  ClientMoodBoardBase, 
  ClientMoodBoardItemBase 
} from '@shared/types/moodboard';
import { ClientMaterial } from './material';

/**
 * Client MoodBoard interface
 * Extends the base MoodBoard with UI-specific fields
 */
export interface ClientMoodBoard extends ExtendMoodBoard<{
  // UI display properties
  thumbnailUrl?: string;
  itemCount: number;
  
  // UI state
  isSelected?: boolean;
  isEditing?: boolean;
  
  // Client-side caching
  lastViewedAt?: Date;
  
  // Client-specific metadata
  localNotes?: string;
  
  // Relationships
  items?: ClientMoodBoardItem[];
  owner?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}> {}

/**
 * Client MoodBoardItem interface
 * Extends the base MoodBoardItem with UI-specific fields
 */
export interface ClientMoodBoardItem extends ExtendMoodBoardItem<{
  // UI display properties
  materialName: string;
  materialThumbnailUrl?: string;
  materialType?: string;
  
  // UI state
  isSelected?: boolean;
  isEditing?: boolean;
  
  // Relationships
  material?: ClientMaterial;
}> {}

/**
 * MoodBoard creation input
 */
export interface CreateMoodBoardInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  viewPreference?: 'grid' | 'list';
}

/**
 * MoodBoard update input
 */
export interface UpdateMoodBoardInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  viewPreference?: 'grid' | 'list';
}

/**
 * MoodBoardItem creation input
 */
export interface AddMoodBoardItemInput {
  boardId: string;
  materialId: string;
  notes?: string;
  position?: number;
}

/**
 * MoodBoardItem update input
 */
export interface UpdateMoodBoardItemInput {
  notes?: string;
  position?: number;
}
