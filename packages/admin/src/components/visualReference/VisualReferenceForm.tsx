import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Chip,
  CircularProgress,
  Typography,
  Autocomplete
} from '@mui/material';
import { useAuth } from '../../../client/src/hooks/useAuth';

interface VisualReferenceFormProps {
  initialData?: any;
  materialType?: string;
  onSubmit: (formData: any) => void;
  isSubmitting: boolean;
}

/**
 * Visual Reference Form Component
 * 
 * Form for creating and editing visual references.
 */
const VisualReferenceForm: React.FC<VisualReferenceFormProps> = ({
  initialData,
  materialType,
  onSubmit,
  isSubmitting
}) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    propertyName: '',
    propertyValue: '',
    materialType: materialType || '',
    source: 'internal',
    sourceUrl: '',
    tags: [] as string[]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [properties, setProperties] = useState<string[]>([]);
  const [propertyValues, setPropertyValues] = useState<Record<string, string[]>>({});
  const [materialTypes, setMaterialTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [tagInput, setTagInput] = useState<string>('');

  // Initialize form data from initialData
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        propertyName: initialData.propertyName || '',
        propertyValue: initialData.propertyValue || '',
        materialType: initialData.materialType || materialType || '',
        source: initialData.source || 'internal',
        sourceUrl: initialData.sourceUrl || '',
        tags: initialData.tags || []
      });
    } else {
      setFormData({
        title: '',
        description: '',
        propertyName: '',
        propertyValue: '',
        materialType: materialType || '',
        source: 'internal',
        sourceUrl: '',
        tags: []
      });
    }
  }, [initialData, materialType]);

  // Fetch properties and material types
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        
        // Fetch properties
        const propertiesResponse = await fetch('/api/properties', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          if (propertiesData.success) {
            const propertyNames = propertiesData.properties.map((p: any) => p.name);
            setProperties(propertyNames);
            
            // Create a map of property values
            const valueMap: Record<string, string[]> = {};
            propertiesData.properties.forEach((p: any) => {
              if (p.allowedValues && Array.isArray(p.allowedValues)) {
                valueMap[p.name] = p.allowedValues;
              }
            });
            setPropertyValues(valueMap);
          }
        }
        
        // Fetch material types
        const materialTypesResponse = await fetch('/api/materials/types', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (materialTypesResponse.ok) {
          const materialTypesData = await materialTypesResponse.json();
          if (materialTypesData.success) {
            setMaterialTypes(materialTypesData.types);
          }
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetadata();
  }, [token]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    
    if (name) {
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
      
      // If property name changes, reset property value
      if (name === 'propertyName') {
        setFormData(prev => ({
          ...prev,
          propertyValue: ''
        }));
      }
    }
  };

  // Handle tag input
  const handleAddTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput]
      }));
      setTagInput('');
    }
  };

  // Handle tag deletion
  const handleDeleteTag = (tagToDelete: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToDelete)
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.propertyName.trim()) {
      newErrors.propertyName = 'Property name is required';
    }
    
    if (!formData.propertyValue.trim()) {
      newErrors.propertyValue = 'Property value is required';
    }
    
    if (!formData.materialType.trim()) {
      newErrors.materialType = 'Material type is required';
    }
    
    if (formData.source === 'external' && !formData.sourceUrl.trim()) {
      newErrors.sourceUrl = 'Source URL is required for external sources';
    }
    
    if (formData.sourceUrl && !formData.sourceUrl.match(/^https?:\/\/.+/)) {
      newErrors.sourceUrl = 'Source URL must be a valid URL';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            name="title"
            label="Title"
            fullWidth
            required
            value={formData.title}
            onChange={handleChange}
            error={!!errors.title}
            helperText={errors.title}
            disabled={isSubmitting}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography variant="body2">Loading properties...</Typography>
            </Box>
          ) : (
            <FormControl fullWidth required error={!!errors.propertyName}>
              <InputLabel>Property Name</InputLabel>
              <Select
                name="propertyName"
                value={formData.propertyName}
                onChange={handleChange}
                label="Property Name"
                disabled={isSubmitting}
              >
                {properties.map(property => (
                  <MenuItem key={property} value={property}>
                    {property}
                  </MenuItem>
                ))}
              </Select>
              {errors.propertyName && (
                <FormHelperText>{errors.propertyName}</FormHelperText>
              )}
            </FormControl>
          )}
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required error={!!errors.propertyValue} disabled={!formData.propertyName}>
            <InputLabel>Property Value</InputLabel>
            <Select
              name="propertyValue"
              value={formData.propertyValue}
              onChange={handleChange}
              label="Property Value"
              disabled={isSubmitting || !formData.propertyName}
            >
              {formData.propertyName && propertyValues[formData.propertyName] ? (
                propertyValues[formData.propertyName].map(value => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="" disabled>
                  Select a property name first
                </MenuItem>
              )}
            </Select>
            {errors.propertyValue && (
              <FormHelperText>{errors.propertyValue}</FormHelperText>
            )}
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={6}>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography variant="body2">Loading material types...</Typography>
            </Box>
          ) : (
            <FormControl fullWidth required error={!!errors.materialType}>
              <InputLabel>Material Type</InputLabel>
              <Select
                name="materialType"
                value={formData.materialType}
                onChange={handleChange}
                label="Material Type"
                disabled={isSubmitting || !!materialType}
              >
                {materialTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
              {errors.materialType && (
                <FormHelperText>{errors.materialType}</FormHelperText>
              )}
            </FormControl>
          )}
        </Grid>
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Source</InputLabel>
            <Select
              name="source"
              value={formData.source}
              onChange={handleChange}
              label="Source"
              disabled={isSubmitting}
            >
              <MenuItem value="internal">Internal</MenuItem>
              <MenuItem value="external">External</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        {formData.source === 'external' && (
          <Grid item xs={12}>
            <TextField
              name="sourceUrl"
              label="Source URL"
              fullWidth
              required
              value={formData.sourceUrl}
              onChange={handleChange}
              error={!!errors.sourceUrl}
              helperText={errors.sourceUrl}
              disabled={isSubmitting}
              placeholder="https://example.com"
            />
          </Grid>
        )}
        
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Tags
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {formData.tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => handleDeleteTag(tag)}
                disabled={isSubmitting}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Add Tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              disabled={isSubmitting}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              fullWidth
            />
            <Button
              variant="outlined"
              onClick={handleAddTag}
              disabled={isSubmitting || !tagInput}
            >
              Add
            </Button>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={24} /> : null}
            >
              {initialData ? 'Update' : 'Create'} Visual Reference
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VisualReferenceForm;
