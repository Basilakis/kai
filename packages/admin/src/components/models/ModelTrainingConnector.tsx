/**
 * Model Training Connector Component
 * 
 * Connects datasets with AI models to facilitate training, fine-tuning,
 * and transfer learning workflows
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  Dataset as DatasetIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayArrowIcon,
  Tune as TuneIcon
} from '@mui/icons-material';

// Interface for component props
interface ModelTrainingConnectorProps {
  onTrainingStart?: (config: TrainingConfig) => void;
  onTrainingComplete?: (results: any) => void;
}

// Interface for training configuration
interface TrainingConfig {
  modelId: string;
  datasetId: string;
  learningRate: number;
  epochs: number;
  batchSize: number;
  useTranferLearning: boolean;
  freezeBaseModel: boolean;
  trainableLayersCount: number;
  enableEarlyStopping: boolean;
  enableDataAugmentation: boolean;
  validationSplit: number;
  enableHyperparameterTuning: boolean;
}

// Interface for dataset
interface Dataset {
  id: string;
  name: string;
  description: string;
  imageCount: number;
  classCount: number;
  status: string;
  source?: string;
  sourceId?: string;
}

// Interface for model
interface Model {
  id: string;
  name: string;
  description: string;
  framework: string;
  type: string;
  accuracy?: number;
  status: string;
}

// Component implementation
const ModelTrainingConnector: React.FC<ModelTrainingConnectorProps> = ({ 
  onTrainingStart, 
  onTrainingComplete 
}) => {
  const theme = useTheme();
  
  // State for available datasets and models
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // State for selected items
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  // State for training configuration
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    modelId: '',
    datasetId: '',
    learningRate: 0.001,
    epochs: 10,
    batchSize: 32,
    useTranferLearning: true,
    freezeBaseModel: true,
    trainableLayersCount: 3,
    enableEarlyStopping: true,
    enableDataAugmentation: true,
    validationSplit: 0.2,
    enableHyperparameterTuning: false
  });
  
  // State for training progress
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  const [trainingMetrics, setTrainingMetrics] = useState<any>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  
  // Load datasets and models on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real implementation, these would be API calls
        // For this example, we're using mock data
        
        // Mock datasets
        const mockDatasets: Dataset[] = [
          {
            id: 'dataset-1',
            name: 'Materials Dataset',
            description: 'Dataset for recognizing various material types and surfaces',
            imageCount: 5000,
            classCount: 25,
            status: 'ready',
            source: 'kaggle'
          },
          {
            id: 'dataset-2',
            name: 'ImageNet Mini',
            description: 'A smaller subset of ImageNet with 1000 classes',
            imageCount: 50000,
            classCount: 1000,
            status: 'ready',
            source: 'imageNet'
          },
          {
            id: 'dataset-3',
            name: 'Custom Uploaded Dataset',
            description: 'User-uploaded dataset from ZIP file',
            imageCount: 1250,
            classCount: 15,
            status: 'ready'
          }
        ];
        
        // Mock models
        const mockModels: Model[] = [
          {
            id: 'model-1',
            name: 'MobileNet V2',
            description: 'Lightweight image classification model',
            framework: 'tensorflow',
            type: 'repository',
            accuracy: 72.8,
            status: 'ready'
          },
          {
            id: 'model-2',
            name: 'ResNet50',
            description: 'Deep residual network for image recognition',
            framework: 'pytorch',
            type: 'repository',
            accuracy: 79.3,
            status: 'ready'
          },
          {
            id: 'model-3',
            name: 'Custom Model',
            description: 'User-uploaded custom model',
            framework: 'tensorflow',
            type: 'uploaded',
            status: 'ready'
          }
        ];
        
        setDatasets(mockDatasets);
        setModels(mockModels);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Update training config when dataset or model changes
  useEffect(() => {
    setTrainingConfig(prev => ({
      ...prev,
      datasetId: selectedDataset,
      modelId: selectedModel
    }));
  }, [selectedDataset, selectedModel]);
  
  // Handle dataset selection
  const handleDatasetChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedDataset(event.target.value as string);
  };
  
  // Handle model selection
  const handleModelChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedModel(event.target.value as string);
  };
  
  // Handle config changes
  const handleConfigChange = (field: keyof TrainingConfig, value: any) => {
    setTrainingConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle training start
  const handleStartTraining = async () => {
    if (!selectedDataset || !selectedModel) {
      setTrainingError('Please select both a dataset and a model');
      return;
    }
    
    setIsTraining(true);
    setTrainingProgress(0);
    setTrainingError(null);
    
    // Notify parent component
    if (onTrainingStart) {
      onTrainingStart(trainingConfig);
    }
    
    try {
      // Simulate training progress
      const interval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 1;
        });
      }, 200);
      
      // Simulate metrics updates during training
      const metricsInterval = setInterval(() => {
        const epoch = Math.floor(trainingProgress / 10) + 1;
        if (epoch > 10) {
          clearInterval(metricsInterval);
          return;
        }
        
        const accuracy = 0.5 + (epoch * 0.04) + (Math.random() * 0.02);
        const loss = 0.5 - (epoch * 0.04) + (Math.random() * 0.02);
        
        setTrainingMetrics({
          epoch,
          accuracy: accuracy,
          loss: loss,
          val_accuracy: accuracy - 0.03 + (Math.random() * 0.05),
          val_loss: loss + 0.03 + (Math.random() * 0.05)
        });
      }, 1000);
      
      // Simulate completing the training process
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      clearInterval(interval);
      clearInterval(metricsInterval);
      setTrainingProgress(100);
      
      // Mock training results
      const results = {
        modelId: selectedModel,
        datasetId: selectedDataset,
        finalAccuracy: 0.92,
        finalLoss: 0.12,
        trainingTime: '3m 42s',
        parameters: trainingConfig,
        timestamp: new Date().toISOString()
      };
      
      // Notify parent component
      if (onTrainingComplete) {
        onTrainingComplete(results);
      }
    } catch (error) {
      console.error('Error during training:', error);
      setTrainingError('An error occurred during training');
      setIsTraining(false);
    }
  };
  
  // Get selected dataset and model details
  const selectedDatasetDetails = datasets.find(d => d.id === selectedDataset);
  const selectedModelDetails = models.find(m => m.id === selectedModel);
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Connect Datasets with AI Models
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Select a dataset and model to train or fine-tune. Configure training parameters to optimize results.
      </Typography>
      
      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Dataset Selection */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <DatasetIcon sx={{ mr: 1 }} color="primary" />
                Select Dataset
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Dataset</InputLabel>
                <Select
                  value={selectedDataset}
                  onChange={handleDatasetChange}
                  label="Dataset"
                >
                  <MenuItem value="">
                    <em>Select a dataset</em>
                  </MenuItem>
                  {datasets.map((dataset) => (
                    <MenuItem key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.classCount} classes, {dataset.imageCount} images)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {selectedDatasetDetails && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {selectedDatasetDetails.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {selectedDatasetDetails.description}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Classes
                        </Typography>
                        <Typography variant="body2">
                          {selectedDatasetDetails.classCount}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Images
                        </Typography>
                        <Typography variant="body2">
                          {selectedDatasetDetails.imageCount}
                        </Typography>
                      </Grid>
                    </Grid>
                    {selectedDatasetDetails.source && (
                      <Chip 
                        size="small" 
                        label={`Source: ${selectedDatasetDetails.source}`} 
                        sx={{ mt: 1 }} 
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </Paper>
          </Grid>
          
          {/* Model Selection */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <StorageIcon sx={{ mr: 1 }} color="primary" />
                Select Model
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={selectedModel}
                  onChange={handleModelChange}
                  label="Model"
                >
                  <MenuItem value="">
                    <em>Select a model</em>
                  </MenuItem>
                  {models.map((model) => (
                    <MenuItem key={model.id} value={model.id}>
                      {model.name} ({model.framework})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {selectedModelDetails && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {selectedModelDetails.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {selectedModelDetails.description}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Framework
                        </Typography>
                        <Typography variant="body2">
                          {selectedModelDetails.framework}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Type
                        </Typography>
                        <Typography variant="body2">
                          {selectedModelDetails.type}
                        </Typography>
                      </Grid>
                    </Grid>
                    {selectedModelDetails.accuracy && (
                      <Chip 
                        size="small" 
                        label={`Base Accuracy: ${selectedModelDetails.accuracy.toFixed(1)}%`} 
                        color="primary"
                        sx={{ mt: 1 }} 
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </Paper>
          </Grid>
          
          {/* Training Configuration */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <SettingsIcon sx={{ mr: 1 }} color="primary" />
                Training Configuration
              </Typography>
              
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Parameters
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Learning Rate: {trainingConfig.learningRate}
                    </Typography>
                    <Slider
                      value={trainingConfig.learningRate}
                      min={0.0001}
                      max={0.01}
                      step={0.0001}
                      onChange={(_, value) => handleConfigChange('learningRate', value)}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Epochs: {trainingConfig.epochs}
                    </Typography>
                    <Slider
                      value={trainingConfig.epochs}
                      min={1}
                      max={50}
                      step={1}
                      onChange={(_, value) => handleConfigChange('epochs', value)}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Batch Size: {trainingConfig.batchSize}
                    </Typography>
                    <Slider
                      value={trainingConfig.batchSize}
                      min={8}
                      max={128}
                      step={8}
                      onChange={(_, value) => handleConfigChange('batchSize', value)}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Validation Split: {trainingConfig.validationSplit}
                    </Typography>
                    <Slider
                      value={trainingConfig.validationSplit}
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      onChange={(_, value) => handleConfigChange('validationSplit', value)}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Advanced Options
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={trainingConfig.useTranferLearning}
                        onChange={(e) => handleConfigChange('useTranferLearning', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Use Transfer Learning"
                  />
                  
                  {trainingConfig.useTranferLearning && (
                    <>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={trainingConfig.freezeBaseModel}
                            onChange={(e) => handleConfigChange('freezeBaseModel', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Freeze Base Model Layers"
                      />
                      
                      {trainingConfig.freezeBaseModel && (
                        <Box sx={{ ml: 3, mb: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            Trainable Layers: {trainingConfig.trainableLayersCount}
                          </Typography>
                          <Slider
                            value={trainingConfig.trainableLayersCount}
                            min={1}
                            max={10}
                            step={1}
                            onChange={(_, value) => handleConfigChange('trainableLayersCount', value)}
                            valueLabelDisplay="auto"
                          />
                        </Box>
                      )}
                    </>
                  )}
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={trainingConfig.enableDataAugmentation}
                        onChange={(e) => handleConfigChange('enableDataAugmentation', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Enable Data Augmentation"
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={trainingConfig.enableEarlyStopping}
                        onChange={(e) => handleConfigChange('enableEarlyStopping', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Enable Early Stopping"
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={trainingConfig.enableHyperparameterTuning}
                        onChange={(e) => handleConfigChange('enableHyperparameterTuning', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Auto-Tune Hyperparameters"
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Training Status */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" display="flex" alignItems="center">
                  <TuneIcon sx={{ mr: 1 }} color="primary" />
                  Training Status
                </Typography>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStartTraining}
                  disabled={!selectedDataset || !selectedModel || isTraining}
                >
                  {isTraining ? 'Training...' : 'Start Training'}
                </Button>
              </Box>
              
              {isTraining && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={trainingProgress} 
                      sx={{ height: 10, borderRadius: 5 }}
                    />
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
                      {trainingProgress}% Complete
                    </Typography>
                  </Box>
                  
                  {trainingMetrics && (
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Epoch {trainingMetrics.epoch}/10
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary">
                            Accuracy
                          </Typography>
                          <Typography variant="body2">
                            {(trainingMetrics.accuracy * 100).toFixed(2)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary">
                            Loss
                          </Typography>
                          <Typography variant="body2">
                            {trainingMetrics.loss.toFixed(4)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary">
                            Val Accuracy
                          </Typography>
                          <Typography variant="body2">
                            {(trainingMetrics.val_accuracy * 100).toFixed(2)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary">
                            Val Loss
                          </Typography>
                          <Typography variant="body2">
                            {trainingMetrics.val_loss.toFixed(4)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </>
              )}
              
              {trainingProgress === 100 && (
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', color: 'success.contrastText', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Training Complete
                  </Typography>
                  <Typography variant="body2">
                    The model has been successfully trained and is ready for use.
                  </Typography>
                </Box>
              )}
              
              {trainingError && (
                <Typography color="error" sx={{ mt: 2 }}>
                  {trainingError}
                </Typography>
              )}
              
              {!isTraining && trainingProgress === 0 && (
                <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 4 }}>
                  Select a dataset and model above, then click "Start Training" to begin.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ModelTrainingConnector;