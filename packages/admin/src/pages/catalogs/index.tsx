import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { 
  DocumentTextIcon, 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  TrashIcon, 
  SearchIcon,
  CloudUploadIcon,
  DocumentDownloadIcon
} from '@heroicons/react/outline';

/**
 * Catalog Management Page
 */
export default function Catalogs() {
  // Mock catalogs data - in a real app, this would come from an API
  const [catalogs, setCatalogs] = useState([
    { 
      id: 1, 
      name: 'Modern Tiles 2023', 
      supplier: 'TileWorks Inc.', 
      uploadDate: '2023-01-15', 
      status: 'Processed', 
      pages: 42, 
      extractedMaterials: 128,
      fileSize: '12.4 MB'
    },
    { 
      id: 2, 
      name: 'Ceramic Collection', 
      supplier: 'CeramicPro', 
      uploadDate: '2023-02-20', 
      status: 'Processed', 
      pages: 36, 
      extractedMaterials: 94,
      fileSize: '8.7 MB'
    },
    { 
      id: 3, 
      name: 'Natural Stone Catalog', 
      supplier: 'StoneWorks', 
      uploadDate: '2023-03-05', 
      status: 'Processing', 
      pages: 58, 
      extractedMaterials: 0,
      fileSize: '15.2 MB'
    },
    { 
      id: 4, 
      name: 'Porcelain Tiles 2023', 
      supplier: 'LuxuryTiles', 
      uploadDate: '2023-03-10', 
      status: 'Failed', 
      pages: 0, 
      extractedMaterials: 0,
      fileSize: '10.1 MB'
    },
    { 
      id: 5, 
      name: 'Outdoor Tiles Collection', 
      supplier: 'OutdoorTiles Co.', 
      uploadDate: '2023-03-15', 
      status: 'Processed', 
      pages: 28, 
      extractedMaterials: 76,
      fileSize: '7.8 MB'
    },
  ]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Filter catalogs based on search term
  const filteredCatalogs = catalogs.filter(catalog => 
    catalog.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    catalog.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mock delete catalog function
  const handleDeleteCatalog = (id: number) => {
    // In a real app, this would call an API to delete the catalog
    setCatalogs(catalogs.filter(catalog => catalog.id !== id));
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Processed':
        return 'bg-green-100 text-green-800';
      case 'Processing':
        return 'bg-blue-100 text-blue-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout title="Catalog Management">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Catalog Management</h1>
        <p className="text-gray-600">Upload and manage material catalogs.</p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            placeholder="Search catalogs..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Upload Catalog Button */}
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <CloudUploadIcon className="h-5 w-5 mr-2" />
          Upload Catalog
        </button>
      </div>

      {/* Catalogs Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Catalog
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upload Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Extracted Materials
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCatalogs.map((catalog) => (
                <tr key={catalog.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{catalog.name}</div>
                        <div className="text-xs text-gray-500">{catalog.fileSize} • {catalog.pages} pages</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{catalog.supplier}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{catalog.uploadDate}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(catalog.status)}`}>
                      {catalog.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {catalog.extractedMaterials > 0 ? catalog.extractedMaterials : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="View catalog"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Download catalog"
                    >
                      <DocumentDownloadIcon className="h-5 w-5" />
                    </button>
                    <button
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Edit catalog"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-900"
                      title="Delete catalog"
                      onClick={() => handleDeleteCatalog(catalog.id)}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination - simplified for now */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Previous
            </button>
            <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredCatalogs.length}</span> of{' '}
                <span className="font-medium">{filteredCatalogs.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  Previous
                </button>
                <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
                  1
                </button>
                <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}