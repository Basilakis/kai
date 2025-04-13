import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { SubscriptionTier, ModuleAccess, ApiLimits, StorageLimits, CreditLimits } from '../../types/subscription';

interface SubscriptionTierFormProps {
  tier?: SubscriptionTier | null;
  onSave: (tier: SubscriptionTier) => void;
  onCancel: () => void;
}

const defaultTier: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  price: 0,
  currency: 'usd',
  stripePriceId: '',
  stripeProductId: '',
  billingInterval: 'monthly',
  moduleAccess: [],
  apiLimits: {
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    requestsPerMonth: 10000,
    includedModules: []
  },
  storageLimits: {
    maxStorageGB: 1,
    maxFileSize: 10,
    maxFilesPerProject: 100
  },
  creditLimits: {
    includedCredits: 0,
    maxPurchasableCredits: 1000,
    creditPriceMultiplier: 1
  },
  maxProjects: 5,
  maxTeamMembers: 1,
  maxMoodboards: 5,
  supportLevel: 'basic',
  isPublic: true,
  customFeatures: []
};

const availableModules = [
  { id: 'moodboard', name: 'Moodboard' },
  { id: 'api', name: 'API Access' },
  { id: 'agents', name: 'AI Agents' },
  { id: '3dModels', name: '3D Models' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'teamCollaboration', name: 'Team Collaboration' }
];

const SubscriptionTierForm: React.FC<SubscriptionTierFormProps> = ({
  tier,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>>(
    tier ? { ...tier } : { ...defaultTier }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newFeature, setNewFeature] = useState<string>('');

  useEffect(() => {
    if (tier) {
      setFormData({ ...tier });
    } else {
      setFormData({ ...defaultTier });
    }
  }, [tier]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (!name) return;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: isNaN(numValue) ? 0 : numValue
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleNestedChange = (
    category: 'apiLimits' | 'storageLimits' | 'creditLimits',
    field: string,
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleModuleAccessChange = (moduleId: string, enabled: boolean) => {
    setFormData(prev => {
      const currentModules = [...prev.moduleAccess];
      const moduleIndex = currentModules.findIndex(m => m.name === moduleId);
      
      if (moduleIndex >= 0) {
        // Update existing module
        currentModules[moduleIndex] = {
          ...currentModules[moduleIndex],
          enabled
        };
      } else {
        // Add new module
        currentModules.push({
          name: moduleId,
          enabled
        });
      }
      
      return {
        ...prev,
        moduleAccess: currentModules
      };
    });
  };

  const isModuleEnabled = (moduleId: string): boolean => {
    const module = formData.moduleAccess.find(m => m.name === moduleId);
    return module ? module.enabled : false;
  };

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      customFeatures: [...(prev.customFeatures || []), newFeature.trim()]
    }));
    
    setNewFeature('');
  };

  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customFeatures: (prev.customFeatures || []).filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (formData.price < 0) {
      newErrors.price = 'Price cannot be negative';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // If editing, preserve the ID
    const tierToSave: any = {
      ...formData
    };
    
    if (tier?.id) {
      tierToSave.id = tier.id;
    }
    
    onSave(tierToSave);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                fullWidth
                required
                error={!!errors.name}
                helperText={errors.name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Billing Interval</InputLabel>
                <Select
                  name="billingInterval"
                  value={formData.billingInterval}
                  onChange={handleChange}
                  label="Billing Interval"
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                  <MenuItem value="one-time">One-time</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                fullWidth
                multiline
                rows={2}
                required
                error={!!errors.description}
                helperText={errors.description}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Price"
                name="price"
                type="number"
                value={formData.price}
                onChange={handleNumberChange}
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                error={!!errors.price}
                helperText={errors.price}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  label="Currency"
                >
                  <MenuItem value="usd">USD</MenuItem>
                  <MenuItem value="eur">EUR</MenuItem>
                  <MenuItem value="gbp">GBP</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={handleSwitchChange}
                    name="isPublic"
                  />
                }
                label="Publicly Visible"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Support Level</InputLabel>
                <Select
                  name="supportLevel"
                  value={formData.supportLevel}
                  onChange={handleChange}
                  label="Support Level"
                >
                  <MenuItem value="basic">Basic</MenuItem>
                  <MenuItem value="priority">Priority</MenuItem>
                  <MenuItem value="dedicated">Dedicated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Grid>
        
        <Grid item xs={12}>
          <Divider />
        </Grid>
        
        {/* Stripe Integration */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Stripe Integration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Stripe Product ID"
                    name="stripeProductId"
                    value={formData.stripeProductId}
                    onChange={handleChange}
                    fullWidth
                    placeholder="prod_..."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Stripe Price ID"
                    name="stripePriceId"
                    value={formData.stripePriceId}
                    onChange={handleChange}
                    fullWidth
                    placeholder="price_..."
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        {/* Module Access */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Module Access</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                {availableModules.map(module => (
                  <FormControlLabel
                    key={module.id}
                    control={
                      <Switch
                        checked={isModuleEnabled(module.id)}
                        onChange={(e) => handleModuleAccessChange(module.id, e.target.checked)}
                      />
                    }
                    label={module.name}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        {/* API Limits */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">API Limits</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Requests Per Minute"
                    type="number"
                    value={formData.apiLimits.requestsPerMinute}
                    onChange={(e) => handleNestedChange('apiLimits', 'requestsPerMinute', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Requests Per Day"
                    type="number"
                    value={formData.apiLimits.requestsPerDay}
                    onChange={(e) => handleNestedChange('apiLimits', 'requestsPerDay', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Requests Per Month"
                    type="number"
                    value={formData.apiLimits.requestsPerMonth}
                    onChange={(e) => handleNestedChange('apiLimits', 'requestsPerMonth', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        {/* Storage Limits */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Storage Limits</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max Storage (GB)"
                    type="number"
                    value={formData.storageLimits.maxStorageGB}
                    onChange={(e) => handleNestedChange('storageLimits', 'maxStorageGB', parseFloat(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0, step: 0.1 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max File Size (MB)"
                    type="number"
                    value={formData.storageLimits.maxFileSize}
                    onChange={(e) => handleNestedChange('storageLimits', 'maxFileSize', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max Files Per Project"
                    type="number"
                    value={formData.storageLimits.maxFilesPerProject}
                    onChange={(e) => handleNestedChange('storageLimits', 'maxFilesPerProject', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        {/* Credit Limits */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Credit Limits</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Included Credits"
                    type="number"
                    value={formData.creditLimits.includedCredits}
                    onChange={(e) => handleNestedChange('creditLimits', 'includedCredits', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max Purchasable Credits"
                    type="number"
                    value={formData.creditLimits.maxPurchasableCredits}
                    onChange={(e) => handleNestedChange('creditLimits', 'maxPurchasableCredits', parseInt(e.target.value) || 0)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Credit Price Multiplier"
                    type="number"
                    value={formData.creditLimits.creditPriceMultiplier}
                    onChange={(e) => handleNestedChange('creditLimits', 'creditPriceMultiplier', parseFloat(e.target.value) || 1)}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0.1, step: 0.1 }
                    }}
                    helperText="1.0 = standard price, 0.8 = 20% discount"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        {/* Resource Limits */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Resource Limits</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max Projects"
                    name="maxProjects"
                    type="number"
                    value={formData.maxProjects || 0}
                    onChange={handleNumberChange}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max Team Members"
                    name="maxTeamMembers"
                    type="number"
                    value={formData.maxTeamMembers || 0}
                    onChange={handleNumberChange}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Max Moodboards"
                    name="maxMoodboards"
                    type="number"
                    value={formData.maxMoodboards || 0}
                    onChange={handleNumberChange}
                    fullWidth
                    InputProps={{
                      inputProps: { min: 0 }
                    }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        {/* Custom Features */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Custom Features</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center">
                    <TextField
                      label="Add Feature"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      fullWidth
                      placeholder="Enter a custom feature"
                    />
                    <IconButton 
                      color="primary" 
                      onClick={handleAddFeature}
                      disabled={!newFeature.trim()}
                      sx={{ ml: 1 }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {(formData.customFeatures || []).map((feature, index) => (
                      <Chip
                        key={index}
                        label={feature}
                        onDelete={() => handleRemoveFeature(index)}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                    {(formData.customFeatures || []).length === 0 && (
                      <Typography variant="body2" color="textSecondary">
                        No custom features added
                      </Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
      
      <Box display="flex" justifyContent="flex-end" mt={3}>
        <Button onClick={onCancel} sx={{ mr: 2 }}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" color="primary">
          {tier ? 'Update Tier' : 'Create Tier'}
        </Button>
      </Box>
    </form>
  );
};

export default SubscriptionTierForm;
