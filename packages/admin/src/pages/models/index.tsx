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
  Snackbar 
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

/**
 * Models Page Component
 * Provides an interface for managing AI models:
 * - Importing pre-trained models
 * - Viewing existing models
 * - Training models with datasets
 */
const ModelsPage: React.FC = () => {
  // State for models
  const [models, setModels] = React.useState<any[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(0);
  const [trainingSuccess, setTrainingSuccess] = React.useState(false);
  const [trainingResult, setTrainingResult] = React.useState<any>(null);

  // Sample model frameworks for visualization
  const frameworkColors: Record<string, string> = {
    tensorflow: '#FF6F00',
    pytorch: '#EE4C2C',
    onnx: '#2CBFD9',
    custom: '#9C27B0'
  };

  // Fetch models on component mount
  React.useEffect(() => {
    // Simulate API call to fetch models
    const fetchModels = async () => {
      try {
        // This would be an actual API call in a real implementation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock models data
        const mockModels = [
          {
            id: 'model-1',
            name: 'MobileNet V2',
            description: 'Lightweight image classification model',
            framework: 'tensorflow',
            type: 'repository',
            source: 'https://tfhub.dev/google/imagenet/mobilenet_v2_130_224/classification/5',
            status: 'ready',
            accuracy: 72.8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'model-2',
            name: 'ResNet50',
            description: 'Deep residual network for image recognition',
            framework: 'pytorch',
            type: 'repository',
            source: 'https://pytorch.org/hub/pytorch_vision_resnet/',
            status: 'ready',
            accuracy: 79.3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        
        setModels(mockModels);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models');
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Handle importing a new model
  const handleImportModel = (model: any) => {
    setModels(prev => [model, ...prev]);
    setImportOpen(false);
  };

  // Handle deleting a model
  const handleDeleteModel = (modelId: string) => {
    setModels(prev => prev.filter(model => model.id !== modelId));
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
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle training start
  const handleTrainingStart = (config: any) => {
    console.log('Training started with config:', config);
  };

  // Handle training complete
  const handleTrainingComplete = (results: any) => {
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
      return <Typography>Loading models...</Typography>;
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
                  <strong>Source:</strong> {model.type}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
                  <strong>Accuracy:</strong> {model.accuracy ? `${model.accuracy.toFixed(1)}%` : 'Not evaluated'}
                </Typography>
                
                <Typography variant="body2" color="textSecondary">
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
                    aria-label="Delete model"
                  >
                    <DeleteIcon />
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
        <Typography color="error" paragraph>
          {error}
        </Typography>
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
          Model training completed successfully! Accuracy: {trainingResult?.finalAccuracy ? `${(trainingResult.finalAccuracy * 100).toFixed(1)}%` : 'N/A'}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ModelsPage;