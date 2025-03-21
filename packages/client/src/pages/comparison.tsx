import React, { useState, useEffect } from 'react';
import { navigate } from 'gatsby';
import Layout from '../components/Layout';
import SEO from '../components/SEO';

// Material interface - same as in catalog.tsx
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

/**
 * Comparison Page
 * 
 * Allows users to compare multiple materials side by side
 */
const ComparisonPage: React.FC = () => {
  // Selected material IDs (from URL query params)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Materials data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All property keys across all materials
  const [allPropertyKeys, setAllPropertyKeys] = useState<string[]>([]);
  
  // Parse IDs from query string on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ids = params.get('ids')?.split(',') || [];
      setSelectedIds(ids.filter(id => id.trim() !== ''));
    }
  }, []);
  
  // Fetch materials based on IDs
  useEffect(() => {
    const fetchMaterials = async () => {
      if (selectedIds.length === 0) return;
      
      try {
        setIsLoading(true);
        
        // In a real app, this would be an API call to fetch specific materials by ID
        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock materials (same as in catalog.tsx)
        const mockMaterialsData: Material[] = [
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
        
        // Filter to get only the selected materials
        const selectedMaterials = mockMaterialsData.filter(
          material => selectedIds.includes(material.id)
        );
        
        if (selectedMaterials.length === 0) {
          setError('No materials found for comparison');
        } else {
          setMaterials(selectedMaterials);
          
          // Extract all unique property keys from all materials
          const propKeys = new Set<string>();
          selectedMaterials.forEach(material => {
            Object.keys(material.properties).forEach(key => {
              propKeys.add(key);
            });
          });
          
          setAllPropertyKeys(Array.from(propKeys));
        }
      } catch (err) {
        setError('Failed to load comparison data');
        console.error('Error loading comparison data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMaterials();
  }, [selectedIds]);
  
  // Remove a material from comparison
  const handleRemoveMaterial = (materialId: string) => {
    const newSelectedIds = selectedIds.filter(id => id !== materialId);
    setSelectedIds(newSelectedIds);
    
    // Update URL
    if (typeof window !== 'undefined') {
      const url = newSelectedIds.length > 0 
        ? `/comparison?ids=${newSelectedIds.join(',')}`
        : '/catalog';
      
      navigate(url);
    }
    
    // Update materials list
    setMaterials(prev => prev.filter(material => material.id !== materialId));
  };
  
  // Go back to catalog
  const handleBackToCatalog = () => {
    navigate('/catalog');
  };

  return (
    <Layout>
      <SEO title="Material Comparison" />
      
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Material Comparison</h1>
            <p className="text-gray-600 mt-1">
              Comparing {materials.length} materials side by side
            </p>
          </div>
          
          <button
            onClick={handleBackToCatalog}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Catalog
          </button>
        </div>
        
        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-md p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mr-4"></div>
            <p className="text-gray-600">Loading comparison data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
            <div className="mt-4">
              <button 
                onClick={handleBackToCatalog}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Return to Catalog
              </button>
            </div>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20h.01M12 4a8 8 0 100 16 8 8 0 000-16z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No materials selected for comparison</h3>
            <p className="text-gray-500 mb-4">Please select materials from the catalog to compare them</p>
            <button 
              onClick={handleBackToCatalog}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Responsive table for comparison */}
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Table header */}
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40 sticky left-0 bg-gray-50">
                      Property
                    </th>
                    {materials.map(material => (
                      <th key={material.id} className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex flex-col">
                          <div className="h-32 bg-gray-200 rounded-md mb-3 flex items-center justify-center text-gray-400">
                            <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 text-sm">{material.name}</span>
                            <span className="text-xs text-gray-500">{material.manufacturer}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveMaterial(material.id)}
                            className="mt-2 text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                
                {/* Table body */}
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Basic info rows */}
                  <tr>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                      Category
                    </td>
                    {materials.map(material => (
                      <td key={material.id} className="py-4 px-6 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {material.category}
                        </span>
                      </td>
                    ))}
                  </tr>
                  
                  <tr>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                      Description
                    </td>
                    {materials.map(material => (
                      <td key={material.id} className="py-4 px-6 text-sm text-gray-500">
                        {material.description}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Property rows */}
                  {allPropertyKeys.map(propKey => (
                    <tr key={propKey}>
                      <td className="py-4 px-6 text-sm font-medium text-gray-900 sticky left-0 bg-white capitalize">
                        {propKey}
                      </td>
                      {materials.map(material => (
                        <td key={material.id} className="py-4 px-6 text-sm text-gray-500">
                          {material.properties[propKey] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ComparisonPage;