import React, { useState } from 'react';
import {
  Grid,
  TextField,
  Button,
  Chip,
  Box,
  FormHelperText,
  IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

interface EnumValidationFieldsProps {
  data: {
    allowedValues: string[];
  };
  onChange: (data: any) => void;
  errors: Record<string, string>;
}

/**
 * Enum Validation Fields Component
 * 
 * Form fields specific to enum validation rules.
 */
const EnumValidationFields: React.FC<EnumValidationFieldsProps> = ({
  data,
  onChange,
  errors
}) => {
  const [newValue, setNewValue] = useState<string>('');

  // Handle adding a new value
  const handleAddValue = () => {
    if (newValue.trim() && !data.allowedValues.includes(newValue.trim())) {
      onChange({
        ...data,
        allowedValues: [...data.allowedValues, newValue.trim()]
      });
      setNewValue('');
    }
  };

  // Handle removing a value
  const handleRemoveValue = (valueToRemove: string) => {
    onChange({
      ...data,
      allowedValues: data.allowedValues.filter(value => value !== valueToRemove)
    });
  };

  // Handle key press (Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddValue();
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="Add Allowed Value"
            fullWidth
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter a value and press Add"
          />
          <Button
            variant="outlined"
            onClick={handleAddValue}
            disabled={!newValue.trim()}
            startIcon={<AddIcon />}
          >
            Add
          </Button>
        </Box>
        {errors.allowedValues && (
          <FormHelperText error>{errors.allowedValues}</FormHelperText>
        )}
      </Grid>
      
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {data.allowedValues.length === 0 ? (
            <FormHelperText>No allowed values added yet</FormHelperText>
          ) : (
            data.allowedValues.map((value, index) => (
              <Chip
                key={index}
                label={value}
                onDelete={() => handleRemoveValue(value)}
                deleteIcon={<DeleteIcon />}
              />
            ))
          )}
        </Box>
      </Grid>
    </Grid>
  );
};

export default EnumValidationFields;
