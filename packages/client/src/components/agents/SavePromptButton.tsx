import React, { useState } from 'react';
import { useUser } from '../../providers/UserProvider';
import { navigate } from 'gatsby';
import { createPrompt } from '../../services/promptLibrary.service';
import { CreateUserPromptInput, PromptUsageType } from '@shared/types/promptLibrary';

interface SavePromptButtonProps {
  promptContent: string;
  agentType: string;
}

/**
 * SavePromptButton component
 * Button for saving prompts from the crewAI agent
 */
const SavePromptButton: React.FC<SavePromptButtonProps> = ({ 
  promptContent, 
  agentType 
}) => {
  const { user } = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Map agent type to prompt usage type
  const mapAgentTypeToUsage = (type: string): PromptUsageType => {
    switch (type.toLowerCase()) {
      case 'analytics':
        return 'analytics_agent';
      case '3d_design':
        return '3d_design_agent';
      case 'search':
        return 'search_agent';
      case 'material_recognition':
        return 'material_recognition_agent';
      default:
        return 'general';
    }
  };
  
  // Handle opening the modal
  const handleOpenModal = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    setIsModalOpen(true);
  };
  
  // Handle closing the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTitle('');
    setDescription('');
    setIsPublic(false);
  };
  
  // Handle saving the prompt
  const handleSavePrompt = async () => {
    if (!title) {
      alert('Please enter a title for your prompt.');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const promptData: CreateUserPromptInput = {
        title,
        content: promptContent,
        description: description || undefined,
        usage: mapAgentTypeToUsage(agentType),
        isPublic
      };
      
      await createPrompt(promptData);
      
      setIsSaving(false);
      handleCloseModal();
      
      alert('Prompt saved successfully!');
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Failed to save prompt. Please try again.');
      setIsSaving(false);
    }
  };
  
  return (
    <>
      <button
        onClick={handleOpenModal}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
      >
        Save Prompt
      </button>
      
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Save Prompt
                    </h3>
                    
                    <div className="mt-2 space-y-4">
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
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSavePrompt}
                  disabled={isSaving}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SavePromptButton;
