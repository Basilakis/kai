import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { ServiceCost } from '../../services/serviceCostService';

interface ServiceCostFormProps {
  serviceCost?: ServiceCost;
  open: boolean;
  onClose: () => void;
  onSave: (serviceCost: Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

// Default service cost for new entries
const defaultServiceCost: Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'> = {
  serviceName: '',
  serviceKey: '',
  costPerUnit: 0.0001,
  unitType: 'token',
  multiplier: 1.0,
  description: '',
  isActive: true
};

// Available unit types
const unitTypes = [
  { value: 'token', label: 'Token' },
  { value: 'image', label: 'Image' },
  { value: 'request', label: 'Request' },
  { value: 'minute', label: 'Minute' },
  { value: 'megabyte', label: 'Megabyte' }
];

const ServiceCostForm: React.FC<ServiceCostFormProps> = ({
  serviceCost,
  open,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>>(
    serviceCost ? {
      serviceName: serviceCost.serviceName,
      serviceKey: serviceCost.serviceKey,
      costPerUnit: serviceCost.costPerUnit,
      unitType: serviceCost.unitType,
      multiplier: serviceCost.multiplier,
      description: serviceCost.description || '',
      isActive: serviceCost.isActive
    } : { ...defaultServiceCost }
  );
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when serviceCost changes
  useEffect(() => {
    if (serviceCost) {
      setFormData({
        serviceName: serviceCost.serviceName,
        serviceKey: serviceCost.serviceKey,
        costPerUnit: serviceCost.costPerUnit,
        unitType: serviceCost.unitType,
        multiplier: serviceCost.multiplier,
        description: serviceCost.description || '',
        isActive: serviceCost.isActive
      });
    } else {
      setFormData({ ...defaultServiceCost });
    }
    setErrors({});
  }, [serviceCost, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name as string]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name as string]: value }));
    }
    
    // Clear error when field is edited
    if (errors[name as string]) {
      setErrors(prev => ({ ...prev, [name as string]: '' }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    if (!isNaN(numValue)) {
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.serviceName.trim()) {
      newErrors.serviceName = 'Service name is required';
    }
    
    if (!formData.serviceKey.trim()) {
      newErrors.serviceKey = 'Service key is required';
    } else if (!/^[a-z0-9.-]+\.[a-z0-9.-]+$/.test(formData.serviceKey)) {
      newErrors.serviceKey = 'Service key should be in format: provider.service';
    }
    
    if (formData.costPerUnit <= 0) {
      newErrors.costPerUnit = 'Cost per unit must be greater than 0';
    }
    
    if (!formData.unitType) {
      newErrors.unitType = 'Unit type is required';
    }
    
    if (formData.multiplier <= 0) {
      newErrors.multiplier = 'Multiplier must be greater than 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {serviceCost ? 'Edit Service Cost' : 'Add Service Cost'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                name="serviceName"
                label="Service Name"
                value={formData.serviceName}
                onChange={handleChange}
                fullWidth
                required
                error={!!errors.serviceName}
                helperText={errors.serviceName}
                placeholder="OpenAI GPT-4"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                name="serviceKey"
                label="Service Key"
                value={formData.serviceKey}
                onChange={handleChange}
                fullWidth
                required
                error={!!errors.serviceKey}
                helperText={errors.serviceKey || 'Format: provider.service (e.g., openai.gpt-4)'}
                placeholder="openai.gpt-4"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                name="costPerUnit"
                label="Cost Per Unit"
                value={formData.costPerUnit}
                onChange={handleNumberChange}
                fullWidth
                required
                type="number"
                inputProps={{ step: '0.000001', min: '0.000001' }}
                error={!!errors.costPerUnit}
                helperText={errors.costPerUnit}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth required error={!!errors.unitType}>
                <InputLabel>Unit Type</InputLabel>
                <Select
                  name="unitType"
                  value={formData.unitType}
                  onChange={handleChange}
                  label="Unit Type"
                >
                  {unitTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.unitType && <FormHelperText>{errors.unitType}</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                name="multiplier"
                label="Multiplier"
                value={formData.multiplier}
                onChange={handleNumberChange}
                fullWidth
                required
                type="number"
                inputProps={{ step: '0.1', min: '0.1' }}
                error={!!errors.multiplier}
                helperText={errors.multiplier || 'Profit margin multiplier'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description"
                value={formData.description}
                onChange={handleChange}
                fullWidth
                multiline
                rows={3}
                placeholder="Detailed description of the service and its pricing"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    color="primary"
                  />
                }
                label="Active"
              />
              <Typography variant="caption" color="textSecondary" display="block">
                Inactive services will not be available for credit usage
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} color="primary" variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ServiceCostForm;
