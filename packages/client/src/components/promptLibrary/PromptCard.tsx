import React from 'react';
import { ClientUserPrompt } from '@shared/types/promptLibrary';
import { navigate } from 'gatsby';
import { StarRating } from './PromptRating';

interface PromptCardProps {
  prompt: ClientUserPrompt;
  onDelete?: (id: string) => void;
  onEdit?: (prompt: ClientUserPrompt) => void;
  showOwner?: boolean;
}

/**
 * PromptCard component
 * Displays a prompt in a card format
 */
const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onDelete,
  onEdit,
  showOwner = false
}) => {
  // Get usage display name
  const getUsageDisplayName = (usage: string): string => {
    switch (usage) {
      case 'analytics_agent':
        return 'Analytics Agent';
      case '3d_design_agent':
        return '3D Design Agent';
      case 'search_agent':
        return 'Search Agent';
      case 'material_recognition_agent':
        return 'Material Recognition Agent';
      case 'general':
      default:
        return 'General';
    }
  };

  // Handle card click
  const handleCardClick = () => {
    if (prompt.isPublic) {
      navigate(`/prompt-library/${prompt.id}`);
    } else {
      navigate(`/prompt-library/my-prompts/${prompt.id}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div
        className="p-4 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900 hover:text-blue-600">
              {prompt.title}
            </h3>
            <div className="flex items-center mt-1 space-x-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${prompt.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {prompt.isPublic ? 'Public' : 'Private'}
              </span>
              <span className="text-xs text-gray-500">
                {getUsageDisplayName(prompt.usage)}
              </span>
              {prompt.categoryName && (
                <span className="text-xs text-gray-500">
                  {prompt.categoryName}
                </span>
              )}
            </div>
          </div>
          {(onDelete || onEdit) && (
            <div className="flex space-x-2">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(prompt);
                  }}
                  className="text-gray-400 hover:text-blue-500 focus:outline-none"
                  aria-label="Edit prompt"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(prompt.id);
                  }}
                  className="text-gray-400 hover:text-red-500 focus:outline-none"
                  aria-label="Delete prompt"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        {prompt.description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
            {prompt.description}
          </p>
        )}

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap">
            {prompt.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mr-1 mb-1"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Rating */}
        {prompt.ratingStats && (
          <div className="mt-2 flex items-center">
            <StarRating
              rating={prompt.ratingStats.avgRating}
              readOnly
              size="sm"
              className="mr-1"
            />
            <span className="text-xs text-gray-500">
              {prompt.ratingStats.avgRating.toFixed(1)} ({prompt.ratingStats.ratingCount})
            </span>
          </div>
        )}

        {/* Fork information */}
        {prompt.originalPrompt && (
          <div className="mt-2 text-xs text-gray-500">
            Forked from: <span className="text-blue-600 hover:underline cursor-pointer" onClick={(e) => {
              e.stopPropagation();
              navigate(`/prompt-library/${prompt.originalPrompt.id}`);
            }}>{prompt.originalPrompt.title}</span>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500 flex justify-between">
          <div>
            {showOwner && prompt.owner && (
              <span>By: {prompt.owner.username}</span>
            )}
            {!showOwner && (
              <span>Created: {new Date(prompt.createdAt).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex space-x-3">
            <span>{prompt.viewsCount} views</span>
            <span>{prompt.importsCount} imports</span>
            {prompt.forkCount > 0 && (
              <span>{prompt.forkCount} forks</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptCard;
