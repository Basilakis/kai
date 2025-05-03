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
  Typography,
  Box,
  Grid,
  CircularProgress,
  Alert,
  FormHelperText
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { CompatibilityType } from '@kai/shared/src/types/property-relationships';

interface CompatibilityRuleFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  sourceProperty: string;
  targetProperty: string;
  initialData?: any;
}

export const CompatibilityRuleForm: React.FC<CompatibilityRuleFormProps> = ({
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
    compatibilityType: CompatibilityType.COMPATIBLE,
    reason: ''
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
        compatibilityType: initialData.compatibilityType || CompatibilityType.COMPATIBLE,
        reason: initialData.reason || ''
      });
    } else {
      // Reset form when opening without initial data
      setFormData({
        sourceValue: '',
        targetValue: '',
        compatibilityType: CompatibilityType.COMPATIBLE,
        reason: ''
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

  const getCompatibilityTypeDescription = (type: CompatibilityType) => {
    switch (type) {
      case CompatibilityType.COMPATIBLE:
        return 'These values work together but are not specifically recommended.';
      case CompatibilityType.RECOMMENDED:
        return 'These values are recommended to be used together.';
      case CompatibilityType.NOT_RECOMMENDED:
        return 'These values can work together but are not recommended.';
      case CompatibilityType.INCOMPATIBLE:
        return 'These values should not be used together.';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialData ? 'Edit' : 'Add'} Compatibility Rule
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
              Define how values of {sourceProperty} are compatible with values of {targetProperty}.
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
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="compatibility-type-label">Compatibility Type</InputLabel>
              <Select
                labelId="compatibility-type-label"
                id="compatibilityType"
                name="compatibilityType"
                value={formData.compatibilityType}
                onChange={handleSelectChange}
                label="Compatibility Type"
                required
              >
                <MenuItem value={CompatibilityType.COMPATIBLE}>Compatible</MenuItem>
                <MenuItem value={CompatibilityType.RECOMMENDED}>Recommended</MenuItem>
                <MenuItem value={CompatibilityType.NOT_RECOMMENDED}>Not Recommended</MenuItem>
                <MenuItem value={CompatibilityType.INCOMPATIBLE}>Incompatible</MenuItem>
              </Select>
              <FormHelperText>
                {getCompatibilityTypeDescription(formData.compatibilityType as CompatibilityType)}
              </FormHelperText>
            </FormControl>
            
            <TextField
              margin="normal"
              fullWidth
              id="reason"
              label="Reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              multiline
              rows={3}
              placeholder="Explain why these values have this compatibility relationship"
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
          disabled={loading || !formData.sourceValue || !formData.targetValue}
        >
          {initialData ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
