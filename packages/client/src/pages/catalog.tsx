import React, { useState, useEffect } from 'react';
import { navigate } from 'gatsby';
import Layout from '../components/Layout';
import SEO from '../components/SEO';

// Material types for the catalog
interface MaterialProperty {
  name: string;
  value: string;
}

interface Material {
  id: string;
  name: string;
  description: string;
  category: string;
  manufacturer: string;
  imageUrl: string;
  properties: Record<string, string>;
  createdAt: string;
}

interface Filter {
  categories: string[];
  manufacturers: string[];
  properties: Record<string, string[]>;
  search: string;
}

/**
 * Catalog Page
 * 
 * Displays a browsable catalog of materials with filtering options
 */
const CatalogPage: React.FC = () => {
  // State for materials and loading
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<Filter>({
    categories: [],
    manufacturers: [],
    properties: {},
    search: ''
  });
  
  // Available filter options from data
  const [availableFilters, setAvailableFilters] = useState({
    categories: new Set<string>(),
    manufacturers: new Set<string>(),
    properties: {} as Record<string, Set<string>>
  });
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [comparisonList, setComparisonList] = useState<string[]>([]);
  
  // Fetch materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setIsLoading(true);
        
        // In a real app, this would be an API call
        // Mocked data for now
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockMaterials: Material[] = [
          {
            id: '1',
            name: 'Carrara White Marble',
            description: 'Classic Italian white marble with gray veining',
            category: 'Tiles',
            manufacturer: 'LuxStone',
            imageUrl: 'https://example.com/marble1.jpg',
            properties: {
              material: 'Natural Stone',
              finish: 'Polished',
              color: 'White/Gray',
              size: '12" x 24"',
              thickness: '10mm'
            },
            createdAt: '2024-01-15'
          },
          {
            id: '2',
            name: 'Walnut Hardwood',
            description: 'Premium walnut hardwood flooring',
            category: 'Wood',
            manufacturer: 'TimberlandCo',
            imageUrl: 'https://example.com/wood1.jpg',
            properties: {
              material: 'Hardwood',
              finish: 'Matte',
              color: 'Brown',
              size: '5" width',
              thickness: '12mm'
            },
            createdAt: '2024-02-10'
          },
          {
            id: '3',
            name: 'Slate Grey Porcelain',
            description: 'Contemporary porcelain tile with slate appearance',
            category: 'Tiles',
            manufacturer: 'TileWorks',
            imageUrl: 'https://example.com/porcelain1.jpg',
            properties: {
              material: 'Porcelain',
              finish: 'Textured',
              color: 'Grey',
              size: '24" x 24"',
              thickness: '8mm'
            },
            createdAt: '2024-01-05'
          },
          {
            id: '4',
            name: 'Maple Engineered Wood',
            description: 'Engineered maple wood flooring',
            category: 'Wood',
            manufacturer: 'TimberlandCo',
            imageUrl: 'https://example.com/wood2.jpg',
            properties: {
              material: 'Engineered Wood',
              finish: 'Satin',
              color: 'Light Brown',
              size: '6" width',
              thickness: '14mm'
            },
            createdAt: '2024-03-01'
          },
          {
            id: '5',
            name: 'Travertine Beige',
            description: 'Natural travertine stone with beige tones',
            category: 'Tiles',
            manufacturer: 'LuxStone',
            imageUrl: 'https://example.com/travertine1.jpg',
            properties: {
              material: 'Natural Stone',
              finish: 'Honed',
              color: 'Beige',
              size: '16" x 16"',
              thickness: '12mm'
            },
            createdAt: '2024-01-20'
          },
          {
            id: '6',
            name: 'White Oak Laminate',
            description: 'Durable white oak laminate flooring',
            category: 'Laminate',
            manufacturer: 'FloorMaster',
            imageUrl: 'https://example.com/laminate1.jpg',
            properties: {
              material: 'Laminate',
              finish: 'Matte',
              color: 'Light Oak',
              size: '7" width',
              thickness: '8mm'
            },
            createdAt: '2024-02-15'
          },
          {
            id: '7',
            name: 'Blue Pearl Granite',
            description: 'Elegant blue pearl granite for countertops',
            category: 'Stone',
            manufacturer: 'StoneCrafters',
            imageUrl: 'https://example.com/granite1.jpg',
            properties: {
              material: 'Granite',
              finish: 'Polished',
              color: 'Blue/Grey',
              size: 'Slab',
              thickness: '30mm'
            },
            createdAt: '2024-01-25'
          },
          {
            id: '8',
            name: 'Luxury Vinyl Plank',
            description: 'Waterproof luxury vinyl flooring with wood appearance',
            category: 'Vinyl',
            manufacturer: 'FloorMaster',
            imageUrl: 'https://example.com/vinyl1.jpg',
            properties: {
              material: 'Vinyl',
              finish: 'Embossed',
              color: 'Medium Oak',
              size: '7" x 48"',
              thickness: '5mm'
            },
            createdAt: '2024-03-05'
          }
        ];
        
        setMaterials(mockMaterials);
        setFilteredMaterials(mockMaterials);
        
        // Extract available filters
        const categories = new Set<string>();
        const manufacturers = new Set<string>();
        const propertyTypes = {} as Record<string, Set<string>>;
        
        mockMaterials.forEach(material => {
          categories.add(material.category);
          manufacturers.add(material.manufacturer);
          
          // Extract property types and values
          Object.entries(material.properties).forEach(([key, value]) => {
            if (!propertyTypes[key]) {
              propertyTypes[key] = new Set<string>();
            }
            propertyTypes[key].add(value);
          });
        });
        
        setAvailableFilters({
          categories,
          manufacturers,
          properties: propertyTypes
        });
        
      } catch (err) {
        setError('Failed to load materials. Please try again later.');
        console.error('Error loading materials:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMaterials();
  }, []);
  
  // Apply filters whenever they change
  useEffect(() => {
    if (materials.length === 0) return;
    
    const applyFilters = () => {
      let result = [...materials];
      
      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(material => 
          material.name.toLowerCase().includes(searchLower) ||
          material.description.toLowerCase().includes(searchLower) ||
          material.manufacturer.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply category filter
      if (filters.categories.length > 0) {
        result = result.filter(material => 
          filters.categories.includes(material.category)
        );
      }
      
      // Apply manufacturer filter
      if (filters.manufacturers.length > 0) {
        result = result.filter(material => 
          filters.manufacturers.includes(material.manufacturer)
        );
      }
      
      // Apply property filters
      Object.entries(filters.properties).forEach(([propName, propValues]) => {
        if (propValues.length > 0) {
          result = result.filter(material => 
            material.properties[propName] && 
            propValues.includes(material.properties[propName])
          );
        }
      });
      
      setFilteredMaterials(result);
    };
    
    applyFilters();
  }, [filters, materials]);
  
  // Handle checkbox filter change
  const handleFilterChange = (type: 'categories' | 'manufacturers', value: string) => {
    setFilters(prev => {
      const currentValues = prev[type];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return {
        ...prev,
        [type]: newValues
      };
    });
  };
  
  // Handle property filter change
  const handlePropertyFilterChange = (property: string, value: string) => {
    setFilters(prev => {
      const currentValues = prev.properties[property] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return {
        ...prev,
        properties: {
          ...prev.properties,
          [property]: newValues
        }
      };
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({
      ...prev,
      search: e.target.value
    }));
  };
  
  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      categories: [],
      manufacturers: [],
      properties: {},
      search: ''
    });
  };
  
  // View material details
  const handleViewMaterial = (material: Material) => {
    setSelectedMaterial(material);
    // In a real app, this might navigate to a detail page
    // navigate(`/catalog/${material.id}`);
  };
  
  // Add/remove from comparison
  const handleToggleComparison = (materialId: string) => {
    setComparisonList(prev => 
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };
  
  // Go to comparison page
  const handleViewComparison = () => {
    // In a real app, this would navigate to a comparison page with the selected items
    navigate(`/comparison?ids=${comparisonList.join(',')}`);
  };
  
  // Close material detail modal
  const handleCloseModal = () => {
    setSelectedMaterial(null);
  };

  return (
    <Layout>
      <SEO title="Material Catalog" />
      
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Material Catalog</h1>
            <p className="text-gray-600 mt-1">
              Browse our collection of {materials.length} materials
            </p>
          </div>
          
          {/* Comparison button */}
          {comparisonList.length > 0 && (
            <button
              onClick={handleViewComparison}
              className="mt-4 md:mt-0 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Compare {comparisonList.length} {comparisonList.length === 1 ? 'Material' : 'Materials'}
            </button>
          )}
        </div>
        
        {/* Search bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search materials by name, description, or manufacturer..."
            value={filters.search}
            onChange={handleSearchChange}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* Main content with filter sidebar and material grid */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-md p-4 mb-4 lg:sticky lg:top-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Filters</h2>
                <button 
                  onClick={handleResetFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden text-gray-500"
                >
                  {showFilters ? 'Hide' : 'Show'}
                </button>
              </div>
              
              <div className={`${showFilters ? 'block' : 'hidden lg:block'} space-y-6`}>
                {/* Category filter */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Category</h3>
                  <div className="space-y-2">
                    {Array.from(availableFilters.categories).map(category => (
                      <div key={category} className="flex items-center">
                        <input
                          id={`category-${category}`}
                          type="checkbox"
                          checked={filters.categories.includes(category)}
                          onChange={() => handleFilterChange('categories', category)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={`category-${category}`} className="ml-2 text-sm text-gray-700">
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Manufacturer filter */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Manufacturer</h3>
                  <div className="space-y-2">
                    {Array.from(availableFilters.manufacturers).map(manufacturer => (
                      <div key={manufacturer} className="flex items-center">
                        <input
                          id={`manufacturer-${manufacturer}`}
                          type="checkbox"
                          checked={filters.manufacturers.includes(manufacturer)}
                          onChange={() => handleFilterChange('manufacturers', manufacturer)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={`manufacturer-${manufacturer}`} className="ml-2 text-sm text-gray-700">
                          {manufacturer}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Property filters */}
                {Object.entries(availableFilters.properties).map(([property, values]) => (
                  <div key={property} className="border-t border-gray-200 pt-4">
                    <h3 className="font-medium text-gray-900 mb-2">{property}</h3>
                    <div className="space-y-2">
                      {Array.from(values).map(value => (
                        <div key={`${property}-${value}`} className="flex items-center">
                          <input
                            id={`${property}-${value}`}
                            type="checkbox"
                            checked={(filters.properties[property] || []).includes(value)}
                            onChange={() => handlePropertyFilterChange(property, value)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`${property}-${value}`} className="ml-2 text-sm text-gray-700">
                            {value}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Material grid */}
          <div className="flex-1">
            {isLoading ? (
              <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-600">Loading materials...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{error}</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20h.01M12 4a8 8 0 100 16 8 8 0 000-16z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No materials found</h3>
                <p className="text-gray-500">Try adjusting your filters or search terms</p>
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMaterials.map((material) => (
                  <div key={material.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Material image - using placeholder for mock */}
                    <div className="h-48 bg-gray-200 relative">
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      
                      {/* Comparison checkbox */}
                      <div className="absolute top-2 right-2">
                        <input
                          type="checkbox"
                          id={`compare-${material.id}`}
                          checked={comparisonList.includes(material.id)}
                          onChange={() => handleToggleComparison(material.id)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`compare-${material.id}`}
                          className={`flex items-center justify-center h-8 w-8 rounded-full ${
                            comparisonList.includes(material.id) 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white text-gray-600 border border-gray-300'
                          }`}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </label>
                      </div>
                    </div>
                    
                    {/* Material info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{material.name}</h2>
                          <p className="text-sm text-gray-600 mb-2">{material.manufacturer}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                          {material.category}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 mb-4 line-clamp-2">{material.description}</p>
                      
                      {/* Material properties preview */}
                      <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-gray-600">
                        {Object.entries(material.properties).slice(0, 4).map(([key, value]) => (
                          <div key={key} className="flex items-baseline">
                            <span className="text-gray-500 mr-1">{key}:</span>
                            <span className="font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* View details button */}
                      <button
                        onClick={() => handleViewMaterial(material)}
                        className="w-full mt-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Material detail modal */}
      {selectedMaterial && (
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
                      {selectedMaterial.name}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 mb-4">
                        {selectedMaterial.manufacturer} • {selectedMaterial.category}
                      </p>
                      
                      <p className="text-sm text-gray-700 mb-4">
                        {selectedMaterial.description}
                      </p>
                      
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h4 className="font-medium text-sm mb-2">Properties</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(selectedMaterial.properties).map(([key, value]) => (
                            <div key={key} className="flex items-baseline text-sm">
                              <span className="text-gray-500 mr-2">{key}:</span>
                              <span className="font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => handleToggleComparison(selectedMaterial.id)}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium sm:ml-3 sm:w-auto sm:text-sm ${
                    comparisonList.includes(selectedMaterial.id)
                      ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {comparisonList.includes(selectedMaterial.id) 
                    ? 'Remove from Comparison' 
                    : 'Add to Comparison'}
                </button>
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
  );
};

export default CatalogPage;