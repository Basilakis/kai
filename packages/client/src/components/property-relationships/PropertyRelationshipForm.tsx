import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Slider,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';
import { useAuth } from '../../hooks/useAuth';

interface PropertyRelationshipFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  relationshipType: RelationshipType;
  materialType: string;
  initialData?: any;
}

export const PropertyRelationshipForm: React.FC<PropertyRelationshipFormProps> = ({
  open,
  onClose,
  onSubmit,
  relationshipType,
  materialType,
  initialData
}) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    sourceProperty: '',
    targetProperty: '',
    strength: 1.0,
    bidirectional: false,
    description: ''
  });
  const [availableProperties, setAvailableProperties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If initialData is provided, use it to initialize the form
    if (initialData) {
      setFormData({
        sourceProperty: initialData.sourceProperty || '',
        targetProperty: initialData.targetProperty || '',
        strength: initialData.strength || 1.0,
        bidirectional: initialData.bidirectional || false,
        description: initialData.description || ''
      });
    } else {
      // Reset form when opening without initial data
      setFormData({
        sourceProperty: '',
        targetProperty: '',
        strength: 1.0,
        bidirectional: false,
        description: ''
      });
    }
  }, [initialData, open]);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      setError(null);
      try {
        // This would be replaced with an actual API call to get available properties
        // For now, we'll use a mock list
        const mockProperties = [
          'material', 'finish', 'rRating', 'vRating', 'peiRating', 'waterAbsorption',
          'size', 'thickness', 'color', 'pattern', 'shape', 'usage', 'style',
          'moh', 'frostResistance', 'chemicalResistance', 'stainResistance'
        ];
        
        setAvailableProperties(mockProperties);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch properties');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProperties();
  }, [token, materialType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    setFormData(prev => ({
      ...prev,
      strength: newValue as number
    }));
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      relationshipType
    });
  };

  const getRelationshipTypeLabel = (type: RelationshipType) => {
    switch (type) {
      case RelationshipType.CORRELATION:
        return 'Correlation';
      case RelationshipType.DEPENDENCY:
        return 'Dependency';
      case RelationshipType.COMPATIBILITY:
        return 'Compatibility';
      case RelationshipType.EXCLUSION:
        return 'Exclusion';
      case RelationshipType.CAUSATION:
        return 'Causation';
      case RelationshipType.DERIVATION:
        return 'Derivation';
      case RelationshipType.ASSOCIATION:
        return 'Association';
      default:
        return type;
    }
  };

  const getRelationshipDescription = (type: RelationshipType) => {
    switch (type) {
      case RelationshipType.CORRELATION:
        return 'Properties that tend to have related values (e.g., material type and water absorption)';
      case RelationshipType.DEPENDENCY:
        return 'Properties where one depends on the other (e.g., finish depends on material type)';
      case RelationshipType.COMPATIBILITY:
        return 'Properties that need to be compatible (e.g., finish and R-rating)';
      case RelationshipType.EXCLUSION:
        return 'Properties that have mutually exclusive values (e.g., certain finishes and R-ratings)';
      case RelationshipType.CAUSATION:
        return 'Properties where one causes the other (e.g., material composition causes certain properties)';
      case RelationshipType.DERIVATION:
        return 'Properties where one is derived from the other (e.g., calculated properties)';
      case RelationshipType.ASSOCIATION:
        return 'General association between properties';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialData ? 'Edit' : 'Add'} {getRelationshipTypeLabel(relationshipType)} Relationship
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              {getRelationshipDescription(relationshipType)}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="source-property-label">Source Property</InputLabel>
                  <Select
                    labelId="source-property-label"
                    id="sourceProperty"
                    name="sourceProperty"
                    value={formData.sourceProperty}
                    onChange={handleSelectChange}
                    label="Source Property"
                    required
                  >
                    {availableProperties.map(prop => (
                      <MenuItem key={prop} value={prop}>
                        {prop}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="target-property-label">Target Property</InputLabel>
                  <Select
                    labelId="target-property-label"
                    id="targetProperty"
                    name="targetProperty"
                    value={formData.targetProperty}
                    onChange={handleSelectChange}
                    label="Target Property"
                    required
                  >
                    {availableProperties
                      .filter(prop => prop !== formData.sourceProperty)
                      .map(prop => (
                        <MenuItem key={prop} value={prop}>
                          {prop}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Typography id="strength-slider" gutterBottom>
                Relationship Strength: {formData.strength.toFixed(2)}
              </Typography>
              <Slider
                value={formData.strength}
                onChange={handleSliderChange}
                aria-labelledby="strength-slider"
                valueLabelDisplay="auto"
                step={0.01}
                marks
                min={0}
                max={1}
              />
            </Box>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.bidirectional}
                  onChange={handleCheckboxChange}
                  name="bidirectional"
                />
              }
              label="Bidirectional Relationship"
            />
            
            <TextField
              margin="normal"
              fullWidth
              id="description"
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={3}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={loading || !formData.sourceProperty || !formData.targetProperty}
        >
          {initialData ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
