import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { useAuth } from '../../../client/src/hooks/useAuth';
import VisualReferenceForm from './VisualReferenceForm';
import VisualReferenceImageUploader from './VisualReferenceImageUploader';
import VisualReferenceGallery from './VisualReferenceGallery';
import VisualReferenceAnnotator from './VisualReferenceAnnotator';

interface VisualReferenceManagerProps {
  materialType?: string;
}

/**
 * Visual Reference Manager Component
 * 
 * Admin component for managing visual references.
 */
const VisualReferenceManager: React.FC<VisualReferenceManagerProps> = ({
  materialType
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [references, setReferences] = useState<any[]>([]);
  const [selectedReference, setSelectedReference] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [propertyFilter, setPropertyFilter] = useState<string>('');
  const [valueFilter, setValueFilter] = useState<string>('');
  const [properties, setProperties] = useState<string[]>([]);
  const [propertyValues, setPropertyValues] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Fetch visual references
  useEffect(() => {
    const fetchVisualReferences = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = '/api/visual-references';
        const queryParams = [];
        
        if (materialType) {
          queryParams.push(`materialType=${encodeURIComponent(materialType)}`);
        }
        
        if (propertyFilter) {
          queryParams.push(`propertyName=${encodeURIComponent(propertyFilter)}`);
        }
        
        if (valueFilter) {
          queryParams.push(`propertyValue=${encodeURIComponent(valueFilter)}`);
        }
        
        if (queryParams.length > 0) {
          url += `?${queryParams.join('&')}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch visual references');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setReferences(data.references);
          
          // Extract unique properties and values
          const uniqueProperties = [...new Set(data.references.map((ref: any) => ref.propertyName))];
          setProperties(uniqueProperties);
          
          if (propertyFilter) {
            const uniqueValues = [...new Set(
              data.references
                .filter((ref: any) => ref.propertyName === propertyFilter)
                .map((ref: any) => ref.propertyValue)
            )];
            setPropertyValues(uniqueValues);
          } else {
            setPropertyValues([]);
          }
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchVisualReferences();
  }, [token, materialType, propertyFilter, valueFilter, refreshKey]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle reference selection
  const handleSelectReference = async (reference: any) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/visual-references/${reference.id}/with-images`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch visual reference details');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedReference(data.reference);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (formData: any) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = isEditing 
        ? `/api/visual-references/${selectedReference?.id}` 
        : '/api/visual-references';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} visual reference`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Visual reference ${isEditing ? 'updated' : 'created'} successfully`);
        setFormOpen(false);
        setRefreshKey(prev => prev + 1);
        
        if (isEditing) {
          setSelectedReference(data.reference);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle reference deletion
  const handleDeleteReference = async (reference: any) => {
    if (!window.confirm(`Are you sure you want to delete the visual reference "${reference.title}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/visual-references/${reference.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete visual reference');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Visual reference deleted successfully');
        setRefreshKey(prev => prev + 1);
        
        if (selectedReference?.id === reference.id) {
          setSelectedReference(null);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/visual-references/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: searchQuery,
          propertyName: propertyFilter || undefined,
          propertyValue: valueFilter || undefined,
          materialType: materialType || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to search visual references');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setReferences(data.references);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Handle image upload success
  const handleImageUploadSuccess = () => {
    // Refresh the selected reference to show the new image
    if (selectedReference) {
      handleSelectReference(selectedReference);
    }
  };

  // Render reference list
  const renderReferenceList = () => {
    if (loading && references.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (references.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No visual references found. Create a new one to get started.
        </Alert>
      );
    }
    
    return (
      <List sx={{ mt: 2 }}>
        {references.map(reference => (
          <Paper key={reference.id} sx={{ mb: 2 }}>
            <ListItem
              button
              onClick={() => handleSelectReference(reference)}
              selected={selectedReference?.id === reference.id}
            >
              <ListItemText
                primary={reference.title}
                secondary={
                  <Box>
                    <Typography variant="body2" component="span">
                      {reference.propertyName}: {reference.propertyValue}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      {reference.description.substring(0, 100)}
                      {reference.description.length > 100 ? '...' : ''}
                    </Typography>
                  </Box>
                }
              />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={reference.materialType}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <IconButton
                  edge="end"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setSelectedReference(reference);
                    setFormOpen(true);
                  }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteReference(reference);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </ListItem>
          </Paper>
        ))}
      </List>
    );
  };

  // Render reference details
  const renderReferenceDetails = () => {
    if (!selectedReference) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Select a visual reference to view details.
        </Alert>
      );
    }
    
    return (
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {selectedReference.title}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Property
              </Typography>
              <Typography variant="body1">
                {selectedReference.propertyName}: {selectedReference.propertyValue}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Material Type
              </Typography>
              <Typography variant="body1">
                {selectedReference.materialType}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {selectedReference.description}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Source
              </Typography>
              <Typography variant="body1">
                {selectedReference.source}
                {selectedReference.sourceUrl && (
                  <Button
                    href={selectedReference.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    View Source
                  </Button>
                )}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
        
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Images
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setActiveTab(2)}
            >
              Add Image
            </Button>
          </Box>
          
          {selectedReference.images && selectedReference.images.length > 0 ? (
            <VisualReferenceGallery
              images={selectedReference.images}
              onSelectImage={(image) => {
                // Set active tab to annotator and pass the selected image
                setActiveTab(3);
              }}
            />
          ) : (
            <Alert severity="info">
              No images available. Add an image to get started.
            </Alert>
          )}
        </Paper>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Visual Reference Library
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Browse References" />
          <Tab label="Reference Details" disabled={!selectedReference} />
          <Tab label="Upload Images" disabled={!selectedReference} />
          <Tab label="Annotate Images" disabled={!selectedReference || !selectedReference?.images?.length} />
        </Tabs>
      </Paper>
      
      {activeTab === 0 && (
        <Box>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  label="Search"
                  fullWidth
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleSearch} edge="end">
                        <SearchIcon />
                      </IconButton>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Property</InputLabel>
                  <Select
                    value={propertyFilter}
                    onChange={(e) => {
                      setPropertyFilter(e.target.value);
                      setValueFilter('');
                    }}
                    label="Property"
                  >
                    <MenuItem value="">All Properties</MenuItem>
                    {properties.map(property => (
                      <MenuItem key={property} value={property}>
                        {property}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth disabled={!propertyFilter}>
                  <InputLabel>Value</InputLabel>
                  <Select
                    value={valueFilter}
                    onChange={(e) => setValueFilter(e.target.value)}
                    label="Value"
                  >
                    <MenuItem value="">All Values</MenuItem>
                    {propertyValues.map(value => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedReference(null);
                      setFormOpen(true);
                    }}
                    fullWidth
                  >
                    New Reference
                  </Button>
                  
                  <IconButton onClick={handleRefresh} title="Refresh">
                    <RefreshIcon />
                  </IconButton>
                </Box>
              </Grid>
            </Grid>
          </Paper>
          
          {renderReferenceList()}
          
          <Dialog
            open={formOpen}
            onClose={() => setFormOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {isEditing ? 'Edit Visual Reference' : 'Create Visual Reference'}
            </DialogTitle>
            <DialogContent>
              <VisualReferenceForm
                initialData={isEditing ? selectedReference : undefined}
                materialType={materialType}
                onSubmit={handleFormSubmit}
                isSubmitting={loading}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
      
      {activeTab === 1 && renderReferenceDetails()}
      
      {activeTab === 2 && selectedReference && (
        <VisualReferenceImageUploader
          referenceId={selectedReference.id}
          onSuccess={handleImageUploadSuccess}
        />
      )}
      
      {activeTab === 3 && selectedReference && selectedReference.images && selectedReference.images.length > 0 && (
        <VisualReferenceAnnotator
          referenceId={selectedReference.id}
          images={selectedReference.images}
        />
      )}
    </Box>
  );
};

export default VisualReferenceManager;
