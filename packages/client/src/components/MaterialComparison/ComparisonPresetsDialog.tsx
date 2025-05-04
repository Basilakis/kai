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
  TextField,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { materialComparisonService, ComparisonPreset } from '../../services/materialComparisonService';

interface ComparisonPresetsDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectPreset: (preset: ComparisonPreset) => void;
  materialType?: string;
}

const ComparisonPresetsDialog: React.FC<ComparisonPresetsDialogProps> = ({
  open,
  onClose,
  onSelectPreset,
  materialType
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [presets, setPresets] = useState<ComparisonPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [createMode, setCreateMode] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<ComparisonPreset | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    materialType: string;
    propertyWeights: Record<string, number>;
    includeProperties: string[];
    excludeProperties: string[];
    isDefault: boolean;
  }>({
    name: '',
    description: '',
    materialType: materialType || '',
    propertyWeights: {},
    includeProperties: [],
    excludeProperties: [],
    isDefault: false
  });

  // Common properties for different material types
  const commonProperties = [
    { name: 'dimensions.width', displayName: 'Width', defaultWeight: 0.7 },
    { name: 'dimensions.height', displayName: 'Height', defaultWeight: 0.7 },
    { name: 'dimensions.depth', displayName: 'Depth', defaultWeight: 0.7 },
    { name: 'color.name', displayName: 'Color', defaultWeight: 0.8 },
    { name: 'finish', displayName: 'Finish', defaultWeight: 0.9 },
    { name: 'pattern', displayName: 'Pattern', defaultWeight: 0.8 },
    { name: 'texture', displayName: 'Texture', defaultWeight: 0.8 }
  ];

  // Material-specific properties
  const materialProperties: Record<string, Array<{ name: string; displayName: string; defaultWeight: number }>> = {
    'tile': [
      { name: 'technicalSpecs.waterAbsorption', displayName: 'Water Absorption', defaultWeight: 0.9 },
      { name: 'technicalSpecs.slipResistance', displayName: 'Slip Resistance', defaultWeight: 0.9 },
      { name: 'technicalSpecs.frostResistance', displayName: 'Frost Resistance', defaultWeight: 0.8 }
    ],
    'wood': [
      { name: 'technicalSpecs.hardness', displayName: 'Hardness', defaultWeight: 0.9 },
      { name: 'technicalSpecs.stability', displayName: 'Stability', defaultWeight: 0.8 },
      { name: 'technicalSpecs.grainPattern', displayName: 'Grain Pattern', defaultWeight: 0.7 }
    ],
    'stone': [
      { name: 'technicalSpecs.density', displayName: 'Density', defaultWeight: 0.8 },
      { name: 'technicalSpecs.porosity', displayName: 'Porosity', defaultWeight: 0.9 },
      { name: 'technicalSpecs.acidResistance', displayName: 'Acid Resistance', defaultWeight: 0.7 }
    ]
  };

  useEffect(() => {
    if (open) {
      loadPresets();
    }
  }, [open, materialType]);

  const loadPresets = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const loadedPresets = await materialComparisonService.getComparisonPresets(materialType);
      setPresets(loadedPresets);
    } catch (error) {
      console.error('Error loading comparison presets:', error);
      setError('Failed to load comparison presets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset: ComparisonPreset) => {
    onSelectPreset(preset);
    onClose();
  };

  const handleEditPreset = (preset: ComparisonPreset) => {
    setSelectedPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description || '',
      materialType: preset.materialType || '',
      propertyWeights: { ...preset.propertyWeights },
      includeProperties: preset.includeProperties || [],
      excludeProperties: preset.excludeProperties || [],
      isDefault: preset.isDefault
    });
    setEditMode(true);
    setCreateMode(false);
  };

  const handleCreatePreset = () => {
    // Initialize with default weights
    const defaultWeights: Record<string, number> = {};
    
    // Add common properties
    commonProperties.forEach(prop => {
      defaultWeights[prop.name] = prop.defaultWeight;
    });
    
    // Add material-specific properties if material type is selected
    if (materialType && materialProperties[materialType]) {
      materialProperties[materialType].forEach(prop => {
        defaultWeights[prop.name] = prop.defaultWeight;
      });
    }
    
    setSelectedPreset(null);
    setFormData({
      name: '',
      description: '',
      materialType: materialType || '',
      propertyWeights: defaultWeights,
      includeProperties: [],
      excludeProperties: [],
      isDefault: false
    });
    setCreateMode(true);
    setEditMode(false);
  };

  const handleDeletePreset = async (preset: ComparisonPreset) => {
    if (!window.confirm(`Are you sure you want to delete the preset "${preset.name}"?`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await materialComparisonService.deleteComparisonPreset(preset.id);
      loadPresets();
    } catch (error) {
      console.error('Error deleting comparison preset:', error);
      setError('Failed to delete comparison preset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePropertyWeightChange = (property: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      propertyWeights: {
        ...prev.propertyWeights,
        [property]: value
      }
    }));
  };

  const handleSavePreset = async () => {
    if (!formData.name) {
      setError('Please enter a name for the preset.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      if (editMode && selectedPreset) {
        // Update existing preset
        await materialComparisonService.updateComparisonPreset(selectedPreset.id, formData);
      } else {
        // Create new preset
        await materialComparisonService.createComparisonPreset(formData);
      }
      
      loadPresets();
      setEditMode(false);
      setCreateMode(false);
    } catch (error) {
      console.error('Error saving comparison preset:', error);
      setError('Failed to save comparison preset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setCreateMode(false);
    setSelectedPreset(null);
  };

  // Get properties to display based on material type
  const getPropertiesForForm = () => {
    const properties = [...commonProperties];
    
    if (formData.materialType && materialProperties[formData.materialType]) {
      properties.push(...materialProperties[formData.materialType]);
    }
    
    return properties;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Comparison Presets</Typography>
          {!editMode && !createMode && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreatePreset}
            >
              Create Preset
            </Button>
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading && presets.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              Loading presets...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : editMode || createMode ? (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              {editMode ? 'Edit Preset' : 'Create Preset'}
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Preset Name"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  fullWidth
                  required
                  margin="normal"
                />
                
                <TextField
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  margin="normal"
                />
                
                <FormControl fullWidth margin="normal">
                  <InputLabel>Material Type</InputLabel>
                  <Select
                    value={formData.materialType}
                    onChange={(e) => handleFormChange('materialType', e.target.value)}
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
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isDefault}
                      onChange={(e) => handleFormChange('isDefault', e.target.checked)}
                    />
                  }
                  label="Set as Default Preset"
                  sx={{ mt: 2 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Property Weights
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Adjust the importance of each property in the comparison.
                </Typography>
                
                <Box sx={{ maxHeight: 300, overflow: 'auto', pr: 2 }}>
                  {getPropertiesForForm().map((property) => (
                    <Box key={property.name} sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        {property.displayName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Slider
                          value={formData.propertyWeights[property.name] || property.defaultWeight}
                          onChange={(e, value) => handlePropertyWeightChange(property.name, value as number)}
                          step={0.1}
                          min={0}
                          max={1}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                        />
                        <Typography variant="body2" sx={{ ml: 2, minWidth: 40 }}>
                          {Math.round((formData.propertyWeights[property.name] || property.defaultWeight) * 100)}%
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        ) : presets.length === 0 ? (
          <Alert severity="info">
            No comparison presets found. Create a preset to get started.
          </Alert>
        ) : (
          <List>
            {presets.map((preset) => (
              <React.Fragment key={preset.id}>
                <ListItem
                  button
                  onClick={() => handleSelectPreset(preset)}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {preset.name}
                        {preset.isDefault && (
                          <Chip
                            label="Default"
                            size="small"
                            color="primary"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        {preset.materialType && (
                          <Typography variant="body2" component="span">
                            {preset.materialType.charAt(0).toUpperCase() + preset.materialType.slice(1)}
                            {' • '}
                          </Typography>
                        )}
                        {preset.description || 'No description'}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPreset(preset);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      
      <DialogActions>
        {editMode || createMode ? (
          <>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSavePreset}
              disabled={!formData.name || loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Save Preset'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ComparisonPresetsDialog;
