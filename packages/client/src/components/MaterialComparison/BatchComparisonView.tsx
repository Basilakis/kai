import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
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
  useTheme,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { materialComparisonService, ComparisonResult, ComparisonPreset } from '../../services/materialComparisonService';
import MaterialComparisonView from './MaterialComparisonView';
import ComparisonPresetsDialog from './ComparisonPresetsDialog';
import { api } from '../../utils/api';

interface BatchComparisonViewProps {
  initialMaterialIds?: string[];
}

const BatchComparisonView: React.FC<BatchComparisonViewProps> = ({
  initialMaterialIds = []
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false);
  const [selectedComparison, setSelectedComparison] = useState<ComparisonResult | null>(null);
  const [presetsDialogOpen, setPresetsDialogOpen] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<ComparisonPreset | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    if (materials.length > 0 && initialMaterialIds.length > 0) {
      const initialMaterials = materials.filter(m => initialMaterialIds.includes(m.id));
      setSelectedMaterials(initialMaterials);
    }
  }, [materials, initialMaterialIds]);

  const loadMaterials = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/materials');
      setMaterials(response.data.materials || []);
    } catch (error) {
      console.error('Error loading materials:', error);
      setError('Failed to load materials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialChange = (event: React.SyntheticEvent, value: any[]) => {
    setSelectedMaterials(value);
    setComparisons([]);
  };

  const handleCompare = async () => {
    if (selectedMaterials.length < 2) {
      setError('Please select at least 2 materials to compare.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const materialIds = selectedMaterials.map(m => m.id);
      const options = selectedPreset ? {
        propertyWeights: selectedPreset.propertyWeights,
        includeProperties: selectedPreset.includeProperties,
        excludeProperties: selectedPreset.excludeProperties
      } : undefined;
      
      const results = await materialComparisonService.compareMaterials(materialIds, options);
      setComparisons(Array.isArray(results) ? results : [results]);
    } catch (error) {
      console.error('Error comparing materials:', error);
      setError('Failed to compare materials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetailDialog = (comparison: ComparisonResult) => {
    setSelectedComparison(comparison);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedComparison(null);
  };

  const handleOpenPresetsDialog = () => {
    setPresetsDialogOpen(true);
  };

  const handleClosePresetsDialog = () => {
    setPresetsDialogOpen(false);
  };

  const handleSelectPreset = (preset: ComparisonPreset) => {
    setSelectedPreset(preset);
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

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            <CompareArrowsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Batch Material Comparison
          </Typography>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={handleOpenPresetsDialog}
          >
            Comparison Presets
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Select Materials to Compare
          </Typography>
          
          <Autocomplete
            multiple
            options={materials}
            getOptionLabel={(option) => `${option.name} (${option.materialType})`}
            value={selectedMaterials}
            onChange={handleMaterialChange}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Materials"
                placeholder="Search materials..."
                variant="outlined"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option.name}
                  {...getTagProps({ index })}
                  color="primary"
                />
              ))
            }
            renderOption={(props, option) => (
              <li {...props}>
                <Grid container alignItems="center">
                  <Grid item xs>
                    <Typography variant="body1">{option.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {option.materialType}
                    </Typography>
                  </Grid>
                </Grid>
              </li>
            )}
            limitTags={5}
            sx={{ mb: 2 }}
          />
          
          {selectedPreset && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Using preset: <strong>{selectedPreset.name}</strong>
              <IconButton
                size="small"
                onClick={() => setSelectedPreset(null)}
                sx={{ ml: 1 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Alert>
          )}
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleCompare}
            disabled={selectedMaterials.length < 2 || loading}
            startIcon={loading ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
          >
            {loading ? 'Comparing...' : 'Compare Materials'}
          </Button>
        </Box>
        
        {comparisons.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Comparison Results
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Material 1</TableCell>
                    <TableCell>Material 2</TableCell>
                    <TableCell>Similarity</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparisons.map((comparison) => {
                    const material1 = materials.find(m => m.id === comparison.materials[0]);
                    const material2 = materials.find(m => m.id === comparison.materials[1]);
                    
                    return (
                      <TableRow key={comparison.id}>
                        <TableCell>{material1?.name || 'Unknown'}</TableCell>
                        <TableCell>{material2?.name || 'Unknown'}</TableCell>
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
                                bgcolor: getSimilarityColor(comparison.overallSimilarity),
                                color: 'white',
                                mr: 1
                              }}
                            >
                              <Typography variant="body2">
                                {Math.round(comparison.overallSimilarity * 100)}%
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => handleOpenDetailDialog(comparison)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
      
      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetailDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CompareArrowsIcon sx={{ mr: 1 }} />
            Comparison Details
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedComparison && (
            <MaterialComparisonView
              materialIds={selectedComparison.materials}
              materials={materials.filter(m => selectedComparison.materials.includes(m.id))}
            />
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDetailDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Presets Dialog */}
      <ComparisonPresetsDialog
        open={presetsDialogOpen}
        onClose={handleClosePresetsDialog}
        onSelectPreset={handleSelectPreset}
        materialType={selectedMaterials.length > 0 ? selectedMaterials[0].materialType : undefined}
      />
    </Box>
  );
};

export default BatchComparisonView;
