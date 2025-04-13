import React, { useState, useEffect } from 'react';
import '../../../types/jsx'; // Import JSX type definitions
import '../../../types/react-extensions'; // Import React extensions
import Span from '../../components/common/Span';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  // IconButton, // Unused import
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Alert,
  Tooltip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  // FormControlLabel, // Unused import
  LinearProgress,
  DialogContentText,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Checkbox
} from '../../components/mui';

/**
 * A single checkpoint entry
 */
interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  metrics: {
    loss: number;
    accuracy: number;
    [key: string]: number;
  };
  modelType: string;
  epoch: number;
  parameters: Record<string, number | string>;
  fileSize: number;
  isActive: boolean;
  tags: string[];
}

/**
 * API for managing checkpoints
 */
const checkpointApi = {
  fetchCheckpoints: async (_jobId: string): Promise<Checkpoint[]> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock data - in a real app, this would come from an API
    return [
      {
        id: 'cp_001',
        timestamp: Date.now() - 3600000 * 5,
        description: 'Initial checkpoint',
        metrics: { loss: 0.8, accuracy: 0.65 },
        modelType: 'classification',
        epoch: 1,
        parameters: { learning_rate: 0.001, batch_size: 32 },
        fileSize: 42500000,
        isActive: false,
        tags: ['initial', 'baseline']
      },
      {
        id: 'cp_002',
        timestamp: Date.now() - 3600000 * 3,
        description: 'After hyperparameter tuning',
        metrics: { loss: 0.5, accuracy: 0.78 },
        modelType: 'classification',
        epoch: 10,
        parameters: { learning_rate: 0.0005, batch_size: 64 },
        fileSize: 42600000,
        isActive: false,
        tags: ['tuned']
      },
      {
        id: 'cp_003',
        timestamp: Date.now() - 3600000,
        description: 'Current best model',
        metrics: { loss: 0.3, accuracy: 0.89 },
        modelType: 'classification',
        epoch: 25,
        parameters: { learning_rate: 0.0005, batch_size: 64 },
        fileSize: 42700000,
        isActive: true,
        tags: ['best', 'current']
      }
    ];
  },

  createCheckpoint: async (
    _jobId: string,
    description: string,
    tags: string[]
  ): Promise<Checkpoint> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Return a mock new checkpoint
    return {
      id: `cp_${String(Date.now()).slice(-6)}`,
      timestamp: Date.now(),
      description,
      metrics: { loss: 0.25, accuracy: 0.92 },
      modelType: 'classification',
      epoch: 30,
      parameters: { learning_rate: 0.0005, batch_size: 64 },
      fileSize: 42800000,
      isActive: true,
      tags
    };
  },

  rollbackCheckpoint: async (
    _jobId: string,
    _checkpointId: string
  ): Promise<boolean> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate success
    return true;
  },

  deleteCheckpoint: async (
    _jobId: string,
    _checkpointId: string
  ): Promise<boolean> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 600));

    // Simulate success
    return true;
  }
};

/**
 * Props for the CheckpointManager component
 */
interface CheckpointManagerProps {
  jobId: string;
  modelType: string;
  onRollback?: (checkpointId: string) => Promise<boolean>;
  onCreateCheckpoint?: (description: string, tags: string[]) => Promise<boolean>;
  onDeleteCheckpoint?: (checkpointId: string) => Promise<boolean>;
}

/**
 * CheckpointManager Component
 *
 * Provides UI for managing model checkpoints, including:
 * - Viewing all available checkpoints
 * - Rolling back to a previous checkpoint
 * - Comparing checkpoint metrics
 * - Creating manual checkpoints during training
 */
const CheckpointManager: React.FC<CheckpointManagerProps> = ({
  jobId,
  modelType: _modelType // Unused prop
}) => {
  // State for checkpoint data
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<string[]>([]);

  // State for dialogs
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState<boolean>(false);
  const [rollbackCheckpointId, setRollbackCheckpointId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [newCheckpointDescription, setNewCheckpointDescription] = useState<string>('');
  const [newCheckpointTags, setNewCheckpointTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');

  // Loading status
  const [isRollbackLoading, setIsRollbackLoading] = useState<boolean>(false);
  const [isCreateLoading, setIsCreateLoading] = useState<boolean>(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState<boolean>(false);

  // Load checkpoints using API
  const loadCheckpoints = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await checkpointApi.fetchCheckpoints(jobId);
      setCheckpoints(result);
    } catch (err) {
      setError('Failed to load checkpoints');
      console.error('Error fetching checkpoints:', err);
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch checkpoints when component mounts or jobId changes
  useEffect(() => {
    loadCheckpoints();
  }, [jobId]);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Format date for display
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Handle checkpoint selection for comparison
  const handleCheckpointToggle = (checkpointId: string) => {
    setSelectedCheckpoints(prev => {
      if (prev.includes(checkpointId)) {
        return prev.filter(id => id !== checkpointId);
      } else {
        // Limit to 2 checkpoints max
        return prev.length < 2 ? [...prev, checkpointId] : [prev[1], checkpointId];
      }
    });
  };

  // Open rollback confirmation dialog
  const handleRollbackClick = (checkpointId: string) => {
    setRollbackCheckpointId(checkpointId);
    setRollbackDialogOpen(true);
  };

  // Confirm rollback to checkpoint
  const handleRollbackConfirm = async () => {
    if (!rollbackCheckpointId) return;

    try {
      setIsRollbackLoading(true);
      setError(null);

      const success = await checkpointApi.rollbackCheckpoint(jobId, rollbackCheckpointId);

      if (success) {
        await loadCheckpoints();
      } else {
        setError('Failed to roll back to checkpoint');
      }
    } catch (err) {
      setError('Error during rollback operation');
      console.error('Rollback error:', err);
    } finally {
      setIsRollbackLoading(false);
      setRollbackDialogOpen(false);
      setRollbackCheckpointId(null);
    }
  };

  // Open create checkpoint dialog
  const handleCreateClick = () => {
    setNewCheckpointDescription('');
    setNewCheckpointTags([]);
    setTagInput('');
    setCreateDialogOpen(true);
  };

  // Add a tag to the new checkpoint
  const handleAddTag = () => {
    if (tagInput.trim() && !newCheckpointTags.includes(tagInput.trim())) {
      setNewCheckpointTags([...newCheckpointTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // Remove a tag from the new checkpoint
  const handleRemoveTag = (tag: string) => {
    setNewCheckpointTags(prev => prev.filter(t => t !== tag));
  };

  // Create a new checkpoint
  const handleCreateConfirm = async () => {
    try {
      setIsCreateLoading(true);
      setError(null);

      await checkpointApi.createCheckpoint(
        jobId,
        newCheckpointDescription,
        newCheckpointTags
      );

      await loadCheckpoints();
    } catch (err) {
      setError('Error creating checkpoint');
      console.error('Checkpoint creation error:', err);
    } finally {
      setIsCreateLoading(false);
      setCreateDialogOpen(false);
    }
  };

  // Delete a checkpoint
  const handleDeleteCheckpoint = async (checkpointId: string) => {
    if (checkpoints.find(cp => cp.id === checkpointId)?.isActive) {
      setError('Cannot delete the active checkpoint');
      return;
    }

    try {
      setIsDeleteLoading(true);
      setError(null);

      const success = await checkpointApi.deleteCheckpoint(jobId, checkpointId);

      if (success) {
        await loadCheckpoints();

        // Remove from selected checkpoints if it was selected
        if (selectedCheckpoints.includes(checkpointId)) {
          setSelectedCheckpoints(prev => prev.filter(id => id !== checkpointId));
        }
      } else {
        setError('Failed to delete checkpoint');
      }
    } catch (err) {
      setError('Error deleting checkpoint');
      console.error('Checkpoint deletion error:', err);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Get selected checkpoints
  const getSelectedCheckpoints = () => {
    return checkpoints.filter(cp => selectedCheckpoints.includes(cp.id));
  };

  // Render comparison section
  const renderComparison = () => {
    const selected = getSelectedCheckpoints();
    if (selected.length < 2) return null;

    const [cp1, cp2] = selected;
    const metrics1 = cp1.metrics;
    const metrics2 = cp2.metrics;

    return (
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Checkpoint Comparison
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {cp1.description || `Checkpoint ${cp1.id}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatDate(cp1.timestamp)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Epoch: {cp1.epoch}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Metrics
                </Typography>

                <Box>
                  <Typography variant="body2">
                    Loss: <Span style={{ fontWeight: 'bold' }}>{metrics1.loss.toFixed(4)}</Span>
                  </Typography>
                  <Typography variant="body2">
                    Accuracy: <Span style={{ fontWeight: 'bold' }}>{(metrics1.accuracy * 100).toFixed(2)}%</Span>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {cp2.description || `Checkpoint ${cp2.id}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatDate(cp2.timestamp)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Epoch: {cp2.epoch}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Metrics
                </Typography>

                <Box>
                  <Typography variant="body2">
                    Loss: <Span style={{ fontWeight: 'bold' }}>{metrics2.loss.toFixed(4)}</Span>{' '}
                    <Typography component="span" color={metrics2.loss < metrics1.loss ? 'success.main' : 'error.main'}>
                      ({((metrics2.loss - metrics1.loss) / metrics1.loss * 100).toFixed(1)}%)
                    </Typography>
                  </Typography>
                  <Typography variant="body2">
                    Accuracy: <Span style={{ fontWeight: 'bold' }}>{(metrics2.accuracy * 100).toFixed(2)}%</Span>{' '}
                    <Typography component="span" color={metrics2.accuracy > metrics1.accuracy ? 'success.main' : 'error.main'}>
                      ({((metrics2.accuracy - metrics1.accuracy) / metrics1.accuracy * 100).toFixed(1)}%)
                    </Typography>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Parameter differences */}
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary>
            <Typography>Parameter Differences</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Parameter</TableCell>
                    <TableCell>{cp1.description || cp1.id}</TableCell>
                    <TableCell>{cp2.description || cp2.id}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.keys({ ...cp1.parameters, ...cp2.parameters }).map(param => (
                    <TableRow key={param}>
                      <TableCell>{param}</TableCell>
                      <TableCell>{cp1.parameters[param] !== undefined ? String(cp1.parameters[param]) : '-'}</TableCell>
                      <TableCell>
                        {cp2.parameters[param] !== undefined ? String(cp2.parameters[param]) : '-'}
                        {cp1.parameters[param] !== undefined && cp2.parameters[param] !== undefined &&
                         cp1.parameters[param] !== cp2.parameters[param] && (
                          <Chip size="small" label="Changed" color="primary" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Model Checkpoints
        </Typography>

        <Button
          variant="contained"
          onClick={handleCreateClick}
          disabled={loading || isCreateLoading || isRollbackLoading || isDeleteLoading}
        >
          {isCreateLoading ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Creating...
            </>
          ) : (
            'Create Checkpoint'
          )}
        </Button>
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Loading state */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Checkpoints table */}
          {checkpoints.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              No checkpoints available for this model.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Compare</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Epoch</TableCell>
                    <TableCell>Metrics</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {checkpoints.map((checkpoint) => (
                    <TableRow
                      key={checkpoint.id}
                      sx={{
                        backgroundColor: checkpoint.isActive ? 'rgba(76, 175, 80, 0.08)' : 'inherit',
                        '&:last-child td, &:last-child th': { border: 0 }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedCheckpoints.includes(checkpoint.id)}
                          onChange={() => handleCheckpointToggle(checkpoint.id)}
                          disabled={!(selectedCheckpoints.includes(checkpoint.id) || selectedCheckpoints.length < 2)}
                        />
                      </TableCell>
                      <TableCell>
                        {checkpoint.id}
                        {checkpoint.isActive && (
                          <Chip size="small" label="Active" color="success" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>{checkpoint.description}</TableCell>
                      <TableCell>{formatDate(checkpoint.timestamp)}</TableCell>
                      <TableCell>{checkpoint.epoch}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Loss: {checkpoint.metrics.loss.toFixed(4)}
                        </Typography>
                        <Typography variant="body2">
                          Acc: {(checkpoint.metrics.accuracy * 100).toFixed(2)}%
                        </Typography>
                      </TableCell>
                      <TableCell>{formatFileSize(checkpoint.fileSize)}</TableCell>
                      <TableCell>
                        {checkpoint.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={checkpoint.isActive ? 'Current active checkpoint' : 'Roll back to this checkpoint'}>
                          <Span>
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              onClick={() => handleRollbackClick(checkpoint.id)}
                              disabled={checkpoint.isActive || isRollbackLoading}
                              sx={{ mr: 1 }}
                            >
                              {isRollbackLoading && rollbackCheckpointId === checkpoint.id ? (
                                <CircularProgress size={20} />
                              ) : (
                                'Rollback'
                              )}
                            </Button>
                          </Span>
                        </Tooltip>

                        <Tooltip title={checkpoint.isActive ? 'Cannot delete active checkpoint' : 'Delete this checkpoint'}>
                          <Span>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleDeleteCheckpoint(checkpoint.id)}
                              disabled={checkpoint.isActive || isDeleteLoading}
                            >
                              {isDeleteLoading ? (
                                <CircularProgress size={20} />
                              ) : (
                                'Delete'
                              )}
                            </Button>
                          </Span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Checkpoint comparison section */}
          {renderComparison()}
        </>
      )}

      {/* Rollback confirmation dialog */}
      <Dialog
        open={rollbackDialogOpen}
        onClose={() => !isRollbackLoading && setRollbackDialogOpen(false)}
      >
        <DialogTitle>Confirm Rollback</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to roll back to checkpoint {rollbackCheckpointId}? This will reset the model to that state and any subsequent training will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRollbackDialogOpen(false)}
            disabled={isRollbackLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRollbackConfirm}
            color="primary"
            disabled={isRollbackLoading}
            autoFocus
          >
            {isRollbackLoading ? 'Rolling Back...' : 'Confirm Rollback'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create checkpoint dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !isCreateLoading && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Checkpoint</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will save the current state of the model as a new checkpoint.
          </DialogContentText>

          <TextField
            label="Checkpoint Description"
            fullWidth
            value={newCheckpointDescription}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCheckpointDescription(e.target.value)}
            margin="normal"
            multiline
            rows={2}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Tags
            </Typography>

            <Box sx={{ display: 'flex', mb: 1 }}>
              <TextField
                label="Add Tag"
                size="small"
                value={tagInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddTag()}
                sx={{ flexGrow: 1, mr: 1 }}
              />
              <Button
                variant="outlined"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {newCheckpointTags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={isCreateLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateConfirm}
            color="primary"
            disabled={isCreateLoading}
          >
            {isCreateLoading ? 'Creating...' : 'Create Checkpoint'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CheckpointManager;