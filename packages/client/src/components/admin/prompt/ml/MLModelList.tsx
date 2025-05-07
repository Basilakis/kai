import React, { useState, useEffect } from 'react';
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
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as TrainIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import MLModelForm from './MLModelForm';
import MLModelDetails from './MLModelDetails';

interface MLModel {
  id: string;
  name: string;
  description?: string;
  modelType: string;
  modelParameters: Record<string, any>;
  trainingDataQuery?: string;
  trainingMetrics?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const MLModelList: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [openCreateDialog, setOpenCreateDialog] = useState<boolean>(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [trainingModel, setTrainingModel] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/prompt-ml/models');
      if (response.data.success) {
        setModels(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch models: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching models: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleCreateModel = async (model: Omit<MLModel, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await axios.post('/api/admin/prompt-ml/models', model);
      if (response.data.success) {
        enqueueSnackbar('Model created successfully', { variant: 'success' });
        setOpenCreateDialog(false);
        fetchModels();
      } else {
        enqueueSnackbar(`Failed to create model: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error creating model: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    }
  };

  const handleTrainModel = async (modelId: string) => {
    setTrainingModel(modelId);
    try {
      const response = await axios.post(`/api/admin/prompt-ml/models/${modelId}/train`);
      if (response.data.success) {
        enqueueSnackbar('Model trained successfully', { variant: 'success' });
        fetchModels();
      } else {
        enqueueSnackbar(`Failed to train model: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error training model: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setTrainingModel(null);
    }
  };

  const getModelTypeLabel = (modelType: string) => {
    switch (modelType) {
      case 'neural_network':
        return 'Neural Network';
      case 'lstm':
        return 'LSTM';
      case 'transformer':
        return 'Transformer';
      case 'random_forest':
        return 'Random Forest';
      case 'gradient_boosting':
        return 'Gradient Boosting';
      default:
        return modelType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getModelTypeColor = (modelType: string) => {
    switch (modelType) {
      case 'neural_network':
        return 'primary';
      case 'lstm':
        return 'secondary';
      case 'transformer':
        return 'info';
      case 'random_forest':
        return 'success';
      case 'gradient_boosting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getAccuracyColor = (accuracy?: number) => {
    if (!accuracy) return 'default';
    if (accuracy >= 0.9) return 'success';
    if (accuracy >= 0.7) return 'primary';
    if (accuracy >= 0.5) return 'warning';
    return 'error';
  };

  const handleViewDetails = (model: MLModel) => {
    setSelectedModel(model);
    setOpenDetailsDialog(true);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">ML Models</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchModels}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
          >
            Create Model
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Model Type</TableCell>
              <TableCell>Metrics</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No models found
                </TableCell>
              </TableRow>
            ) : (
              models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <Typography variant="body1">{model.name}</Typography>
                    {model.description && (
                      <Typography variant="body2" color="textSecondary">
                        {model.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getModelTypeLabel(model.modelType)}
                      color={getModelTypeColor(model.modelType) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {model.trainingMetrics ? (
                      <>
                        <Typography variant="body2">
                          <strong>Accuracy:</strong>{' '}
                          <Chip
                            label={`${(model.trainingMetrics.accuracy * 100).toFixed(1)}%`}
                            color={getAccuracyColor(model.trainingMetrics.accuracy)}
                            size="small"
                          />
                        </Typography>
                        <Typography variant="body2">
                          <strong>F1 Score:</strong> {(model.trainingMetrics.f1Score * 100).toFixed(1)}%
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Not trained yet
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={model.isActive ? 'Active' : 'Inactive'}
                      color={model.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(model.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Train Model">
                      <IconButton
                        onClick={() => handleTrainModel(model.id)}
                        disabled={trainingModel === model.id}
                      >
                        {trainingModel === model.id ? (
                          <CircularProgress size={24} />
                        ) : (
                          <TrainIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Details">
                      <IconButton onClick={() => handleViewDetails(model)}>
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Performance">
                      <IconButton>
                        <AssessmentIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Model Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create ML Model</DialogTitle>
        <DialogContent>
          <MLModelForm onSubmit={handleCreateModel} />
        </DialogContent>
      </Dialog>

      {/* Model Details Dialog */}
      <Dialog
        open={openDetailsDialog}
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Model Details</DialogTitle>
        <DialogContent>
          {selectedModel && <MLModelDetails model={selectedModel} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MLModelList;
