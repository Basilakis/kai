import React from 'react';
import externalDatabaseService, {
  ExternalDatabase,
  ExternalMaterial,
  ExternalSearchParams,
  ExternalSearchResults
} from '../services/externalDatabaseService';

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

// Create context
// @ts-ignore - React.createContext exists at runtime but TypeScript doesn't recognize it
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
  // @ts-ignore - React.useMemo exists at runtime but TypeScript doesn't recognize it
  const connectedDatabases = React.useMemo(() => {
    return databases.filter(db => db.isConnected);
  }, [databases]);

  // Load databases on mount
  React.useEffect(() => {
    const loadDatabases = async () => {
      try {
        setIsLoading(true);
        
        // Use real API service instead of mock data
        const availableDatabases = await externalDatabaseService.getAvailableDatabases();
        setDatabases(availableDatabases);
      } catch (error) {
        console.error('Failed to load databases:', error);
        setDatabases([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDatabases();
  }, []);

  // Get database by ID
  const getDatabaseById = (databaseId: string): ExternalDatabase | undefined => {
    return databases.find(db => db.id === databaseId);
  };

  // Connect to a database
  const connectToDatabase = async (databaseId: string, apiKey?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Use real API service
      const result = await externalDatabaseService.connectToDatabase(databaseId, apiKey);
      
      if (result.success) {
        // Refresh databases to get updated connection status
        const updatedDatabases = await externalDatabaseService.getAvailableDatabases();
        setDatabases(updatedDatabases);
        return true;
      }
      
      return false;
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
      
      // Use real API service
      const result = await externalDatabaseService.disconnectFromDatabase(databaseId);
      
      if (result.success) {
        // Refresh databases to get updated connection status
        const updatedDatabases = await externalDatabaseService.getAvailableDatabases();
        setDatabases(updatedDatabases);
        return true;
      }
      
      return false;
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
      
      // Use real API service
      const availableDatabases = await externalDatabaseService.getAvailableDatabases();
      setDatabases(availableDatabases);
      return availableDatabases;
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
      
      // Use real API service
      const result = await externalDatabaseService.refreshDatabaseConnection(databaseId);
      
      if (result.success) {
        // Refresh databases to get updated information
        const updatedDatabases = await externalDatabaseService.getAvailableDatabases();
        setDatabases(updatedDatabases);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to refresh connection to database ${databaseId}:`, error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Search an external database
  const searchExternalDatabase = async (
    databaseId: string,
    params: ExternalSearchParams
  ): Promise<ExternalSearchResults> => {
    try {
      setIsLoading(true);
      
      // Use real API service
      const results = await externalDatabaseService.searchExternalDatabase(databaseId, params);
      
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
      
      // Use real API service
      const results = await externalDatabaseService.searchAllDatabases(params);
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
      
      // Use real API service
      const materialId = await externalDatabaseService.importMaterial(material);
      return materialId;
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
      
      // Use real API service
      const materialIds = await externalDatabaseService.importMaterials(materials);
      return materialIds;
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
      
      // Use real API service
      const success = await externalDatabaseService.syncMaterial(materialId);
      return success;
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
      
      // Use real API service
      const material = await externalDatabaseService.getMaterialFromExternal(databaseId, externalId);
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
// @ts-ignore - React.useContext exists at runtime but TypeScript doesn't recognize it
export const useExternalDatabase = (): ExternalDatabaseContextValue => React.useContext(ExternalDatabaseContext);

export default ExternalDatabaseProvider;