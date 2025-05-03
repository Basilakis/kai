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
  Box
} from '@mui/material';

interface CustomValidationFieldsProps {
  data: {
    functionName: string;
    parameters: Record<string, any>;
  };
  onChange: (data: any) => void;
  errors: Record<string, string>;
}

/**
 * Custom Validation Fields Component
 * 
 * Form fields specific to custom validation rules.
 */
const CustomValidationFields: React.FC<CustomValidationFieldsProps> = ({
  data,
  onChange,
  errors
}) => {
  const [parametersJson, setParametersJson] = useState<string>(
    JSON.stringify(data.parameters, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Available custom validators
  const availableValidators = [
    { name: 'isEmail', description: 'Validates if the value is a valid email address' },
    { name: 'isUrl', description: 'Validates if the value is a valid URL' },
    { name: 'isColor', description: 'Validates if the value is a valid color (hex, rgb, rgba)' },
    { name: 'isISO8601Date', description: 'Validates if the value is a valid ISO 8601 date' }
  ];

  // Handle function name change
  const handleFunctionNameChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    onChange({
      ...data,
      functionName: e.target.value as string
    });
  };

  // Handle parameters change
  const handleParametersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParametersJson(e.target.value);
    
    try {
      if (e.target.value.trim()) {
        const parsedParams = JSON.parse(e.target.value);
        onChange({
          ...data,
          parameters: parsedParams
        });
        setJsonError(null);
      } else {
        onChange({
          ...data,
          parameters: {}
        });
        setJsonError(null);
      }
    } catch (error) {
      setJsonError('Invalid JSON format');
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <FormControl fullWidth required error={!!errors.functionName}>
          <InputLabel>Validator Function</InputLabel>
          <Select
            value={data.functionName}
            onChange={handleFunctionNameChange}
            label="Validator Function"
          >
            {availableValidators.map(validator => (
              <MenuItem key={validator.name} value={validator.name}>
                {validator.name}
              </MenuItem>
            ))}
          </Select>
          {errors.functionName && (
            <FormHelperText>{errors.functionName}</FormHelperText>
          )}
        </FormControl>
      </Grid>
      
      {data.functionName && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Function Description
          </Typography>
          <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, mb: 2 }}>
            <Typography variant="body2">
              {availableValidators.find(v => v.name === data.functionName)?.description || 'No description available'}
            </Typography>
          </Box>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <TextField
          label="Parameters (JSON)"
          fullWidth
          multiline
          rows={4}
          value={parametersJson}
          onChange={handleParametersChange}
          error={!!jsonError}
          helperText={jsonError}
          placeholder='{"param1": "value1", "param2": 123}'
        />
        <FormHelperText>
          Enter parameters as a JSON object. Leave empty if no parameters are needed.
        </FormHelperText>
      </Grid>
    </Grid>
  );
};

export default CustomValidationFields;
