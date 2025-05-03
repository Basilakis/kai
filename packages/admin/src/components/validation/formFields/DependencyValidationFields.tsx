import React, { useState } from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
  Box,
  Divider,
  RadioGroup,
  Radio,
  FormControlLabel
} from '@mui/material';
import { ValidationOperator } from '@kai/shared/src/types/validation';

interface DependencyValidationFieldsProps {
  data: {
    condition: {
      propertyName: string;
      operator: string;
      value?: any;
    };
    requiredValue?: any;
    requiredPattern?: string;
    requiredRange?: {
      min?: number;
      max?: number;
    };
  };
  onChange: (data: any) => void;
  errors: Record<string, string>;
  properties: string[];
}

/**
 * Dependency Validation Fields Component
 * 
 * Form fields specific to dependency validation rules.
 */
const DependencyValidationFields: React.FC<DependencyValidationFieldsProps> = ({
  data,
  onChange,
  errors,
  properties
}) => {
  const [requirementType, setRequirementType] = useState<string>(
    data.requiredValue !== undefined ? 'value' :
    data.requiredPattern ? 'pattern' :
    data.requiredRange?.min !== undefined || data.requiredRange?.max !== undefined ? 'range' :
    'value'
  );

  // Handle condition change
  const handleConditionChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    
    if (name) {
      onChange({
        ...data,
        condition: {
          ...data.condition,
          [name.replace('condition_', '')]: value
        }
      });
    }
  };

  // Handle condition value change
  const handleConditionValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    
    onChange({
      ...data,
      condition: {
        ...data.condition,
        value
      }
    });
  };

  // Handle requirement type change
  const handleRequirementTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newType = e.target.value;
    setRequirementType(newType);
    
    // Reset other requirement types
    const newData = { ...data };
    
    if (newType === 'value') {
      newData.requiredPattern = '';
      newData.requiredRange = { min: undefined, max: undefined };
    } else if (newType === 'pattern') {
      newData.requiredValue = undefined;
      newData.requiredRange = { min: undefined, max: undefined };
    } else if (newType === 'range') {
      newData.requiredValue = undefined;
      newData.requiredPattern = '';
    }
    
    onChange(newData);
  };

  // Handle required value change
  const handleRequiredValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    
    onChange({
      ...data,
      requiredValue: value
    });
  };

  // Handle required pattern change
  const handleRequiredPatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    
    onChange({
      ...data,
      requiredPattern: value
    });
  };

  // Handle required range change
  const handleRequiredRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    const numValue = value === '' ? undefined : Number(value);
    
    onChange({
      ...data,
      requiredRange: {
        ...data.requiredRange,
        [name.replace('range_', '')]: numValue
      }
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          Condition
        </Typography>
        <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth required error={!!errors.conditionProperty}>
                <InputLabel>Property</InputLabel>
                <Select
                  name="condition_propertyName"
                  value={data.condition.propertyName}
                  onChange={handleConditionChange}
                  label="Property"
                >
                  {properties.map(property => (
                    <MenuItem key={property} value={property}>
                      {property}
                    </MenuItem>
                  ))}
                </Select>
                {errors.conditionProperty && (
                  <FormHelperText>{errors.conditionProperty}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth required error={!!errors.conditionOperator}>
                <InputLabel>Operator</InputLabel>
                <Select
                  name="condition_operator"
                  value={data.condition.operator}
                  onChange={handleConditionChange}
                  label="Operator"
                >
                  <MenuItem value={ValidationOperator.EQUALS}>Equals</MenuItem>
                  <MenuItem value={ValidationOperator.NOT_EQUALS}>Not Equals</MenuItem>
                  <MenuItem value={ValidationOperator.GREATER_THAN}>Greater Than</MenuItem>
                  <MenuItem value={ValidationOperator.LESS_THAN}>Less Than</MenuItem>
                  <MenuItem value={ValidationOperator.GREATER_THAN_OR_EQUALS}>Greater Than or Equals</MenuItem>
                  <MenuItem value={ValidationOperator.LESS_THAN_OR_EQUALS}>Less Than or Equals</MenuItem>
                  <MenuItem value={ValidationOperator.CONTAINS}>Contains</MenuItem>
                  <MenuItem value={ValidationOperator.NOT_CONTAINS}>Not Contains</MenuItem>
                  <MenuItem value={ValidationOperator.STARTS_WITH}>Starts With</MenuItem>
                  <MenuItem value={ValidationOperator.ENDS_WITH}>Ends With</MenuItem>
                  <MenuItem value={ValidationOperator.MATCHES}>Matches (Regex)</MenuItem>
                  <MenuItem value={ValidationOperator.EXISTS}>Exists</MenuItem>
                  <MenuItem value={ValidationOperator.NOT_EXISTS}>Not Exists</MenuItem>
                </Select>
                {errors.conditionOperator && (
                  <FormHelperText>{errors.conditionOperator}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                label="Value"
                fullWidth
                value={data.condition.value || ''}
                onChange={handleConditionValueChange}
                disabled={
                  data.condition.operator === ValidationOperator.EXISTS ||
                  data.condition.operator === ValidationOperator.NOT_EXISTS
                }
              />
            </Grid>
          </Grid>
        </Box>
      </Grid>
      
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          Requirement
        </Typography>
        
        <RadioGroup
          value={requirementType}
          onChange={handleRequirementTypeChange}
          sx={{ mb: 2 }}
        >
          <FormControlLabel value="value" control={<Radio />} label="Specific Value" />
          <FormControlLabel value="pattern" control={<Radio />} label="Pattern Match" />
          <FormControlLabel value="range" control={<Radio />} label="Numeric Range" />
        </RadioGroup>
        
        {requirementType === 'value' && (
          <TextField
            label="Required Value"
            fullWidth
            value={data.requiredValue || ''}
            onChange={handleRequiredValueChange}
            placeholder="Value that must be present when condition is met"
          />
        )}
        
        {requirementType === 'pattern' && (
          <TextField
            label="Required Pattern"
            fullWidth
            value={data.requiredPattern || ''}
            onChange={handleRequiredPatternChange}
            placeholder="e.g., ^[A-Za-z0-9]+$"
          />
        )}
        
        {requirementType === 'range' && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                name="range_min"
                label="Minimum Value"
                type="number"
                fullWidth
                value={data.requiredRange?.min === undefined ? '' : data.requiredRange.min}
                onChange={handleRequiredRangeChange}
                inputProps={{ step: 'any' }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                name="range_max"
                label="Maximum Value"
                type="number"
                fullWidth
                value={data.requiredRange?.max === undefined ? '' : data.requiredRange.max}
                onChange={handleRequiredRangeChange}
                inputProps={{ step: 'any' }}
              />
            </Grid>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
};

export default DependencyValidationFields;
