import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface RelatedSearch {
  property: string;
  value: string;
  confidence: number;
}

interface SearchResult {
  id: string;
  properties: Record<string, string>;
  score: number;
  relationshipScore: number;
  finalScore: number;
}

interface RelationshipEnhancedSearchContextType {
  loading: boolean;
  error: string | null;
  results: SearchResult[];
  relatedSearches: RelatedSearch[];
  expandedQuery: Record<string, string | string[]>;
  search: (materialType: string, query: Record<string, string>, originalResults: any[]) => Promise<void>;
  expandQuery: (materialType: string, query: Record<string, string>) => Promise<Record<string, string | string[]>>;
  getRelatedSearches: (materialType: string, query: Record<string, string>) => Promise<RelatedSearch[]>;
}

const RelationshipEnhancedSearchContext = createContext<RelationshipEnhancedSearchContextType | undefined>(undefined);

export const useRelationshipEnhancedSearch = () => {
  const context = useContext(RelationshipEnhancedSearchContext);
  if (!context) {
    throw new Error('useRelationshipEnhancedSearch must be used within a RelationshipEnhancedSearchProvider');
  }
  return context;
};

interface RelationshipEnhancedSearchProviderProps {
  children: ReactNode;
}

export const RelationshipEnhancedSearchProvider: React.FC<RelationshipEnhancedSearchProviderProps> = ({ children }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [relatedSearches, setRelatedSearches] = useState<RelatedSearch[]>([]);
  const [expandedQuery, setExpandedQuery] = useState<Record<string, string | string[]>>({});

  const search = useCallback(async (
    materialType: string,
    query: Record<string, string>,
    originalResults: any[]
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/search/relationship-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          materialType,
          query,
          results: originalResults
        })
      });

      if (!response.ok) {
        throw new Error('Failed to perform relationship-enhanced search');
      }

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        setRelatedSearches(data.relatedSearches);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setResults([]);
      setRelatedSearches([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const expandQuery = useCallback(async (
    materialType: string,
    query: Record<string, string>
  ): Promise<Record<string, string | string[]>> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/search/expand-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          materialType,
          query
        })
      });

      if (!response.ok) {
        throw new Error('Failed to expand query');
      }

      const data = await response.json();

      if (data.success) {
        setExpandedQuery(data.expandedQuery);
        return data.expandedQuery;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      return query;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const getRelatedSearches = useCallback(async (
    materialType: string,
    query: Record<string, string>
  ): Promise<RelatedSearch[]> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/search/related-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          materialType,
          query
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get related searches');
      }

      const data = await response.json();

      if (data.success) {
        setRelatedSearches(data.relatedSearches);
        return data.relatedSearches;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  const value = {
    loading,
    error,
    results,
    relatedSearches,
    expandedQuery,
    search,
    expandQuery,
    getRelatedSearches
  };

  return (
    <RelationshipEnhancedSearchContext.Provider value={value}>
      {children}
    </RelationshipEnhancedSearchContext.Provider>
  );
};

export default RelationshipEnhancedSearchProvider;
