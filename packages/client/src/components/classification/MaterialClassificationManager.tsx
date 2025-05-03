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
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import ClassificationSystemSelector from './ClassificationSystemSelector';
import ClassificationTree from './ClassificationTree';
import {
  ClassificationSystem,
  ClassificationCategory,
  ClassificationTreeNode,
  MaterialClassification
} from '@kai/shared/src/types/classification';

interface MaterialClassificationManagerProps {
  materialId: string;
  materialName?: string;
  onClassificationChange?: () => void;
}

/**
 * Material Classification Manager Component
 * 
 * Allows users to manage classifications for a material.
 */
const MaterialClassificationManager: React.FC<MaterialClassificationManagerProps> = ({
  materialId,
  materialName,
  onClassificationChange
}) => {
  const { token } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState<ClassificationSystem | null>(null);
  const [treeNodes, setTreeNodes] = useState<ClassificationTreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ClassificationTreeNode | null>(null);
  const [classifications, setClassifications] = useState<MaterialClassification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [isPrimary, setIsPrimary] = useState<boolean>(false);

  // Fetch material classifications
  useEffect(() => {
    const fetchMaterialClassifications = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/classification/materials/${materialId}/classifications`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch material classifications');
        }
        
        const data = await response.json();
        
        if (data.success && data.classifications) {
          setClassifications(data.classifications);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterialClassifications();
  }, [materialId, token]);

  // Fetch classification tree when system changes
  useEffect(() => {
    const fetchClassificationTree = async () => {
      if (!selectedSystem) return;
      
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/classification/systems/${selectedSystem.id}/tree`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch classification tree');
        }
        
        const data = await response.json();
        
        if (data.success && data.tree) {
          setTreeNodes(data.tree);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchClassificationTree();
  }, [selectedSystem, token]);

  const handleSystemSelect = (system: ClassificationSystem) => {
    setSelectedSystem(system);
    setSelectedNode(null);
  };

  const handleNodeSelect = (node: ClassificationTreeNode) => {
    setSelectedNode(node);
  };

  const handleAddClassification = async () => {
    if (!selectedNode) return;
    
    try {
      setLoading(true);
      setError(null);

      // If this is a primary classification, we need to update all other classifications
      if (isPrimary) {
        // First, set all existing classifications to non-primary
        for (const classification of classifications) {
          if (classification.isPrimary) {
            await fetch(`/api/classification/material-classifications/${classification.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                isPrimary: false
              })
            });
          }
        }
      }

      // Create the new classification
      const response = await fetch('/api/classification/material-classifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          materialId,
          categoryId: selectedNode.id,
          isPrimary,
          source: 'manual'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add classification');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh classifications
        const refreshResponse = await fetch(`/api/classification/materials/${materialId}/classifications`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          
          if (refreshData.success) {
            setClassifications(refreshData.classifications);
            
            if (onClassificationChange) {
              onClassificationChange();
            }
          }
        }
        
        setAddDialogOpen(false);
        setIsPrimary(false);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClassification = async (classificationId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/classification/material-classifications/${classificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete classification');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Remove the deleted classification from the list
        setClassifications(prev => prev.filter(c => c.id !== classificationId));
        
        if (onClassificationChange) {
          onClassificationChange();
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

  const handleSetPrimary = async (classificationId: string) => {
    try {
      setLoading(true);
      setError(null);

      // First, set all classifications to non-primary
      for (const classification of classifications) {
        if (classification.isPrimary) {
          await fetch(`/api/classification/material-classifications/${classification.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              isPrimary: false
            })
          });
        }
      }

      // Then, set the selected classification to primary
      const response = await fetch(`/api/classification/material-classifications/${classificationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          isPrimary: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to set primary classification');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update the classifications list
        setClassifications(prev => prev.map(c => ({
          ...c,
          isPrimary: c.id === classificationId
        })));
        
        if (onClassificationChange) {
          onClassificationChange();
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

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Material Classifications
        {materialName && ` for ${materialName}`}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 3 }}>
        <ClassificationSystemSelector
          onSystemSelect={handleSystemSelect}
          selectedSystemId={selectedSystem?.id}
        />
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Classification Tree
          </Typography>
          
          {loading && !treeNodes.length ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : treeNodes.length > 0 ? (
            <ClassificationTree
              nodes={treeNodes}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNode?.id}
            />
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {selectedSystem
                  ? 'No categories found for this classification system.'
                  : 'Select a classification system to view categories.'}
              </Typography>
            </Paper>
          )}
          
          {selectedNode && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
              >
                Add Classification
              </Button>
            </Box>
          )}
        </Box>
        
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1">
              Current Classifications
            </Typography>
            
            <Tooltip title="Refresh Classifications">
              <IconButton
                size="small"
                onClick={() => {
                  if (onClassificationChange) {
                    onClassificationChange();
                  }
                }}
              >
                <SyncIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Paper>
            {loading && !classifications.length ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : classifications.length > 0 ? (
              <List>
                {classifications.map((classification, index) => (
                  <React.Fragment key={classification.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {classification.category?.name}
                            </Typography>
                            <Chip
                              label={classification.category?.code}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" component="div">
                              System: {classification.category?.systemId}
                            </Typography>
                            <Typography variant="caption" component="div">
                              Path: {classification.category?.path}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title={classification.isPrimary ? 'Primary Classification' : 'Set as Primary'}>
                          <IconButton
                            edge="end"
                            onClick={() => handleSetPrimary(classification.id)}
                            disabled={classification.isPrimary}
                            color={classification.isPrimary ? 'primary' : 'default'}
                          >
                            {classification.isPrimary ? <StarIcon /> : <StarBorderIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove Classification">
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteClassification(classification.id)}
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
                  No classifications found for this material.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
      
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
        <DialogTitle>Add Classification</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" gutterBottom>
              Add the following classification to this material:
            </Typography>
            
            <Box sx={{ my: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle1">
                {selectedNode?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Code: {selectedNode?.code}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                System: {selectedSystem?.name}
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
              }
              label="Set as primary classification"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddClassification}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaterialClassificationManager;
