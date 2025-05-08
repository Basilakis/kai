import React, { useEffect, useState } from 'react';
import { navigate } from 'gatsby';
import Layout from '../../../components/Layout';
import { useUser } from '../../../providers/UserProvider';
import { ClientUserPrompt, UpdateUserPromptInput } from '@shared/types/promptLibrary';
import { getPromptById, updatePrompt, deletePrompt } from '../../../services/promptLibrary.service';
import PromptForm from '../../../components/promptLibrary/PromptForm';

interface MyPromptDetailPageProps {
  params: {
    id: string;
  };
}

/**
 * MyPromptDetailPage component
 * Displays details of a user's own prompt with edit capabilities
 */
const MyPromptDetailPage: React.FC<MyPromptDetailPageProps> = ({ params }) => {
  const { id } = params;
  const { user } = useUser();
  
  // State for prompt
  const [prompt, setPrompt] = useState<ClientUserPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch prompt
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        setIsLoading(true);
        
        // Redirect if not logged in
        if (!user) {
          navigate('/login');
          return;
        }
        
        const data = await getPromptById(id);
        
        // Check if prompt belongs to the user
        if (data.userId !== user.id) {
          setError('You do not have permission to view this prompt.');
          setIsLoading(false);
          return;
        }
        
        setPrompt(data);
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
  }, [id, user]);
  
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
  
  // Handle updating the prompt
  const handleUpdatePrompt = async (data: UpdateUserPromptInput) => {
    if (!prompt) return;
    
    try {
      setIsSubmitting(true);
      const updatedPrompt = await updatePrompt(prompt.id, data);
      setPrompt(updatedPrompt);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating prompt:', error);
      alert('Failed to update prompt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle deleting the prompt
  const handleDeletePrompt = async () => {
    if (!prompt) return;
    
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }
    
    try {
      await deletePrompt(prompt.id);
      navigate('/prompt-library');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      alert('Failed to delete prompt. Please try again.');
    }
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
            {isEditing ? (
              <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                  Edit Prompt
                </h1>
                <PromptForm
                  prompt={prompt}
                  onSubmit={handleUpdatePrompt}
                  onCancel={() => setIsEditing(false)}
                  isSubmitting={isSubmitting}
                />
              </div>
            ) : (
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
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeletePrompt}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Delete
                    </button>
                  </div>
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
                      <span>Created: {new Date(prompt.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex space-x-4">
                      <span>{prompt.viewsCount} views</span>
                      <span>{prompt.importsCount} imports</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default MyPromptDetailPage;
