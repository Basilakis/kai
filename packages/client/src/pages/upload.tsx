import React, { useState, useCallback } from 'react';
import { navigate } from 'gatsby';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import SEO from '../components/SEO';

// Mock recognition result type
interface RecognitionResult {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  confidence: number;
  imageUrl: string;
  properties: Record<string, string>;
}

/**
 * Upload Page
 * 
 * Allows users to upload an image for material recognition
 * and displays the recognition results with confidence indicators.
 */
const UploadPage: React.FC = () => {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<RecognitionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    
    // Determine file type
    if (selectedFile.type.startsWith('image/')) {
      setFileType('image');
      
      // Create preview for images
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type === 'application/pdf') {
      setFileType('pdf');
      setPreview(null); // No preview for PDFs
    } else {
      setError('Unsupported file type. Please upload an image or PDF.');
      setFile(null);
      setFileType(null);
      setPreview(null);
    }
  }, []);

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  // Process the file for recognition
  const handleProcessFile = async () => {
    if (!file) {
      setError('Please upload a file first');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      
      // Mock API call with timeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock recognition results
      setResults([
        {
          id: '1',
          name: 'Carrara White Marble',
          category: 'Tiles',
          manufacturer: 'LuxStone',
          confidence: 0.95,
          imageUrl: 'https://example.com/marble1.jpg',
          properties: {
            material: 'Natural Stone',
            finish: 'Polished',
            color: 'White/Gray',
            size: '12" x 24"',
            thickness: '10mm'
          }
        },
        {
          id: '2',
          name: 'Whitehaven Marble Tile',
          category: 'Tiles',
          manufacturer: 'Stonecraft',
          confidence: 0.87,
          imageUrl: 'https://example.com/marble2.jpg',
          properties: {
            material: 'Natural Stone',
            finish: 'Honed',
            color: 'White',
            size: '12" x 12"',
            thickness: '12mm'
          }
        },
        {
          id: '3',
          name: 'Venato White Porcelain',
          category: 'Tiles',
          manufacturer: 'TileWorks',
          confidence: 0.78,
          imageUrl: 'https://example.com/porcelain1.jpg',
          properties: {
            material: 'Porcelain',
            finish: 'Matte',
            color: 'White/Gray',
            size: '24" x 24"',
            thickness: '8mm'
          }
        }
      ]);
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error('Recognition error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset the upload
  const handleReset = () => {
    setFile(null);
    setFileType(null);
    setPreview(null);
    setResults(null);
    setError(null);
  };

  // View material details (would navigate to detail page in real app)
  const handleViewMaterial = (materialId: string) => {
    navigate(`/catalog/${materialId}`);
  };

  // Add to comparison
  const handleAddToComparison = (materialId: string) => {
    // In a real implementation, this would add to a comparison list
    console.log(`Material ${materialId} added to comparison`);
    
    // Show a success message or navigate to comparison page
    alert('Material added to comparison');
  };

  return (
    <Layout>
      <SEO title="Upload Material" />
      
      <div className="max-w-5xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">Material Recognition</h1>
        
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Upload section - takes up 5/12 of the width on large screens */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Image or PDF</h2>
              
              {!file ? (
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H4m32-12.8L24 36l-8-8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    Drag and drop your file here, or <span className="text-blue-600">browse</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports images (JPG, PNG, WebP) and PDFs up to 10MB
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File preview */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-4">
                        {fileType === 'image' && preview ? (
                          <img 
                            src={preview} 
                            alt="Preview" 
                            className="h-24 w-24 object-cover rounded-md" 
                          />
                        ) : (
                          <div className="h-24 w-24 bg-gray-200 rounded-md flex items-center justify-center">
                            <svg className="h-12 w-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {fileType === 'image' ? 'Image' : 'PDF'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex space-x-3">
                    <button 
                      onClick={handleReset}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Replace
                    </button>
                    <button 
                      onClick={handleProcessFile}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : 'Recognize Material'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Upload tips */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900">Tips for best results:</h3>
                <ul className="mt-2 text-xs text-gray-500 list-disc pl-5 space-y-1">
                  <li>Use clear, well-lit images</li>
                  <li>Capture the material from a 90-degree angle</li>
                  <li>Include a reference object for scale if possible</li>
                  <li>Make sure the texture is visible</li>
                  <li>For PDFs, ensure material specifications are included</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Results section - takes up 7/12 of the width on large screens */}
          <div className="lg:col-span-7">
            {isProcessing ? (
              <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                <p className="text-lg font-medium text-gray-700">Analyzing your material...</p>
                <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
              </div>
            ) : results ? (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Recognition Results</h2>
                
                <div className="space-y-6">
                  {results.map((result) => (
                    <div key={result.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-20 h-20 mr-4 bg-gray-200 rounded-md">
                          {/* Mock image placeholder */}
                          <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
                            <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          {/* Result header with confidence badge */}
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-medium">{result.name}</h3>
                            <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {(result.confidence * 100).toFixed(0)}% Match
                            </div>
                          </div>
                          
                          {/* Material info */}
                          <p className="text-sm text-gray-600 mb-2">
                            {result.category} • {result.manufacturer}
                          </p>
                          
                          {/* Properties */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
                            {Object.entries(result.properties).map(([key, value]) => (
                              <div key={key} className="flex items-baseline">
                                <span className="text-gray-500 mr-2">{key}:</span>
                                <span className="font-medium">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end space-x-3">
                        <button 
                          onClick={() => handleAddToComparison(result.id)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700"
                        >
                          Add to Comparison
                        </button>
                        <button 
                          onClick={() => handleViewMaterial(result.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium text-white"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* View history link */}
                <div className="mt-6 text-center">
                  <a href="/history" className="text-sm text-blue-600 hover:text-blue-800">
                    View your recognition history
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center justify-center h-64 text-center">
                <svg className="h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <p className="text-lg font-medium text-gray-700">Upload an image to start</p>
                <p className="text-sm text-gray-500 mt-2">
                  Our AI will analyze your material and find the closest matches
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UploadPage;