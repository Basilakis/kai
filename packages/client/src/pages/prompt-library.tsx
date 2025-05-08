import React, { useEffect, useState } from 'react';
import { navigate, useLocation } from 'gatsby';
import Layout from '../components/Layout';
import { useUser } from '../providers/UserProvider';
import PromptCard from '../components/promptLibrary/PromptCard';
import PromptForm from '../components/promptLibrary/PromptForm';
import TagsInput from '../components/promptLibrary/TagsInput';
import { StarRating } from '../components/promptLibrary/PromptRating';
import {
  ClientUserPrompt,
  CreateUserPromptInput,
  PromptCategory,
  PromptLibraryFilters,
  PromptSortOption,
  PromptUsageType
} from '@shared/types/promptLibrary';
import {
  createPrompt,
  deletePrompt,
  getPromptCategories,
  getPublicPrompts,
  getUserPrompts
} from '../services/promptLibrary.service';

/**
 * PromptLibraryPage component
 * Main page for the prompt library feature
 */
const PromptLibraryPage: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();

  // State for prompts
  const [myPrompts, setMyPrompts] = useState<ClientUserPrompt[]>([]);
  const [publicPrompts, setPublicPrompts] = useState<ClientUserPrompt[]>([]);
  const [isLoadingMyPrompts, setIsLoadingMyPrompts] = useState(true);
  const [isLoadingPublicPrompts, setIsLoadingPublicPrompts] = useState(true);

  // State for categories
  const [categories, setCategories] = useState<PromptCategory[]>([]);

  // State for active tab
  const [activeTab, setActiveTab] = useState<'my-prompts' | 'public-prompts'>(
    location.search.includes('tab=public-prompts') ? 'public-prompts' : 'my-prompts'
  );

  // State for creating/editing prompts
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ClientUserPrompt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for filters
  const [filters, setFilters] = useState<PromptLibraryFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedUsage, setSelectedUsage] = useState<PromptUsageType | ''>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<PromptSortOption>('newest');

  // Fetch prompts and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesData = await getPromptCategories();
        setCategories(categoriesData);

        // Fetch my prompts if user is logged in
        if (user) {
          setIsLoadingMyPrompts(true);
          const myPromptsData = await getUserPrompts(filters);
          setMyPrompts(myPromptsData);
          setIsLoadingMyPrompts(false);
        }

        // Fetch public prompts
        setIsLoadingPublicPrompts(true);
        const publicPromptsData = await getPublicPrompts(filters);
        setPublicPrompts(publicPromptsData);
        setIsLoadingPublicPrompts(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoadingMyPrompts(false);
        setIsLoadingPublicPrompts(false);
      }
    };

    fetchData();
  }, [user, filters]);

  // Apply filters
  const applyFilters = () => {
    const newFilters: PromptLibraryFilters = {};

    if (searchTerm) {
      newFilters.search = searchTerm;
    }

    if (selectedCategory) {
      newFilters.categoryId = selectedCategory;
    }

    if (selectedUsage) {
      newFilters.usage = selectedUsage;
    }

    if (selectedTags.length > 0) {
      newFilters.tags = selectedTags;
    }

    if (minRating !== '') {
      newFilters.minRating = Number(minRating);
    }

    if (dateFrom) {
      newFilters.dateFrom = dateFrom;
    }

    if (dateTo) {
      newFilters.dateTo = dateTo;
    }

    newFilters.sortBy = sortBy;

    setFilters(newFilters);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedUsage('');
    setSelectedTags([]);
    setMinRating('');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
    setFilters({});
  };

  // Handle creating a new prompt
  const handleCreatePrompt = async (data: CreateUserPromptInput) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setIsSubmitting(true);
      const newPrompt = await createPrompt(data);
      setMyPrompts([newPrompt, ...myPrompts]);
      setIsCreatingPrompt(false);
    } catch (error) {
      console.error('Error creating prompt:', error);
      alert('Failed to create prompt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a prompt
  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await deletePrompt(id);
      setMyPrompts(myPrompts.filter(prompt => prompt.id !== id));
    } catch (error) {
      console.error('Error deleting prompt:', error);
      alert('Failed to delete prompt. Please try again.');
    }
  };

  // Handle editing a prompt
  const handleEditPrompt = (prompt: ClientUserPrompt) => {
    setEditingPrompt(prompt);
  };

  // Handle updating a prompt
  const handleUpdatePrompt = async (data: CreateUserPromptInput) => {
    if (!editingPrompt) return;

    try {
      setIsSubmitting(true);
      const updatedPrompt = await deletePrompt(editingPrompt.id);
      setMyPrompts(myPrompts.map(p => p.id === editingPrompt.id ? updatedPrompt : p));
      setEditingPrompt(null);
    } catch (error) {
      console.error('Error updating prompt:', error);
      alert('Failed to update prompt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Prompt Library</h1>
          {user && (
            <button
              onClick={() => setIsCreatingPrompt(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create New Prompt
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('my-prompts')}
              className={`${
                activeTab === 'my-prompts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              My Prompts
            </button>
            <button
              onClick={() => setActiveTab('public-prompts')}
              className={`${
                activeTab === 'public-prompts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Public Prompts
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Search prompts..."
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="usage" className="block text-sm font-medium text-gray-700">
                Usage
              </label>
              <select
                id="usage"
                value={selectedUsage}
                onChange={(e) => setSelectedUsage(e.target.value as PromptUsageType | '')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Usages</option>
                <option value="general">General</option>
                <option value="analytics_agent">Analytics Agent</option>
                <option value="3d_design_agent">3D Design Agent</option>
                <option value="search_agent">Search Agent</option>
                <option value="material_recognition_agent">Material Recognition Agent</option>
              </select>
            </div>

            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700">
                Sort By
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as PromptSortOption)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="most_viewed">Most Viewed</option>
                <option value="most_imported">Most Imported</option>
                <option value="most_forked">Most Forked</option>
                <option value="highest_rated">Highest Rated</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label htmlFor="minRating" className="block text-sm font-medium text-gray-700">
                Minimum Rating
              </label>
              <div className="mt-1 flex items-center">
                <select
                  id="minRating"
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value === '' ? '' : Number(e.target.value))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Any Rating</option>
                  <option value="1">1+ Stars</option>
                  <option value="2">2+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                </select>
                <div className="ml-2">
                  <StarRating rating={minRating === '' ? 0 : Number(minRating)} readOnly size="sm" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">
                From Date
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700">
                To Date
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Tags
            </label>
            <TagsInput
              tags={selectedTags}
              onChange={setSelectedTags}
              placeholder="Add tags to filter by..."
              maxTags={5}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Apply Filters
            </button>
            <button
              onClick={resetFilters}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Create/Edit Prompt Form */}
        {(isCreatingPrompt || editingPrompt) && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
            </h2>
            <PromptForm
              prompt={editingPrompt || undefined}
              onSubmit={editingPrompt ? handleUpdatePrompt : handleCreatePrompt}
              onCancel={() => {
                setIsCreatingPrompt(false);
                setEditingPrompt(null);
              }}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* My Prompts Tab */}
        {activeTab === 'my-prompts' && (
          <>
            {!user ? (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Please log in to view your prompts
                </h3>
                <p className="text-gray-600 mb-4">
                  You need to be logged in to create and manage your prompts.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Log In
                </button>
              </div>
            ) : isLoadingMyPrompts ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : myPrompts.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  You don't have any prompts yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first prompt to get started.
                </p>
                <button
                  onClick={() => setIsCreatingPrompt(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Create New Prompt
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {myPrompts.map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onDelete={handleDeletePrompt}
                    onEdit={handleEditPrompt}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Public Prompts Tab */}
        {activeTab === 'public-prompts' && (
          <>
            {isLoadingPublicPrompts ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : publicPrompts.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No public prompts found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your filters or check back later.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {publicPrompts.map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    showOwner={true}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default PromptLibraryPage;
