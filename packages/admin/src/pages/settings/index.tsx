import React, { useState } from 'react';
import Layout from '../../components/Layout';
import SupabaseSettingsPanel from '../../components/SupabaseSettingsPanel';
import { 
  CogIcon, 
  SaveIcon, 
  CloudIcon, 
  DatabaseIcon, 
  MailIcon, 
  LockClosedIcon,
  ServerIcon,
  ChipIcon
} from '@heroicons/react/outline';

/**
 * System Settings Page
 */
export default function Settings() {
  // Mock settings data - in a real app, this would come from an API
  const [settings, setSettings] = useState({
    // AWS Settings
    awsAccessKey: '••••••••••••••••',
    awsSecretKey: '••••••••••••••••',
    awsRegion: 'us-east-1',
    awsS3Bucket: 'kai-materials',
    
    // Database Settings
    dbConnectionString: 'mongodb://••••••••••••••••',
    dbName: 'kai_materials_db',
    
    // Email Settings
    emailSender: 'notifications@example.com',
    emailApiKey: '••••••••••••••••',
    
    // ML Service Settings
    mlServiceUrl: 'http://ml-service.example.com',
    mlServiceApiKey: '••••••••••••••••',
    confidenceThreshold: 0.75,
    
    // System Settings
    maxUploadSize: 50, // MB
    maxConcurrentJobs: 5,
    enableUserRegistration: true,
    enablePublicApi: false,
    debugMode: false
  });

  // Form state
  const [formValues, setFormValues] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('aws');
  const [saveStatus, setSaveStatus] = useState<null | 'saving' | 'success' | 'error'>(null);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    // Handle checkbox inputs
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormValues({
        ...formValues,
        [name]: checked
      });
    } 
    // Handle number inputs
    else if (type === 'number') {
      setFormValues({
        ...formValues,
        [name]: parseFloat(value)
      });
    } 
    // Handle all other inputs
    else {
      setFormValues({
        ...formValues,
        [name]: value
      });
    }
  };

  // Save settings
  const saveSettings = () => {
    setSaveStatus('saving');
    
    // Simulate API call
    setTimeout(() => {
      setSettings(formValues);
      setSaveStatus('success');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    }, 1000);
  };

  // Get save button text and color based on status
  const getSaveButtonProps = () => {
    switch (saveStatus) {
      case 'saving':
        return { text: 'Saving...', color: 'bg-yellow-600 hover:bg-yellow-700' };
      case 'success':
        return { text: 'Saved!', color: 'bg-green-600 hover:bg-green-700' };
      case 'error':
        return { text: 'Error!', color: 'bg-red-600 hover:bg-red-700' };
      default:
        return { text: 'Save Changes', color: 'bg-blue-600 hover:bg-blue-700' };
    }
  };

  const saveButtonProps = getSaveButtonProps();

  return (
    <Layout title="System Settings">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">System Settings</h1>
        <p className="text-gray-600">Configure system-wide settings and integrations.</p>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              className={`${
                activeTab === 'aws'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('aws')}
            >
              <div className="flex items-center">
                <CloudIcon className="h-5 w-5 mr-2" />
                AWS Configuration
              </div>
            </button>
            <button
              className={`${
                activeTab === 'database'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('database')}
            >
              <div className="flex items-center">
                <DatabaseIcon className="h-5 w-5 mr-2" />
                Database
              </div>
            </button>
            <button
              className={`${
                activeTab === 'supabase'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('supabase')}
            >
              <div className="flex items-center">
                <DatabaseIcon className="h-5 w-5 mr-2" />
                Supabase
              </div>
            </button>
            <button
              className={`${
                activeTab === 'email'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('email')}
            >
              <div className="flex items-center">
                <MailIcon className="h-5 w-5 mr-2" />
                Email
              </div>
            </button>
            <button
              className={`${
                activeTab === 'ml'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('ml')}
            >
              <div className="flex items-center">
                <ChipIcon className="h-5 w-5 mr-2" />
                ML Service
              </div>
            </button>
            <button
              className={`${
                activeTab === 'system'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('system')}
            >
              <div className="flex items-center">
                <ServerIcon className="h-5 w-5 mr-2" />
                System
              </div>
            </button>
          </nav>
        </div>

        {/* AWS Settings */}
        {activeTab === 'aws' && (
          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="awsAccessKey" className="block text-sm font-medium text-gray-700">
                  AWS Access Key
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="password"
                    name="awsAccessKey"
                    id="awsAccessKey"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.awsAccessKey}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="awsSecretKey" className="block text-sm font-medium text-gray-700">
                  AWS Secret Key
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="password"
                    name="awsSecretKey"
                    id="awsSecretKey"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.awsSecretKey}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="awsRegion" className="block text-sm font-medium text-gray-700">
                  AWS Region
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <select
                    name="awsRegion"
                    id="awsRegion"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.awsRegion}
                    onChange={handleInputChange}
                  >
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-east-2">US East (Ohio)</option>
                    <option value="us-west-1">US West (N. California)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="eu-central-1">EU (Frankfurt)</option>
                    <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="awsS3Bucket" className="block text-sm font-medium text-gray-700">
                  S3 Bucket Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="awsS3Bucket"
                    id="awsS3Bucket"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.awsS3Bucket}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Database Settings */}
        {activeTab === 'database' && (
          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="dbConnectionString" className="block text-sm font-medium text-gray-700">
                  MongoDB Connection String
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="password"
                    name="dbConnectionString"
                    id="dbConnectionString"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.dbConnectionString}
                    onChange={handleInputChange}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Format: mongodb://username:password@host:port/database
                </p>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="dbName" className="block text-sm font-medium text-gray-700">
                  Database Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="dbName"
                    id="dbName"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.dbName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Settings */}
        {activeTab === 'email' && (
          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="emailSender" className="block text-sm font-medium text-gray-700">
                  Sender Email Address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="email"
                    name="emailSender"
                    id="emailSender"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.emailSender}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="emailApiKey" className="block text-sm font-medium text-gray-700">
                  AWS SES API Key
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="password"
                    name="emailApiKey"
                    id="emailApiKey"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.emailApiKey}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ML Service Settings */}
        {activeTab === 'ml' && (
          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="mlServiceUrl" className="block text-sm font-medium text-gray-700">
                  ML Service URL
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="mlServiceUrl"
                    id="mlServiceUrl"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.mlServiceUrl}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="mlServiceApiKey" className="block text-sm font-medium text-gray-700">
                  ML Service API Key
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="password"
                    name="mlServiceApiKey"
                    id="mlServiceApiKey"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.mlServiceApiKey}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="confidenceThreshold" className="block text-sm font-medium text-gray-700">
                  Confidence Threshold
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="confidenceThreshold"
                    id="confidenceThreshold"
                    min="0"
                    max="1"
                    step="0.01"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.confidenceThreshold}
                    onChange={handleInputChange}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Value between 0 and 1. Higher values require more confidence for matches.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Supabase Settings */}
        {activeTab === 'supabase' && (
          <SupabaseSettingsPanel />
        )}

        {/* System Settings */}
        {activeTab === 'system' && (
          <div className="px-6 py-6 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="maxUploadSize" className="block text-sm font-medium text-gray-700">
                  Max Upload Size (MB)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="maxUploadSize"
                    id="maxUploadSize"
                    min="1"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.maxUploadSize}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="maxConcurrentJobs" className="block text-sm font-medium text-gray-700">
                  Max Concurrent Jobs
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    name="maxConcurrentJobs"
                    id="maxConcurrentJobs"
                    min="1"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    value={formValues.maxConcurrentJobs}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="enableUserRegistration"
                      name="enableUserRegistration"
                      type="checkbox"
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={formValues.enableUserRegistration}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="enableUserRegistration" className="font-medium text-gray-700">
                      Enable User Registration
                    </label>
                    <p className="text-gray-500">Allow new users to register accounts.</p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="enablePublicApi"
                      name="enablePublicApi"
                      type="checkbox"
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={formValues.enablePublicApi}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="enablePublicApi" className="font-medium text-gray-700">
                      Enable Public API
                    </label>
                    <p className="text-gray-500">Allow access to the public API endpoints.</p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="debugMode"
                      name="debugMode"
                      type="checkbox"
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      checked={formValues.debugMode}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="debugMode" className="font-medium text-gray-700">
                      Debug Mode
                    </label>
                    <p className="text-gray-500">Enable detailed logging and debugging information.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${saveButtonProps.color} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            onClick={saveSettings}
            disabled={saveStatus === 'saving'}
          >
            <SaveIcon className="h-4 w-4 mr-2" />
            {saveButtonProps.text}
          </button>
        </div>
      </div>
    </Layout>
  );
}