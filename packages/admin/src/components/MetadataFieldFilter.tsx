import React from 'react';
import {
  Box,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  SelectChangeEvent
} from '@mui/material';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';

// Define field types
const FIELD_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' }
];

// Interface for filter options
export interface MetadataFieldFilterOptions {
  searchTerm: string;
  fieldType: string;
  materialType: MaterialType;
  isActive?: boolean;
}

// Props for the MetadataFieldFilter component
interface MetadataFieldFilterProps {
  filterOptions: MetadataFieldFilterOptions;
  onFilterChange: (options: MetadataFieldFilterOptions) => void;
}

/**
 * MetadataFieldFilter Component
 * 
 * A filter component for metadata fields with search, field type, and material type filters.
 */
const MetadataFieldFilter: React.FC<MetadataFieldFilterProps> = ({
  filterOptions,
  onFilterChange
}) => {
  // Handle search term change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filterOptions,
      searchTerm: event.target.value
    });
  };

  // Handle field type change
  const handleFieldTypeChange = (event: SelectChangeEvent<string>) => {
    onFilterChange({
      ...filterOptions,
      fieldType: event.target.value
    });
  };

  // Handle material type change
  const handleMaterialTypeChange = (value: MaterialType) => {
    onFilterChange({
      ...filterOptions,
      materialType: value
    });
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Filter Metadata Fields
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Search"
            placeholder="Search by name or description"
            value={filterOptions.searchTerm}
            onChange={handleSearchChange}
            variant="outlined"
            size="small"
          />
        </Grid>
        
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel id="field-type-filter-label">Field Type</InputLabel>
            <Select
              labelId="field-type-filter-label"
              id="field-type-filter"
              value={filterOptions.fieldType}
              onChange={handleFieldTypeChange}
              label="Field Type"
            >
              {FIELD_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <MaterialTypeSelector
            value={filterOptions.materialType}
            onChange={handleMaterialTypeChange}
            size="small"
          />
        </Grid>
      </Grid>
    </Paper>
  );
};

export default MetadataFieldFilter;
