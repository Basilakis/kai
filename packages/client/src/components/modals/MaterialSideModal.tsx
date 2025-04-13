/**
 * MaterialSideModal Component
 * 
 * A side modal that displays material details and allows adding the material to a MoodBoard
 */

import React, { useState, useEffect } from 'react';
import { 
  createMoodBoard, 
  getUserMoodBoards, 
  addMoodBoardItem 
} from '../../services/moodboard.service';
import { ClientMoodBoard, CreateMoodBoardInput } from '../../types/moodboard';
import { ClientMaterial } from '../../types/material';

interface MaterialSideModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: ClientMaterial | null;
}

const MaterialSideModal: React.FC<MaterialSideModalProps> = ({ 
  isOpen, 
  onClose, 
  material 
}) => {
  // State
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [newBoardName, setNewBoardName] = useState<string>('');
  const [isCreatingBoard, setIsCreatingBoard] = useState<boolean>(false);
  const [userBoards, setUserBoards] = useState<ClientMoodBoard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch user's boards when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchUserBoards();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedBoardId('');
      setNewBoardName('');
      setIsCreatingBoard(false);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  // Fetch user's boards
  const fetchUserBoards = async () => {
    try {
      setIsLoading(true);
      const boards = await getUserMoodBoards();
      setUserBoards(boards);
      
      // Select the first board by default if available
      if (boards.length > 0) {
        setSelectedBoardId(boards[0].id);
      }
    } catch (err) {
      setError('Failed to load your boards. Please try again.');
      console.error('Error fetching boards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding material to board
  const handleAddToBoard = async () => {
    if (!material) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // If creating a new board
      if (isCreatingBoard && newBoardName.trim()) {
        // Create new board
        const newBoardInput: CreateMoodBoardInput = {
          name: newBoardName.trim(),
          isPublic: false,
          viewPreference: 'grid'
        };
        
        const newBoard = await createMoodBoard(newBoardInput);
        
        // Add material to the new board
        await addMoodBoardItem({
          boardId: newBoard.id,
          materialId: material.id
        });
        
        setSuccess(`Added to new board "${newBoardName}"`);
      } 
      // Adding to existing board
      else if (selectedBoardId) {
        await addMoodBoardItem({
          boardId: selectedBoardId,
          materialId: material.id
        });
        
        const boardName = userBoards.find(b => b.id === selectedBoardId)?.name || 'selected board';
        setSuccess(`Added to "${boardName}"`);
      } else {
        setError('Please select a board or create a new one');
        return;
      }
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to add material to board. Please try again.');
      console.error('Error adding to board:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle between selecting existing board and creating new board
  const toggleCreateBoard = () => {
    setIsCreatingBoard(!isCreatingBoard);
    if (!isCreatingBoard) {
      setSelectedBoardId('');
    } else {
      setNewBoardName('');
      if (userBoards.length > 0) {
        setSelectedBoardId(userBoards[0].id);
      }
    }
  };

  if (!material) return null;

  return (
    <div className={`fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Modal Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Material Details</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Modal Content */}
      <div className="p-4 overflow-y-auto h-full pb-24">
        {/* Material Image */}
        <div className="mb-4 bg-gray-100 rounded-lg overflow-hidden h-48 flex items-center justify-center">
          {material.thumbnailUrl ? (
            <img 
              src={material.thumbnailUrl} 
              alt={material.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-4xl font-bold text-gray-300">
              {material.name?.charAt(0) || 'M'}
            </div>
          )}
        </div>

        {/* Material Info */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-1">{material.name}</h3>
          <p className="text-sm text-gray-600 mb-3">{material.type}</p>
          
          {material.description && (
            <p className="text-sm text-gray-700 mb-3">{material.description}</p>
          )}
          
          {/* Material Properties */}
          {material.properties && Object.keys(material.properties).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Properties</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(material.properties).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-medium text-gray-600">{key}: </span>
                    <span className="text-gray-800">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add to MoodBoard Section */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Add to MoodBoard</h3>
          
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-2 bg-red-50 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-2 bg-green-50 text-green-700 text-sm rounded">
              {success}
            </div>
          )}
          
          {/* Board Selection */}
          {!isCreatingBoard ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Board
              </label>
              <select
                value={selectedBoardId}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md mb-3 text-sm"
                disabled={isLoading || userBoards.length === 0}
              >
                {userBoards.length === 0 ? (
                  <option value="">No boards available</option>
                ) : (
                  userBoards.map(board => (
                    <option key={board.id} value={board.id}>
                      {board.name} ({board.itemCount} items)
                    </option>
                  ))
                )}
              </select>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Board Name
              </label>
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Enter board name"
                className="w-full p-2 border border-gray-300 rounded-md mb-3 text-sm"
                disabled={isLoading}
              />
            </>
          )}
          
          {/* Toggle between select/create */}
          <button
            onClick={toggleCreateBoard}
            className="text-sm text-blue-600 hover:text-blue-800 mb-4 focus:outline-none"
            disabled={isLoading}
          >
            {isCreatingBoard ? 'Select existing board' : 'Create new board'}
          </button>
          
          {/* Add Button */}
          <button
            onClick={handleAddToBoard}
            disabled={isLoading || (isCreatingBoard && !newBoardName.trim()) || (!isCreatingBoard && !selectedBoardId)}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding...' : 'Add to Board'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialSideModal;
