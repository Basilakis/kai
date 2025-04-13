/**
 * MoodBoard Page
 * 
 * Displays a specific MoodBoard with its materials in either grid or list view
 */

import React, { useState, useEffect } from 'react';
import { navigate } from 'gatsby';
import { useParams } from '@reach/router';
import Layout from '../components/Layout';
import { 
  getMoodBoardById, 
  getMoodBoardItems, 
  updateMoodBoard, 
  removeMoodBoardItem 
} from '../services/moodboard.service';
import { ClientMoodBoard, ClientMoodBoardItem } from '../types/moodboard';
import { useUser } from '../providers/UserProvider';

const BoardPage: React.FC = () => {
  // Get board ID from URL params
  const { boardId } = useParams();
  const { user, isLoading: isUserLoading } = useUser();
  
  // State
  const [board, setBoard] = useState<ClientMoodBoard | null>(null);
  const [items, setItems] = useState<ClientMoodBoardItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false);

  // Fetch board data
  useEffect(() => {
    if (boardId) {
      fetchBoardData();
    }
  }, [boardId]);

  // Update view mode when board is loaded
  useEffect(() => {
    if (board) {
      setViewMode(board.viewPreference);
    }
  }, [board]);

  // Set edit form values when entering edit mode
  useEffect(() => {
    if (board && isEditing) {
      setEditName(board.name);
      setEditDescription(board.description || '');
      setIsPublic(board.isPublic);
    }
  }, [isEditing, board]);

  // Fetch board data and items
  const fetchBoardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch board details
      const boardData = await getMoodBoardById(boardId);
      setBoard(boardData);
      
      // Fetch board items
      const itemsData = await getMoodBoardItems(boardId);
      setItems(itemsData);
      
      // Set view mode based on board preference
      setViewMode(boardData.viewPreference);
    } catch (err) {
      console.error('Error fetching board data:', err);
      setError('Failed to load board data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle view mode toggle
  const handleViewModeToggle = async (mode: 'grid' | 'list') => {
    setViewMode(mode);
    
    // Update board preference if user is the owner
    if (board && user && board.userId === user.id) {
      try {
        await updateMoodBoard(board.id, {
          viewPreference: mode
        });
      } catch (err) {
        console.error('Error updating view preference:', err);
        // Continue with local state change even if API update fails
      }
    }
  };

  // Handle removing an item
  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this material from the board?')) {
      return;
    }
    
    try {
      await removeMoodBoardItem(itemId);
      
      // Update local state
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));
      
      // Update item count in board
      if (board) {
        setBoard({
          ...board,
          itemCount: board.itemCount - 1
        });
      }
    } catch (err) {
      console.error('Error removing item:', err);
      alert('Failed to remove item. Please try again.');
    }
  };

  // Handle board visibility toggle
  const handleVisibilityToggle = async () => {
    if (!board || !user || board.userId !== user.id) return;
    
    try {
      const updatedBoard = await updateMoodBoard(board.id, {
        isPublic: !board.isPublic
      });
      
      setBoard(updatedBoard);
      setIsPublic(updatedBoard.isPublic);
    } catch (err) {
      console.error('Error updating board visibility:', err);
      alert('Failed to update board visibility. Please try again.');
    }
  };

  // Handle save board edits
  const handleSaveEdits = async () => {
    if (!board || !editName.trim()) return;
    
    try {
      const updatedBoard = await updateMoodBoard(board.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        isPublic
      });
      
      setBoard(updatedBoard);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating board:', err);
      alert('Failed to update board. Please try again.');
    }
  };

  // Check if user is the board owner
  const isOwner = user && board && user.id === board.userId;

  // Render loading state
  if (isLoading || isUserLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </Layout>
    );
  }

  // Render error state
  if (error || !board) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 p-4 rounded-md">
            <h2 className="text-lg font-medium text-red-800">Error</h2>
            <p className="mt-2 text-sm text-red-700">
              {error || 'Board not found. It may have been deleted or you do not have permission to view it.'}
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
            >
              Back to Profile
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Board Header */}
        <div className="mb-8">
          {isEditing ? (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-xl font-semibold mb-4">Edit Board</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Board Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Enter board name"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={() => setIsPublic(!isPublic)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Make this board public</span>
                </label>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveEdits}
                  disabled={!editName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{board.name}</h1>
                {board.description && (
                  <p className="mt-2 text-gray-600">{board.description}</p>
                )}
                <div className="mt-2 flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${board.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {board.isPublic ? 'Public' : 'Private'}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {board.itemCount} {board.itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>
              
              {isOwner && (
                <div className="mt-4 md:mt-0 flex space-x-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleVisibilityToggle}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {board.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* View Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2">
            <button
              onClick={() => handleViewModeToggle('grid')}
              className={`px-3 py-1.5 rounded-md text-sm focus:outline-none ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => handleViewModeToggle('list')}
              className={`px-3 py-1.5 rounded-md text-sm focus:outline-none ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              List View
            </button>
          </div>
          
          <button
            onClick={() => navigate('/profile')}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Back to Profile
          </button>
        </div>
        
        {/* Materials Display */}
        {items.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No materials in this board yet</h3>
            <p className="text-gray-600">
              Start adding materials to your board by browsing the materials catalog.
            </p>
            <button
              onClick={() => navigate('/materials')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Browse Materials
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="h-48 bg-gray-200 relative">
                  {item.materialThumbnailUrl ? (
                    <img 
                      src={item.materialThumbnailUrl} 
                      alt={item.materialName} 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-gray-300">
                        {item.materialName.charAt(0)}
                      </span>
                    </div>
                  )}
                  
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="absolute top-2 right-2 p-1 bg-white bg-opacity-70 rounded-full hover:bg-opacity-100 focus:outline-none"
                      aria-label="Remove material"
                    >
                      <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="font-medium text-gray-900">{item.materialName}</h3>
                  {item.materialType && (
                    <p className="text-sm text-gray-600 mt-1">{item.materialType}</p>
                  )}
                  {item.notes && (
                    <p className="mt-2 text-sm text-gray-700 italic">"{item.notes}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {items.map(item => (
                <li key={item.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 h-12 w-12 bg-gray-200 rounded-md overflow-hidden">
                      {item.materialThumbnailUrl ? (
                        <img 
                          src={item.materialThumbnailUrl} 
                          alt={item.materialName} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-300">
                            {item.materialName.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.materialName}
                      </p>
                      {item.materialType && (
                        <p className="text-sm text-gray-500 truncate">
                          {item.materialType}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-1 text-sm text-gray-700 italic">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                    
                    {isOwner && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-gray-400 hover:text-gray-500 focus:outline-none"
                          aria-label="Remove material"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BoardPage;
