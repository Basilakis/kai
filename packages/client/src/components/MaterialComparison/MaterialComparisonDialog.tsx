import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
  Chip,
  Grid
} from '@mui/material';
import { CompareArrows as CompareArrowsIcon } from '@mui/icons-material';
import MaterialComparisonView from './MaterialComparisonView';
import { api } from '../../utils/api';

interface MaterialComparisonDialogProps {
  open: boolean;
  onClose: () => void;
  initialMaterialIds?: string[];
}

const MaterialComparisonDialog: React.FC<MaterialComparisonDialogProps> = ({
  open,
  onClose,
  initialMaterialIds = []
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      loadMaterials();
      
      // Set initial materials if provided
      if (initialMaterialIds.length > 0) {
        setSelectedMaterials([]);
      }
    }
  }, [open, initialMaterialIds]);

  useEffect(() => {
    if (materials.length > 0 && initialMaterialIds.length > 0) {
      const initialMaterials = materials.filter(m => initialMaterialIds.includes(m.id));
      setSelectedMaterials(initialMaterials);
      
      if (initialMaterials.length === 2) {
        setComparing(true);
      }
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
    setComparing(false);
  };

  const handleCompare = () => {
    if (selectedMaterials.length !== 2) {
      setError('Please select exactly 2 materials to compare.');
      return;
    }
    
    setComparing(true);
    setError(null);
  };

  const handleBack = () => {
    setComparing(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CompareArrowsIcon sx={{ mr: 1 }} />
          Material Comparison
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Loading materials...
            </Typography>
          </Box>
        ) : comparing ? (
          <MaterialComparisonView
            materialIds={selectedMaterials.map(m => m.id)}
            materials={selectedMaterials}
            onClose={handleBack}
          />
        ) : (
          <Box sx={{ py: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Typography variant="body1" paragraph>
              Select two materials to compare their properties and calculate similarity.
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
            
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                How Material Comparison Works
              </Typography>
              <Typography variant="body2">
                The system analyzes properties of both materials and calculates similarity scores for each property.
                Properties are weighted by importance, with technical specifications typically having higher weights.
                The overall similarity score is a weighted average of all property similarities.
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {comparing ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCompare}
              disabled={selectedMaterials.length !== 2}
            >
              Compare Materials
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MaterialComparisonDialog;
