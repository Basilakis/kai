import React, { useState, useEffect } from 'react';

interface MaterialCategory {
  category: string;
  count: number;
  icon?: string;
}

interface StatisticsData {
  totalCompanies: number;
  totalMaterials: number;
  materialCategories: MaterialCategory[];
  loading: boolean;
  error: string | null;
}

/**
 * Dashboard Statistics Component
 * 
 * Displays key metrics including total companies, total materials,
 * and material categories in a simple, clean user interface.
 */
const DashboardStats: React.FC = () => {
  // Stats state
  const [stats, setStats] = useState<StatisticsData>({
    totalCompanies: 0,
    totalMaterials: 0,
    materialCategories: [],
    loading: true,
    error: null
  });

  // Fetch statistics from the API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // In a real implementation, this would call the API
        // For now, we'll use mock data
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock statistics data
        setStats({
          totalCompanies: 48,
          totalMaterials: 2547,
          materialCategories: [
            { category: 'Tiles', count: 856, icon: '🧱' },
            { category: 'Wood', count: 643, icon: '🪵' },
            { category: 'Stone', count: 421, icon: '🪨' },
            { category: 'Metals', count: 314, icon: '🔩' },
            { category: 'Fabrics', count: 213, icon: '🧵' },
            { category: 'Plastics', count: 100, icon: '📦' }
          ],
          loading: false,
          error: null
        });
      } catch (err) {
        setStats(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load statistics'
        }));
      }
    };

    fetchStats();
  }, []);

  // Loading state
  if (stats.loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="flex space-x-4">
            <div className="h-20 bg-gray-200 rounded w-1/2"></div>
            <div className="h-20 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-6 bg-gray-200 rounded w-1/4 mt-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (stats.error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error loading statistics</p>
          <p>{stats.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
      
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
          <div className="text-blue-500 text-sm font-medium uppercase tracking-wide mb-1">
            Total Companies Integrated
          </div>
          <div className="text-4xl font-bold text-blue-700">
            {stats.totalCompanies.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
          <div className="text-indigo-500 text-sm font-medium uppercase tracking-wide mb-1">
            Total Materials
          </div>
          <div className="text-4xl font-bold text-indigo-700">
            {stats.totalMaterials.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Categories */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Material Categories</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.materialCategories.map((category) => (
            <div 
              key={category.category} 
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">{category.icon}</span>
                <div>
                  <div className="font-medium">{category.category}</div>
                  <div className="text-gray-500 text-sm">
                    {category.count.toLocaleString()} items
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <a href="/upload" className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors inline-flex items-center justify-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          Upload New Image
        </a>
        
        <a href="/catalog" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center justify-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
          </svg>
          Browse Catalog
        </a>
      </div>
    </div>
  );
};

export default DashboardStats;