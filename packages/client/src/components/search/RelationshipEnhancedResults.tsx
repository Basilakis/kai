import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Info as InfoIcon,
  AccountTree as AccountTreeIcon
} from '@mui/icons-material';
import { useRelationshipEnhancedSearch } from './RelationshipEnhancedSearchProvider';

interface RelationshipEnhancedResultsProps {
  materialType: string;
  query: Record<string, string>;
  originalResults: any[];
  onResultClick: (result: any) => void;
}

const RelationshipEnhancedResults: React.FC<RelationshipEnhancedResultsProps> = ({
  materialType,
  query,
  originalResults,
  onResultClick
}) => {
  const { results, loading, error, search } = useRelationshipEnhancedSearch();

  React.useEffect(() => {
    // Only perform search if we have a query and original results
    if (Object.keys(query).length > 0 && originalResults.length > 0) {
      search(materialType, query, originalResults);
    }
  }, [materialType, query, originalResults, search]);

  // If no results or error, show original results
  if ((results.length === 0 && !loading) || error) {
    return (
      <Box>
        {originalResults.map((result, index) => (
          <Card 
            key={index} 
            sx={{ mb: 2, cursor: 'pointer' }}
            onClick={() => onResultClick(result)}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {result.properties.name || `Material ${result.id}`}
              </Typography>
              
              <Grid container spacing={1}>
                {Object.entries(result.properties).map(([key, value]) => (
                  <Grid item key={key}>
                    <Chip 
                      label={`${key}: ${value}`} 
                      size="small" 
                      variant="outlined"
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box>
      {loading ? (
        <LinearProgress sx={{ mb: 2 }} />
      ) : (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Results enhanced using property relationships
          </Typography>
        </Box>
      )}
      
      {results.map((result, index) => (
        <Card 
          key={index} 
          sx={{ 
            mb: 2, 
            cursor: 'pointer',
            borderLeft: '4px solid',
            borderColor: getScoreColor(result.relationshipScore)
          }}
          onClick={() => onResultClick(result)}
        >
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">
                {result.properties.name || `Material ${result.id}`}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title="Relationship score based on property relationships">
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="body2">
                      {Math.round(result.relationshipScore * 100)}%
                    </Typography>
                  </Box>
                </Tooltip>
                
                <Tooltip title="View relationship details">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            <Grid container spacing={1}>
              {Object.entries(result.properties).map(([key, value]) => {
                // Highlight properties that match the query
                const isQueryMatch = query[key] === value;
                
                return (
                  <Grid item key={key}>
                    <Chip 
                      label={`${key}: ${value}`} 
                      size="small" 
                      color={isQueryMatch ? 'primary' : 'default'}
                      variant={isQueryMatch ? 'filled' : 'outlined'}
                    />
                  </Grid>
                );
              })}
            </Grid>
            
            <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Relevance score: {Math.round(result.finalScore * 100)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={result.finalScore * 100}
                sx={{ 
                  height: 4, 
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: getScoreColor(result.finalScore)
                  }
                }}
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

// Helper function to get color based on score
const getScoreColor = (score: number): string => {
  if (score >= 0.8) return '#4caf50'; // Green
  if (score >= 0.6) return '#8bc34a'; // Light Green
  if (score >= 0.4) return '#ffeb3b'; // Yellow
  if (score >= 0.2) return '#ff9800'; // Orange
  return '#f44336'; // Red
};

export default RelationshipEnhancedResults;
