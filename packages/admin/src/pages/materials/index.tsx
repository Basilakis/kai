import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { 
  CubeIcon, 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  TrashIcon, 
  SearchIcon,
  FilterIcon,
  PhotographIcon
} from '@heroicons/react/outline';

/**
 * Material Management Page
 */
export default function Materials() {
  // Mock materials data - in a real app, this would come from an API
  const [materials, setMaterials] = useState([
    { 
      id: 1, 
      name: 'Marble White', 
      type: 'Natural Stone', 
      dimensions: '60x60 cm', 
      color: 'White',
      finish: 'Polished',
      catalogName: 'Modern Tiles 2023',
      catalogId: 1,
      thumbnailUrl: '/images/materials/marble-white.jpg'
    },
    { 
      id: 2, 
      name: 'Ceramic Beige', 
      type: 'Ceramic', 
      dimensions: '30x30 cm', 
      color: 'Beige',
      finish: 'Matte',
      catalogName: 'Ceramic Collection',
      catalogId: 2,
      thumbnailUrl: '/images/materials/ceramic-beige.jpg'
    },
    { 
      id: 3, 
      name: 'Granite Black', 
      type: 'Natural Stone', 
      dimensions: '60x60 cm', 
      color: 'Black',
      finish: 'Honed',
      catalogName: 'Natural Stone Catalog',
      catalogId: 3,
      thumbnailUrl: '/images/materials/granite-black.jpg'
    },
    { 
      id: 4, 
      name: 'Porcelain Grey', 
      type: 'Porcelain', 
      dimensions: '45x45 cm', 
      color: 'Grey',
      finish: 'Textured',
      catalogName: 'Porcelain Tiles 2023',
      catalogId: 4,
      thumbnailUrl: '/images/materials/porcelain-grey.jpg'
    },
    { 
      id: 5, 
      name: 'Outdoor Slate', 
      type: 'Natural Stone', 
      dimensions: '60x30 cm', 
      color: 'Dark Grey',
      finish: 'Natural',
      catalogName: 'Outdoor Tiles Collection',
      catalogId: 5,
      thumbnailUrl: '/images/materials/outdoor-slate.jpg'
    },
  ]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter states
  const [selectedType, setSelectedType] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState('');

  // Get unique material types for filter
  const materialTypes = [...new Set(materials.map(material => material.type))];
  
  // Get unique catalog names for filter
  const catalogNames = [...new Set(materials.map(material => material.catalogName))];

  // Filter materials based on search term and filters
  const filteredMaterials = materials.filter(material => {
    // Search term filter
    const matchesSearch = 
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      material.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.color.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Type filter
    const matchesType = selectedType === '' || material.type === selectedType;
    
    // Catalog filter
    const matchesCatalog = selectedCatalog === '' || material.catalogName === selectedCatalog;
    
    return matchesSearch && matchesType && matchesCatalog;
  });

  // Mock delete material function
  const handleDeleteMaterial = (id: number) => {
    // In a real app, this would call an API to delete the material
    setMaterials(materials.filter(material => material.id !== id));
  };

  return (
    <Layout title="Material Management">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Material Management</h1>
        <p className="text-gray-600">Manage materials extracted from catalogs.</p>
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
            placeholder="Search materials..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Add Material Button */}
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Material
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center mb-4">
          <FilterIcon className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Material Type
            </label>
            <select
              id="type-filter"
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">All Types</option>
              {materialTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="catalog-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Catalog Source
            </label>
            <select
              id="catalog-filter"
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={selectedCatalog}
              onChange={(e) => setSelectedCatalog(e.target.value)}
            >
              <option value="">All Catalogs</option>
              {catalogNames.map((catalog) => (
                <option key={catalog} value={catalog}>
                  {catalog}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMaterials.map((material) => (
          <div key={material.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="h-48 bg-gray-200 flex items-center justify-center">
              {material.thumbnailUrl ? (
                <img 
                  src={material.thumbnailUrl} 
                  alt={material.name} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <PhotographIcon className="h-12 w-12 text-gray-400" />
                  <span className="text-sm text-gray-500 mt-2">No image</span>
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900">{material.name}</h3>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Type:</span> {material.type}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Dimensions:</span> {material.dimensions}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Color:</span> {material.color}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Finish:</span> {material.finish}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Catalog:</span> {material.catalogName}
                </p>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  className="p-1 text-blue-600 hover:text-blue-900"
                  title="View material"
                >
                  <EyeIcon className="h-5 w-5" />
                </button>
                <button
                  className="p-1 text-blue-600 hover:text-blue-900"
                  title="Edit material"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
                <button
                  className="p-1 text-red-600 hover:text-red-900"
                  title="Delete material"
                  onClick={() => handleDeleteMaterial(material.id)}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredMaterials.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <CubeIcon className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No materials found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}

      {/* Pagination - simplified for now */}
      {filteredMaterials.length > 0 && (
        <div className="mt-6 bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow">
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
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredMaterials.length}</span> of{' '}
                <span className="font-medium">{filteredMaterials.length}</span> results
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
      )}
    </Layout>
  );
}