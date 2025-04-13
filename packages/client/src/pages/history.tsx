/// <reference path="../types/gatsby.d.ts" />

import React, { useState, useEffect } from 'react';
import PrivateRoute from '../components/PrivateRoute';
import { navigate } from 'gatsby';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import historyService, { HistoryItem } from '../services/historyService';
import { formatLocalizedDateTime } from '@kai/shared/utils/formatting';

/**
 * History Page
 *
 * Displays a chronological list of past material recognition attempts
 */
const HistoryPage: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Fetch history items
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch history data from API
        const response = await historyService.getRecognitionHistory(page, limit);

        setHistoryItems(response.data);

        // Set pagination if available
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
        }
      } catch (err) {
        setError('Failed to load history. Please try again later.');
        console.error('Error loading history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [page, limit]);


  // View details of a history item
  const handleViewItem = (item: HistoryItem) => {
    setSelectedItem(item);
  };

  // Close modal
  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  // Navigate to upload page
  const handleNewRecognition = () => {
    navigate('/upload');
  };

  // Compare results from a history item
  const handleCompareResults = (item: HistoryItem) => {
    // Get the IDs of the materials to compare
    const materialIds = item.results.map(result => result.id);

    // Navigate to the comparison page with the material IDs
    navigate(`/comparison?ids=${materialIds.join(',')}`);
  };

  // Delete history item
  const handleDeleteItem = async (itemId: string) => {
    try {
      const success = await historyService.deleteHistoryItem(itemId);

      if (success) {
        // Remove from local state
        setHistoryItems(items => items.filter(item => item.id !== itemId));

        // Close modal if the deleted item was selected
        if (selectedItem?.id === itemId) {
          setSelectedItem(null);
        }
      }
    } catch (err) {
      console.error(`Error deleting history item ${itemId}:`, err);
      // Provide feedback to user (could use a toast notification)
      alert('Failed to delete history item. Please try again.');
    }
  };

  return (
    <PrivateRoute>
      <Layout>
        <SEO title="Recognition History" />

      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Recognition History</h1>
            <p className="text-gray-600 mt-1">
              Your past material recognition attempts
            </p>
          </div>

          <button
            onClick={handleNewRecognition}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            New Recognition
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-md p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mr-4"></div>
            <p className="text-gray-600">Loading history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No recognition history</h3>
            <p className="text-gray-500 mb-4">You haven't performed any material recognitions yet</p>
            <button
              onClick={handleNewRecognition}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upload Your First Image
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {historyItems.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-4">
                  <div className="flex items-start">
                    {/* Image/File Preview with actual thumbnails */}
                    <div className="flex-shrink-0 mr-4">
                      {item.fileType === 'image' ? (
                        <div className="h-20 w-20 rounded-md overflow-hidden border border-gray-200 relative group">
                          <img
                            src={item.imageUrl}
                            alt={item.fileName}
                            className="h-full w-full object-cover"
                          />
                          {/* Add AI detection indicator badge */}
                          <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-bl-md">
                            AI
                          </div>
                          {/* Quick-view overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                // Use type casting to access DOM event methods
                                (e as any).stopPropagation();
                                handleViewItem(item);
                              }}
                              className="p-1.5 bg-white rounded-full shadow-md"
                            >
                              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 w-20 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center text-gray-400">
                          <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2H7v-2h8zM7 8h8v2H7V8z" clipRule="evenodd" />
                          </svg>
                          {/* PDF indicator */}
                          <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-bl-md">
                            PDF
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info & Results Summary */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{item.fileName}</h3>
                          <p className="text-sm text-gray-500">
                            {formatLocalizedDateTime(item.timestamp)} • {item.fileSize.toFixed(1)} MB
                          </p>

                          {/* Top match summary */}
                          {item.results.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-gray-700">
                                Top match: {item.results[0]?.name ?? 'Unknown'}
                              </p>
                              <div className="flex items-center">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 mt-1 mb-1">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(item.results[0]?.confidence ?? 0) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-semibold text-gray-700 ml-2">
                                  {Math.round((item.results[0]?.confidence ?? 0) * 100)}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Multiple results indicator */}
                          {item.results.length > 1 && (
                            <p className="text-xs text-gray-500 mt-1">
                              +{item.results.length - 1} more matches
                            </p>
                          )}
                        </div>

                        {/* Actions dropdown */}
                        <div className="relative">
                          <div className="dropdown inline-block relative">
                            <button className="text-gray-500 hover:text-gray-700 focus:outline-none">
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            <div className="dropdown-menu hidden absolute right-0 mt-2 py-2 w-48 bg-white rounded-md shadow-xl z-10">
                              <button
                                onClick={() => handleViewItem(item)}
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                View Details
                              </button>
                              {item.results.length > 1 && (
                                <button
                                  onClick={() => handleCompareResults(item)}
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  Compare Results
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                      onClick={() => handleViewItem(item)}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700"
                    >
                      View Details
                    </button>
                    {item.results.length > 1 && (
                      <button
                        onClick={() => handleCompareResults(item)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium text-white"
                      >
                        Compare Results
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                      page === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Calculate page numbers to show (centered around current page)
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                      page === totalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={handleCloseModal}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Recognition Details
                    </h3>

                    <div className="mt-4">
                      {/* Enhanced file info with full-size image */}
                      <div className="flex flex-col sm:flex-row mb-4">
                        <div className="w-full sm:w-1/2 mb-4 sm:mb-0 sm:mr-4">
                          {selectedItem.fileType === 'image' ? (
                            <div className="relative rounded-lg overflow-hidden border border-gray-200 max-h-64 flex items-center justify-center">
                              <img
                                src={selectedItem.imageUrl}
                                alt={selectedItem.fileName}
                                className="max-w-full max-h-64 object-contain"
                              />
                              {/* Only show AI detection overlays for images */}
                              <div className="absolute inset-0 pointer-events-none">
                                {/* Sample AI detection areas based on results */}
                                {selectedItem.results.map((result, idx) => {
                                  // Create pseudo-random positions based on result properties
                                  const hash = result.name.length + result.manufacturer.length;
                                  const x = 15 + (hash % 30);
                                  const y = 20 + ((hash * 2) % 40);
                                  const width = 25 + (hash % 20);
                                  const height = 25 + ((hash * 3) % 20);

                                  // Use different colors for different materials
                                  const colors: string[] = [
                                    'rgba(0, 128, 255, 0.3)',
                                    'rgba(255, 128, 0, 0.3)',
                                    'rgba(0, 192, 64, 0.3)',
                                    'rgba(128, 0, 255, 0.3)'
                                  ];

                                  // Get color with guaranteed value
                                  const color = colors[idx % colors.length] || 'rgba(0, 0, 0, 0.3)';
                                  const borderColor = color.replace('0.3', '0.7');

                                  return (
                                    <div
                                      key={result.id}
                                      className="absolute border-2 shadow-sm flex items-center justify-center"
                                      style={{
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        width: `${width}%`,
                                        height: `${height}%`,
                                        backgroundColor: colors[idx % colors.length],
                                        borderColor: borderColor,
                                      }}
                                    >
                                      <div className="bg-white bg-opacity-80 text-xs px-1 py-0.5 rounded shadow max-w-full">
                                        {result.name} ({Math.round(result.confidence * 100)}%)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="h-48 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400">
                              <div className="text-center">
                                <svg className="h-12 w-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2H7v-2h8zM7 8h8v2H7V8z" clipRule="evenodd" />
                                </svg>
                                <p className="mt-2 text-sm">PDF file preview not available</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="w-full sm:w-1/2">
                          <div>
                            <p className="font-medium">{selectedItem.fileName}</p>
                            <p className="text-sm text-gray-500">
                              {formatLocalizedDateTime(selectedItem.timestamp)} • {selectedItem.fileSize.toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Results */}
                      <h4 className="font-medium text-gray-800 mb-2">Recognition Results</h4>
                      <div className="space-y-4">
                        {selectedItem.results.map((result, index) => (
                          <div key={result.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h5 className="font-medium flex items-center">
                                  {result.name}
                                  {index === 0 && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                      Best Match
                                    </span>
                                  )}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {result.category} • {result.manufacturer}
                                </p>
                              </div>
                              <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                {Math.round(result.confidence * 100)}% Match
                              </div>
                            </div>

                            {/* Enhanced confidence visualization */}
                            <div className="mt-3 mb-2">
                              <div className="flex items-center mb-1">
                                <span className="text-xs text-gray-500 mr-2">Confidence:</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      result.confidence > 0.9 ? 'bg-green-500' :
                                      result.confidence > 0.75 ? 'bg-blue-500' :
                                      result.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${result.confidence * 100}%` }}
                                  ></div>
                                </div>
                                <span className="ml-2 text-xs font-medium text-gray-700">
                                  {Math.round(result.confidence * 100)}%
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {result.confidence > 0.9 ? 'Very high confidence match' :
                                result.confidence > 0.75 ? 'High confidence match' :
                                result.confidence > 0.6 ? 'Medium confidence match' :
                                'Low confidence match'}
                              </p>
                            </div>

                            {/* Material properties */}
                            <div className="mt-3 pt-2 border-t border-gray-100">
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <div className="text-gray-500">Material Type:</div>
                                <div>{result.category}</div>
                                <div className="text-gray-500">Manufacturer:</div>
                                <div>{result.manufacturer}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {selectedItem.results.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCompareResults(selectedItem);
                      handleCloseModal();
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Compare Results
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </Layout>
    </PrivateRoute>
  );
};

export default HistoryPage;