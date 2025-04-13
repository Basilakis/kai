/**
 * MoodBoard Service
 * 
 * Provides methods for interacting with the MoodBoard API
 */

import { supabaseClient } from './supabaseClient';
import { 
  ClientMoodBoard, 
  ClientMoodBoardItem, 
  CreateMoodBoardInput, 
  UpdateMoodBoardInput,
  AddMoodBoardItemInput,
  UpdateMoodBoardItemInput
} from '../types/moodboard';

/**
 * Get all MoodBoards for the current user
 */
export const getUserMoodBoards = async (): Promise<ClientMoodBoard[]> => {
  const { data, error } = await supabaseClient
    .from('moodboards')
    .select(`
      *,
      items:moodboard_items(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching moodboards: ${error.message}`);
  }

  return data.map(board => ({
    id: board.id,
    name: board.name,
    description: board.description,
    userId: board.user_id,
    isPublic: board.is_public,
    viewPreference: board.view_preference,
    createdAt: board.created_at,
    updatedAt: board.updated_at,
    itemCount: board.items[0]?.count || 0
  }));
};

/**
 * Get a specific MoodBoard by ID
 */
export const getMoodBoardById = async (boardId: string): Promise<ClientMoodBoard> => {
  const { data, error } = await supabaseClient
    .from('moodboards')
    .select(`
      *,
      items:moodboard_items(count)
    `)
    .eq('id', boardId)
    .single();

  if (error) {
    throw new Error(`Error fetching moodboard: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    userId: data.user_id,
    isPublic: data.is_public,
    viewPreference: data.view_preference,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    itemCount: data.items[0]?.count || 0
  };
};

/**
 * Get MoodBoard items
 */
export const getMoodBoardItems = async (boardId: string): Promise<ClientMoodBoardItem[]> => {
  const { data, error } = await supabaseClient
    .from('moodboard_items')
    .select(`
      *,
      material:materials(id, name, type, thumbnail_url)
    `)
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  if (error) {
    throw new Error(`Error fetching moodboard items: ${error.message}`);
  }

  return data.map(item => ({
    id: item.id,
    boardId: item.board_id,
    materialId: item.material_id,
    notes: item.notes,
    position: item.position,
    addedAt: item.added_at,
    materialName: item.material?.name || 'Unknown Material',
    materialThumbnailUrl: item.material?.thumbnail_url,
    materialType: item.material?.type
  }));
};

/**
 * Create a new MoodBoard
 */
export const createMoodBoard = async (input: CreateMoodBoardInput): Promise<ClientMoodBoard> => {
  const { data, error } = await supabaseClient
    .from('moodboards')
    .insert({
      name: input.name,
      description: input.description,
      is_public: input.isPublic || false,
      view_preference: input.viewPreference || 'grid'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating moodboard: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    userId: data.user_id,
    isPublic: data.is_public,
    viewPreference: data.view_preference,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    itemCount: 0
  };
};

/**
 * Update a MoodBoard
 */
export const updateMoodBoard = async (boardId: string, input: UpdateMoodBoardInput): Promise<ClientMoodBoard> => {
  const { data, error } = await supabaseClient
    .from('moodboards')
    .update({
      name: input.name,
      description: input.description,
      is_public: input.isPublic,
      view_preference: input.viewPreference,
      updated_at: new Date().toISOString()
    })
    .eq('id', boardId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating moodboard: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    userId: data.user_id,
    isPublic: data.is_public,
    viewPreference: data.view_preference,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    itemCount: 0 // This will be updated when fetching the board with items
  };
};

/**
 * Delete a MoodBoard
 */
export const deleteMoodBoard = async (boardId: string): Promise<void> => {
  const { error } = await supabaseClient
    .from('moodboards')
    .delete()
    .eq('id', boardId);

  if (error) {
    throw new Error(`Error deleting moodboard: ${error.message}`);
  }
};

/**
 * Add an item to a MoodBoard
 */
export const addMoodBoardItem = async (input: AddMoodBoardItemInput): Promise<ClientMoodBoardItem> => {
  // Get the highest position to place the new item at the end
  const { data: positionData } = await supabaseClient
    .from('moodboard_items')
    .select('position')
    .eq('board_id', input.boardId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = positionData && positionData.length > 0 
    ? positionData[0].position + 1 
    : 0;

  const { data, error } = await supabaseClient
    .from('moodboard_items')
    .insert({
      board_id: input.boardId,
      material_id: input.materialId,
      notes: input.notes,
      position: input.position !== undefined ? input.position : nextPosition
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error adding item to moodboard: ${error.message}`);
  }

  // Fetch material details
  const { data: materialData } = await supabaseClient
    .from('materials')
    .select('name, type, thumbnail_url')
    .eq('id', input.materialId)
    .single();

  return {
    id: data.id,
    boardId: data.board_id,
    materialId: data.material_id,
    notes: data.notes,
    position: data.position,
    addedAt: data.added_at,
    materialName: materialData?.name || 'Unknown Material',
    materialThumbnailUrl: materialData?.thumbnail_url,
    materialType: materialData?.type
  };
};

/**
 * Update a MoodBoard item
 */
export const updateMoodBoardItem = async (
  itemId: string, 
  input: UpdateMoodBoardItemInput
): Promise<ClientMoodBoardItem> => {
  const { data, error } = await supabaseClient
    .from('moodboard_items')
    .update({
      notes: input.notes,
      position: input.position
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating moodboard item: ${error.message}`);
  }

  // Fetch material details
  const { data: materialData } = await supabaseClient
    .from('materials')
    .select('name, type, thumbnail_url')
    .eq('id', data.material_id)
    .single();

  return {
    id: data.id,
    boardId: data.board_id,
    materialId: data.material_id,
    notes: data.notes,
    position: data.position,
    addedAt: data.added_at,
    materialName: materialData?.name || 'Unknown Material',
    materialThumbnailUrl: materialData?.thumbnail_url,
    materialType: materialData?.type
  };
};

/**
 * Remove an item from a MoodBoard
 */
export const removeMoodBoardItem = async (itemId: string): Promise<void> => {
  const { error } = await supabaseClient
    .from('moodboard_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw new Error(`Error removing item from moodboard: ${error.message}`);
  }
};

/**
 * Get MoodBoards for a specific user
 */
export const getUserPublicMoodBoards = async (userId: string): Promise<ClientMoodBoard[]> => {
  const { data, error } = await supabaseClient
    .from('moodboards')
    .select(`
      *,
      items:moodboard_items(count)
    `)
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching user moodboards: ${error.message}`);
  }

  return data.map(board => ({
    id: board.id,
    name: board.name,
    description: board.description,
    userId: board.user_id,
    isPublic: board.is_public,
    viewPreference: board.view_preference,
    createdAt: board.created_at,
    updatedAt: board.updated_at,
    itemCount: board.items[0]?.count || 0
  }));
};
