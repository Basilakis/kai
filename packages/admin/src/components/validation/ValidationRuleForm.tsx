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
  CircularProgress,
  Typography
} from '@mui/material';
import {
  ValidationRuleType,
  ValidationSeverity
} from '@kai/shared/src/types/validation';
import RangeValidationFields from './formFields/RangeValidationFields';
import PatternValidationFields from './formFields/PatternValidationFields';
import EnumValidationFields from './formFields/EnumValidationFields';
import DependencyValidationFields from './formFields/DependencyValidationFields';
import CustomValidationFields from './formFields/CustomValidationFields';
import CompositeValidationFields from './formFields/CompositeValidationFields';

interface ValidationRuleFormProps {
  initialData?: any;
  materialType?: string;
  onSubmit: (formData: any) => void;
  isSubmitting: boolean;
  existingRules?: any[];
}

/**
 * Validation Rule Form Component
 * 
 * Form for creating and editing validation rules.
 */
const ValidationRuleForm: React.FC<ValidationRuleFormProps> = ({
  initialData,
  materialType,
  onSubmit,
  isSubmitting,
  existingRules = []
}) => {
  // Base form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: ValidationRuleType.RANGE,
    propertyName: '',
    materialType: materialType || '',
    severity: ValidationSeverity.ERROR,
    message: '',
    isActive: true
  });

  // Type-specific form data
  const [rangeData, setRangeData] = useState({
    min: undefined as number | undefined,
    max: undefined as number | undefined,
    step: undefined as number | undefined,
    unit: ''
  });

  const [patternData, setPatternData] = useState({
    pattern: '',
    flags: ''
  });

  const [enumData, setEnumData] = useState({
    allowedValues: [] as string[]
  });

  const [dependencyData, setDependencyData] = useState({
    condition: {
      propertyName: '',
      operator: '',
      value: undefined
    },
    requiredValue: undefined,
    requiredPattern: '',
    requiredRange: {
      min: undefined as number | undefined,
      max: undefined as number | undefined
    }
  });

  const [customData, setCustomData] = useState({
    functionName: '',
    parameters: {}
  });

  const [compositeData, setCompositeData] = useState({
    operator: '',
    rules: [] as string[]
  });

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Properties list
  const [properties, setProperties] = useState<string[]>([]);

  // Initialize form data from initialData
  useEffect(() => {
    if (initialData) {
      // Set base data
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        type: initialData.type || ValidationRuleType.RANGE,
        propertyName: initialData.propertyName || '',
        materialType: initialData.materialType || materialType || '',
        severity: initialData.severity || ValidationSeverity.ERROR,
        message: initialData.message || '',
        isActive: initialData.isActive !== undefined ? initialData.isActive : true
      });

      // Set type-specific data
      switch (initialData.type) {
        case ValidationRuleType.RANGE:
          setRangeData({
            min: initialData.min,
            max: initialData.max,
            step: initialData.step,
            unit: initialData.unit || ''
          });
          break;

        case ValidationRuleType.PATTERN:
          setPatternData({
            pattern: initialData.pattern || '',
            flags: initialData.flags || ''
          });
          break;

        case ValidationRuleType.ENUM:
          setEnumData({
            allowedValues: initialData.allowedValues || []
          });
          break;

        case ValidationRuleType.DEPENDENCY:
          setDependencyData({
            condition: initialData.condition || {
              propertyName: '',
              operator: '',
              value: undefined
            },
            requiredValue: initialData.requiredValue,
            requiredPattern: initialData.requiredPattern || '',
            requiredRange: initialData.requiredRange || {
              min: undefined,
              max: undefined
            }
          });
          break;

        case ValidationRuleType.CUSTOM:
          setCustomData({
            functionName: initialData.functionName || '',
            parameters: initialData.parameters || {}
          });
          break;

        case ValidationRuleType.COMPOSITE:
          setCompositeData({
            operator: initialData.operator || '',
            rules: initialData.rules || []
          });
          break;
      }
    } else {
      // Reset form for new rule
      setFormData({
        name: '',
        description: '',
        type: ValidationRuleType.RANGE,
        propertyName: '',
        materialType: materialType || '',
        severity: ValidationSeverity.ERROR,
        message: '',
        isActive: true
      });

      setRangeData({
        min: undefined,
        max: undefined,
        step: undefined,
        unit: ''
      });

      setPatternData({
        pattern: '',
        flags: ''
      });

      setEnumData({
        allowedValues: []
      });

      setDependencyData({
        condition: {
          propertyName: '',
          operator: '',
          value: undefined
        },
        requiredValue: undefined,
        requiredPattern: '',
        requiredRange: {
          min: undefined,
          max: undefined
        }
      });

      setCustomData({
        functionName: '',
        parameters: {}
      });

      setCompositeData({
        operator: '',
        rules: []
      });
    }
  }, [initialData, materialType]);

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        // In a real app, this would be an API call
        // For now, extract unique properties from existing rules
        const uniqueProperties = [...new Set(existingRules.map(rule => rule.propertyName))];
        setProperties(uniqueProperties);
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };

    fetchProperties();
  }, [existingRules]);

  // Handle base form input changes
  const handleBaseInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
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
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate base fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.propertyName.trim()) {
      newErrors.propertyName = 'Property name is required';
    }

    if (!formData.materialType.trim()) {
      newErrors.materialType = 'Material type is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Error message is required';
    }

    // Validate type-specific fields
    switch (formData.type) {
      case ValidationRuleType.RANGE:
        if (rangeData.min === undefined && rangeData.max === undefined) {
          newErrors.range = 'At least one of min or max is required';
        }
        break;

      case ValidationRuleType.PATTERN:
        if (!patternData.pattern.trim()) {
          newErrors.pattern = 'Pattern is required';
        }
        break;

      case ValidationRuleType.ENUM:
        if (enumData.allowedValues.length === 0) {
          newErrors.allowedValues = 'At least one allowed value is required';
        }
        break;

      case ValidationRuleType.DEPENDENCY:
        if (!dependencyData.condition.propertyName) {
          newErrors.conditionProperty = 'Condition property is required';
        }
        if (!dependencyData.condition.operator) {
          newErrors.conditionOperator = 'Condition operator is required';
        }
        break;

      case ValidationRuleType.CUSTOM:
        if (!customData.functionName) {
          newErrors.functionName = 'Function name is required';
        }
        break;

      case ValidationRuleType.COMPOSITE:
        if (!compositeData.operator) {
          newErrors.operator = 'Logical operator is required';
        }
        if (compositeData.rules.length === 0) {
          newErrors.rules = 'At least one rule is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      // Combine base data with type-specific data
      let submitData = { ...formData };

      switch (formData.type) {
        case ValidationRuleType.RANGE:
          submitData = { ...submitData, ...rangeData };
          break;

        case ValidationRuleType.PATTERN:
          submitData = { ...submitData, ...patternData };
          break;

        case ValidationRuleType.ENUM:
          submitData = { ...submitData, ...enumData };
          break;

        case ValidationRuleType.DEPENDENCY:
          submitData = { ...submitData, ...dependencyData };
          break;

        case ValidationRuleType.CUSTOM:
          submitData = { ...submitData, ...customData };
          break;

        case ValidationRuleType.COMPOSITE:
          submitData = { ...submitData, ...compositeData };
          break;
      }

      onSubmit(submitData);
    }
  };

  // Render type-specific fields
  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case ValidationRuleType.RANGE:
        return (
          <RangeValidationFields
            data={rangeData}
            onChange={setRangeData}
            errors={errors}
          />
        );

      case ValidationRuleType.PATTERN:
        return (
          <PatternValidationFields
            data={patternData}
            onChange={setPatternData}
            errors={errors}
          />
        );

      case ValidationRuleType.ENUM:
        return (
          <EnumValidationFields
            data={enumData}
            onChange={setEnumData}
            errors={errors}
          />
        );

      case ValidationRuleType.DEPENDENCY:
        return (
          <DependencyValidationFields
            data={dependencyData}
            onChange={setDependencyData}
            errors={errors}
            properties={properties}
          />
        );

      case ValidationRuleType.CUSTOM:
        return (
          <CustomValidationFields
            data={customData}
            onChange={setCustomData}
            errors={errors}
          />
        );

      case ValidationRuleType.COMPOSITE:
        return (
          <CompositeValidationFields
            data={compositeData}
            onChange={setCompositeData}
            errors={errors}
            existingRules={existingRules}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        {/* Base Fields */}
        <Grid item xs={12}>
          <TextField
            name="name"
            label="Rule Name"
            fullWidth
            required
            value={formData.name}
            onChange={handleBaseInputChange}
            error={!!errors.name}
            helperText={errors.name}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={handleBaseInputChange}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required error={!!errors.propertyName}>
            <InputLabel>Property Name</InputLabel>
            <Select
              name="propertyName"
              value={formData.propertyName}
              onChange={handleBaseInputChange}
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
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            name="materialType"
            label="Material Type"
            fullWidth
            required
            value={formData.materialType}
            onChange={handleBaseInputChange}
            error={!!errors.materialType}
            helperText={errors.materialType}
            disabled={isSubmitting || !!materialType}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Rule Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleBaseInputChange}
              label="Rule Type"
              disabled={isSubmitting || !!initialData}
            >
              <MenuItem value={ValidationRuleType.RANGE}>Range</MenuItem>
              <MenuItem value={ValidationRuleType.PATTERN}>Pattern</MenuItem>
              <MenuItem value={ValidationRuleType.ENUM}>Enumeration</MenuItem>
              <MenuItem value={ValidationRuleType.DEPENDENCY}>Dependency</MenuItem>
              <MenuItem value={ValidationRuleType.CUSTOM}>Custom</MenuItem>
              <MenuItem value={ValidationRuleType.COMPOSITE}>Composite</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Severity</InputLabel>
            <Select
              name="severity"
              value={formData.severity}
              onChange={handleBaseInputChange}
              label="Severity"
              disabled={isSubmitting}
            >
              <MenuItem value={ValidationSeverity.ERROR}>Error</MenuItem>
              <MenuItem value={ValidationSeverity.WARNING}>Warning</MenuItem>
              <MenuItem value={ValidationSeverity.INFO}>Info</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            name="message"
            label="Error Message"
            fullWidth
            required
            value={formData.message}
            onChange={handleBaseInputChange}
            error={!!errors.message}
            helperText={errors.message}
            disabled={isSubmitting}
          />
        </Grid>

        {/* Type-specific Fields */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            {formData.type} Validation Configuration
          </Typography>
          {renderTypeSpecificFields()}
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={24} /> : null}
            >
              {initialData ? 'Update' : 'Create'} Validation Rule
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ValidationRuleForm;
