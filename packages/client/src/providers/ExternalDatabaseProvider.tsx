import React from 'react';

// External database source
export interface ExternalDatabase {
  id: string;
  name: string;
  description: string;
  url: string;
  apiKey?: string;
  logo?: string;
  categories: string[];
  connectedAt?: string;
  lastSyncAt?: string;
  isConnected: boolean;
  isPremium: boolean;
  materialCount: number;
}

// External material interface
export interface ExternalMaterial {
  id: string;
  externalId: string;
  databaseId: string;
  name: string;
  manufacturer: string;
  category: string;
  description?: string;
  imageUrl?: string;
  properties: Record<string, any>;
  dateAdded: string;
  dateUpdated: string;
  isSynced: boolean;
}

// Search results from external database
export interface ExternalSearchResults {
  materials: ExternalMaterial[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// External database search params
export interface ExternalSearchParams {
  query: string;
  category?: string;
  manufacturer?: string;
  properties?: Record<string, any>;
  page: number;
  pageSize: number;
}

// External database context
interface ExternalDatabaseContextValue {
  databases: ExternalDatabase[];
  connectedDatabases: ExternalDatabase[];
  isLoading: boolean;
  currentSearchResults: ExternalSearchResults | null;
  // Database actions
  connectToDatabase: (databaseId: string, apiKey?: string) => Promise<boolean>;
  disconnectFromDatabase: (databaseId: string) => Promise<boolean>;
  getAvailableDatabases: () => Promise<ExternalDatabase[]>;
  refreshDatabaseConnection: (databaseId: string) => Promise<boolean>;
  // Search actions
  searchExternalDatabase: (
    databaseId: string,
    params: ExternalSearchParams
  ) => Promise<ExternalSearchResults>;
  searchAllDatabases: (
    params: ExternalSearchParams
  ) => Promise<Record<string, ExternalSearchResults>>;
  // Import actions
  importMaterial: (material: ExternalMaterial) => Promise<string>;
  importMaterials: (materials: ExternalMaterial[]) => Promise<string[]>;
  syncMaterial: (materialId: string) => Promise<boolean>;
  // Utility methods
  getDatabaseById: (databaseId: string) => ExternalDatabase | undefined;
  getMaterialFromExternal: (databaseId: string, externalId: string) => Promise<ExternalMaterial | null>;
}

// Sample external databases
const sampleDatabases: ExternalDatabase[] = [
  {
    id: 'matdb-1',
    name: 'MaterialDB',
    description: 'Comprehensive database of building and construction materials',
    url: 'https://materialdb.example.com',
    categories: ['Construction', 'Interior', 'Exterior', 'Flooring', 'Tiles'],
    isConnected: false,
    isPremium: false,
    materialCount: 50000,
    logo: 'https://via.placeholder.com/150?text=MaterialDB'
  },
  {
    id: 'archmat-2',
    name: 'ArchMaterials',
    description: 'Architectural materials for professional designers',
    url: 'https://archmat.example.com',
    categories: ['Architectural', 'Premium', 'Designers', 'Sustainable'],
    isConnected: false,
    isPremium: true,
    materialCount: 25000,
    logo: 'https://via.placeholder.com/150?text=ArchMat'
  },
  {
    id: 'ecomat-3',
    name: 'EcoMaterials',
    description: 'Sustainable and eco-friendly building materials database',
    url: 'https://ecomat.example.com',
    categories: ['Sustainable', 'Eco-friendly', 'Recycled', 'Green Building'],
    isConnected: false,
    isPremium: false,
    materialCount: 15000,
    logo: 'https://via.placeholder.com/150?text=EcoMat'
  }
];

// Create context
// @ts-ignore - Workaround for TypeScript issue
const ExternalDatabaseContext = React.createContext<ExternalDatabaseContextValue>({
  databases: [],
  connectedDatabases: [],
  isLoading: false,
  currentSearchResults: null,
  connectToDatabase: async () => false,
  disconnectFromDatabase: async () => false,
  getAvailableDatabases: async () => [],
  refreshDatabaseConnection: async () => false,
  searchExternalDatabase: async () => ({ 
    materials: [], 
    totalCount: 0, 
    page: 1, 
    pageSize: 10,
    hasMore: false 
  }),
  searchAllDatabases: async () => ({}),
  importMaterial: async () => '',
  importMaterials: async () => [],
  syncMaterial: async () => false,
  getDatabaseById: () => undefined,
  getMaterialFromExternal: async () => null,
});

// Provider props
interface ExternalDatabaseProviderProps {
  children: React.ReactNode;
}

/**
 * ExternalDatabaseProvider Component
 * 
 * Provides functionality for integrating with external material databases:
 * - Connect to various material databases
 * - Search across multiple databases
 * - Import materials from external sources
 * - Track and manage database connections
 */
export const ExternalDatabaseProvider: React.FC<ExternalDatabaseProviderProps> = ({ children }) => {
  // State
  const [databases, setDatabases] = React.useState<ExternalDatabase[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [currentSearchResults, setCurrentSearchResults] = React.useState<ExternalSearchResults | null>(null);

  // Derived state
  const connectedDatabases = React.useMemo(() => {
    return databases.filter(db => db.isConnected);
  }, [databases]);

  // Load databases on mount
  React.useEffect(() => {
    const loadDatabases = async () => {
      try {
        setIsLoading(true);
        
        // In a real app, this would be an API call
        // For demo, we'll load from localStorage or use samples
        const saved = localStorage.getItem('externalDatabases');
        if (saved) {
          setDatabases(JSON.parse(saved));
        } else {
          // Use sample data for demo
          setDatabases(sampleDatabases);
        }
      } catch (error) {
        console.error('Failed to load databases:', error);
        setDatabases(sampleDatabases);
      } finally {
        setIsLoading(false);
      }
    };

    loadDatabases();
  }, []);

  // Save databases to localStorage when they change
  React.useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('externalDatabases', JSON.stringify(databases));
    }
  }, [databases, isLoading]);

  // Get database by ID
  const getDatabaseById = (databaseId: string): ExternalDatabase | undefined => {
    return databases.find(db => db.id === databaseId);
  };

  // Connect to a database
  const connectToDatabase = async (databaseId: string, apiKey?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // In a real app, this would make an API call to authenticate with the external database
      // For demo, we'll simulate a connection after a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const db = getDatabaseById(databaseId);
      if (!db) {
        throw new Error(`Database ${databaseId} not found`);
      }
      
      // Update database connection status
      const updatedDb: ExternalDatabase = {
        ...db,
        isConnected: true,
        apiKey,
        connectedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
      };
      
      setDatabases(prev => 
        prev.map(d => d.id === databaseId ? updatedDb : d)
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to connect to database ${databaseId}:`, error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect from a database
  const disconnectFromDatabase = async (databaseId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // In a real app, this would make an API call to disconnect
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update database connection status
      setDatabases(prev => 
        prev.map(db => 
          db.id === databaseId 
            ? { ...db, isConnected: false, apiKey: undefined } 
            : db
        )
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to disconnect from database ${databaseId}:`, error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get available databases
  const getAvailableDatabases = async (): Promise<ExternalDatabase[]> => {
    try {
      setIsLoading(true);
      
      // In a real app, this would be an API call to get available databases
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return current databases
      return databases;
    } catch (error) {
      console.error('Failed to get available databases:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh database connection
  const refreshDatabaseConnection = async (databaseId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const db = getDatabaseById(databaseId);
      if (!db || !db.isConnected) {
        return false;
      }
      
      // In a real app, this would refresh the connection
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Update last sync time
      setDatabases(prev => 
        prev.map(d => 
          d.id === databaseId
            ? { ...d, lastSyncAt: new Date().toISOString() }
            : d
        )
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to refresh connection to database ${databaseId}:`, error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Generate mock materials
  const generateMockMaterials = (
    databaseId: string, 
    count: number, 
    query: string,
    category?: string
  ): ExternalMaterial[] => {
    const db = getDatabaseById(databaseId);
    if (!db) return [];
    
    // Use query and categories to influence the results
    const materials: ExternalMaterial[] = [];
    const categories = category ? [category] : db.categories;
    
    for (let i = 0; i < count; i++) {
      // Generate a name that includes the query if provided
      const nameSuffix = query ? ` (${query})` : '';
      const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
      
      materials.push({
        id: `local-${databaseId}-${i}`,
        externalId: `ext-${databaseId}-${i}`,
        databaseId,
        name: `${db.name} Material ${i + 1}${nameSuffix}`,
        manufacturer: `Manufacturer ${(i % 5) + 1}`,
        category: selectedCategory || 'Unknown',
        description: `A ${selectedCategory ? selectedCategory.toLowerCase() : 'unknown'} material from ${db.name}.`,
        imageUrl: `https://via.placeholder.com/300?text=${encodeURIComponent(db.name + i)}`,
        properties: {
          hardness: Math.floor(Math.random() * 10),
          waterResistant: Math.random() > 0.5,
          sustainable: db.id === 'ecomat-3' ? true : Math.random() > 0.7,
        },
        dateAdded: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        dateUpdated: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
        isSynced: false,
      });
    }
    
    return materials;
  };

  // Search an external database
  const searchExternalDatabase = async (
    databaseId: string,
    params: ExternalSearchParams
  ): Promise<ExternalSearchResults> => {
    try {
      setIsLoading(true);
      
      const db = getDatabaseById(databaseId);
      if (!db) {
        throw new Error(`Database ${databaseId} not found`);
      }
      
      if (!db.isConnected) {
        throw new Error(`Database ${databaseId} is not connected`);
      }
      
      // In a real app, this would make an API call to the external database
      // For demo, we'll generate mock results after a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate mock results
      const totalCount = Math.floor(Math.random() * 100) + 20;
      const pageSize = params.pageSize || 10;
      const page = params.page || 1;
      const offset = (page - 1) * pageSize;
      const resultCount = Math.min(pageSize, totalCount - offset);
      
      const materials = generateMockMaterials(
        databaseId, 
        resultCount > 0 ? resultCount : 0, 
        params.query,
        params.category
      );
      
      const results: ExternalSearchResults = {
        materials,
        totalCount,
        page,
        pageSize,
        hasMore: offset + pageSize < totalCount,
      };
      
      setCurrentSearchResults(results);
      return results;
    } catch (error) {
      console.error(`Failed to search database ${databaseId}:`, error);
      const emptyResults: ExternalSearchResults = {
        materials: [],
        totalCount: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 10,
        hasMore: false,
      };
      setCurrentSearchResults(emptyResults);
      return emptyResults;
    } finally {
      setIsLoading(false);
    }
  };

  // Search all connected databases
  const searchAllDatabases = async (
    params: ExternalSearchParams
  ): Promise<Record<string, ExternalSearchResults>> => {
    try {
      setIsLoading(true);
      
      if (connectedDatabases.length === 0) {
        return {};
      }
      
      // In a real app, this would search multiple databases in parallel
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results: Record<string, ExternalSearchResults> = {};
      
      // Generate mock results for each database
      connectedDatabases.forEach((db: ExternalDatabase) => {
        const totalCount = Math.floor(Math.random() * 50) + 5;
        const pageSize = params.pageSize || 10;
        const page = params.page || 1;
        const offset = (page - 1) * pageSize;
        const resultCount = Math.min(pageSize, totalCount - offset);
        
        results[db.id] = {
          materials: generateMockMaterials(
            db.id, 
            resultCount > 0 ? resultCount : 0, 
            params.query,
            params.category
          ),
          totalCount,
          page,
          pageSize,
          hasMore: offset + pageSize < totalCount,
        };
      });
      
      return results;
    } catch (error) {
      console.error('Failed to search all databases:', error);
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  // Import a material
  const importMaterial = async (material: ExternalMaterial): Promise<string> => {
    try {
      setIsLoading(true);
      
      // In a real app, this would make an API call to import the material
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a local ID for the imported material
      const localId = `local-${material.databaseId}-${Date.now()}`;
      
      // In a real app, we would save the imported material to the local database
      console.log(`Imported material: ${material.name} (${localId})`);
      
      return localId;
    } catch (error) {
      console.error(`Failed to import material ${material.name}:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Import multiple materials
  const importMaterials = async (materials: ExternalMaterial[]): Promise<string[]> => {
    try {
      setIsLoading(true);
      
      // In a real app, this would make an API call to import multiple materials
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate local IDs for the imported materials
      const localIds = materials.map((material) => 
        `local-${material.databaseId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      );
      
      // In a real app, we would save the imported materials to the local database
      console.log(`Imported ${materials.length} materials`);
      
      return localIds;
    } catch (error) {
      console.error(`Failed to import ${materials.length} materials:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sync a material
  const syncMaterial = async (materialId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // In a real app, this would make an API call to sync the material
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // In a real app, we would update the local material with the latest data from the external database
      console.log(`Synced material: ${materialId}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to sync material ${materialId}:`, error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get a material from an external database
  const getMaterialFromExternal = async (
    databaseId: string, 
    externalId: string
  ): Promise<ExternalMaterial | null> => {
    try {
      setIsLoading(true);
      
      const db = getDatabaseById(databaseId);
      if (!db || !db.isConnected) {
        return null;
      }
      
      // In a real app, this would make an API call to get the material
      // For demo, we'll simulate after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a mock material
      const material: ExternalMaterial = {
        id: `local-${databaseId}-${externalId}`,
        externalId,
        databaseId,
        name: `${db.name} Material ${externalId}`,
        manufacturer: `Manufacturer ${Math.floor(Math.random() * 5) + 1}`,
        category: db.categories.length > 0 
          ? db.categories[Math.floor(Math.random() * db.categories.length)] 
          : 'General',
        description: `A material from ${db.name} database.`,
        imageUrl: `https://via.placeholder.com/300?text=${encodeURIComponent(db.name)}`,
        properties: {
          hardness: Math.floor(Math.random() * 10),
          waterResistant: Math.random() > 0.5,
          sustainable: db.id === 'ecomat-3' ? true : Math.random() > 0.7,
        },
        dateAdded: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        dateUpdated: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
        isSynced: false,
      };
      
      return material;
    } catch (error) {
      console.error(`Failed to get material ${externalId} from database ${databaseId}:`, error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ExternalDatabaseContext.Provider
      value={{
        databases,
        connectedDatabases,
        isLoading,
        currentSearchResults,
        connectToDatabase,
        disconnectFromDatabase,
        getAvailableDatabases,
        refreshDatabaseConnection,
        searchExternalDatabase,
        searchAllDatabases,
        importMaterial,
        importMaterials,
        syncMaterial,
        getDatabaseById,
        getMaterialFromExternal,
      }}
    >
      {children}
    </ExternalDatabaseContext.Provider>
  );
};

// Custom hook for using the external database context
// @ts-ignore - Workaround for TypeScript issue
export const useExternalDatabase = (): ExternalDatabaseContextValue => React.useContext(ExternalDatabaseContext);

export default ExternalDatabaseProvider;