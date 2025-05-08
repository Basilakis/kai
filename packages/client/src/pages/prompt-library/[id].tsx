import React, { useEffect, useState } from 'react';
import { navigate } from 'gatsby';
import Layout from '../../components/Layout';
import { useUser } from '../../providers/UserProvider';
import { ClientUserPrompt } from '@shared/types/promptLibrary';
import {
  getPromptById,
  importPrompt,
  forkPrompt,
  incrementPromptViewCount
} from '../../services/promptLibrary.service';
import PromptRating from '../../components/promptLibrary/PromptRating';

interface PromptDetailPageProps {
  params: {
    id: string;
  };
}

/**
 * PromptDetailPage component
 * Displays details of a public prompt
 */
const PromptDetailPage: React.FC<PromptDetailPageProps> = ({ params }) => {
  const { id } = params;
  const { user } = useUser();

  // State for prompt
  const [prompt, setPrompt] = useState<ClientUserPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [refreshRating, setRefreshRating] = useState(0);

  // Fetch prompt
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        setIsLoading(true);
        const data = await getPromptById(id);

        // Check if prompt is public or belongs to the user
        if (!data.isPublic && (!user || data.userId !== user.id)) {
          setError('This prompt is private and cannot be viewed.');
          setIsLoading(false);
          return;
        }

        setPrompt(data);

        // Increment view count
        await incrementPromptViewCount(id);
      } catch (error) {
        console.error('Error fetching prompt:', error);
        setError('Failed to load prompt. It may have been deleted or is not available.');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchPrompt();
    }
  }, [id, user, refreshRating]);

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

  // Handle importing the prompt
  const handleImportPrompt = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setIsImporting(true);
      const result = await importPrompt(id);

      if (result.success) {
        alert('Prompt imported successfully!');
        navigate('/prompt-library');
      } else {
        alert(`Failed to import prompt: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing prompt:', error);
      alert('Failed to import prompt. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle forking the prompt
  const handleForkPrompt = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setIsForking(true);
      const result = await forkPrompt(id);

      if (result.success) {
        alert('Prompt forked successfully!');
        navigate(`/prompt-library/my-prompts/${result.promptId}`);
      } else {
        alert(`Failed to fork prompt: ${result.error}`);
      }
    } catch (error) {
      console.error('Error forking prompt:', error);
      alert('Failed to fork prompt. Please try again.');
    } finally {
      setIsForking(false);
    }
  };

  // Handle rating change
  const handleRatingChange = () => {
    setRefreshRating(prev => prev + 1);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-red-600 mb-2">
              {error}
            </h3>
            <p className="text-gray-600 mb-4">
              Please check the URL or go back to the prompt library.
            </p>
            <button
              onClick={() => navigate('/prompt-library')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back to Prompt Library
            </button>
          </div>
        ) : prompt ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {prompt.title}
                  </h1>
                  <div className="flex items-center space-x-3 mb-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${prompt.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {prompt.isPublic ? 'Public' : 'Private'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {getUsageDisplayName(prompt.usage)}
                    </span>
                    {prompt.categoryName && (
                      <span className="text-sm text-gray-500">
                        Category: {prompt.categoryName}
                      </span>
                    )}
                  </div>
                </div>

                {user && prompt.userId !== user.id && (
                  <div className="flex space-x-3">
                    <button
                      onClick={handleImportPrompt}
                      disabled={isImporting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {isImporting ? 'Importing...' : 'Import to My Library'}
                    </button>

                    <button
                      onClick={handleForkPrompt}
                      disabled={isForking}
                      className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      {isForking ? 'Forking...' : 'Fork Prompt'}
                    </button>
                  </div>
                )}
              </div>

              {prompt.description && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-2">
                    Description
                  </h2>
                  <p className="text-gray-600">
                    {prompt.description}
                  </p>
                </div>
              )}

              {/* Tags */}
              {prompt.tags && prompt.tags.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-2">
                    Tags
                  </h2>
                  <div className="flex flex-wrap">
                    {prompt.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 mr-2 mb-2"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Original prompt info if this is a fork */}
              {prompt.originalPrompt && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-2">
                    Forked From
                  </h2>
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-blue-800 font-medium mb-1">
                      {prompt.originalPrompt.title}
                    </p>
                    {prompt.originalPrompt.owner && (
                      <p className="text-sm text-blue-600">
                        By: {prompt.originalPrompt.owner.username}
                      </p>
                    )}
                    <button
                      onClick={() => navigate(`/prompt-library/${prompt.originalPrompt.id}`)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Original Prompt
                    </button>
                  </div>
                </div>
              )}

              {/* Forks of this prompt */}
              {prompt.forks && prompt.forks.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-2">
                    Forks ({prompt.forks.length})
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <ul className="space-y-2">
                      {prompt.forks.map((fork) => (
                        <li key={fork.id} className="flex justify-between items-center">
                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer"
                                onClick={() => navigate(`/prompt-library/${fork.id}`)}>
                            {fork.title}
                          </span>
                          {fork.owner && (
                            <span className="text-sm text-gray-500">
                              By: {fork.owner.username}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Rating */}
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  Rating
                </h2>
                <PromptRating
                  promptId={prompt.id}
                  userRating={prompt.userRating}
                  ratingStats={prompt.ratingStats}
                  onRatingChange={handleRatingChange}
                />
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  Prompt Content
                </h2>
                <div className="bg-gray-50 p-4 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">
                    {prompt.content}
                  </pre>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div>
                    {prompt.owner && (
                      <span>Created by: {prompt.owner.username}</span>
                    )}
                    {!prompt.owner && (
                      <span>Created: {new Date(prompt.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <div className="flex space-x-4">
                    <span>{prompt.viewsCount} views</span>
                    <span>{prompt.importsCount} imports</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default PromptDetailPage;
