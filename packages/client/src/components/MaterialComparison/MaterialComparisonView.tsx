import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  Chip,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Tooltip,
  IconButton,
  useTheme
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { materialComparisonService, ComparisonResult, PropertyComparison } from '../../services/materialComparisonService';

interface MaterialComparisonViewProps {
  materialIds: string[];
  materials: any[];
  onClose?: () => void;
}

const MaterialComparisonView: React.FC<MaterialComparisonViewProps> = ({
  materialIds,
  materials,
  onClose
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(true);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('importance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterImportance, setFilterImportance] = useState<('high' | 'medium' | 'low')[]>(['high', 'medium', 'low']);

  useEffect(() => {
    if (materialIds.length === 2) {
      compareMaterials();
    }
  }, [materialIds]);

  const compareMaterials = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await materialComparisonService.compareMaterials(materialIds);
      setComparison(result as ComparisonResult);
    } catch (error) {
      console.error('Error comparing materials:', error);
      setError('Failed to compare materials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (property: string) => {
    if (sortBy === property) {
      // Toggle sort direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort property and default to descending
      setSortBy(property);
      setSortDirection('desc');
    }
  };

  const handleFilterImportance = (importance: 'high' | 'medium' | 'low') => {
    if (filterImportance.includes(importance)) {
      // Remove from filter
      setFilterImportance(filterImportance.filter(i => i !== importance));
    } else {
      // Add to filter
      setFilterImportance([...filterImportance, importance]);
    }
  };

  const getSortedAndFilteredComparisons = () => {
    if (!comparison) return [];
    
    // Filter by importance
    const filtered = comparison.propertyComparisons.filter(
      comp => filterImportance.includes(comp.importance)
    );
    
    // Sort by selected property
    return filtered.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'propertyName':
          valueA = a.propertyDisplayName || a.propertyName;
          valueB = b.propertyDisplayName || b.propertyName;
          break;
        case 'similarity':
          valueA = a.similarity;
          valueB = b.similarity;
          break;
        case 'importance':
          // Convert importance to numeric value for sorting
          const importanceValues = { high: 3, medium: 2, low: 1 };
          valueA = importanceValues[a.importance];
          valueB = importanceValues[b.importance];
          break;
        default:
          valueA = a[sortBy as keyof PropertyComparison];
          valueB = b[sortBy as keyof PropertyComparison];
      }
      
      // Handle string comparison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      // Handle numeric comparison
      return sortDirection === 'asc'
        ? (valueA as number) - (valueB as number)
        : (valueB as number) - (valueA as number);
    });
  };

  const getImportanceColor = (importance: 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) {
      return theme.palette.success.main;
    } else if (similarity >= 0.5) {
      return theme.palette.warning.main;
    } else {
      return theme.palette.error.main;
    }
  };

  const formatPropertyValue = (value: any, unit?: string) => {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'number') {
      return unit ? `${value} ${unit}` : value;
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    return value.toString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Comparing materials...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!comparison) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No comparison data available.
      </Alert>
    );
  }

  const sortedComparisons = getSortedAndFilteredComparisons();
  const material1 = materials.find(m => m.id === materialIds[0]);
  const material2 = materials.find(m => m.id === materialIds[1]);

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            <CompareArrowsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Material Comparison
          </Typography>
          {onClose && (
            <Button variant="outlined" onClick={onClose}>
              Close
            </Button>
          )}
        </Box>
        
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={5}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="h6">{material1?.name || 'Material 1'}</Typography>
              <Typography variant="body2" color="textSecondary">
                {material1?.materialType || 'Unknown Type'}
              </Typography>
              {material1?.description && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {material1.description}
                </Typography>
              )}
            </Box>
          </Grid>
          
          <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  bgcolor: getSimilarityColor(comparison.overallSimilarity),
                  color: 'white',
                  mb: 1
                }}
              >
                <Typography variant="h4">
                  {Math.round(comparison.overallSimilarity * 100)}%
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary">
                Similarity
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={5}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="h6">{material2?.name || 'Material 2'}</Typography>
              <Typography variant="body2" color="textSecondary">
                {material2?.materialType || 'Unknown Type'}
              </Typography>
              {material2?.description && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {material2.description}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Filter by Importance
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label="High"
              color={filterImportance.includes('high') ? 'error' : 'default'}
              onClick={() => handleFilterImportance('high')}
              variant={filterImportance.includes('high') ? 'filled' : 'outlined'}
            />
            <Chip
              label="Medium"
              color={filterImportance.includes('medium') ? 'warning' : 'default'}
              onClick={() => handleFilterImportance('medium')}
              variant={filterImportance.includes('medium') ? 'filled' : 'outlined'}
            />
            <Chip
              label="Low"
              color={filterImportance.includes('low') ? 'success' : 'default'}
              onClick={() => handleFilterImportance('low')}
              variant={filterImportance.includes('low') ? 'filled' : 'outlined'}
            />
          </Box>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Property
                    <IconButton size="small" onClick={() => handleSort('propertyName')}>
                      {sortBy === 'propertyName' ? (
                        sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                      ) : (
                        <FilterListIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Importance
                    <IconButton size="small" onClick={() => handleSort('importance')}>
                      {sortBy === 'importance' ? (
                        sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                      ) : (
                        <FilterListIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell>{material1?.name || 'Material 1'}</TableCell>
                <TableCell>{material2?.name || 'Material 2'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    Similarity
                    <IconButton size="small" onClick={() => handleSort('similarity')}>
                      {sortBy === 'similarity' ? (
                        sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                      ) : (
                        <FilterListIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedComparisons.map((comp) => (
                <TableRow key={comp.propertyName}>
                  <TableCell>
                    <Typography variant="body2">
                      {comp.propertyDisplayName || comp.propertyName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={comp.importance.charAt(0).toUpperCase() + comp.importance.slice(1)}
                      size="small"
                      sx={{
                        bgcolor: getImportanceColor(comp.importance),
                        color: 'white'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {formatPropertyValue(comp.values[materialIds[0]], comp.unit)}
                  </TableCell>
                  <TableCell>
                    {formatPropertyValue(comp.values[materialIds[1]], comp.unit)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          bgcolor: getSimilarityColor(comp.similarity),
                          color: 'white',
                          mr: 1
                        }}
                      >
                        <Typography variant="body2">
                          {Math.round(comp.similarity * 100)}%
                        </Typography>
                      </Box>
                      {comp.similarity >= 0.8 ? (
                        <CheckCircleIcon color="success" />
                      ) : comp.similarity >= 0.5 ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {sortedComparisons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No properties match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default MaterialComparisonView;
