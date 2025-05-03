import React from 'react';
import { Box, Typography, Chip, Paper } from '@mui/material';
import { useRelationshipEnhancedSearch } from './RelationshipEnhancedSearchProvider';

interface RelatedSearchesProps {
  materialType: string;
  currentQuery: Record<string, string>;
  onApplyFilter: (property: string, value: string) => void;
}

const RelatedSearches: React.FC<RelatedSearchesProps> = ({
  materialType,
  currentQuery,
  onApplyFilter
}) => {
  const { relatedSearches, loading, error, getRelatedSearches } = useRelationshipEnhancedSearch();

  React.useEffect(() => {
    // Only fetch related searches if we have a query
    if (Object.keys(currentQuery).length > 0) {
      getRelatedSearches(materialType, currentQuery);
    }
  }, [materialType, currentQuery, getRelatedSearches]);

  // If no related searches or error, don't show anything
  if ((relatedSearches.length === 0 && !loading) || error) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        Related Searches
      </Typography>
      
      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading related searches...
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {relatedSearches.map((search, index) => (
            <Chip
              key={index}
              label={`${search.property}: ${search.value}`}
              onClick={() => onApplyFilter(search.property, search.value)}
              color="primary"
              variant="outlined"
              sx={{ 
                opacity: search.confidence,
                '&:hover': {
                  opacity: 1
                }
              }}
            />
          ))}
        </Box>
      )}
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        These suggestions are based on property relationships in our database.
      </Typography>
    </Paper>
  );
};

export default RelatedSearches;
