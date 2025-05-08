import React, { useState } from 'react';
import { ratePrompt } from '../../services/promptLibrary.service';
import { PromptRatingStats } from '@shared/types/promptLibrary';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * StarRating component
 * Displays a star rating with optional interaction
 */
export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  onChange,
  readOnly = false,
  className = ''
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  // Determine star size based on prop
  const getStarSize = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4';
      case 'lg': return 'w-8 h-8';
      case 'md':
      default: return 'w-6 h-6';
    }
  };
  
  // Handle mouse enter on star
  const handleMouseEnter = (index: number) => {
    if (!readOnly) {
      setHoverRating(index);
    }
  };
  
  // Handle mouse leave on star container
  const handleMouseLeave = () => {
    if (!readOnly) {
      setHoverRating(0);
    }
  };
  
  // Handle click on star
  const handleClick = (index: number) => {
    if (!readOnly && onChange) {
      onChange(index);
    }
  };
  
  return (
    <div 
      className={`flex ${className}`} 
      onMouseLeave={handleMouseLeave}
    >
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = (hoverRating || rating) >= starValue;
        
        return (
          <div
            key={index}
            className={`${getStarSize()} ${readOnly ? '' : 'cursor-pointer'} text-gray-300 ${isFilled ? 'text-yellow-400' : ''}`}
            onMouseEnter={() => handleMouseEnter(starValue)}
            onClick={() => handleClick(starValue)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isFilled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={isFilled ? '0' : '1.5'}
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

interface PromptRatingProps {
  promptId: string;
  userRating?: number | null;
  ratingStats?: PromptRatingStats;
  onRatingChange?: () => void;
  className?: string;
}

/**
 * PromptRating component
 * Displays and allows users to rate a prompt
 */
const PromptRating: React.FC<PromptRatingProps> = ({
  promptId,
  userRating,
  ratingStats,
  onRatingChange,
  className = ''
}) => {
  const [isRating, setIsRating] = useState(false);
  const [currentRating, setCurrentRating] = useState<number | null>(userRating || null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Format average rating to one decimal place
  const formattedAvgRating = ratingStats?.avgRating 
    ? ratingStats.avgRating.toFixed(1) 
    : '0.0';
  
  // Handle rating change
  const handleRatingChange = (rating: number) => {
    setCurrentRating(rating);
    setIsRating(true);
  };
  
  // Handle rating submission
  const handleSubmitRating = async () => {
    if (!currentRating) return;
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      await ratePrompt({
        promptId,
        rating: currentRating,
        comment: comment || undefined
      });
      
      setIsRating(false);
      
      // Notify parent component of rating change
      if (onRatingChange) {
        onRatingChange();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={`${className}`}>
      {isRating ? (
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Rate this prompt</h3>
          
          <div className="mb-4">
            <StarRating
              rating={currentRating || 0}
              onChange={handleRatingChange}
              size="lg"
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>
          
          {error && (
            <div className="mb-4 text-red-500 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex space-x-3">
            <button
              onClick={handleSubmitRating}
              disabled={!currentRating || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>
            <button
              onClick={() => setIsRating(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center">
          <StarRating
            rating={ratingStats?.avgRating || 0}
            readOnly
            size="md"
            className="mr-2"
          />
          <span className="text-sm text-gray-600">
            {formattedAvgRating} ({ratingStats?.ratingCount || 0} {ratingStats?.ratingCount === 1 ? 'rating' : 'ratings'})
          </span>
          
          {userRating ? (
            <button
              onClick={() => setIsRating(true)}
              className="ml-4 text-sm text-blue-600 hover:text-blue-800"
            >
              You rated this {userRating}/5
            </button>
          ) : (
            <button
              onClick={() => setIsRating(true)}
              className="ml-4 text-sm text-blue-600 hover:text-blue-800"
            >
              Rate this prompt
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PromptRating;
