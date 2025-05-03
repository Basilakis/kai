import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import ClassificationSystemSelector from './ClassificationSystemSelector';
import ClassificationTree from './ClassificationTree';
import {
  ClassificationSystem,
  ClassificationTreeNode,
  ClassificationMapping,
  MappingType
} from '@kai/shared/src/types/classification';

interface ClassificationMappingManagerProps {
  onMappingChange?: () => void;
}

/**
 * Classification Mapping Manager Component
 * 
 * Allows users to manage mappings between different classification systems.
 */
const ClassificationMappingManager: React.FC<ClassificationMappingManagerProps> = ({
  onMappingChange
}) => {
  const { token } = useAuth();
  const [sourceSystem, setSourceSystem] = useState<ClassificationSystem | null>(null);
  const [targetSystem, setTargetSystem] = useState<ClassificationSystem | null>(null);
  const [sourceTreeNodes, setSourceTreeNodes] = useState<ClassificationTreeNode[]>([]);
  const [targetTreeNodes, setTargetTreeNodes] = useState<ClassificationTreeNode[]>([]);
  const [selectedSourceNode, setSelectedSourceNode] = useState<ClassificationTreeNode | null>(null);
  const [selectedTargetNode, setSelectedTargetNode] = useState<ClassificationTreeNode | null>(null);
  const [mappings, setMappings] = useState<ClassificationMapping[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [mappingType, setMappingType] = useState<MappingType>(MappingType.EXACT);
  const [confidence, setConfidence] = useState<number>(1.0);
  const [description, setDescription] = useState<string>('');

  // Fetch classification tree when source system changes
  useEffect(() => {
    const fetchSourceClassificationTree = async () => {
      if (!sourceSystem) return;
      
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/classification/systems/${sourceSystem.id}/tree`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch source classification tree');
        }
        
        const data = await response.json();
        
        if (data.success && data.tree) {
          setSourceTreeNodes(data.tree);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSourceClassificationTree();
  }, [sourceSystem, token]);

  // Fetch classification tree when target system changes
  useEffect(() => {
    const fetchTargetClassificationTree = async () => {
      if (!targetSystem) return;
      
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/classification/systems/${targetSystem.id}/tree`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch target classification tree');
        }
        
        const data = await response.json();
        
        if (data.success && data.tree) {
          setTargetTreeNodes(data.tree);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTargetClassificationTree();
  }, [targetSystem, token]);

  // Fetch mappings when source or target node changes
  useEffect(() => {
    const fetchMappings = async () => {
      if (!selectedSourceNode) return;
      
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/classification/mappings?sourceCategoryId=${selectedSourceNode.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch mappings');
        }
        
        const data = await response.json();
        
        if (data.success && data.mappings) {
          setMappings(data.mappings);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMappings();
  }, [selectedSourceNode, token]);

  const handleSourceSystemSelect = (system: ClassificationSystem) => {
    setSourceSystem(system);
    setSelectedSourceNode(null);
  };

  const handleTargetSystemSelect = (system: ClassificationSystem) => {
    setTargetSystem(system);
    setSelectedTargetNode(null);
  };

  const handleSourceNodeSelect = (node: ClassificationTreeNode) => {
    setSelectedSourceNode(node);
  };

  const handleTargetNodeSelect = (node: ClassificationTreeNode) => {
    setSelectedTargetNode(node);
  };

  const handleAddMapping = async () => {
    if (!selectedSourceNode || !selectedTargetNode) return;
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/classification/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceCategoryId: selectedSourceNode.id,
          targetCategoryId: selectedTargetNode.id,
          mappingType,
          confidence,
          description
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add mapping');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh mappings
        const refreshResponse = await fetch(`/api/classification/mappings?sourceCategoryId=${selectedSourceNode.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          
          if (refreshData.success) {
            setMappings(refreshData.mappings);
            
            if (onMappingChange) {
              onMappingChange();
            }
          }
        }
        
        setAddDialogOpen(false);
        setMappingType(MappingType.EXACT);
        setConfidence(1.0);
        setDescription('');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/classification/mappings/${mappingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete mapping');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the deleted mapping from the list
        setMappings(prev => prev.filter(m => m.id !== mappingId));
        
        if (onMappingChange) {
          onMappingChange();
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

  const getMappingTypeColor = (type: MappingType) => {
    switch (type) {
      case MappingType.EXACT:
        return 'success';
      case MappingType.BROADER:
        return 'primary';
      case MappingType.NARROWER:
        return 'secondary';
      case MappingType.RELATED:
        return 'default';
      default:
        return 'default';
    }
  };

  const getMappingTypeIcon = (type: MappingType) => {
    switch (type) {
      case MappingType.EXACT:
        return <LinkIcon />;
      case MappingType.BROADER:
      case MappingType.NARROWER:
      case MappingType.RELATED:
        return <LinkOffIcon />;
      default:
        return <LinkIcon />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Classification Mappings
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" gutterBottom>
            Source System
          </Typography>
          <ClassificationSystemSelector
            onSystemSelect={handleSourceSystemSelect}
            selectedSystemId={sourceSystem?.id}
            label="Source Classification System"
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" gutterBottom>
            Target System
          </Typography>
          <ClassificationSystemSelector
            onSystemSelect={handleTargetSystemSelect}
            selectedSystemId={targetSystem?.id}
            label="Target Classification System"
          />
        </Grid>
      </Grid>
      
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Source Categories
          </Typography>
          
          {loading && !sourceTreeNodes.length ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : sourceTreeNodes.length > 0 ? (
            <ClassificationTree
              nodes={sourceTreeNodes}
              onNodeSelect={handleSourceNodeSelect}
              selectedNodeId={selectedSourceNode?.id}
            />
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {sourceSystem
                  ? 'No categories found for this classification system.'
                  : 'Select a source classification system to view categories.'}
              </Typography>
            </Paper>
          )}
        </Box>
        
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Target Categories
          </Typography>
          
          {loading && !targetTreeNodes.length ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : targetTreeNodes.length > 0 ? (
            <ClassificationTree
              nodes={targetTreeNodes}
              onNodeSelect={handleTargetNodeSelect}
              selectedNodeId={selectedTargetNode?.id}
            />
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {targetSystem
                  ? 'No categories found for this classification system.'
                  : 'Select a target classification system to view categories.'}
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>
      
      {selectedSourceNode && selectedTargetNode && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Create Mapping
          </Button>
        </Box>
      )}
      
      {selectedSourceNode && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Existing Mappings for {selectedSourceNode.name}
          </Typography>
          
          <Paper>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : mappings.length > 0 ? (
              <List>
                {mappings.map((mapping, index) => (
                  <React.Fragment key={mapping.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {mapping.targetCategory?.name}
                            </Typography>
                            <Chip
                              label={mapping.mappingType}
                              size="small"
                              color={getMappingTypeColor(mapping.mappingType as MappingType)}
                              icon={getMappingTypeIcon(mapping.mappingType as MappingType)}
                            />
                            {mapping.confidence !== undefined && (
                              <Chip
                                label={`${Math.round(mapping.confidence * 100)}%`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" component="div">
                              System: {mapping.targetCategory?.systemId}
                            </Typography>
                            <Typography variant="caption" component="div">
                              Code: {mapping.targetCategory?.code}
                            </Typography>
                            {mapping.description && (
                              <Typography variant="caption" component="div">
                                Description: {mapping.description}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Delete Mapping">
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteMapping(mapping.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No mappings found for this category.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}
      
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Classification Mapping</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" gutterBottom>
              Create a mapping between the following categories:
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle1">
                    Source: {selectedSourceNode?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Code: {selectedSourceNode?.code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    System: {sourceSystem?.name}
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle1">
                    Target: {selectedTargetNode?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Code: {selectedTargetNode?.code}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    System: {targetSystem?.name}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="mapping-type-label">Mapping Type</InputLabel>
                  <Select
                    labelId="mapping-type-label"
                    id="mapping-type"
                    value={mappingType}
                    label="Mapping Type"
                    onChange={(e) => setMappingType(e.target.value as MappingType)}
                  >
                    <MenuItem value={MappingType.EXACT}>Exact Match</MenuItem>
                    <MenuItem value={MappingType.BROADER}>Broader Than</MenuItem>
                    <MenuItem value={MappingType.NARROWER}>Narrower Than</MenuItem>
                    <MenuItem value={MappingType.RELATED}>Related To</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Confidence (0-1)"
                  type="number"
                  fullWidth
                  value={confidence}
                  onChange={(e) => setConfidence(Math.max(0, Math.min(1, parseFloat(e.target.value))))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddMapping}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Mapping'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClassificationMappingManager;
