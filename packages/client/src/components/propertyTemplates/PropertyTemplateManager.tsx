import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FileCopy as DuplicateIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../hooks/useAuth';
import { MaterialTypeEnum } from '@kai/shared';
import apiClient from '../../services/apiClient';

// Property Template type
interface PropertyTemplate {
  id: string;
  name: string;
  description?: string;
  materialType?: string;
  categoryId?: string;
  parentTemplateId?: string;
  isActive: boolean;
  priority: number;
  properties: Record<string, any>;
  overrideRules: {
    field: string;
    condition?: string;
    value?: any;
  }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Category type
interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  path: string[];
  level: number;
}

// Property Template Form type
interface PropertyTemplateForm {
  name: string;
  description: string;
  materialType: string;
  categoryId: string;
  parentTemplateId: string;
  isActive: boolean;
  priority: number;
  properties: Record<string, any>;
  overrideRules: {
    field: string;
    condition: string;
    value: any;
  }[];
}

// Initial form state
const initialFormState: PropertyTemplateForm = {
  name: '',
  description: '',
  materialType: '',
  categoryId: '',
  parentTemplateId: '',
  isActive: true,
  priority: 0,
  properties: {},
  overrideRules: []
};

/**
 * Property Template Manager Component
 */
const PropertyTemplateManager: React.FC = () => {
  // State
  const [templates, setTemplates] = useState<PropertyTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<PropertyTemplateForm>(initialFormState);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [propertyKey, setPropertyKey] = useState<string>('');
  const [propertyValue, setPropertyValue] = useState<string>('');
  const [ruleField, setRuleField] = useState<string>('');
  const [ruleCondition, setRuleCondition] = useState<string>('');
  const [ruleValue, setRuleValue] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Hooks
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  // Fetch templates and categories on component mount
  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/property-templates');
      setTemplates(response.data.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      enqueueSnackbar('Failed to fetch property templates', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/api/categories');
      setCategories(response.data.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      enqueueSnackbar('Failed to fetch categories', { variant: 'error' });
    }
  };

  // Handle form open
  const handleFormOpen = (template?: PropertyTemplate) => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        materialType: template.materialType || '',
        categoryId: template.categoryId || '',
        parentTemplateId: template.parentTemplateId || '',
        isActive: template.isActive,
        priority: template.priority,
        properties: { ...template.properties },
        overrideRules: [...template.overrideRules]
      });
      setEditMode(true);
      setCurrentTemplateId(template.id);
    } else {
      setFormData(initialFormState);
      setEditMode(false);
      setCurrentTemplateId(null);
    }
    setFormOpen(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setFormOpen(false);
    setFormData(initialFormState);
    setEditMode(false);
    setCurrentTemplateId(null);
  };

  // Handle form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editMode && currentTemplateId) {
        await apiClient.put(`/api/property-templates/${currentTemplateId}`, formData);
        enqueueSnackbar('Property template updated successfully', { variant: 'success' });
      } else {
        await apiClient.post('/api/property-templates', formData);
        enqueueSnackbar('Property template created successfully', { variant: 'success' });
      }
      handleFormClose();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      enqueueSnackbar('Failed to save property template', { variant: 'error' });
    }
  };

  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Handle switch change
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({
      ...formData,
      [name]: checked
    });
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Add property
  const handleAddProperty = () => {
    if (propertyKey.trim() === '') {
      enqueueSnackbar('Property key cannot be empty', { variant: 'error' });
      return;
    }

    setFormData({
      ...formData,
      properties: {
        ...formData.properties,
        [propertyKey]: propertyValue
      }
    });

    setPropertyKey('');
    setPropertyValue('');
  };

  // Remove property
  const handleRemoveProperty = (key: string) => {
    const newProperties = { ...formData.properties };
    delete newProperties[key];
    setFormData({
      ...formData,
      properties: newProperties
    });
  };

  // Add rule
  const handleAddRule = () => {
    if (ruleField.trim() === '') {
      enqueueSnackbar('Rule field cannot be empty', { variant: 'error' });
      return;
    }

    setFormData({
      ...formData,
      overrideRules: [
        ...formData.overrideRules,
        {
          field: ruleField,
          condition: ruleCondition,
          value: ruleValue
        }
      ]
    });

    setRuleField('');
    setRuleCondition('');
    setRuleValue('');
  };

  // Remove rule
  const handleRemoveRule = (index: number) => {
    const newRules = [...formData.overrideRules];
    newRules.splice(index, 1);
    setFormData({
      ...formData,
      overrideRules: newRules
    });
  };

  // Handle delete template
  const handleDeleteTemplate = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Confirm delete template
  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      await apiClient.delete(`/api/property-templates/${templateToDelete}`);
      enqueueSnackbar('Property template deleted successfully', { variant: 'success' });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      enqueueSnackbar('Failed to delete property template', { variant: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  // Handle duplicate template
  const handleDuplicateTemplate = (template: PropertyTemplate) => {
    const duplicateData = {
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined
    };
    handleFormOpen(duplicateData as PropertyTemplate);
  };

  // Render template list
  const renderTemplateList = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <CircularProgress />
        </Box>
      );
    }

    if (templates.length === 0) {
      return (
        <Box p={4} textAlign="center">
          <Typography variant="body1">No property templates found.</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleFormOpen()}
            sx={{ mt: 2 }}
          >
            Create Template
          </Button>
        </Box>
      );
    }

    return (
      <Grid container spacing={2}>
        {templates.map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card>
              <CardHeader
                title={template.name}
                subheader={`Priority: ${template.priority} | ${template.isActive ? 'Active' : 'Inactive'}`}
                action={
                  <Box>
                    <IconButton onClick={() => handleFormOpen(template)} size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDuplicateTemplate(template)} size="small">
                      <DuplicateIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteTemplate(template.id)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              />
              <CardContent>
                {template.description && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {template.description}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Material Type:</strong> {template.materialType || 'Any'}
                </Typography>
                {template.categoryId && (
                  <Typography variant="body2">
                    <strong>Category:</strong>{' '}
                    {categories.find((c) => c.id === template.categoryId)?.name || template.categoryId}
                  </Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">
                  <strong>Properties:</strong> {Object.keys(template.properties).length}
                </Typography>
                <Typography variant="body2">
                  <strong>Override Rules:</strong> {template.overrideRules.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Render form
  const renderForm = () => {
    return (
      <Dialog open={formOpen} onClose={handleFormClose} maxWidth="md" fullWidth>
        <form onSubmit={handleFormSubmit}>
          <DialogTitle>{editMode ? 'Edit Property Template' : 'Create Property Template'}</DialogTitle>
          <DialogContent>
            <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
              <Tab label="Basic Info" />
              <Tab label="Properties" />
              <Tab label="Override Rules" />
            </Tabs>

            {/* Basic Info Tab */}
            {tabValue === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    name="name"
                    label="Template Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="description"
                    label="Description"
                    value={formData.description}
                    onChange={handleInputChange}
                    fullWidth
                    multiline
                    rows={3}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Material Type</InputLabel>
                    <Select
                      name="materialType"
                      value={formData.materialType}
                      onChange={handleInputChange}
                      label="Material Type"
                    >
                      <MenuItem value="">Any</MenuItem>
                      {Object.values(MaterialTypeEnum.enum).map((type) => (
                        <MenuItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Select a material type or leave empty to apply to all types
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      name="categoryId"
                      value={formData.categoryId}
                      onChange={handleInputChange}
                      label="Category"
                    >
                      <MenuItem value="">Any</MenuItem>
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Select a category or leave empty to apply to all categories
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Parent Template</InputLabel>
                    <Select
                      name="parentTemplateId"
                      value={formData.parentTemplateId}
                      onChange={handleInputChange}
                      label="Parent Template"
                    >
                      <MenuItem value="">None</MenuItem>
                      {templates
                        .filter((t) => t.id !== currentTemplateId)
                        .map((template) => (
                          <MenuItem key={template.id} value={template.id}>
                            {template.name}
                          </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>
                      Select a parent template to inherit properties from
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    name="priority"
                    label="Priority"
                    type="number"
                    value={formData.priority}
                    onChange={handleInputChange}
                    fullWidth
                    helperText="Higher priority templates override lower priority ones"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleSwitchChange}
                        color="primary"
                      />
                    }
                    label="Active"
                  />
                </Grid>
              </Grid>
            )}

            {/* Properties Tab */}
            {tabValue === 1 && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={5}>
                    <TextField
                      label="Property Key"
                      value={propertyKey}
                      onChange={(e) => setPropertyKey(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField
                      label="Property Value"
                      value={propertyValue}
                      onChange={(e) => setPropertyValue(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleAddProperty}
                      fullWidth
                      sx={{ height: '100%' }}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>

                <Paper variant="outlined" sx={{ p: 2, maxHeight: '300px', overflow: 'auto' }}>
                  {Object.keys(formData.properties).length === 0 ? (
                    <Typography variant="body2" color="textSecondary" align="center">
                      No properties defined
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {Object.entries(formData.properties).map(([key, value]) => (
                        <Grid item xs={12} key={key}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            p={1}
                            border="1px solid #eee"
                            borderRadius={1}
                          >
                            <Box>
                              <Typography variant="body2">
                                <strong>{key}:</strong> {JSON.stringify(value)}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveProperty(key)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
              </Box>
            )}

            {/* Override Rules Tab */}
            {tabValue === 2 && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Field"
                      value={ruleField}
                      onChange={(e) => setRuleField(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Condition"
                      value={ruleCondition}
                      onChange={(e) => setRuleCondition(e.target.value)}
                      fullWidth
                      placeholder="e.g. materialType=tile"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Value"
                      value={ruleValue}
                      onChange={(e) => setRuleValue(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleAddRule}
                      fullWidth
                      sx={{ height: '100%' }}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>

                <Paper variant="outlined" sx={{ p: 2, maxHeight: '300px', overflow: 'auto' }}>
                  {formData.overrideRules.length === 0 ? (
                    <Typography variant="body2" color="textSecondary" align="center">
                      No override rules defined
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {formData.overrideRules.map((rule, index) => (
                        <Grid item xs={12} key={index}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            p={1}
                            border="1px solid #eee"
                            borderRadius={1}
                          >
                            <Box>
                              <Typography variant="body2">
                                <strong>Field:</strong> {rule.field}
                              </Typography>
                              {rule.condition && (
                                <Typography variant="body2">
                                  <strong>Condition:</strong> {rule.condition}
                                </Typography>
                              )}
                              {rule.value !== undefined && (
                                <Typography variant="body2">
                                  <strong>Value:</strong> {JSON.stringify(rule.value)}
                                </Typography>
                              )}
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveRule(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleFormClose}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {editMode ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  };

  // Render delete confirmation dialog
  const renderDeleteDialog = () => {
    return (
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this property template?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteTemplate} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Property Templates</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchTemplates}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleFormOpen()}
          >
            Create Template
          </Button>
        </Box>
      </Box>

      {renderTemplateList()}
      {renderForm()}
      {renderDeleteDialog()}
    </Box>
  );
};

export default PropertyTemplateManager;
