import React from 'react';

// Search filter interface
export interface SearchFilterOptions {
  query: string;
  categories: string[];
  manufacturers: string[];
  materialTypes: string[];
  properties: {
    [key: string]: string | boolean | number | [number, number]; // Property value or range
  };
  dateRange?: {
    from: string;
    to: string;
  };
  confidenceScore?: [number, number]; // Range of confidence scores [min, max]
  sortBy: 'name' | 'date' | 'manufacturer' | 'category' | 'confidenceScore';
  sortDirection: 'asc' | 'desc';
  resultsPerPage: number;
}

// Saved search interface
export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilterOptions;
  createdAt: string;
  lastUsed?: string;
  count?: number; // Number of times used
}

// Default filter options
const defaultFilterOptions: SearchFilterOptions = {
  query: '',
  categories: [],
  manufacturers: [],
  materialTypes: [],
  properties: {},
  sortBy: 'date',
  sortDirection: 'desc',
  resultsPerPage: 20
};

// Available property filters - would typically come from backend
export const availableProperties = {
  hardness: {
    type: 'range',
    min: 0,
    max: 10,
    unit: 'Mohs',
  },
  waterResistant: {
    type: 'boolean',
    label: 'Water Resistant',
  },
  color: {
    type: 'select',
    options: ['White', 'Black', 'Gray', 'Brown', 'Red', 'Blue', 'Green', 'Yellow'],
  },
  thickness: {
    type: 'range',
    min: 0,
    max: 100,
    unit: 'mm',
  },
  weight: {
    type: 'range',
    min: 0,
    max: 5000,
    unit: 'g/m²',
  },
  heatResistant: {
    type: 'boolean',
    label: 'Heat Resistant',
  },
  sustainable: {
    type: 'boolean',
    label: 'Sustainable',
  },
  price: {
    type: 'range',
    min: 0,
    max: 1000,
    unit: '$/m²',
  },
};

// SearchFilter context interface
interface SearchFilterContextValue {
  filters: SearchFilterOptions;
  savedSearches: SavedSearch[];
  isLoading: boolean;
  // Filter actions
  updateFilter: <K extends keyof SearchFilterOptions>(
    key: K,
    value: SearchFilterOptions[K]
  ) => void;
  resetFilters: () => void;
  // Property filters
  addPropertyFilter: (
    property: string,
    value: string | boolean | number | [number, number]
  ) => void;
  removePropertyFilter: (property: string) => void;
  // Saved searches
  saveCurrentSearch: (name: string) => Promise<SavedSearch>;
  loadSavedSearch: (searchId: string) => void;
  deleteSavedSearch: (searchId: string) => Promise<void>;
  // Available options
  availableCategories: string[];
  availableManufacturers: string[];
  availableMaterialTypes: string[];
}

// Create context
// @ts-ignore - Workaround for TypeScript issue
const SearchFilterContext = React.createContext<SearchFilterContextValue>({
  filters: defaultFilterOptions,
  savedSearches: [],
  isLoading: false,
  updateFilter: () => {},
  resetFilters: () => {},
  addPropertyFilter: () => {},
  removePropertyFilter: () => {},
  saveCurrentSearch: async () => ({ id: '', name: '', filters: defaultFilterOptions, createdAt: '' }),
  loadSavedSearch: () => {},
  deleteSavedSearch: async () => {},
  availableCategories: [],
  availableManufacturers: [],
  availableMaterialTypes: [],
});

// Sample data for available options - would come from API in real app
const sampleCategories = [
  'Tiles', 'Flooring', 'Wood', 'Stone', 'Fabric', 'Metal', 'Glass', 'Plastic', 'Composite'
];

const sampleManufacturers = [
  'LuxStone', 'TimberlandCo', 'TileWorks', 'FloorMaster', 'TextilePro', 'GlassWorks', 'MetalCraft'
];

const sampleMaterialTypes = [
  'Marble', 'Granite', 'Oak', 'Pine', 'Ceramic', 'Porcelain', 'Carpet', 'Vinyl', 
  'Laminate', 'Stainless Steel', 'Aluminum', 'Tempered Glass', 'PVC', 'Composite Wood'
];

// Provider props
interface SearchFilterProviderProps {
  children: React.ReactNode;
}

/**
 * SearchFilterProvider Component
 * 
 * Provides functionality for advanced filtering and search:
 * - Text search with query
 * - Category/manufacturer/type filtering
 * - Property-based filtering (e.g., hardness, color)
 * - Range filtering
 * - Sorting options
 * - Saved searches
 */
export const SearchFilterProvider: React.FC<SearchFilterProviderProps> = ({ children }) => {
  // State
  const [filters, setFilters] = React.useState<SearchFilterOptions>(defaultFilterOptions);
  const [savedSearches, setSavedSearches] = React.useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [availableCategories] = React.useState<string[]>(sampleCategories);
  const [availableManufacturers] = React.useState<string[]>(sampleManufacturers);
  const [availableMaterialTypes] = React.useState<string[]>(sampleMaterialTypes);

  // Load saved searches from localStorage on mount
  React.useEffect(() => {
    const loadSavedSearches = () => {
      try {
        const saved = localStorage.getItem('savedSearches');
        if (saved) {
          setSavedSearches(JSON.parse(saved));
        }
        
        // Load last used filters if available
        const lastFilters = localStorage.getItem('lastFilters');
        if (lastFilters) {
          setFilters(JSON.parse(lastFilters));
        }
      } catch (error) {
        console.error('Failed to load saved searches:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedSearches();
  }, []);

  // Save searches to localStorage when they change
  React.useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('savedSearches', JSON.stringify(savedSearches));
    }
  }, [savedSearches, isLoading]);

  // Save current filters to localStorage when they change
  React.useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('lastFilters', JSON.stringify(filters));
    }
  }, [filters, isLoading]);

  // Update a single filter value
  const updateFilter = <K extends keyof SearchFilterOptions>(
    key: K,
    value: SearchFilterOptions[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Reset filters to default
  const resetFilters = () => {
    setFilters(defaultFilterOptions);
  };

  // Add a property filter
  const addPropertyFilter = (
    property: string,
    value: string | boolean | number | [number, number]
  ) => {
    setFilters(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [property]: value
      }
    }));
  };

  // Remove a property filter
  const removePropertyFilter = (property: string) => {
    setFilters(prev => {
      const newProperties = { ...prev.properties };
      delete newProperties[property];
      
      return {
        ...prev,
        properties: newProperties
      };
    });
  };

  // Save current search
  const saveCurrentSearch = async (name: string): Promise<SavedSearch> => {
    const newSearch: SavedSearch = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      filters: { ...filters },
      createdAt: new Date().toISOString(),
      count: 1
    };

    setSavedSearches(prev => [...prev, newSearch]);
    return newSearch;
  };

  // Load a saved search
  const loadSavedSearch = (searchId: string) => {
    const search = savedSearches.find(s => s.id === searchId);
    if (search) {
      // Update the search record with usage information
      const updatedSearch = {
        ...search,
        lastUsed: new Date().toISOString(),
        count: (search.count || 0) + 1
      };

      setSavedSearches(prev => 
        prev.map(s => s.id === searchId ? updatedSearch : s)
      );

      // Apply the filters
      setFilters(search.filters);
    }
  };

  // Delete a saved search
  const deleteSavedSearch = async (searchId: string) => {
    setSavedSearches(prev => prev.filter(s => s.id !== searchId));
  };

  return (
    <SearchFilterContext.Provider
      value={{
        filters,
        savedSearches,
        isLoading,
        updateFilter,
        resetFilters,
        addPropertyFilter,
        removePropertyFilter,
        saveCurrentSearch,
        loadSavedSearch,
        deleteSavedSearch,
        availableCategories,
        availableManufacturers,
        availableMaterialTypes
      }}
    >
      {children}
    </SearchFilterContext.Provider>
  );
};

// Custom hook for using the search filter context
// @ts-ignore - Workaround for TypeScript issue
export const useSearchFilter = (): SearchFilterContextValue => React.useContext(SearchFilterContext);

export default SearchFilterProvider;