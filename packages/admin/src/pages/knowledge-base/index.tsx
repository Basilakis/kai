import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { 
  SearchIcon, 
  FilterIcon, 
  TagIcon, 
  CollectionIcon,
  DatabaseIcon,
  PhotographIcon,
  DocumentTextIcon,
  ArrowsExpandIcon,
  ViewGridIcon,
  ViewListIcon
} from '@heroicons/react/outline';

/**
 * Knowledge Base Page
 * Allows users to search and browse the tile information database
 */
export default function KnowledgeBase() {
  // Mock tile data
  const [tiles, setTiles] = useState([
    {
      id: 'tile-001',
      name: 'Carrara White Marble',
      type: 'Natural Stone',
      color: 'White',
      dimensions: '12" x 24"',
      finish: 'Polished',
      material: 'Marble',
      origin: 'Italy',
      collection: 'Premium Marble',
      tags: ['marble', 'white', 'polished', 'premium'],
      image: '/mock/tile1.jpg',
      catalogId: 'cat-001',
      catalogName: 'Italian Marble Collection 2025',
      dateAdded: '2025-01-15T10:30:00Z',
      lastUpdated: '2025-03-10T14:45:00Z',
      version: 2
    },
    {
      id: 'tile-002',
      name: 'Nero Marquina',
      type: 'Natural Stone',
      color: 'Black',
      dimensions: '12" x 12"',
      finish: 'Polished',
      material: 'Marble',
      origin: 'Spain',
      collection: 'Premium Marble',
      tags: ['marble', 'black', 'polished', 'premium'],
      image: '/mock/tile2.jpg',
      catalogId: 'cat-002',
      catalogName: 'European Marble Collection 2025',
      dateAdded: '2025-01-20T11:15:00Z',
      lastUpdated: '2025-01-20T11:15:00Z',
      version: 1
    },
    {
      id: 'tile-003',
      name: 'Calacatta Gold',
      type: 'Natural Stone',
      color: 'White/Gold',
      dimensions: '24" x 48"',
      finish: 'Honed',
      material: 'Marble',
      origin: 'Italy',
      collection: 'Luxury Marble',
      tags: ['marble', 'white', 'gold', 'honed', 'luxury'],
      image: '/mock/tile3.jpg',
      catalogId: 'cat-001',
      catalogName: 'Italian Marble Collection 2025',
      dateAdded: '2025-01-15T10:45:00Z',
      lastUpdated: '2025-02-05T09:30:00Z',
      version: 3
    },
    {
      id: 'tile-004',
      name: 'Slate Black',
      type: 'Natural Stone',
      color: 'Black',
      dimensions: '16" x 16"',
      finish: 'Natural',
      material: 'Slate',
      origin: 'Brazil',
      collection: 'Earth Elements',
      tags: ['slate', 'black', 'natural', 'rustic'],
      image: '/mock/tile4.jpg',
      catalogId: 'cat-003',
      catalogName: 'Natural Stone Collection 2025',
      dateAdded: '2025-02-10T13:20:00Z',
      lastUpdated: '2025-02-10T13:20:00Z',
      version: 1
    },
    {
      id: 'tile-005',
      name: 'Travertine Beige',
      type: 'Natural Stone',
      color: 'Beige',
      dimensions: '18" x 18"',
      finish: 'Tumbled',
      material: 'Travertine',
      origin: 'Turkey',
      collection: 'Classic Stone',
      tags: ['travertine', 'beige', 'tumbled', 'classic'],
      image: '/mock/tile5.jpg',
      catalogId: 'cat-003',
      catalogName: 'Natural Stone Collection 2025',
      dateAdded: '2025-02-10T14:10:00Z',
      lastUpdated: '2025-03-15T11:25:00Z',
      version: 2
    },
    {
      id: 'tile-006',
      name: 'Wood Oak',
      type: 'Ceramic',
      color: 'Brown',
      dimensions: '6" x 36"',
      finish: 'Matte',
      material: 'Ceramic',
      origin: 'Spain',
      collection: 'Wood Look',
      tags: ['ceramic', 'wood-look', 'brown', 'matte'],
      image: '/mock/tile6.jpg',
      catalogId: 'cat-004',
      catalogName: 'Wood Look Tiles 2025',
      dateAdded: '2025-02-25T09:45:00Z',
      lastUpdated: '2025-02-25T09:45:00Z',
      version: 1
    }
  ]);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    color: '',
    material: '',
    finish: '',
    collection: ''
  });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTile, setSelectedTile] = useState(null);

  // Filter options derived from tile data
  const filterOptions = {
    type: [...new Set(tiles.map(tile => tile.type))],
    color: [...new Set(tiles.map(tile => tile.color))],
    material: [...new Set(tiles.map(tile => tile.material))],
    finish: [...new Set(tiles.map(tile => tile.finish))],
    collection: [...new Set(tiles.map(tile => tile.collection))]
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      type: '',
      color: '',
      material: '',
      finish: '',
      collection: ''
    });
    setSearchQuery('');
  };

  // Filter tiles based on search query and filters
  const filteredTiles = tiles.filter(tile => {
    // Search query filter
    if (searchQuery && !tile.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !tile.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false;
    }
    
    // Apply other filters
    if (filters.type && tile.type !== filters.type) return false;
    if (filters.color && tile.color !== filters.color) return false;
    if (filters.material && tile.material !== filters.material) return false;
    if (filters.finish && tile.finish !== filters.finish) return false;
    if (filters.collection && tile.collection !== filters.collection) return false;
    
    return true;
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // View tile details
  const viewTileDetails = (tile: any) => {
    setSelectedTile(tile);
  };

  // Close tile details
  const closeTileDetails = () => {
    setSelectedTile(null);
  };

  return (
    <Layout title="Knowledge Base">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Knowledge Base</h1>
        <p className="text-gray-600">Search and browse the tile information database.</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-12 py-2 sm:text-sm border-gray-300 rounded-md"
                placeholder="Search by name, tag, or material..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => setViewMode('grid')}
              >
                <ViewGridIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => setViewMode('list')}
              >
                <ViewListIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${showFilters ? 'bg-blue-50 text-blue-600' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  id="type"
                  name="type"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={filters.type}
                  onChange={handleFilterChange}
                >
                  <option value="">All Types</option>
                  {filterOptions.type.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700">Color</label>
                <select
                  id="color"
                  name="color"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={filters.color}
                  onChange={handleFilterChange}
                >
                  <option value="">All Colors</option>
                  {filterOptions.color.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="material" className="block text-sm font-medium text-gray-700">Material</label>
                <select
                  id="material"
                  name="material"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={filters.material}
                  onChange={handleFilterChange}
                >
                  <option value="">All Materials</option>
                  {filterOptions.material.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="finish" className="block text-sm font-medium text-gray-700">Finish</label>
                <select
                  id="finish"
                  name="finish"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={filters.finish}
                  onChange={handleFilterChange}
                >
                  <option value="">All Finishes</option>
                  {filterOptions.finish.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="collection" className="block text-sm font-medium text-gray-700">Collection</label>
                <select
                  id="collection"
                  name="collection"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={filters.collection}
                  onChange={handleFilterChange}
                >
                  <option value="">All Collections</option>
                  {filterOptions.collection.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-5 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Showing {filteredTiles.length} of {tiles.length} tiles
        </p>
      </div>

      {/* Tile Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTiles.map(tile => (
            <div 
              key={tile.id} 
              className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-300 cursor-pointer"
              onClick={() => viewTileDetails(tile)}
            >
              <div className="h-48 bg-gray-200 relative">
                <img 
                  src={tile.image} 
                  alt={tile.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <h3 className="text-white font-medium truncate">{tile.name}</h3>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm text-gray-500">{tile.type}</p>
                    <p className="text-sm text-gray-500">{tile.dimensions}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    v{tile.version}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {tile.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {tag}
                    </span>
                  ))}
                  {tile.tags.length > 3 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      +{tile.tags.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tile List View */}
      {viewMode === 'list' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredTiles.map(tile => (
              <li key={tile.id}>
                <div 
                  className="px-4 py-4 flex items-center hover:bg-gray-50 cursor-pointer"
                  onClick={() => viewTileDetails(tile)}
                >
                  <div className="flex-shrink-0 h-16 w-16 bg-gray-200 rounded overflow-hidden">
                    <img 
                      src={tile.image} 
                      alt={tile.name} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{tile.name}</h3>
                        <p className="text-sm text-gray-500">{tile.type} • {tile.dimensions} • {tile.finish}</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          v{tile.version}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Updated: {formatDate(tile.lastUpdated)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tile.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty State */}
      {filteredTiles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <PhotographIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tiles found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
          <div className="mt-6">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={resetFilters}
            >
              Reset all filters
            </button>
          </div>
        </div>
      )}

      {/* Tile Detail Modal */}
      {selectedTile && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={closeTileDetails}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">{selectedTile.name}</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Version {selectedTile.version}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="bg-gray-200 rounded-lg overflow-hidden">
                          <img 
                            src={selectedTile.image} 
                            alt={selectedTile.name} 
                            className="w-full h-auto object-cover"
                          />
                        </div>
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <TagIcon className="h-4 w-4 mr-1" />
                            Tags
                          </h4>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedTile.tags.map(tag => (
                              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-4">Specifications</h4>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Type</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.type}</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Material</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.material}</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Color</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.color}</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.dimensions}</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Finish</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.finish}</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Origin</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.origin}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-sm font-medium text-gray-500 flex items-center">
                              <CollectionIcon className="h-4 w-4 mr-1" />
                              Collection
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.collection}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-sm font-medium text-gray-500 flex items-center">
                              <DocumentTextIcon className="h-4 w-4 mr-1" />
                              Catalog
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedTile.catalogName} ({selectedTile.catalogId})</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Date Added</dt>
                            <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedTile.dateAdded)}</dd>
                          </div>
                          <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                            <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedTile.lastUpdated)}</dd>
                          </div>
                        </dl>

                        <div className="mt-6 flex space-x-3">
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Find Similar
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            View History
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeTileDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}