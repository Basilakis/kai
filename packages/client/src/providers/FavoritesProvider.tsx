import React from 'react';

// Favorite material interface
export interface FavoriteMaterial {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  imageUrl: string;
  dateAdded: string;
  notes?: string;
  customTags?: string[];
}

// Favorites context interface
interface FavoritesContextValue {
  favorites: FavoriteMaterial[];
  isLoading: boolean;
  addFavorite: (material: FavoriteMaterial) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  updateFavorite: (id: string, updates: Partial<FavoriteMaterial>) => Promise<void>;
  isFavorite: (id: string) => boolean;
  clearAllFavorites: () => Promise<void>;
  addCustomTag: (materialId: string, tag: string) => Promise<void>;
  removeCustomTag: (materialId: string, tag: string) => Promise<void>;
  addNote: (materialId: string, note: string) => Promise<void>;
}

// Create context with default values
// @ts-ignore - Workaround for TypeScript issue
const FavoritesContext = React.createContext<FavoritesContextValue>({
  favorites: [],
  isLoading: false,
  addFavorite: async () => {},
  removeFavorite: async () => {},
  updateFavorite: async () => {},
  isFavorite: () => false,
  clearAllFavorites: async () => {},
  addCustomTag: async () => {},
  removeCustomTag: async () => {},
  addNote: async () => {},
});

// Provider props
interface FavoritesProviderProps {
  children: React.ReactNode;
}

/**
 * FavoritesProvider Component
 * 
 * Manages user favorites/bookmarks for materials
 * Allows adding, removing, and updating favorites
 * Supports tags and notes for personalization
 */
export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  // State
  const [favorites, setFavorites] = React.useState<FavoriteMaterial[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Load favorites from localStorage on mount
  React.useEffect(() => {
    const loadFavorites = () => {
      try {
        const savedFavorites = localStorage.getItem('favorites');
        if (savedFavorites) {
          setFavorites(JSON.parse(savedFavorites));
        }
      } catch (error) {
        console.error('Failed to load favorites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // Save favorites to localStorage whenever they change
  React.useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    }
  }, [favorites, isLoading]);

  // Add a material to favorites
  const addFavorite = async (material: FavoriteMaterial) => {
    // Don't add if already exists
    if (favorites.some(fav => fav.id === material.id)) {
      return;
    }

    // Add dateAdded if not provided
    const materialWithDate = {
      ...material,
      dateAdded: material.dateAdded || new Date().toISOString(),
    };

    setFavorites(prev => [...prev, materialWithDate]);
  };

  // Remove a material from favorites
  const removeFavorite = async (id: string) => {
    setFavorites(prev => prev.filter(fav => fav.id !== id));
  };

  // Update a favorite material
  const updateFavorite = async (id: string, updates: Partial<FavoriteMaterial>) => {
    setFavorites(prev => 
      prev.map(fav => 
        fav.id === id ? { ...fav, ...updates } : fav
      )
    );
  };

  // Check if a material is favorited
  const isFavorite = (id: string) => {
    return favorites.some(fav => fav.id === id);
  };

  // Clear all favorites
  const clearAllFavorites = async () => {
    setFavorites([]);
  };

  // Add a custom tag to a material
  const addCustomTag = async (materialId: string, tag: string) => {
    setFavorites(prev => 
      prev.map(fav => {
        if (fav.id === materialId) {
          const currentTags = fav.customTags || [];
          // Don't add duplicate tags
          if (currentTags.includes(tag)) {
            return fav;
          }
          return {
            ...fav,
            customTags: [...currentTags, tag]
          };
        }
        return fav;
      })
    );
  };

  // Remove a custom tag from a material
  const removeCustomTag = async (materialId: string, tag: string) => {
    setFavorites(prev => 
      prev.map(fav => {
        if (fav.id === materialId && fav.customTags) {
          return {
            ...fav,
            customTags: fav.customTags.filter(t => t !== tag)
          };
        }
        return fav;
      })
    );
  };

  // Add/update a note to a material
  const addNote = async (materialId: string, note: string) => {
    setFavorites(prev => 
      prev.map(fav => {
        if (fav.id === materialId) {
          return {
            ...fav,
            notes: note
          };
        }
        return fav;
      })
    );
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isLoading,
        addFavorite,
        removeFavorite,
        updateFavorite,
        isFavorite,
        clearAllFavorites,
        addCustomTag,
        removeCustomTag,
        addNote,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

// Custom hook for using favorites
// @ts-ignore - Workaround for TypeScript issue
export const useFavorites = (): FavoritesContextValue => React.useContext(FavoritesContext);

export default FavoritesProvider;