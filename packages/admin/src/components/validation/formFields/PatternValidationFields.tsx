import React from 'react';
import {
  Grid,
  TextField,
  FormHelperText,
  Typography,
  Box
} from '@mui/material';

interface PatternValidationFieldsProps {
  data: {
    pattern: string;
    flags: string;
  };
  onChange: (data: any) => void;
  errors: Record<string, string>;
}

/**
 * Pattern Validation Fields Component
 * 
 * Form fields specific to pattern validation rules.
 */
const PatternValidationFields: React.FC<PatternValidationFieldsProps> = ({
  data,
  onChange,
  errors
}) => {
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    onChange({
      ...data,
      [name]: value
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          name="pattern"
          label="Regular Expression Pattern"
          fullWidth
          required
          value={data.pattern}
          onChange={handleInputChange}
          error={!!errors.pattern}
          helperText={errors.pattern}
          placeholder="e.g., ^[A-Za-z0-9]+$"
        />
      </Grid>
      
      <Grid item xs={12}>
        <TextField
          name="flags"
          label="Regex Flags"
          fullWidth
          value={data.flags}
          onChange={handleInputChange}
          placeholder="e.g., i, g, m"
        />
        <FormHelperText>
          Common flags: i (case-insensitive), g (global), m (multi-line)
        </FormHelperText>
      </Grid>
      
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          Pattern Examples
        </Typography>
        <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
          <Typography variant="body2" component="div">
            <ul>
              <li><strong>Email:</strong> ^[^\s@]+@[^\s@]+\.[^\s@]+$</li>
              <li><strong>URL:</strong> ^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$</li>
              <li><strong>Alphanumeric:</strong> ^[A-Za-z0-9]+$</li>
              <li><strong>Numbers only:</strong> ^[0-9]+$</li>
              <li><strong>Hex color:</strong> ^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$</li>
            </ul>
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

export default PatternValidationFields;
