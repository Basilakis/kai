import React from 'react';

// Offline action types
export type OfflineActionType = 
  'addFavorite' | 
  'removeFavorite' | 
  'updateProfile' | 
  'updatePreference' | 
  'addNote' | 
  'saveSearch' | 
  'customAction';

// Offline queue action
export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: string;
  priority: number; // Higher number = higher priority
  executed: boolean;
  error?: string;
}

// Cached material interface
export interface CachedMaterial {
  id: string;
  materialData: any; // The complete material data
  imageUrl?: string;
  cachedAt: string;
  expiresAt?: string;
  lastAccessed: string;
  accessCount: number;
}

// Cached search result
export interface CachedSearch {
  id: string;
  query: string;
  filters: Record<string, any>;
  results: any[];
  cachedAt: string;
  expiresAt?: string;
  lastAccessed: string;
  accessCount: number;
}

// Cache statistics
export interface CacheStats {
  totalCachedMaterials: number;
  totalCachedSearches: number;
  totalQueuedActions: number;
  totalSize: number; // In bytes (estimated)
  oldestCacheItem: string;
  newestCacheItem: string;
  lastSyncTime?: string;
}

// Offline context interface
interface OfflineContextValue {
  isOnline: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  isOfflineEnabled: boolean;
  // Actions queue
  queuedActions: OfflineAction[];
  addOfflineAction: (type: OfflineActionType, payload: any, priority?: number) => void;
  removeOfflineAction: (id: string) => void;
  executeQueuedActions: () => Promise<boolean>;
  clearOfflineQueue: () => void;
  // Cache management
  cacheStats: CacheStats;
  cachedMaterials: Record<string, CachedMaterial>;
  cachedSearches: Record<string, CachedSearch>;
  cacheMaterial: (id: string, data: any, imageUrl?: string) => Promise<void>;
  removeCachedMaterial: (id: string) => Promise<void>;
  getCachedMaterial: (id: string) => CachedMaterial | null;
  cacheSearch: (query: string, filters: Record<string, any>, results: any[]) => Promise<void>;
  getCachedSearch: (query: string, filters: Record<string, any>) => CachedSearch | null;
  clearCache: (olderThan?: number) => Promise<void>; // Clear cache items older than X days
  // Preferences
  setCacheSize: (sizeInMB: number) => void;
  setOfflineEnabled: (enabled: boolean) => void;
  setCacheExpiry: (days: number) => void;
  // Utilities
  syncWithServer: () => Promise<boolean>;
  isResourceCached: (url: string) => boolean;
  getResourceFromCache: (url: string) => Promise<Blob | null>;
  getCacheSize: () => number; // In MB
  estimateCacheUsage: () => Promise<CacheStats>;
}

// Default cache stats
const defaultCacheStats: CacheStats = {
  totalCachedMaterials: 0,
  totalCachedSearches: 0,
  totalQueuedActions: 0,
  totalSize: 0,
  oldestCacheItem: '',
  newestCacheItem: '',
};

// Create context
// @ts-ignore - Workaround for TypeScript issue
const OfflineContext = React.createContext<OfflineContextValue>({
  isOnline: true,
  isInitialized: false,
  isLoading: false,
  isOfflineEnabled: true,
  queuedActions: [],
  addOfflineAction: () => {},
  removeOfflineAction: () => {},
  executeQueuedActions: async () => false,
  clearOfflineQueue: () => {},
  cacheStats: defaultCacheStats,
  cachedMaterials: {},
  cachedSearches: {},
  cacheMaterial: async () => {},
  removeCachedMaterial: async () => {},
  getCachedMaterial: () => null,
  cacheSearch: async () => {},
  getCachedSearch: () => null,
  clearCache: async () => {},
  setCacheSize: () => {},
  setOfflineEnabled: () => {},
  setCacheExpiry: () => {},
  syncWithServer: async () => false,
  isResourceCached: () => false,
  getResourceFromCache: async () => null,
  getCacheSize: () => 0,
  estimateCacheUsage: async () => defaultCacheStats,
});

// Provider props
interface OfflineProviderProps {
  // @ts-ignore - Workaround for TypeScript issue
  children: React.ReactNode;
}

/**
 * OfflineProvider Component
 * 
 * Provides functionality for offline mode:
 * - Network status detection
 * - Caching data for offline use
 * - Queuing offline actions
 * - Synchronization when reconnected
 * - Managing offline preferences
 */
export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  // State
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isOfflineEnabled, setIsOfflineEnabled] = React.useState<boolean>(true);
  const [queuedActions, setQueuedActions] = React.useState<OfflineAction[]>([]);
  const [cachedMaterials, setCachedMaterials] = React.useState<Record<string, CachedMaterial>>({});
  const [cachedSearches, setCachedSearches] = React.useState<Record<string, CachedSearch>>({});
  const [cacheStats, setCacheStats] = React.useState<CacheStats>(defaultCacheStats);
  const [cacheSize, setCacheSize] = React.useState<number>(100); // Default 100MB
  const [cacheExpiry, setCacheExpiry] = React.useState<number>(30); // Default 30 days

  // Initialize and set up online/offline listeners
  React.useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        
        // Set initial online status
        setIsOnline(navigator.onLine);
        
        // Load cached materials from localStorage
        await loadCachedData();
        
        // Load offline queue from localStorage
        await loadOfflineQueue();
        
        // Load preferences from localStorage
        loadPreferences();
        
        // Update cache stats
        await updateCacheStats();
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize offline mode:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Set up online/offline event listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Attempt to sync when coming back online
      if (isInitialized && queuedActions.length > 0) {
        executeQueuedActions();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    init();
    
    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isInitialized]);

  // Save queued actions to localStorage whenever they change
  React.useEffect(() => {
    if (isInitialized && !isLoading) {
      localStorage.setItem('offlineQueue', JSON.stringify(queuedActions));
      updateCacheStats();
    }
  }, [queuedActions, isInitialized, isLoading]);

  // Save cached materials to localStorage whenever they change
  React.useEffect(() => {
    if (isInitialized && !isLoading) {
      localStorage.setItem('cachedMaterials', JSON.stringify(cachedMaterials));
      updateCacheStats();
    }
  }, [cachedMaterials, isInitialized, isLoading]);

  // Save cached searches to localStorage whenever they change
  React.useEffect(() => {
    if (isInitialized && !isLoading) {
      localStorage.setItem('cachedSearches', JSON.stringify(cachedSearches));
      updateCacheStats();
    }
  }, [cachedSearches, isInitialized, isLoading]);

  // Save preferences to localStorage whenever they change
  React.useEffect(() => {
    if (isInitialized && !isLoading) {
      localStorage.setItem('offlinePreferences', JSON.stringify({
        isOfflineEnabled,
        cacheSize,
        cacheExpiry,
      }));
    }
  }, [isOfflineEnabled, cacheSize, cacheExpiry, isInitialized, isLoading]);

  // Load cached data from localStorage
  const loadCachedData = async () => {
    try {
      // Load cached materials
      const savedMaterials = localStorage.getItem('cachedMaterials');
      if (savedMaterials) {
        setCachedMaterials(JSON.parse(savedMaterials));
      }
      
      // Load cached searches
      const savedSearches = localStorage.getItem('cachedSearches');
      if (savedSearches) {
        setCachedSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Failed to load cached data:', error);
    }
  };

  // Load offline queue from localStorage
  const loadOfflineQueue = async () => {
    try {
      const savedQueue = localStorage.getItem('offlineQueue');
      if (savedQueue) {
        setQueuedActions(JSON.parse(savedQueue));
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  };

  // Load preferences from localStorage
  const loadPreferences = () => {
    try {
      const savedPreferences = localStorage.getItem('offlinePreferences');
      if (savedPreferences) {
        const { isOfflineEnabled: enabled, cacheSize: size, cacheExpiry: expiry } = JSON.parse(savedPreferences);
        setIsOfflineEnabled(enabled !== undefined ? enabled : true);
        setCacheSize(size || 100);
        setCacheExpiry(expiry || 30);
      }
    } catch (error) {
      console.error('Failed to load offline preferences:', error);
    }
  };

  // Update cache statistics
  const updateCacheStats = async () => {
    try {
      const stats = await estimateCacheUsage();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to update cache stats:', error);
    }
  };

  // Add an action to the offline queue
  const addOfflineAction = (type: OfflineActionType, payload: any, priority: number = 1) => {
    if (!isOfflineEnabled) return;
    
    const action: OfflineAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      priority,
      executed: false,
    };
    
    setQueuedActions(prev => [...prev, action]);
  };

  // Remove an action from the offline queue
  const removeOfflineAction = (id: string) => {
    setQueuedActions(prev => prev.filter(action => action.id !== id));
  };

  // Execute all queued actions
  const executeQueuedActions = async (): Promise<boolean> => {
    if (!isOnline || queuedActions.length === 0) {
      return false;
    }
    
    try {
      setIsLoading(true);
      
      // Sort actions by priority (higher first) and then by timestamp (oldest first)
      const sortedActions = [...queuedActions].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
      let success = true;
      
      // Process each action
      for (const action of sortedActions) {
        if (action.executed) continue;
        
        try {
          // In a real app, this would make API calls based on action type and payload
          // For demo, we'll simulate success after a delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Mark as executed
          setQueuedActions(prev => 
            prev.map(a => a.id === action.id ? { ...a, executed: true } : a)
          );
          
          console.log(`Executed offline action: ${action.type}`);
        } catch (error) {
          console.error(`Failed to execute offline action ${action.type}:`, error);
          
          // Mark as failed
          setQueuedActions(prev => 
            prev.map(a => a.id === action.id ? { ...a, error: error instanceof Error ? error.message : String(error) } : a)
          );
          
          success = false;
        }
      }
      
      // Remove executed actions after all are processed
      setQueuedActions(prev => prev.filter(action => !action.executed));
      
      return success;
    } catch (error) {
      console.error('Failed to execute queued actions:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear the offline queue
  const clearOfflineQueue = () => {
    setQueuedActions([]);
  };

  // Cache a material
  const cacheMaterial = async (id: string, data: any, imageUrl?: string): Promise<void> => {
    if (!isOfflineEnabled) return;
    
    try {
      const now = new Date().toISOString();
      const expires = cacheExpiry > 0 
        ? new Date(Date.now() + (cacheExpiry * 24 * 60 * 60 * 1000)).toISOString() 
        : undefined;
      
      const cachedMaterial: CachedMaterial = {
        id,
        materialData: data,
        imageUrl,
        cachedAt: now,
        expiresAt: expires,
        lastAccessed: now,
        accessCount: 1,
      };
      
      setCachedMaterials(prev => ({
        ...prev,
        [id]: cachedMaterial
      }));
      
      // In a real app, you would also cache the image for offline use
      // This would typically use the Cache API or IndexedDB
      if (imageUrl) {
        console.log(`Caching image for material ${id}: ${imageUrl}`);
      }
    } catch (error) {
      console.error(`Failed to cache material ${id}:`, error);
    }
  };

  // Remove a cached material
  const removeCachedMaterial = async (id: string): Promise<void> => {
    try {
      setCachedMaterials(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (error) {
      console.error(`Failed to remove cached material ${id}:`, error);
    }
  };

  // Get a cached material
  const getCachedMaterial = (id: string): CachedMaterial | null => {
    const material = cachedMaterials[id];
    
    if (!material) {
      return null;
    }
    
    // Check if expired
    if (material.expiresAt && new Date(material.expiresAt) < new Date()) {
      // Schedule removal of expired item
      setTimeout(() => removeCachedMaterial(id), 0);
      return null;
    }
    
    // Update last accessed and count
    setCachedMaterials(prev => {
      const material = prev[id];
      if (!material) return prev;
      
      return {
        ...prev,
        [id]: {
          ...material,
          lastAccessed: new Date().toISOString(),
          accessCount: material.accessCount + 1,
        }
      };
    });
    
    return material;
  };

  // Cache a search result
  const cacheSearch = async (
    query: string, 
    filters: Record<string, any>, 
    results: any[]
  ): Promise<void> => {
    if (!isOfflineEnabled) return;
    
    try {
      // Generate a unique ID for this search
      const searchId = `search-${query}-${JSON.stringify(filters)}`;
      
      const now = new Date().toISOString();
      const expires = cacheExpiry > 0 
        ? new Date(Date.now() + (cacheExpiry * 24 * 60 * 60 * 1000)).toISOString() 
        : undefined;
      
      const cachedSearch: CachedSearch = {
        id: searchId,
        query,
        filters,
        results,
        cachedAt: now,
        expiresAt: expires,
        lastAccessed: now,
        accessCount: 1,
      };
      
      setCachedSearches(prev => ({
        ...prev,
        [searchId]: cachedSearch
      }));
    } catch (error) {
      console.error('Failed to cache search:', error);
    }
  };

  // Get a cached search result
  const getCachedSearch = (
    query: string, 
    filters: Record<string, any>
  ): CachedSearch | null => {
    const searchId = `search-${query}-${JSON.stringify(filters)}`;
    const search = cachedSearches[searchId];
    
    if (!search) {
      return null;
    }
    
    // Check if expired
    if (search.expiresAt && new Date(search.expiresAt) < new Date()) {
      // Schedule removal of expired item
      setTimeout(() => {
        setCachedSearches(prev => {
          const updated = { ...prev };
          delete updated[searchId];
          return updated;
        });
      }, 0);
      return null;
    }
    
    // Update last accessed and count
    setCachedSearches(prev => {
      const search = prev[searchId];
      if (!search) return prev;
      
      return {
        ...prev,
        [searchId]: {
          ...search,
          lastAccessed: new Date().toISOString(),
          accessCount: search.accessCount + 1,
        }
      };
    });
    
    return search;
  };

  // Clear the cache
  const clearCache = async (olderThan?: number): Promise<void> => {
    try {
      setIsLoading(true);
      
      if (olderThan) {
        // Clear items older than X days
        const cutoffDate = new Date(Date.now() - (olderThan * 24 * 60 * 60 * 1000));
        
        setCachedMaterials(prev => {
          const updated = { ...prev };
          
          Object.keys(updated).forEach(key => {
            const item = updated[key];
            if (item && new Date(item.lastAccessed) < cutoffDate) {
              delete updated[key];
            }
          });
          
          return updated;
        });
        
        setCachedSearches(prev => {
          const updated = { ...prev };
          
          Object.keys(updated).forEach(key => {
            const item = updated[key];
            if (item && new Date(item.lastAccessed) < cutoffDate) {
              delete updated[key];
            }
          });
          
          return updated;
        });
      } else {
        // Clear all cache
        setCachedMaterials({});
        setCachedSearches({});
      }
      
      // In a real app, you would also clear the image cache
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set offline mode enabled/disabled
  const setOfflineMode = (enabled: boolean) => {
    setIsOfflineEnabled(enabled);
  };

  // Sync with server
  const syncWithServer = async (): Promise<boolean> => {
    if (!isOnline) {
      return false;
    }
    
    try {
      setIsLoading(true);
      
      // Execute queued actions
      const actionsSuccess = await executeQueuedActions();
      
      // In a real app, this would also sync cached data with the server
      
      // Update last sync time
      const stats = { 
        ...cacheStats, 
        lastSyncTime: new Date().toISOString() 
      };
      setCacheStats(stats);
      
      return actionsSuccess;
    } catch (error) {
      console.error('Failed to sync with server:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a resource is cached
  const isResourceCached = (url: string): boolean => {
    // In a real app, this would check if the resource is in the Cache API
    // For demo, we'll just check if any cached material has this URL
    return Object.values(cachedMaterials).some(material => material.imageUrl === url);
  };

  // Get a resource from cache
  const getResourceFromCache = async (url: string): Promise<Blob | null> => {
    // In a real app, this would get the resource from the Cache API or IndexedDB
    // For demo, we'll just simulate after a delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate finding the resource
    const found = isResourceCached(url);
    
    if (!found) {
      return null;
    }
    
    // Simulate a cached blob (this is just a placeholder)
    // In a real implementation, you would return the actual cached resource
    return new Blob(['cached data'], { type: 'text/plain' });
  };

  // Get current cache size
  const getCacheSize = (): number => {
    return cacheStats.totalSize / (1024 * 1024); // Convert bytes to MB
  };

  // Estimate cache usage
  const estimateCacheUsage = async (): Promise<CacheStats> => {
    // Count items
    const materialCount = Object.keys(cachedMaterials).length;
    const searchCount = Object.keys(cachedSearches).length;
    const actionCount = queuedActions.length;
    
    // Estimate size (very rough estimate)
    const materialSize = Object.values(cachedMaterials).reduce((size, material) => {
      // Rough estimate of JSON size
      return size + JSON.stringify(material).length;
    }, 0);
    
    const searchSize = Object.values(cachedSearches).reduce((size, search) => {
      // Rough estimate of JSON size
      return size + JSON.stringify(search).length;
    }, 0);
    
    const actionSize = queuedActions.reduce((size, action) => {
      // Rough estimate of JSON size
      return size + JSON.stringify(action).length;
    }, 0);
    
    // Total size (bytes)
    const totalSize = materialSize + searchSize + actionSize;
    
    // Determine oldest and newest cache items
    let oldestDate = new Date();
    let newestDate = new Date(0);
    
    Object.values(cachedMaterials).forEach(material => {
      const cachedDate = new Date(material.cachedAt);
      if (cachedDate < oldestDate) oldestDate = cachedDate;
      if (cachedDate > newestDate) newestDate = cachedDate;
    });
    
    Object.values(cachedSearches).forEach(search => {
      const cachedDate = new Date(search.cachedAt);
      if (cachedDate < oldestDate) oldestDate = cachedDate;
      if (cachedDate > newestDate) newestDate = cachedDate;
    });
    
    return {
      totalCachedMaterials: materialCount,
      totalCachedSearches: searchCount,
      totalQueuedActions: actionCount,
      totalSize,
      oldestCacheItem: oldestDate.toISOString(),
      newestCacheItem: newestDate.toISOString(),
      lastSyncTime: cacheStats.lastSyncTime,
    };
  };

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isInitialized,
        isLoading,
        isOfflineEnabled,
        queuedActions,
        addOfflineAction,
        removeOfflineAction,
        executeQueuedActions,
        clearOfflineQueue,
        cacheStats,
        cachedMaterials,
        cachedSearches,
        cacheMaterial,
        removeCachedMaterial,
        getCachedMaterial,
        cacheSearch,
        getCachedSearch,
        clearCache,
        setCacheSize,
        setOfflineEnabled: setOfflineMode,
        setCacheExpiry,
        syncWithServer,
        isResourceCached,
        getResourceFromCache,
        getCacheSize,
        estimateCacheUsage,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

// Custom hook for using the offline context
// @ts-ignore - Workaround for TypeScript issue
export const useOffline = (): OfflineContextValue => React.useContext(OfflineContext);

export default OfflineProvider;