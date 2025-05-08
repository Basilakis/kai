import React, { useState, KeyboardEvent } from 'react';

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

/**
 * TagsInput component
 * Allows users to input and manage tags
 */
const TagsInput: React.FC<TagsInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add tags...',
  maxTags = 10,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  
  // Add a new tag
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    
    // Validate tag
    if (!trimmedTag || tags.includes(trimmedTag) || tags.length >= maxTags) {
      return;
    }
    
    // Add tag and clear input
    onChange([...tags, trimmedTag]);
    setInputValue('');
  };
  
  // Remove a tag
  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };
  
  // Handle key down events
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Add tag on Enter or comma
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
    
    // Remove last tag on Backspace if input is empty
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };
  
  return (
    <div className={`flex flex-wrap items-center border border-gray-300 rounded-md p-2 ${className}`}>
      {/* Display existing tags */}
      {tags.map((tag, index) => (
        <div
          key={index}
          className="flex items-center bg-blue-100 text-blue-800 text-sm rounded-full px-3 py-1 m-1"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
          >
            &times;
          </button>
        </div>
      ))}
      
      {/* Input for new tags */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-grow min-w-[120px] p-1 border-none focus:outline-none focus:ring-0"
        disabled={tags.length >= maxTags}
      />
      
      {/* Show max tags message */}
      {tags.length >= maxTags && (
        <span className="text-xs text-red-500 ml-2">
          Maximum {maxTags} tags
        </span>
      )}
    </div>
  );
};

export default TagsInput;
