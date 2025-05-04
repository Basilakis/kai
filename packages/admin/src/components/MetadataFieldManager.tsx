import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  Grid,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';
import MaterialTypeIndicator, { getMaterialTypeFromCategories } from './MaterialTypeIndicator';
import MetadataFieldFilter, { MetadataFieldFilterOptions } from './MetadataFieldFilter';

// Define material types
const MATERIAL_TYPES = ['tile', 'wood', 'lighting', 'furniture', 'decoration', 'all'];

// Define field types
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' }
];

// Interface for metadata field
interface MetadataField {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  fieldType: 'text' | 'textarea' | 'number' | 'dropdown' | 'boolean' | 'date';
  isRequired: boolean;
  order: number;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    minLength?: number;
    maxLength?: number;
    step?: number;
    customMessage?: string;
  };
  options?: Array<{
    value: string;
    label: string;
  }>;
  unit?: string;
  hint?: string;
  extractionPatterns?: string[];
  extractionExamples?: string[];
  categories: string[];
  isActive: boolean;
}

/**
 * MetadataFieldManager Component
 *
 * This component provides an interface for managing metadata fields in the admin dashboard.
 */
const MetadataFieldManager: React.FC = () => {
  // State for metadata fields
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [filteredFields, setFilteredFields] = useState<MetadataField[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [selectedField, setSelectedField] = useState<MetadataField | null>(null);
  const [expandedMetadata, setExpandedMetadata] = useState<boolean>(false);
  const [expandedOptions, setExpandedOptions] = useState<boolean>(false);
  const [expandedExtraction, setExpandedExtraction] = useState<boolean>(false);
  const [optionsText, setOptionsText] = useState<string>('[]');
  const [extractionPatternsText, setExtractionPatternsText] = useState<string>('[]');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<MetadataFieldFilterOptions>({
    searchTerm: '',
    fieldType: 'all',
    materialType: 'all',
    isActive: true
  });

  // Form data state
  const [formData, setFormData] = useState<Partial<MetadataField>>({
    name: '',
    displayName: '',
    description: '',
    fieldType: 'text',
    isRequired: false,
    order: 0,
    defaultValue: '',
    validation: {},
    options: [],
    unit: '',
    hint: '',
    extractionPatterns: [],
    extractionExamples: [],
    categories: [],
    isActive: true
  });

  // Material type state for form
  const [materialType, setMaterialType] = useState<MaterialType>('all');

  // Load metadata fields
  useEffect(() => {
    loadFields();
  }, []);

  // Apply filters when fields or filter options change
  useEffect(() => {
    applyFilters();
  }, [fields, filterOptions]);

  // Apply filters to fields
  const applyFilters = () => {
    let result = [...fields];

    // Apply search filter
    if (filterOptions.searchTerm) {
      const searchTerm = filterOptions.searchTerm.toLowerCase();
      result = result.filter(field =>
        field.name.toLowerCase().includes(searchTerm) ||
        field.displayName.toLowerCase().includes(searchTerm) ||
        (field.description && field.description.toLowerCase().includes(searchTerm))
      );
    }

    // Apply field type filter
    if (filterOptions.fieldType && filterOptions.fieldType !== 'all') {
      result = result.filter(field => field.fieldType === filterOptions.fieldType);
    }

    // Apply material type filter
    if (filterOptions.materialType && filterOptions.materialType !== 'all') {
      result = result.filter(field => field.categories.includes(filterOptions.materialType));
    }

    // Apply active filter
    if (filterOptions.isActive !== undefined) {
      result = result.filter(field => field.isActive === filterOptions.isActive);
    }

    setFilteredFields(result);
  };

  // Handle filter change
  const handleFilterChange = (newFilterOptions: MetadataFieldFilterOptions) => {
    setFilterOptions(newFilterOptions);
  };

  // Load fields from API
  const loadFields = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.get('/admin/metadata-field');
      if (response.data && response.data.fields) {
        setFields(response.data.fields);
      } else {
        console.error('Unexpected API response format:', response.data);
        setSnackbar({
          open: true,
          message: 'Unexpected API response format',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error loading metadata fields:', error);
      setSnackbar({
        open: true,
        message: `Failed to load metadata fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle opening dialog for add/edit
  const handleOpenDialog = (field?: MetadataField): void => {
    if (field) {
      setSelectedField(field);
      setFormData({
        name: field.name,
        displayName: field.displayName,
        description: field.description || '',
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        order: field.order,
        defaultValue: field.defaultValue || '',
        validation: field.validation || {},
        options: field.options || [],
        unit: field.unit || '',
        hint: field.hint || '',
        extractionPatterns: field.extractionPatterns || [],
        extractionExamples: field.extractionExamples || [],
        categories: field.categories || [],
        isActive: field.isActive
      });
      setOptionsText(JSON.stringify(field.options || [], null, 2));
      setExtractionPatternsText(JSON.stringify(field.extractionPatterns || [], null, 2));

      // Set material type based on categories
      if (field.categories && field.categories.length > 0) {
        // Check if any of the categories match a material type
        const matchedType = MATERIAL_TYPES.find(type => field.categories.includes(type));
        if (matchedType) {
          setMaterialType(matchedType);
        } else {
          setMaterialType('all');
        }
      } else {
        setMaterialType('all');
      }
    } else {
      setSelectedField(null);
      setFormData({
        name: '',
        displayName: '',
        description: '',
        fieldType: 'text',
        isRequired: false,
        order: 0,
        defaultValue: '',
        validation: {},
        options: [],
        unit: '',
        hint: '',
        extractionPatterns: [],
        extractionExamples: [],
        categories: [],
        isActive: true
      });
      setOptionsText('[]');
      setExtractionPatternsText('[]');
      setMaterialType('all');
    }
    setExpandedMetadata(false);
    setExpandedOptions(false);
    setExpandedExtraction(false);
    setDialogOpen(true);
  };

  // Handle closing dialog
  const handleCloseDialog = (): void => {
    setDialogOpen(false);
  };

  // Handle opening delete dialog
  const handleOpenDeleteDialog = (field: MetadataField): void => {
    setSelectedField(field);
    setDeleteDialogOpen(true);
  };

  // Handle closing delete dialog
  const handleCloseDeleteDialog = (): void => {
    setDeleteDialogOpen(false);
    setSelectedField(null);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>): void => {
    const name = e.target.name as string;
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;

    setFormData((prev: Partial<MetadataField>) => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle material type change
  const handleMaterialTypeChange = (value: MaterialType): void => {
    setMaterialType(value);

    // Update categories based on material type
    setFormData((prev: Partial<MetadataField>) => {
      const categories = prev.categories || [];

      // Remove any existing material types
      const filteredCategories = categories.filter(cat => !MATERIAL_TYPES.includes(cat));

      // Add the new material type if it's not 'all'
      if (value !== 'all') {
        filteredCategories.push(value);
      }

      return {
        ...prev,
        categories: filteredCategories
      };
    });
  };

  // Handle options change
  const handleOptionsChange = (): boolean => {
    try {
      const options = JSON.parse(optionsText);
      setFormData((prev: Partial<MetadataField>) => ({
        ...prev,
        options
      }));
      return true;
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Invalid JSON format in options',
        severity: 'error'
      });
      return false;
    }
  };

  // Handle extraction patterns change
  const handleExtractionPatternsChange = (): boolean => {
    try {
      const extractionPatterns = JSON.parse(extractionPatternsText);
      setFormData((prev: Partial<MetadataField>) => ({
        ...prev,
        extractionPatterns
      }));
      return true;
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Invalid JSON format in extraction patterns',
        severity: 'error'
      });
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (): Promise<void> => {
    // Validate options JSON if expanded
    if (expandedOptions && !handleOptionsChange()) {
      return;
    }

    // Validate extraction patterns JSON if expanded
    if (expandedExtraction && !handleExtractionPatternsChange()) {
      return;
    }

    setLoading(true);
    try {
      if (selectedField) {
        // Update existing field
        const response = await api.put(`/admin/metadata-field/${selectedField.id}`, formData);
        console.log('Field updated successfully:', response.data);
        setSnackbar({
          open: true,
          message: 'Metadata field updated successfully',
          severity: 'success'
        });
      } else {
        // Create new field
        const response = await api.post('/admin/metadata-field', formData);
        console.log('Field created successfully:', response.data);
        setSnackbar({
          open: true,
          message: 'Metadata field created successfully',
          severity: 'success'
        });
      }
      handleCloseDialog();
      loadFields();
    } catch (error: any) {
      console.error('Error saving metadata field:', error);
      let errorMessage = 'Failed to save metadata field';

      // Extract error message from response if available
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle field deletion
  const handleDelete = async (): Promise<void> => {
    if (!selectedField) return;

    setLoading(true);
    try {
      const response = await api.delete(`/admin/metadata-field/${selectedField.id}`);
      console.log('Field deleted successfully:', response.data);
      setSnackbar({
        open: true,
        message: 'Metadata field deleted successfully',
        severity: 'success'
      });
      handleCloseDeleteDialog();
      loadFields();
    } catch (error: any) {
      console.error('Error deleting metadata field:', error);
      let errorMessage = 'Failed to delete metadata field';

      // Extract error message from response if available
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle snackbar close
  const handleSnackbarClose = (): void => {
    setSnackbar((prev) => ({
      ...prev,
      open: false
    }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Metadata Fields
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Field
        </Button>
      </Box>

      {/* Filter component */}
      <MetadataFieldFilter
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Field Type</TableCell>
              <TableCell>Material Type</TableCell>
              <TableCell>Required</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Loading metadata fields...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredFields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {fields.length === 0 ?
                    "No metadata fields found. Add some to get started." :
                    "No fields match the current filters. Try adjusting your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredFields.map((field) => {
                // Determine material type from categories
                const fieldMaterialType = getMaterialTypeFromCategories(field.categories);

                return (
                  <TableRow key={field.id}>
                    <TableCell>{field.name}</TableCell>
                    <TableCell>{field.displayName}</TableCell>
                    <TableCell>
                      {field.description ? (
                        field.description.length > 50 ?
                          `${field.description.substring(0, 50)}...` :
                          field.description
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={field.fieldType.charAt(0).toUpperCase() + field.fieldType.slice(1)}
                        size="small"
                        color={
                          field.fieldType === 'text' ? 'primary' :
                          field.fieldType === 'number' ? 'secondary' :
                          field.fieldType === 'dropdown' ? 'success' :
                          field.fieldType === 'boolean' ? 'warning' :
                          field.fieldType === 'textarea' ? 'info' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <MaterialTypeIndicator
                        materialType={fieldMaterialType as MaterialType}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {field.isRequired ? (
                        <Chip label="Required" size="small" color="error" />
                      ) : (
                        <Chip label="Optional" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={field.isActive ? 'Active' : 'Inactive'}
                        color={field.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton onClick={() => handleOpenDialog(field)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          onClick={() => handleOpenDeleteDialog(field)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Field Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedField ? 'Edit Metadata Field' : 'Add Metadata Field'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Field Name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  helperText="Unique identifier for the field (e.g., 'thickness')"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Display Name"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  required
                  helperText="User-friendly name (e.g., 'Thickness (mm)')"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                  helperText="Detailed description of what this field represents"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="field-type-label">Field Type</InputLabel>
                  <Select
                    labelId="field-type-label"
                    name="fieldType"
                    value={formData.fieldType}
                    onChange={handleInputChange}
                    label="Field Type"
                    required
                  >
                    {FIELD_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <MaterialTypeSelector
                  value={materialType}
                  onChange={handleMaterialTypeChange}
                  label="Material Type"
                  required
                  showDescription
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Order"
                  name="order"
                  type="number"
                  value={formData.order}
                  onChange={handleInputChange}
                  helperText="Display order in the UI"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isRequired}
                      onChange={handleInputChange}
                      name="isRequired"
                      color="primary"
                    />
                  }
                  label="Required Field"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      name="isActive"
                      color="primary"
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>

            <Divider />

            {/* Options Section (for dropdown fields) */}
            {formData.fieldType === 'dropdown' && (
              <Box>
                <Button
                  onClick={() => setExpandedOptions(!expandedOptions)}
                  endIcon={expandedOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ mb: 1 }}
                >
                  Dropdown Options
                </Button>

                {expandedOptions && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" paragraph>
                      Enter options as a JSON array of objects with value and label properties.
                      Example: [{"value": "ceramic", "label": "Ceramic"}, {"value": "porcelain", "label": "Porcelain"}]
                    </Typography>
                    <TextField
                      fullWidth
                      label="Options (JSON)"
                      multiline
                      rows={5}
                      value={optionsText}
                      onChange={(e) => setOptionsText(e.target.value)}
                      error={(() => {
                        try {
                          JSON.parse(optionsText);
                          return false;
                        } catch (e) {
                          return true;
                        }
                      })()}
                      helperText={(() => {
                        try {
                          JSON.parse(optionsText);
                          return 'Valid JSON';
                        } catch (e) {
                          return 'Invalid JSON format';
                        }
                      })()}
                      variant="outlined"
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </Box>
                )}
              </Box>
            )}

            {/* Extraction Patterns Section */}
            <Box>
              <Button
                onClick={() => setExpandedExtraction(!expandedExtraction)}
                endIcon={expandedExtraction ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ mb: 1 }}
              >
                OCR Extraction Patterns
              </Button>

              {expandedExtraction && (
                <Box>
                  <Typography variant="caption" color="text.secondary" paragraph>
                    Enter regular expression patterns for extracting this field from OCR text.
                    Example: ["(?i)thickness:?\\s*(\\d+(?:\\.\\d+)?)\\s*mm", "(?i)(\\d+(?:\\.\\d+)?)\\s*mm thick"]
                  </Typography>
                  <TextField
                    fullWidth
                    label="Extraction Patterns (JSON)"
                    multiline
                    rows={5}
                    value={extractionPatternsText}
                    onChange={(e) => setExtractionPatternsText(e.target.value)}
                    error={(() => {
                      try {
                        JSON.parse(extractionPatternsText);
                        return false;
                      } catch (e) {
                        return true;
                      }
                    })()}
                    helperText={(() => {
                      try {
                        JSON.parse(extractionPatternsText);
                        return 'Valid JSON';
                      } catch (e) {
                        return 'Invalid JSON format';
                      }
                    })()}
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />

                  <TextField
                    fullWidth
                    label="Extraction Hint"
                    name="hint"
                    value={formData.hint}
                    onChange={handleInputChange}
                    margin="normal"
                    helperText="Natural language hint for AI extraction (e.g., 'Look for thickness in millimeters')"
                  />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the metadata field "{selectedField?.displayName}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MetadataFieldManager;
