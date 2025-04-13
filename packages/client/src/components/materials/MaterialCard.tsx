/**
 * MaterialCard Component
 * 
 * Displays a material card with an option to add to MoodBoard
 */

import React, { useState } from 'react';
import { navigate } from 'gatsby';
import { ClientMaterial } from '../../types/material';
import MaterialSideModal from '../modals/MaterialSideModal';

interface MaterialCardProps {
  material: ClientMaterial;
  className?: string;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material, className = '' }) => {
  const [isSideModalOpen, setIsSideModalOpen] = useState<boolean>(false);
  
  // Open side modal
  const handleAddToMoodBoard = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    setIsSideModalOpen(true);
  };
  
  // Navigate to material details
  const handleCardClick = () => {
    navigate(`/materials/${material.id}`);
  };
  
  return (
    <>
      <div 
        className={`bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200 ${className}`}
        onClick={handleCardClick}
      >
        {/* Material Image */}
        <div className="h-48 bg-gray-200 relative">
          {material.thumbnailUrl ? (
            <img 
              src={material.thumbnailUrl} 
              alt={material.name} 
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-4xl font-bold text-gray-300">
                {material.name?.charAt(0) || 'M'}
              </span>
            </div>
          )}
          
          {/* Add to MoodBoard Button */}
          <button
            onClick={handleAddToMoodBoard}
            className="absolute bottom-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add to Board
          </button>
        </div>
        
        {/* Material Info */}
        <div className="p-4">
          <h3 className="font-medium text-gray-900">{material.name}</h3>
          {material.type && (
            <p className="text-sm text-gray-600 mt-1">{material.type}</p>
          )}
          {material.manufacturer && (
            <p className="text-sm text-gray-500 mt-1">{material.manufacturer}</p>
          )}
        </div>
      </div>
      
      {/* Side Modal */}
      <MaterialSideModal 
        isOpen={isSideModalOpen}
        onClose={() => setIsSideModalOpen(false)}
        material={material}
      />
    </>
  );
};

export default MaterialCard;
