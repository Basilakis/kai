import React from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  IconButton, 
  Dialog, 
  Tooltip,
  Tab,
  Tabs,
  Paper,
  Alert,
  Snackbar,
  CircularProgress 
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import SchoolIcon from '@mui/icons-material/School';
import ModelImporter from '../../components/models/ModelImporter';
import ModelTrainingConnector from '../../components/models/ModelTrainingConnector';
import modelsService, { Model, TrainingParams, TrainingResult, ImportModelParams, TrainingConfig } from '../../services/modelsService';

/**
 * Models Page Component
 * Provides an interface for managing AI models:
 * - Importing pre-trained models
 * - Viewing existing models
 * - Training models with datasets
 */
const ModelsPage: React.FC = () => {
  // State for models
  const [models, setModels] = React.useState<Model[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(0);
  const [trainingSuccess, setTrainingSuccess] = React.useState(false);
  const [trainingResult, setTrainingResult] = React.useState<TrainingResult | null>(null);
  const [deleteInProgress, setDeleteInProgress] = React.useState<string | null>(null);

  // Model frameworks for visualization
  const frameworkColors: Record<string, string> = {
    tensorflow: '#FF6F00',
    pytorch: '#EE4C2C',
    onnx: '#2CBFD9',
    custom: '#9C27B0'
  };

  // Fetch models on component mount
  React.useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);
        // Call the real API service
        const modelsList = await modelsService.getModels();
        setModels(modelsList);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Handle importing a new model
  const handleImportModel = async (modelData: ImportModelParams) => {
    try {
      setLoading(true);
      // Call the real API service
      const importedModel = await modelsService.importModel(modelData);
      setModels(prev => [importedModel, ...prev]);
      setImportOpen(false);
    } catch (err) {
      console.error('Error importing model:', err);
      setError('Failed to import model: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a model
  const handleDeleteModel = async (modelId: string) => {
    try {
      setDeleteInProgress(modelId);
      // Call the real API service
      await modelsService.deleteModel(modelId);
      setModels(prev => prev.filter(model => model.id !== modelId));
    } catch (err) {
      console.error(`Error deleting model ${modelId}:`, err);
      setError('Failed to delete model: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleteInProgress(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle tab change
  // @ts-ignore - SyntheticEvent is used but not exported from React namespace
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle training start
  const handleTrainingStart = async (config: TrainingConfig) => {
    try {
      setLoading(true);
      // Call the real API service
      const result = await modelsService.trainModel(config);
      setTrainingResult(result);
      setTrainingSuccess(true);
      
      // Refresh the models list to include the newly trained model
      if (result.success) {
        const modelsList = await modelsService.getModels();
        setModels(modelsList);
      }
    } catch (err) {
      console.error('Error training model:', err);
      setError('Failed to train model: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Handle training complete
  const handleTrainingComplete = (results: TrainingResult) => {
    console.log('Training completed with results:', results);
    setTrainingResult(results);
    setTrainingSuccess(true);
  };

  // Handle closing the training success message
  const handleCloseSnackbar = () => {
    setTrainingSuccess(false);
  };

  // Render models list
  const renderModelsList = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading models...</Typography>
        </Box>
      );
    }

    if (models.length === 0) {
      return (
        <Card sx={{ mb: 3, textAlign: 'center', py: 4 }}>
          <CardContent>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No AI Models Available
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Import pre-trained models or train new ones with your datasets.
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddCircleIcon />}
              onClick={() => setImportOpen(true)}
            >
              Import Your First Model
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Grid container spacing={3}>
        {models.map(model => (
          <Grid item xs={12} md={6} lg={4} key={model.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="h6" gutterBottom>
                    {model.name}
                  </Typography>
                  <Chip
                    label={model.framework}
                    size="small"
                    sx={{
                      bgcolor: frameworkColors[model.framework] || '#757575',
                      color: 'white',
                    }}
                  />
                </Box>
                
                <Typography variant="body2" color="textSecondary" paragraph>
                  {model.description || 'No description provided'}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  {/* @ts-ignore - JSX.IntrinsicElements strong element */}
                  <strong>Source:</strong> {model.type}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  {/* @ts-ignore - JSX.IntrinsicElements strong element */}
                  <strong>Accuracy:</strong> {model.accuracy ? `${model.accuracy.toFixed(1)}%` : 'Not evaluated'}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  {/* @ts-ignore - JSX.IntrinsicElements strong element */}
                  <strong>Added:</strong> {formatDate(model.createdAt)}
                </Typography>
              </CardContent>
              
              <Box display="flex" justifyContent="flex-end" p={1}>
                <Tooltip title="Train with dataset">
                  <IconButton
                    color="primary"
                    size="small"
                    onClick={() => setActiveTab(2)}
                    aria-label="Train model with dataset"
                  >
                    <SchoolIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton
                    color="primary"
                    size="small"
                    aria-label="Edit model"
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => handleDeleteModel(model.id)}
                    disabled={deleteInProgress === model.id}
                    aria-label="Delete model"
                  >
                    {deleteInProgress === model.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <DeleteIcon />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box p={3}>
      {/* Header Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">AI Models</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleIcon />}
          onClick={() => setImportOpen(true)}
        >
          Import Model
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main content with tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          indicatorColor="primary" 
          textColor="primary"
          variant="fullWidth"
        >
          <Tab icon={<StorageIcon />} label="Models" />
          <Tab icon={<MemoryIcon />} label="Import" />
          <Tab icon={<SchoolIcon />} label="Training" />
        </Tabs>
      </Paper>

      <Box>
        {/* Models List Tab */}
        {activeTab === 0 && renderModelsList()}
        
        {/* Import Model Tab */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Import Pre-Trained Models
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              Import a pre-trained model from a file, repository, or URL. The system supports TensorFlow, PyTorch, and ONNX models.
            </Typography>
            <ModelImporter onComplete={handleImportModel} />
          </Box>
        )}
        
        {/* Training Tab */}
        {activeTab === 2 && (
          <ModelTrainingConnector 
            onTrainingStart={handleTrainingStart}
            onTrainingComplete={handleTrainingComplete}
          />
        )}
      </Box>

      {/* Import Model Dialog */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <Box p={2}>
          <Typography variant="h5" gutterBottom>Import AI Model</Typography>
          <ModelImporter onComplete={handleImportModel} />
        </Box>
      </Dialog>

      {/* Success Notification */}
      <Snackbar 
        open={trainingSuccess} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          Model training completed successfully! Accuracy: {trainingResult?.accuracy ? `${(trainingResult.accuracy * 100).toFixed(1)}%` : 'N/A'}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ModelsPage;