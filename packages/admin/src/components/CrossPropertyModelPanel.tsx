import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
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
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
  School as SchoolIcon,
  Upload as UploadIcon,
  ViewModule as ViewModuleIcon
} from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';

/**
 * Cross-Property Model Panel Component
 * 
 * This component allows admins to manage cross-property models.
 */
const CrossPropertyModelPanel: React.FC<{
  materialType: MaterialType;
}> = ({ materialType }) => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  const [createModelDialogOpen, setCreateModelDialogOpen] = useState<boolean>(false);
  const [modelName, setModelName] = useState<string>('');
  const [modelDescription, setModelDescription] = useState<string>('');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);
  const [trainDialogOpen, setTrainDialogOpen] = useState<boolean>(false);
  const [trainingOptions, setTrainingOptions] = useState({
    epochs: 20,
    batchSize: 32,
    learningRate: 0.001,
    useTransferLearning: true,
    useDataAugmentation: true
  });
  const [training, setTraining] = useState<boolean>(false);
  const [predictDialogOpen, setPredictDialogOpen] = useState<boolean>(false);
  const [predictImage, setPredictImage] = useState<File | null>(null);
  const [predictions, setPredictions] = useState<any | null>(null);
  const [predicting, setPredicting] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load models
  useEffect(() => {
    loadModels();
    loadProperties();
  }, [materialType]);

  // Load cross-property models
  const loadModels = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ai/cross-property/models', {
        params: {
          materialType
        }
      });
      
      setModels(response.data.models || []);
      
      // Select the first model if available
      if (response.data.models?.length > 0) {
        setSelectedModel(response.data.models[0]);
      }
    } catch (error) {
      console.error('Error loading cross-property models:', error);
      setError('Error loading cross-property models');
    } finally {
      setLoading(false);
    }
  };

  // Load available properties
  const loadProperties = async () => {
    try {
      const response = await api.get('/api/ai/visual-reference/properties', {
        params: {
          materialType
        }
      });
      
      setAvailableProperties(response.data.properties || []);
    } catch (error) {
      console.error('Error loading properties:', error);
      setError('Error loading properties');
    }
  };

  // Handle create model dialog open
  const handleOpenCreateModelDialog = () => {
    setCreateModelDialogOpen(true);
    setModelName('');
    setModelDescription('');
    setSelectedProperties([]);
  };

  // Handle create model dialog close
  const handleCloseCreateModelDialog = () => {
    setCreateModelDialogOpen(false);
  };

  // Handle property selection change
  const handlePropertySelectionChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedProperties(event.target.value as string[]);
  };

  // Handle create model
  const handleCreateModel = async () => {
    if (!modelName) {
      setError('Please enter a model name');
      return;
    }
    
    if (selectedProperties.length < 2) {
      setError('Please select at least 2 properties');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/api/ai/cross-property/models', {
        name: modelName,
        materialType,
        properties: selectedProperties,
        description: modelDescription || undefined
      });
      
      handleCloseCreateModelDialog();
      loadModels();
      setSelectedModel(response.data.model);
    } catch (error) {
      console.error('Error creating cross-property model:', error);
      setError('Error creating cross-property model');
    } finally {
      setLoading(false);
    }
  };

  // Handle model selection
  const handleModelSelect = async (modelId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/api/ai/cross-property/models/${modelId}`);
      setSelectedModel(response.data.model);
    } catch (error) {
      console.error('Error loading model details:', error);
      setError('Error loading model details');
    } finally {
      setLoading(false);
    }
  };

  // Handle train dialog open
  const handleOpenTrainDialog = () => {
    setTrainDialogOpen(true);
    setTrainingOptions({
      epochs: 20,
      batchSize: 32,
      learningRate: 0.001,
      useTransferLearning: true,
      useDataAugmentation: true
    });
  };

  // Handle train dialog close
  const handleCloseTrainDialog = () => {
    setTrainDialogOpen(false);
  };

  // Handle training option change
  const handleTrainingOptionChange = (name: string, value: any) => {
    setTrainingOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle train model
  const handleTrainModel = async () => {
    setTraining(true);
    try {
      const response = await api.post(`/api/ai/cross-property/models/${selectedModel.id}/train`, {
        options: trainingOptions
      });
      
      handleCloseTrainDialog();
      setSelectedModel(response.data.model);
    } catch (error) {
      console.error('Error training model:', error);
      setError('Error training model');
    } finally {
      setTraining(false);
    }
  };

  // Handle predict dialog open
  const handleOpenPredictDialog = () => {
    setPredictDialogOpen(true);
    setPredictImage(null);
    setPredictions(null);
  };

  // Handle predict dialog close
  const handleClosePredictDialog = () => {
    setPredictDialogOpen(false);
  };

  // Handle predict image selection
  const handlePredictImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setPredictImage(event.target.files[0]);
      setPredictions(null);
    }
  };

  // Handle predict
  const handlePredict = async () => {
    if (!predictImage) {
      setError('Please select an image');
      return;
    }
    
    setPredicting(true);
    try {
      // Create form data
      const formData = new FormData();
      formData.append('image', predictImage);
      
      // Send prediction request
      const response = await api.post(`/api/ai/cross-property/models/${selectedModel.id}/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setPredictions(response.data.predictions);
    } catch (error) {
      console.error('Error predicting:', error);
      setError('Error predicting');
    } finally {
      setPredicting(false);
    }
  };

  // Handle delete dialog open
  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  // Handle delete dialog close
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  // Handle delete model
  const handleDeleteModel = async () => {
    try {
      await api.delete(`/api/ai/cross-property/models/${selectedModel.id}`);
      
      handleCloseDeleteDialog();
      loadModels();
      setSelectedModel(null);
    } catch (error) {
      console.error('Error deleting model:', error);
      setError('Error deleting model');
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence < 0.5) return 'error';
    if (confidence < 0.8) return 'warning';
    return 'success';
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        <ViewModuleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Cross-Property Models: {materialType}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Models
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateModelDialog}
              >
                Create Model
              </Button>
            </Box>
            
            {loading && !selectedModel ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : models.length === 0 ? (
              <Alert severity="info">
                No cross-property models found for this material type. Create a model to get started.
              </Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Properties</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {models.map((model) => (
                      <TableRow 
                        key={model.id}
                        selected={selectedModel?.id === model.id}
                        hover
                        onClick={() => handleModelSelect(model.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{model.name}</TableCell>
                        <TableCell>{model.properties.length}</TableCell>
                        <TableCell>
                          <Chip
                            label={model.lastTrainedAt ? 'Trained' : 'Not Trained'}
                            size="small"
                            color={model.lastTrainedAt ? 'success' : 'warning'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          {selectedModel ? (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {selectedModel.name}
                </Typography>
                <Box>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleOpenTrainDialog}
                    sx={{ mr: 1 }}
                  >
                    Train
                  </Button>
                  {selectedModel.lastTrainedAt && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleOpenPredictDialog}
                      sx={{ mr: 1 }}
                    >
                      Predict
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleOpenDeleteDialog}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Model Information
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>ID:</strong> {selectedModel.id}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Material Type:</strong> {selectedModel.materialType}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Created:</strong> {new Date(selectedModel.createdAt).toLocaleString()}
                      </Typography>
                      {selectedModel.lastTrainedAt && (
                        <Typography variant="body2">
                          <strong>Last Trained:</strong> {new Date(selectedModel.lastTrainedAt).toLocaleString()}
                        </Typography>
                      )}
                      {selectedModel.description && (
                        <Typography variant="body2">
                          <strong>Description:</strong> {selectedModel.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Properties
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {selectedModel.properties.map((property: string) => (
                        <Chip
                          key={property}
                          label={property}
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
                
                {selectedModel.accuracy && (
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Accuracy Metrics
                      </Typography>
                      <Grid container spacing={2}>
                        {Object.entries(selectedModel.accuracy).map(([property, accuracy]: [string, any]) => (
                          <Grid item xs={6} md={3} key={property}>
                            <Typography variant="body2">
                              <strong>{property}:</strong> {(accuracy * 100).toFixed(1)}%
                            </Typography>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  </Grid>
                )}
                
                {selectedModel.trainingDataSize && (
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Training Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2">
                            <strong>Training Data Size:</strong> {selectedModel.trainingDataSize} samples
                          </Typography>
                        </Grid>
                        {selectedModel.parameters && (
                          <>
                            <Grid item xs={6} md={3}>
                              <Typography variant="body2">
                                <strong>Epochs:</strong> {selectedModel.parameters.epochs}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} md={3}>
                              <Typography variant="body2">
                                <strong>Batch Size:</strong> {selectedModel.parameters.batchSize}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} md={3}>
                              <Typography variant="body2">
                                <strong>Learning Rate:</strong> {selectedModel.parameters.learningRate}
                              </Typography>
                            </Grid>
                          </>
                        )}
                      </Grid>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Paper>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Select a Model
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Please select a model from the list or create a new one.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateModelDialog}
                sx={{ mt: 2 }}
              >
                Create Model
              </Button>
            </Paper>
          )}
        </Grid>
      </Grid>
      
      {/* Create Model Dialog */}
      <Dialog
        open={createModelDialogOpen}
        onClose={handleCloseCreateModelDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Cross-Property Model</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Create a new cross-property model for {materialType}.
              This model will be able to recognize multiple properties at once.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Model Name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  fullWidth
                  required
                  margin="normal"
                />
                
                <TextField
                  label="Description"
                  value={modelDescription}
                  onChange={(e) => setModelDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Properties</InputLabel>
                  <Select
                    multiple
                    value={selectedProperties}
                    onChange={handlePropertySelectionChange}
                    label="Properties"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} />
                        ))}
                      </Box>
                    )}
                  >
                    {availableProperties.map((property) => (
                      <MenuItem key={property.name} value={property.name}>
                        {property.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Select at least 2 properties for the cross-property model.
                </Typography>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Cross-Property Models
              </Typography>
              <Typography variant="body2">
                Cross-property models can recognize multiple properties from a single image.
                This is more efficient than using separate models for each property.
                The model will be trained to recognize all selected properties simultaneously.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateModelDialog}>Cancel</Button>
          <Button
            onClick={handleCreateModel}
            variant="contained"
            color="primary"
            disabled={loading || selectedProperties.length < 2 || !modelName}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Model'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Train Dialog */}
      <Dialog
        open={trainDialogOpen}
        onClose={handleCloseTrainDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Train Model: {selectedModel?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Train the cross-property model to recognize {selectedModel?.properties.join(', ')}.
              This process may take some time depending on the amount of training data.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Epochs"
                  type="number"
                  value={trainingOptions.epochs}
                  onChange={(e) => handleTrainingOptionChange('epochs', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 1, max: 100 }
                  }}
                />
                
                <TextField
                  label="Batch Size"
                  type="number"
                  value={trainingOptions.batchSize}
                  onChange={(e) => handleTrainingOptionChange('batchSize', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 1, max: 128 }
                  }}
                />
                
                <TextField
                  label="Learning Rate"
                  type="number"
                  value={trainingOptions.learningRate}
                  onChange={(e) => handleTrainingOptionChange('learningRate', parseFloat(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 0.0001, max: 0.1, step: 0.0001 }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={trainingOptions.useTransferLearning}
                        onChange={(e) => handleTrainingOptionChange('useTransferLearning', e.target.checked)}
                      />
                    }
                    label="Use Transfer Learning"
                  />
                  <Typography variant="body2" color="textSecondary" sx={{ ml: 3, mb: 2 }}>
                    Use a pre-trained model as a starting point for training.
                    This can significantly improve accuracy and reduce training time.
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={trainingOptions.useDataAugmentation}
                        onChange={(e) => handleTrainingOptionChange('useDataAugmentation', e.target.checked)}
                      />
                    }
                    label="Use Data Augmentation"
                  />
                  <Typography variant="body2" color="textSecondary" sx={{ ml: 3 }}>
                    Generate additional training data by applying random transformations.
                    This can help prevent overfitting and improve generalization.
                  </Typography>
                </FormGroup>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Training Process
              </Typography>
              <Typography variant="body2">
                The system will train a model to recognize all selected properties simultaneously.
                This process may take several minutes to complete.
                You will be notified when the training is complete.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTrainDialog}>Cancel</Button>
          <Button
            onClick={handleTrainModel}
            variant="contained"
            color="primary"
            disabled={training}
          >
            {training ? <CircularProgress size={24} /> : 'Train Model'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Predict Dialog */}
      <Dialog
        open={predictDialogOpen}
        onClose={handleClosePredictDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Predict with Model: {selectedModel?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Use the cross-property model to predict {selectedModel?.properties.join(', ')} from an image.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box 
                  sx={{ 
                    border: '2px dashed', 
                    borderColor: 'divider', 
                    borderRadius: 1, 
                    p: 3, 
                    textAlign: 'center',
                    mb: 3
                  }}
                >
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                  >
                    Select Image
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handlePredictImageSelect}
                    />
                  </Button>
                  
                  {predictImage && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Selected image: {predictImage.name} ({Math.round(predictImage.size / 1024)} KB)
                      </Typography>
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <img
                          src={URL.createObjectURL(predictImage)}
                          alt="Preview"
                          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>
                
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handlePredict}
                  disabled={!predictImage || predicting}
                  fullWidth
                >
                  {predicting ? <CircularProgress size={24} /> : 'Predict'}
                </Button>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Predictions
                </Typography>
                
                {predictions ? (
                  <Box>
                    {Object.entries(predictions).map(([property, prediction]: [string, any]) => (
                      <Box key={property} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">
                          {property}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1">
                            {prediction.value}
                          </Typography>
                          <Chip
                            label={`${(prediction.confidence * 100).toFixed(0)}%`}
                            size="small"
                            color={getConfidenceColor(prediction.confidence)}
                          />
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={prediction.confidence * 100}
                          color={getConfidenceColor(prediction.confidence)}
                          sx={{ height: 4, mb: 1 }}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                      Select an image and click Predict to see the results.
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePredictDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Model</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1">
              Are you sure you want to delete the model <strong>{selectedModel?.name}</strong>?
              This action cannot be undone.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleDeleteModel}
            variant="contained"
            color="error"
          >
            Delete Model
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CrossPropertyModelPanel;
