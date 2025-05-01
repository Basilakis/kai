/// <reference path="../types/global.d.ts" />
/// <reference path="../types/jsx.d.ts" />
/// <reference path="../types/mui-icons.d.ts" />

// Fix import order - React must be first
import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
  Snackbar,
  Alert
} from './mui';

import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  RefreshIcon,
  VisibilityIcon,
  CloudUploadIcon,
  CategoryIcon,
  WarningIcon,
  AnalyticsIcon,
  SettingsIcon
} from './mui-icons';

interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parentId?: string;
  path: string[];
  level: number;
  isActive: boolean;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// Mock API functions (to be replaced with actual API calls)
const fetchCategories = async (): Promise<{ categories: Category[]; total: number }> => {
  // Mock data for development
  const mockCategories: Category[] = [
    {
      id: '1',
      name: 'Tile',
      description: 'Ceramic, porcelain, and natural stone tiles',
      slug: 'tile',
      path: [],
      level: 0,
      isActive: true,
      order: 0,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Stone',
      description: 'Natural and engineered stone materials',
      slug: 'stone',
      path: [],
      level: 0,
      isActive: true,
      order: 1,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Wood',
      description: 'Solid and engineered wood materials',
      slug: 'wood',
      path: [],
      level: 0,
      isActive: true,
      order: 2,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Ceramic',
      description: 'Ceramic materials and products',
      slug: 'ceramic',
      path: [],
      level: 0,
      isActive: true,
      order: 3,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '5',
      name: 'Porcelain Tile',
      description: 'Porcelain materials and products',
      slug: 'porcelain-tile',
      parentId: '1',
      path: ['1'],
      level: 1,
      isActive: true,
      order: 0,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    categories: mockCategories,
    total: mockCategories.length
  };
};

const createCategory = async (categoryData: Partial<Category>): Promise<Partial<Category>> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock response with generated ID
  return {
    ...categoryData,
    id: Math.random().toString(36).substr(2, 9),
    slug: categoryData.name?.toLowerCase().replace(/\s+/g, '-') || '',
    path: categoryData.parentId ? [categoryData.parentId] : [],
    level: categoryData.parentId ? 1 : 0,
    createdBy: 'current-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const updateCategory = async (id: string, categoryData: Partial<Category>): Promise<Partial<Category>> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock response
  return {
    ...categoryData,
    id,
    updatedAt: new Date().toISOString()
  };
};

const deleteCategory = async (id: string): Promise<{ success: boolean }> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock response
  return { success: true };
};

// CategoryManager component
const CategoryManager: React.FC = () => {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<Category | null>(null);
  const [filterParentId, setFilterParentId] = React.useState<string>('');
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    parentId: '',
    isActive: true,
    metadata: {}
  });
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info' | 'warning'
  });
  const [expandedMetadata, setExpandedMetadata] = React.useState(false);
  const [metadataEditorContent, setMetadataEditorContent] = React.useState('{}');
  
  // Load categories on component mount
  React.useEffect(() => {
    loadCategories();
  }, []);
  
  const loadCategories = async (): Promise<void> => {
    setLoading(true);
    try {
      // Replace with actual API call
      const result = await fetchCategories();
      setCategories(result.categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load categories',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenDialog = (category?: Category): void => {
    if (category) {
      setSelectedCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        parentId: category.parentId || '',
        isActive: category.isActive,
        metadata: category.metadata || {}
      });
      setMetadataEditorContent(JSON.stringify(category.metadata || {}, null, 2));
    } else {
      setSelectedCategory(null);
      setFormData({
        name: '',
        description: '',
        parentId: '',
        isActive: true,
        metadata: {}
      });
      setMetadataEditorContent('{}');
    }
    setExpandedMetadata(false);
    setDialogOpen(true);
  };
  
  const handleCloseDialog = (): void => {
    setDialogOpen(false);
  };
  
  const handleOpenDeleteDialog = (category: Category): void => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };
  
  const handleCloseDeleteDialog = (): void => {
    setDeleteDialogOpen(false);
    setSelectedCategory(null);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>): void => {
    const name = e.target.name as string;
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    
    setFormData((prev: Record<string, any>) => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleMetadataChange = (): boolean => {
    try {
      const metadata = JSON.parse(metadataEditorContent);
      setFormData((prev: Record<string, any>) => ({
        ...prev,
        metadata
      }));
      return true;
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Invalid JSON format in metadata',
        severity: 'error'
      });
      return false;
    }
  };
  
  const handleSubmit = async (): Promise<void> => {
    // Validate metadata JSON if expanded
    if (expandedMetadata && !handleMetadataChange()) {
      return;
    }
    
    setLoading(true);
    try {
      if (selectedCategory) {
        // Update existing category
        await updateCategory(selectedCategory.id, formData);
        setSnackbar({
          open: true,
          message: 'Category updated successfully',
          severity: 'success'
        });
      } else {
        // Create new category
        await createCategory(formData);
        setSnackbar({
          open: true,
          message: 'Category created successfully',
          severity: 'success'
        });
      }
      handleCloseDialog();
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save category',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (): Promise<void> => {
    if (!selectedCategory) return;
    
    setLoading(true);
    try {
      await deleteCategory(selectedCategory.id);
      setSnackbar({
        open: true,
        message: 'Category deleted successfully',
        severity: 'success'
      });
      handleCloseDeleteDialog();
      loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete category',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleCloseSnackbar = (): void => {
    setSnackbar((prev: Record<string, any>) => ({
      ...prev,
      open: false
    }));
  };
  
  const handleExport = (): void => {
    try {
      const categoriesJson = JSON.stringify(categories, null, 2);
      const blob = new Blob([categoriesJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `categories-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      setSnackbar({
        open: true,
        message: 'Categories exported successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error exporting categories:', error);
      setSnackbar({
        open: true,
        message: 'Failed to export categories',
        severity: 'error'
      });
    }
  };
  
  const handleImportClick = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = handleImportFile;
    input.click();
  };
  
  const handleImportFile = (e: Event): void => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedCategories = JSON.parse(content);
        
        if (!Array.isArray(importedCategories)) {
          throw new Error('Invalid format: Expected an array of categories');
        }
        
        setLoading(true);
        
        // In a real implementation, you would call an API endpoint to import the categories
        // For now, we'll just simulate the import by waiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setSnackbar({
          open: true,
          message: `Successfully imported ${importedCategories.length} categories`,
          severity: 'success'
        });
        
        // Reload categories
        loadCategories();
      } catch (error) {
        console.error('Error importing categories:', error);
        setSnackbar({
          open: true,
          message: `Error importing categories: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setSnackbar({
        open: true,
        message: 'Error reading the file',
        severity: 'error'
      });
    };
  };
  
  // Filter categories by parent ID
  const filteredCategories = filterParentId
    ? categories.filter((category: Category) => category.parentId === filterParentId)
    : categories;

  // Get root categories for filter dropdown
  const rootCategories = categories.filter((category: Category) => !category.parentId);
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Material Categories
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AnalyticsIcon />}
            onClick={handleExport}
            disabled={loading || categories.length === 0}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            onClick={handleImportClick}
            disabled={loading}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadCategories}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add Category
          </Button>
        </Box>
      </Box>
      
      <Paper sx={{ mb: 4, p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          About Category Management
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Categories define the types of materials that can be recognized by the system. 
          They are used throughout the application for classification, filtering, and organizing materials.
          Each category can have specific metadata that defines its properties and behavior.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <CategoryIcon color="info" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            Categories can be arranged in a hierarchy with parent-child relationships.
          </Typography>
        </Box>
      </Paper>
      
      <Box sx={{ mb: 3 }}>
        <FormControl variant="outlined" sx={{ minWidth: 250 }}>
          <InputLabel id="parent-filter-label">Filter by Parent Category</InputLabel>
          <Select
            labelId="parent-filter-label"
            label="Filter by Parent Category"
            value={filterParentId}
            onChange={(e: any) => setFilterParentId(e.target.value as string)}
          >
            <MenuItem value="">
              <em>All Categories</em>
            </MenuItem>
            {rootCategories.map((category: Category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Parent</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={40} />
                </TableCell>
              </TableRow>
            ) : filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography variant="body1" color="textSecondary">
                    No categories found
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{ mt: 2 }}
                  >
                    Add Category
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category: Category) => {
                const parentCategory = categories.find((c: Category) => c.id === category.parentId);
                
                return (
                  <TableRow key={category.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Indent based on level */}
                        {Array.from({ length: category.level }).map((_, i) => (
                          <Box key={i} sx={{ width: 20 }} />
                        ))}
                        {category.name}
                      </Box>
                    </TableCell>
                    <TableCell>{category.description || '-'}</TableCell>
                    <TableCell>{category.level}</TableCell>
                    <TableCell>{parentCategory ? parentCategory.name : '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={category.isActive ? 'Active' : 'Inactive'}
                        color={category.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton onClick={() => handleOpenDialog(category)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          onClick={() => handleOpenDeleteDialog(category)} 
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
      
      {/* Add/Edit Category Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {selectedCategory ? 'Edit Category' : 'Add Category'}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Category Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              multiline
              rows={3}
            />
            
            <FormControl fullWidth>
              <InputLabel id="parent-category-label">Parent Category</InputLabel>
              <Select
                labelId="parent-category-label"
                label="Parent Category"
                name="parentId"
                value={formData.parentId}
                onChange={handleInputChange}
              >
                <MenuItem value="">
                  <em>None (Root Category)</em>
                </MenuItem>
                {categories
                  .filter((c: Category) => c.id !== selectedCategory?.id) // Filter out current category to prevent self-referencing
                  .map((category: Category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>
            
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
            
            <Box>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 1
                }}
                onClick={() => setExpandedMetadata(!expandedMetadata)}
              >
                <Typography variant="subtitle1">
                  Advanced: Metadata
                </Typography>
                <SettingsIcon
                  sx={{
                    transform: expandedMetadata ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                />
              </Box>
              
              {expandedMetadata && (
                <Box>
                  <Typography variant="caption" color="text.secondary" paragraph>
                    Metadata allows you to define additional properties for this category,
                    such as field options, UI preferences, or integration settings.
                    Enter valid JSON format.
                  </Typography>
                  <TextField
                    fullWidth
                    label="Metadata (JSON)"
                    multiline
                    rows={8}
                    value={metadataEditorContent}
                    onChange={(e: any) => setMetadataEditorContent(e.target.value)}
                    error={(() => {
                      try {
                        JSON.parse(metadataEditorContent);
                        return false;
                      } catch (e) {
                        return true;
                      }
                    })()}
                    helperText={(() => {
                      try {
                        JSON.parse(metadataEditorContent);
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            color="primary" 
            variant="contained"
            disabled={!formData.name.trim() || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
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
          <Typography variant="body1">
            Are you sure you want to delete the category "{selectedCategory?.name}"?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Warning: This action cannot be undone. Materials assigned to this category may become uncategorized.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CategoryManager;