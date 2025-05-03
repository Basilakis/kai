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
import { useAuth } from '../../hooks/useAuth';

interface ValueCorrelationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  sourceProperty: string;
  targetProperty: string;
  initialData?: any;
}

export const ValueCorrelationForm: React.FC<ValueCorrelationFormProps> = ({
  open,
  onClose,
  onSubmit,
  sourceProperty,
  targetProperty,
  initialData
}) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    sourceValue: '',
    targetValue: '',
    correlationStrength: 0.5,
    sampleSize: 0,
    confidenceInterval: 0.0,
    isStatistical: false,
    isManual: true
  });
  const [sourceValues, setSourceValues] = useState<string[]>([]);
  const [targetValues, setTargetValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If initialData is provided, use it to initialize the form
    if (initialData) {
      setFormData({
        sourceValue: initialData.sourceValue || '',
        targetValue: initialData.targetValue || '',
        correlationStrength: initialData.correlationStrength || 0.5,
        sampleSize: initialData.sampleSize || 0,
        confidenceInterval: initialData.confidenceInterval || 0.0,
        isStatistical: initialData.isStatistical || false,
        isManual: initialData.isManual || true
      });
    } else {
      // Reset form when opening without initial data
      setFormData({
        sourceValue: '',
        targetValue: '',
        correlationStrength: 0.5,
        sampleSize: 0,
        confidenceInterval: 0.0,
        isStatistical: false,
        isManual: true
      });
    }
  }, [initialData, open]);

  useEffect(() => {
    const fetchPropertyValues = async () => {
      setLoading(true);
      setError(null);
      try {
        // This would be replaced with actual API calls to get available values
        // For now, we'll use mock lists
        
        // Mock source property values based on the property name
        let mockSourceValues: string[] = [];
        if (sourceProperty === 'material') {
          mockSourceValues = ['porcelain', 'ceramic', 'natural stone', 'glass', 'metal'];
        } else if (sourceProperty === 'finish') {
          mockSourceValues = ['matte', 'glossy', 'polished', 'textured', 'honed'];
        } else if (sourceProperty === 'rRating') {
          mockSourceValues = ['R9', 'R10', 'R11', 'R12', 'R13'];
        } else {
          mockSourceValues = ['value1', 'value2', 'value3'];
        }
        
        // Mock target property values based on the property name
        let mockTargetValues: string[] = [];
        if (targetProperty === 'material') {
          mockTargetValues = ['porcelain', 'ceramic', 'natural stone', 'glass', 'metal'];
        } else if (targetProperty === 'finish') {
          mockTargetValues = ['matte', 'glossy', 'polished', 'textured', 'honed'];
        } else if (targetProperty === 'rRating') {
          mockTargetValues = ['R9', 'R10', 'R11', 'R12', 'R13'];
        } else {
          mockTargetValues = ['value1', 'value2', 'value3'];
        }
        
        setSourceValues(mockSourceValues);
        setTargetValues(mockTargetValues);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch property values');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPropertyValues();
  }, [token, sourceProperty, targetProperty]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleCorrelationSliderChange = (_event: Event, newValue: number | number[]) => {
    setFormData(prev => ({
      ...prev,
      correlationStrength: newValue as number
    }));
  };

  const handleConfidenceSliderChange = (_event: Event, newValue: number | number[]) => {
    setFormData(prev => ({
      ...prev,
      confidenceInterval: newValue as number
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
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialData ? 'Edit' : 'Add'} Value Correlation
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
              Define how values of {sourceProperty} correlate with values of {targetProperty}.
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="source-value-label">{sourceProperty} Value</InputLabel>
                  <Select
                    labelId="source-value-label"
                    id="sourceValue"
                    name="sourceValue"
                    value={formData.sourceValue}
                    onChange={handleSelectChange}
                    label={`${sourceProperty} Value`}
                    required
                  >
                    {sourceValues.map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="target-value-label">{targetProperty} Value</InputLabel>
                  <Select
                    labelId="target-value-label"
                    id="targetValue"
                    name="targetValue"
                    value={formData.targetValue}
                    onChange={handleSelectChange}
                    label={`${targetProperty} Value`}
                    required
                  >
                    {targetValues.map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Typography id="correlation-strength-slider" gutterBottom>
                Correlation Strength: {formData.correlationStrength.toFixed(2)}
              </Typography>
              <Slider
                value={formData.correlationStrength}
                onChange={handleCorrelationSliderChange}
                aria-labelledby="correlation-strength-slider"
                valueLabelDisplay="auto"
                step={0.01}
                marks={[
                  { value: -1, label: '-1' },
                  { value: 0, label: '0' },
                  { value: 1, label: '1' }
                ]}
                min={-1}
                max={1}
              />
              <Typography variant="caption" color="textSecondary">
                -1 (strong negative correlation), 0 (no correlation), 1 (strong positive correlation)
              </Typography>
            </Box>
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="sampleSize"
                  label="Sample Size"
                  name="sampleSize"
                  type="number"
                  value={formData.sampleSize}
                  onChange={handleNumberChange}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box>
                  <Typography id="confidence-interval-slider" gutterBottom>
                    Confidence Interval: {formData.confidenceInterval.toFixed(2)}
                  </Typography>
                  <Slider
                    value={formData.confidenceInterval}
                    onChange={handleConfidenceSliderChange}
                    aria-labelledby="confidence-interval-slider"
                    valueLabelDisplay="auto"
                    step={0.01}
                    marks
                    min={0}
                    max={1}
                  />
                </Box>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isStatistical}
                    onChange={handleCheckboxChange}
                    name="isStatistical"
                  />
                }
                label="Statistical Correlation (based on data analysis)"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isManual}
                    onChange={handleCheckboxChange}
                    name="isManual"
                  />
                }
                label="Manual Correlation (defined by expert)"
              />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={loading || !formData.sourceValue || !formData.targetValue}
        >
          {initialData ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
