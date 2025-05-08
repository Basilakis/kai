import React, { useEffect, useState } from 'react';
import {
  ClientUserPrompt,
  CreateUserPromptInput,
  PromptCategory,
  PromptUsageType,
  UpdateUserPromptInput
} from '@shared/types/promptLibrary';
import { getPromptCategories } from '../../services/promptLibrary.service';
import TagsInput from './TagsInput';

interface PromptFormProps {
  prompt?: ClientUserPrompt;
  onSubmit: (data: CreateUserPromptInput | UpdateUserPromptInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

/**
 * PromptForm component
 * Form for creating and editing prompts
 */
const PromptForm: React.FC<PromptFormProps> = ({
  prompt,
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  // Form state
  const [title, setTitle] = useState(prompt?.title || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [description, setDescription] = useState(prompt?.description || '');
  const [categoryId, setCategoryId] = useState(prompt?.categoryId || '');
  const [usage, setUsage] = useState<PromptUsageType>(prompt?.usage || 'general');
  const [isPublic, setIsPublic] = useState(prompt?.isPublic || false);
  const [tags, setTags] = useState<string[]>(prompt?.tags || []);

  // Categories state
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);
        const data = await getPromptCategories();
        setCategories(data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      title,
      content,
      description: description || undefined,
      categoryId: categoryId || undefined,
      usage,
      isPublic,
      tags: tags.length > 0 ? tags : undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Prompt Content *
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            disabled={isLoadingCategories}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="usage" className="block text-sm font-medium text-gray-700">
            Usage *
          </label>
          <select
            id="usage"
            value={usage}
            onChange={(e) => setUsage(e.target.value as PromptUsageType)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          >
            <option value="general">General</option>
            <option value="analytics_agent">Analytics Agent</option>
            <option value="3d_design_agent">3D Design Agent</option>
            <option value="search_agent">Search Agent</option>
            <option value="material_recognition_agent">Material Recognition Agent</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
          Tags
        </label>
        <TagsInput
          tags={tags}
          onChange={setTags}
          placeholder="Add tags (press Enter or comma to add)"
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-500">
          Add relevant tags to help others find your prompt. Press Enter or comma to add a tag.
        </p>
      </div>

      <div className="flex items-center">
        <input
          id="isPublic"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
          Make this prompt public
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : prompt ? 'Update Prompt' : 'Create Prompt'}
        </button>
      </div>
    </form>
  );
};

export default PromptForm;
