import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  CircularProgress,
  Button,
  Divider,
  Alert,
  Tooltip,
  IconButton,
  useTheme,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { materialComparisonService, SimilarMaterialResult } from '../../services/materialComparisonService';
import MaterialComparisonDialog from './MaterialComparisonDialog';

interface SimilarMaterialsViewProps {
  materialId: string;
  material: any;
  onMaterialSelect?: (materialId: string) => void;
}

const SimilarMaterialsView: React.FC<SimilarMaterialsViewProps> = ({
  materialId,
  material,
  onMaterialSelect
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(true);
  const [similarMaterials, setSimilarMaterials] = useState<SimilarMaterialResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.5);
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>('');
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState<boolean>(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);

  useEffect(() => {
    if (materialId) {
      findSimilarMaterials();
    }
  }, [materialId, similarityThreshold, materialTypeFilter]);

  const findSimilarMaterials = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const options: any = {
        limit: 20
      };
      
      if (materialTypeFilter) {
        options.materialType = materialTypeFilter;
      }
      
      const results = await materialComparisonService.findSimilarMaterials(materialId, options);
      
      // Filter by similarity threshold
      const filtered = results.filter(result => result.similarity >= similarityThreshold);
      
      setSimilarMaterials(filtered);
    } catch (error) {
      console.error('Error finding similar materials:', error);
      setError('Failed to find similar materials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimilarityThresholdChange = (event: Event, newValue: number | number[]) => {
    setSimilarityThreshold(newValue as number);
  };

  const handleMaterialTypeFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setMaterialTypeFilter(event.target.value as string);
  };

  const handleCompare = (similarMaterialId: string) => {
    setSelectedMaterialId(similarMaterialId);
    setComparisonDialogOpen(true);
  };

  const handleCloseComparisonDialog = () => {
    setComparisonDialogOpen(false);
    setSelectedMaterialId(null);
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

  if (loading && similarMaterials.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Finding similar materials...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            <SearchIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Similar Materials
          </Typography>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => findSimilarMaterials()}
          >
            Refresh
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Similarity Threshold
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={similarityThreshold}
                onChange={handleSimilarityThresholdChange}
                aria-labelledby="similarity-threshold-slider"
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                step={0.05}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 0.5, label: '50%' },
                  { value: 1, label: '100%' }
                ]}
                min={0}
                max={1}
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Material Type</InputLabel>
              <Select
                value={materialTypeFilter}
                onChange={handleMaterialTypeFilterChange}
                label="Material Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="tile">Tile</MenuItem>
                <MenuItem value="wood">Wood</MenuItem>
                <MenuItem value="stone">Stone</MenuItem>
                <MenuItem value="carpet">Carpet</MenuItem>
                <MenuItem value="vinyl">Vinyl</MenuItem>
                <MenuItem value="laminate">Laminate</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
        {similarMaterials.length === 0 ? (
          <Alert severity="info">
            No similar materials found matching the current criteria.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {similarMaterials.map((result) => (
              <Grid item xs={12} sm={6} md={4} key={result.material.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardActionArea
                    onClick={() => onMaterialSelect && onMaterialSelect(result.material.id)}
                  >
                    {result.material.imageUrl && (
                      <CardMedia
                        component="img"
                        height="140"
                        image={result.material.imageUrl}
                        alt={result.material.name}
                      />
                    )}
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="h6" component="div">
                          {result.material.name}
                        </Typography>
                        <Chip
                          label={`${Math.round(result.similarity * 100)}%`}
                          size="small"
                          sx={{
                            bgcolor: getSimilarityColor(result.similarity),
                            color: 'white'
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {result.material.materialType}
                      </Typography>
                      {result.material.description && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {result.material.description.length > 100
                            ? `${result.material.description.substring(0, 100)}...`
                            : result.material.description}
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                  <Divider />
                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      startIcon={<CompareArrowsIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompare(result.material.id);
                      }}
                    >
                      Compare
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
      
      {/* Comparison Dialog */}
      <MaterialComparisonDialog
        open={comparisonDialogOpen}
        onClose={handleCloseComparisonDialog}
        initialMaterialIds={selectedMaterialId ? [materialId, selectedMaterialId] : []}
      />
    </Box>
  );
};

export default SimilarMaterialsView;
