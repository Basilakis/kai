import React, { useState, useEffect } from 'react';
import { 
  DatabaseIcon, 
  RefreshIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  SearchIcon
} from '@heroicons/react/outline';

/**
 * Supabase Database Panel Component
 * 
 * This component provides an interface for configuring Supabase database
 * settings for storing materials, vectors, and ML models, including
 * hybrid search capabilities combining vector and full-text search.
 */
const SupabaseSettingsPanel: React.FC = () => {
  // Configuration state
  const [config, setConfig] = useState({
    supabaseUrl: '',
    supabaseKey: '',
    enableVectorSearch: true,
    enableHybridSearch: true,
    textSearchWeight: 0.5,
    vectorSearchWeight: 0.5,
    storageRegion: 'us-east-1'
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Load existing configuration on component mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        
        // Simulate API response for demonstration
        const data = {
          supabaseUrl: '',
          supabaseKey: '',
          enableVectorSearch: true,
          storageRegion: 'us-east-1'
        };
        
        setConfig(data);
      } catch (error) {
        console.error('Failed to load Supabase configuration', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setConfig(prev => ({
        ...prev,
        [name]: checked
      }));
    } 
    // Handle all other inputs
    else {
      setConfig(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    try {
      setTestStatus('loading');
      setTestMessage('Testing connection...');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo, randomly succeed or fail
      const success = Math.random() > 0.3;
      
      if (success) {
        setTestStatus('success');
        setTestMessage('Connection successful! Supabase is properly configured.');
      } else {
        setTestStatus('error');
        setTestMessage('Connection failed. Please check your credentials and try again.');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage('Connection test failed due to an error');
      console.error('Supabase connection test failed', error);
    }
  };


  // Get status alert
  const getStatusAlert = () => {
    if (testStatus === 'idle') return null;

    const alertClasses = {
      loading: 'bg-blue-50 border-blue-400 text-blue-700',
      success: 'bg-green-50 border-green-400 text-green-700',
      error: 'bg-red-50 border-red-400 text-red-700'
    };

    const iconMap = {
      loading: <RefreshIcon className="h-5 w-5 animate-spin" />,
      success: <CheckCircleIcon className="h-5 w-5" />,
      error: <ExclamationCircleIcon className="h-5 w-5" />
    };

    return (
      <div className={`rounded-md p-4 border ${alertClasses[testStatus]} mb-6`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">{iconMap[testStatus]}</div>
          <div className="ml-3">
            <p className="text-sm font-medium">
              {testMessage}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {getStatusAlert()}

      {/* Connection Settings */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Supabase Connection
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure Supabase credentials for storing and retrieving materials, vectors, and ML models.
          </p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label htmlFor="supabaseUrl" className="block text-sm font-medium text-gray-700">
                Supabase URL
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="text"
                  name="supabaseUrl"
                  id="supabaseUrl"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={config.supabaseUrl}
                  onChange={handleInputChange}
                  placeholder="https://your-project.supabase.co"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Your Supabase project URL
              </p>
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="supabaseKey" className="block text-sm font-medium text-gray-700">
                Supabase API Key
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type="password"
                  name="supabaseKey"
                  id="supabaseKey"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={config.supabaseKey}
                  onChange={handleInputChange}
                  placeholder="••••••••••••••••"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Your Supabase service role API key (keep this secret)
              </p>
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="storageRegion" className="block text-sm font-medium text-gray-700">
                Storage Region
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <select
                  name="storageRegion"
                  id="storageRegion"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={config.storageRegion}
                  onChange={handleInputChange}
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-1">US West (N. California)</option>
                  <option value="eu-west-1">EU (Ireland)</option>
                  <option value="eu-central-1">EU (Frankfurt)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Select the region closest to your users
              </p>
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="enableVectorSearch"
                    name="enableVectorSearch"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={config.enableVectorSearch}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="enableVectorSearch" className="font-medium text-gray-700">
                    Enable pgvector for similarity search
                  </label>
                  <p className="text-gray-500">Use the PostgreSQL pgvector extension for efficient vector similarity search</p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-6">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="enableHybridSearch"
                    name="enableHybridSearch"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={config.enableHybridSearch}
                    onChange={handleInputChange}
                    disabled={!config.enableVectorSearch}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="enableHybridSearch" className="font-medium text-gray-700">
                    Enable hybrid search
                  </label>
                  <p className="text-gray-500">Combine vector similarity and full-text search for better results</p>
                </div>
              </div>
            </div>

            {config.enableHybridSearch && config.enableVectorSearch && (
              <div className="sm:col-span-6 space-y-4">
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center">
                    <SearchIcon className="h-4 w-4 mr-2" />
                    Hybrid Search Configuration
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Adjust weights to balance between text search precision and vector search recall
                  </p>
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="textSearchWeight" className="block text-sm font-medium text-gray-700">
                    Text Search Weight: {config.textSearchWeight}
                  </label>
                  <div className="mt-1">
                    <input
                      type="range"
                      name="textSearchWeight"
                      id="textSearchWeight"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.textSearchWeight}
                      onChange={(e) => {
                        const textWeight = parseFloat(e.target.value);
                        setConfig(prev => ({
                          ...prev,
                          textSearchWeight: textWeight,
                          // Ensure weights sum to 1
                          vectorSearchWeight: parseFloat((1 - textWeight).toFixed(1))
                        }));
                      }}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Higher values prioritize exact keyword matches
                  </p>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="vectorSearchWeight" className="block text-sm font-medium text-gray-700">
                    Vector Search Weight: {config.vectorSearchWeight}
                  </label>
                  <div className="mt-1">
                    <input
                      type="range"
                      name="vectorSearchWeight"
                      id="vectorSearchWeight"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.vectorSearchWeight}
                      onChange={(e) => {
                        const vectorWeight = parseFloat(e.target.value);
                        setConfig(prev => ({
                          ...prev,
                          vectorSearchWeight: vectorWeight,
                          // Ensure weights sum to 1
                          textSearchWeight: parseFloat((1 - vectorWeight).toFixed(1))
                        }));
                      }}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Higher values prioritize semantic similarity
                  </p>
                </div>
              </div>
            )}

            <div className="sm:col-span-6">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                onClick={handleTestConnection}
                disabled={loading || testStatus === 'loading'}
              >
                {testStatus === 'loading' ? (
                  <RefreshIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                ) : (
                  <DatabaseIcon className="-ml-1 mr-2 h-4 w-4" />
                )}
                Test Connection
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SupabaseSettingsPanel;