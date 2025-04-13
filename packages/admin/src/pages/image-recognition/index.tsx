// @ts-nocheck - Disable TypeScript checking for this file
import React, { useState } from 'react';
import Layout from '../../components/Layout';
// Using inline SVG icons instead of Heroicons due to compatibility issues
const PhotoIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const ArrowUpTrayIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const AdjustmentsHorizontalIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);

const ClockIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationCircleIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);
// Import from the shared utility package using relative path for consistency
import { formatLocalizedDateTime } from '../../../../shared/src/utils/formatting';

// Define interfaces for recognition data
interface RecognitionResult {
  tileId: string;
  name: string;
  confidence: number;
  image: string;
}

interface RecognitionItem {
  id: string;
  timestamp: string;
  image: string;
  status: 'completed' | 'failed';
  results?: RecognitionResult[];
  error?: string;
}

/**
 * Image Recognition Page
 * Allows users to upload images and identify matching tiles
 */
export default function ImageRecognition() {
  // Mock recognition history
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionItem[]>([
    {
      id: 'rec-001',
      timestamp: '2025-03-19T10:30:00Z',
      image: '/mock/tile1.jpg',
      status: 'completed',
      results: [
        { tileId: 'tile-123', name: 'Marble White', confidence: 0.92, image: '/mock/result1.jpg' },
        { tileId: 'tile-456', name: 'Carrara White', confidence: 0.87, image: '/mock/result2.jpg' },
        { tileId: 'tile-789', name: 'Calacatta Gold', confidence: 0.76, image: '/mock/result3.jpg' }
      ]
    },
    {
      id: 'rec-002',
      timestamp: '2025-03-18T15:45:00Z',
      image: '/mock/tile2.jpg',
      status: 'completed',
      results: [
        { tileId: 'tile-234', name: 'Slate Black', confidence: 0.95, image: '/mock/result4.jpg' },
        { tileId: 'tile-567', name: 'Basalt Dark', confidence: 0.82, image: '/mock/result5.jpg' }
      ]
    },
    {
      id: 'rec-003',
      timestamp: '2025-03-17T09:15:00Z',
      image: '/mock/tile3.jpg',
      status: 'failed',
      error: 'Low image quality. Please upload a clearer image.'
    }
  ]);

  // Recognition settings
  const [settings, setSettings] = useState({
    confidenceThreshold: 0.7,
    maxResults: 5,
    enableFeatureMatching: true,
    enableMachineLearning: true,
    preferredModel: 'hybrid'
  });

  // UI state
  const [activeTab, setActiveTab] = useState('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentRecognition, setCurrentRecognition] = useState<RecognitionItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Start mock upload process
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploading(false);
            // Simulate recognition process
            setTimeout(() => {
              setCurrentRecognition(recognitionHistory[0]);
            }, 1500);
            return 100;
          }
          return prev + 10;
        });
      }, 300);
    }
  };

  // Handle settings change
  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value
    }));
  };


  // Get confidence color class
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-blue-600';
    return 'text-yellow-600';
  };

  return (
    <Layout title="Image Recognition">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Image Recognition</h1>
        <p className="text-gray-600">Upload images to identify matching tiles from our database.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            className={`${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            onClick={() => setActiveTab('upload')}
          >
            <div className="flex items-center">
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Upload & Recognize
            </div>
          </button>
          <button
            className={`${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            onClick={() => setActiveTab('history')}
          >
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              Recognition History
            </div>
          </button>
        </nav>
      </div>

      {/* Settings Toggle */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => setShowSettings(!showSettings)}
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
          {showSettings ? 'Hide Settings' : 'Show Settings'}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 p-4 rounded-md mb-6 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recognition Settings</h3>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label htmlFor="confidenceThreshold" className="block text-sm font-medium text-gray-700">
                Confidence Threshold
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="confidenceThreshold"
                  id="confidenceThreshold"
                  min="0"
                  max="1"
                  step="0.05"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={settings.confidenceThreshold}
                  onChange={handleSettingChange}
                />
                <p className="mt-1 text-xs text-gray-500">Value between 0 and 1</p>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="maxResults" className="block text-sm font-medium text-gray-700">
                Max Results
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="maxResults"
                  id="maxResults"
                  min="1"
                  max="20"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={settings.maxResults}
                  onChange={handleSettingChange}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="preferredModel" className="block text-sm font-medium text-gray-700">
                Recognition Model
              </label>
              <div className="mt-1">
                <select
                  id="preferredModel"
                  name="preferredModel"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={settings.preferredModel}
                  onChange={handleSettingChange}
                >
                  <option value="hybrid">Hybrid (OpenCV + ML)</option>
                  <option value="feature">Feature-based only</option>
                  <option value="ml">Machine Learning only</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-3">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="enableFeatureMatching"
                    name="enableFeatureMatching"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={settings.enableFeatureMatching}
                    onChange={handleSettingChange}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="enableFeatureMatching" className="font-medium text-gray-700">
                    Enable Feature Matching
                  </label>
                  <p className="text-gray-500">Use OpenCV for feature-based matching</p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-3">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="enableMachineLearning"
                    name="enableMachineLearning"
                    type="checkbox"
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={settings.enableMachineLearning}
                    onChange={handleSettingChange}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="enableMachineLearning" className="font-medium text-gray-700">
                    Enable Machine Learning
                  </label>
                  <p className="text-gray-500">Use neural networks for classification</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload & Recognize Tab */}
      {activeTab === 'upload' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {!currentRecognition ? (
            <div className="p-6">
              <div className="max-w-lg mx-auto">
                <label
                  htmlFor="file-upload"
                  className={`relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none ${
                    isUploading ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <span>Upload an image</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleFileSelect}
                          disabled={isUploading}
                        />
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </div>
                </label>

                {isUploading && (
                  <div className="mt-4">
                    <h4 className="sr-only">Status</h4>
                    <div className="mt-2" aria-hidden="true">
                      <div className="bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-blue-600 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-sm font-medium text-gray-500">
                        <p>Uploading...</p>
                        <p>{uploadProgress}%</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900">Image Recognition Tips</h3>
                  <ul className="mt-2 text-sm text-gray-500 list-disc pl-5 space-y-1">
                    <li>Use high-resolution images for better results</li>
                    <li>Ensure good lighting conditions</li>
                    <li>Capture the tile pattern clearly</li>
                    <li>Include a color reference card if possible</li>
                    <li>Avoid shadows and reflections</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Recognition Results</h3>
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setCurrentRecognition(null)}
                >
                  New Recognition
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <div className="bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={currentRecognition.image}
                      alt="Uploaded tile"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Uploaded: {formatLocalizedDateTime(currentRecognition.timestamp)}
                    </p>
                    <p className="text-sm text-gray-500">
                      ID: {currentRecognition.id}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  {currentRecognition.status === 'completed' ? (
                    <>
                      <h4 className="text-md font-medium text-gray-900 mb-4">
                        Matching Tiles ({currentRecognition.results?.length || 0})
                      </h4>
                      <div className="space-y-4">
                        {currentRecognition.results?.map((result) => (
                          <div
                            key={result.tileId}
                            className="flex items-start p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex-shrink-0 h-16 w-16 bg-gray-100 rounded overflow-hidden mr-4">
                              <img
                                src={result.image}
                                alt={result.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {result.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                ID: {result.tileId}
                              </p>
                              <div className="flex items-center mt-1">
                                <p className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                                  Confidence: {(result.confidence * 100).toFixed(1)}%
                                </p>
                                <div
                                  className={`ml-2 h-2 w-16 rounded-full ${
                                    result.confidence >= 0.9
                                      ? 'bg-green-200'
                                      : result.confidence >= 0.7
                                      ? 'bg-blue-200'
                                      : 'bg-yellow-200'
                                  }`}
                                >
                                  <div
                                    className={`h-2 rounded-full ${
                                      result.confidence >= 0.9
                                        ? 'bg-green-600'
                                        : result.confidence >= 0.7
                                        ? 'bg-blue-600'
                                        : 'bg-yellow-600'
                                    }`}
                                    style={{ width: `${result.confidence * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-4">
                              <button
                                type="button"
                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Recognition Failed
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p>{currentRecognition.error}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Recognition Requests</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Results
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recognitionHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex-shrink-0 h-10 w-10 rounded overflow-hidden bg-gray-100">
                          <img src={item.image} alt="" className="h-10 w-10 object-cover" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatLocalizedDateTime(item.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.status === 'completed' ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.status === 'completed' ? (
                          <span>{item.results?.length || 0} matches</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => {
                            setCurrentRecognition(item);
                            setActiveTab('upload');
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}