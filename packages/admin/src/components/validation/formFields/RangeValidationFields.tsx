import React from 'react';
import {
  Grid,
  TextField,
  FormHelperText
} from '@mui/material';

interface RangeValidationFieldsProps {
  data: {
    min?: number;
    max?: number;
    step?: number;
    unit: string;
  };
  onChange: (data: any) => void;
  errors: Record<string, string>;
}

/**
 * Range Validation Fields Component
 * 
 * Form fields specific to range validation rules.
 */
const RangeValidationFields: React.FC<RangeValidationFieldsProps> = ({
  data,
  onChange,
  errors
}) => {
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'min' || name === 'max' || name === 'step') {
      // Convert to number or undefined
      const numValue = value === '' ? undefined : Number(value);
      
      onChange({
        ...data,
        [name]: numValue
      });
    } else {
      onChange({
        ...data,
        [name]: value
      });
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <TextField
          name="min"
          label="Minimum Value"
          type="number"
          fullWidth
          value={data.min === undefined ? '' : data.min}
          onChange={handleInputChange}
          inputProps={{ step: 'any' }}
        />
      </Grid>
      
      <Grid item xs={12} md={4}>
        <TextField
          name="max"
          label="Maximum Value"
          type="number"
          fullWidth
          value={data.max === undefined ? '' : data.max}
          onChange={handleInputChange}
          inputProps={{ step: 'any' }}
        />
      </Grid>
      
      <Grid item xs={12} md={4}>
        <TextField
          name="step"
          label="Step"
          type="number"
          fullWidth
          value={data.step === undefined ? '' : data.step}
          onChange={handleInputChange}
          inputProps={{ step: 'any', min: 0 }}
        />
      </Grid>
      
      <Grid item xs={12}>
        <TextField
          name="unit"
          label="Unit"
          fullWidth
          value={data.unit}
          onChange={handleInputChange}
          placeholder="e.g., mm, kg, °C"
        />
      </Grid>
      
      {errors.range && (
        <Grid item xs={12}>
          <FormHelperText error>{errors.range}</FormHelperText>
        </Grid>
      )}
    </Grid>
  );
};

export default RangeValidationFields;
