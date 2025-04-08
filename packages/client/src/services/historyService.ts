/**
 * History Service
 * 
 * Provides methods for retrieving and managing recognition history.
 * Handles fetching history items, viewing details, and deleting records.
 * 
 * Now leverages the unified search API for history retrieval operations
 * while maintaining backward compatibility with existing code.
 */
import axios from 'axios';
import unifiedSearchService from './unifiedSearchService';

// Base API URL from environment
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Recognition result type
export interface RecognitionResult {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  confidence: number;
}

// History item type
export interface HistoryItem {
  id: string;
  timestamp: string;
  imageUrl: string;
  fileType: 'image' | 'pdf';
  fileName: string;
  fileSize: number;
  results: RecognitionResult[];
}

export interface HistoryResponse {
  success: boolean;
  data: HistoryItem[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    limit: number;
  };
}

/**
 * Get the user's recognition history
 */
export const getRecognitionHistory = async (page: number = 1, limit: number = 10): Promise<HistoryResponse> => {
  try {
    // Use the unified search API with type='history'
    return await unifiedSearchService.search({
      type: 'history',
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching recognition history:', error);
    throw new Error('Failed to fetch recognition history');
  }
};

/**
 * Get a specific history item by ID
 */
export const getHistoryItemById = async (id: string): Promise<HistoryItem> => {
  try {
    const response = await axios.get(`${API_URL}/recognition/history/${id}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching history item ${id}:`, error);
    throw new Error(`Failed to fetch history item ${id}`);
  }
};

/**
 * Delete a history item
 */
export const deleteHistoryItem = async (id: string): Promise<boolean> => {
  try {
    const response = await axios.delete(`${API_URL}/recognition/history/${id}`);
    return response.data.success;
  } catch (error) {
    console.error(`Error deleting history item ${id}:`, error);
    throw new Error(`Failed to delete history item ${id}`);
  }
};

/**
 * Mark a history item as favorite
 */
export const toggleFavorite = async (id: string, isFavorite: boolean): Promise<boolean> => {
  try {
    // Use put method instead of patch as it's more universally supported in REST APIs
    const response = await axios.put(`${API_URL}/recognition/history/${id}/favorite`, {
      favorite: isFavorite
    });
    return response.data.success;
  } catch (error) {
    console.error(`Error updating favorite status for item ${id}:`, error);
    throw new Error(`Failed to update favorite status for item ${id}`);
  }
};

// Export default object with all methods
export default {
  getRecognitionHistory,
  getHistoryItemById,
  deleteHistoryItem,
  toggleFavorite
};