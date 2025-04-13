/**
 * Materials Page
 * 
 * Displays a list of materials with the ability to add them to MoodBoards
 */

import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import MaterialCard from '../components/materials/MaterialCard';
import { ClientMaterial } from '../types/material';

// Mock material data - in a real app, this would come from an API
const mockMaterials: ClientMaterial[] = [
  {
    id: '1',
    name: 'Carrara Marble',
    type: 'Natural Stone',
    manufacturer: 'LuxStone',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    properties: {
      color: 'White',
      finish: 'Polished',
      size: '60x60 cm',
      thickness: '10mm'
    }
  },
  {
    id: '2',
    name: 'Oak Hardwood',
    type: 'Wood',
    manufacturer: 'WoodCraft',
    thumbnailUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    properties: {
      color: 'Natural',
      finish: 'Matte',
      size: '120x20 cm',
      thickness: '15mm'
    }
  },
  {
    id: '3',
    name: 'Porcelain Tile',
    type: 'Ceramic',
    manufacturer: 'TileWorks',
    thumbnailUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    properties: {
      color: 'Beige',
      finish: 'Textured',
      size: '30x30 cm',
      thickness: '8mm'
    }
  },
  {
    id: '4',
    name: 'Concrete Slab',
    type: 'Concrete',
    manufacturer: 'ConcreteWorks',
    thumbnailUrl: 'https://images.unsplash.com/photo-1617791160505-6f00504e3519?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    properties: {
      color: 'Gray',
      finish: 'Rough',
      size: '100x100 cm',
      thickness: '20mm'
    }
  },
  {
    id: '5',
    name: 'Granite Countertop',
    type: 'Natural Stone',
    manufacturer: 'StoneEdge',
    thumbnailUrl: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    properties: {
      color: 'Black',
      finish: 'Polished',
      size: 'Custom',
      thickness: '30mm'
    }
  },
  {
    id: '6',
    name: 'Vinyl Flooring',
    type: 'Synthetic',
    manufacturer: 'FloorMaster',
    thumbnailUrl: 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    properties: {
      color: 'Wood Look',
      finish: 'Textured',
      size: '120x20 cm',
      thickness: '5mm'
    }
  }
];

const MaterialsPage: React.FC = () => {
  const [materials, setMaterials] = useState<ClientMaterial[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  
  // Fetch materials on component mount
  useEffect(() => {
    // In a real app, this would be an API call
    const fetchMaterials = async () => {
      try {
        setIsLoading(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setMaterials(mockMaterials);
      } catch (error) {
        console.error('Error fetching materials:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMaterials();
  }, []);
  
  // Get unique material types for filter
  const materialTypes = Array.from(new Set(mockMaterials.map(m => m.type)));
  
  // Filter materials based on search term and selected type
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = searchTerm === '' || 
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === '' || material.type === selectedType;
    
    return matchesSearch && matchesType;
  });
  
  return (
    <Layout>
      <SEO title="Materials" description="Browse our collection of materials" />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4 md:mb-0">Materials</h1>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials..."
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              {materialTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Materials Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No materials found</h3>
            <p className="text-gray-600">
              Try adjusting your search or filter to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMaterials.map(material => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MaterialsPage;
