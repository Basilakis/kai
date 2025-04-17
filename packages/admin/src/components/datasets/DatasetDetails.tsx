/**
 * Dataset Details Component
 * 
 * Displays detailed information about a dataset, including classes, statistics, and training configuration
 */

import React, { useState, useEffect } from 'react';
import BarChart from '../charts/BarChart';
import SplitRatioControl from './SplitRatioControl';
import ModelSelectionControl from './ModelSelectionControl';
import DataAugmentationOptions from './DataAugmentationOptions';
import DatasetTrainingProgress from '../training/DatasetTrainingProgress'; // Import the progress component
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Typography,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Slider,
  TextField,
  FormControl,
  InputLabel,
  FormGroup,
  ListItemIcon,
  ListItemText,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemButton,
  useTheme
} from '../mui';

// Import Material UI icons from centralized file
import {
  AnalyticsIcon,
  CategoryIcon,
  ImageIcon,
  SettingsIcon,
  PlayArrowIcon
} from '../mui-icons';

// Dataset details component props interface
interface DatasetDetailsProps {
  dataset: {
    id: string;
    name: string;
    description?: string;
    source?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    classCount: number;
    imageCount: number;
    // Enhanced dataset statistics
    statistics?: {
      totalImages: number;
      totalClasses: number;
      averageImagesPerClass: number;
      datasetSizeFormatted: string;
      classDistribution: Array<{
        name: string;
        count: number;
      }>;
      imageQualityMetrics?: {
        averageResolution: string;
        formatDistribution: Array<{
          format: string;
          percentage: number;
        }>;
      };
    };
  };
}

// Define TrainingConfiguration type (matching backend)
interface TrainingConfiguration {
  modelArchitecture: string; // From ModelConfig
  pretrainedWeights: string; // From ModelConfig (mapped)
  splitRatios: { train: number; validation: number; test: number };
  stratified: boolean;
  hyperparameters: { // From ModelConfig
    batchSize: number;
    learningRate: number;
    epochs: number;
  };
  augmentation: { // From AugmentationOptions.techniques
    rotation: boolean;
    horizontalFlip: boolean;
    brightnessContrast: boolean; 
    crop: boolean; 
    // Add other augmentation fields if needed
  };
}

// Define ModelConfig type (matching ModelSelectionControl)
interface ModelConfig {
  architecture: string;
  variant: string;
  pretrained: boolean;
  hyperparameters: {
    batchSize: number;
    learningRate: number;
    epochs: number;
  };
}

// Define AugmentationOptions type (matching DataAugmentationOptions)
interface AugmentationOptions {
  enabled: boolean;
  techniques: {
    rotation: boolean;
    horizontalFlip: boolean;
    verticalFlip: boolean;
    randomCrop: boolean;
    colorJitter: boolean;
    randomErasing: boolean;
    randomNoise: boolean;
  };
  intensities: {
    rotationDegrees: number;
    cropScale: number;
    brightnessVariation: number;
    erasePercent: number;
  };
}


// Format date to local string
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Render status chip with appropriate color
const renderStatusChip = (status: string) => {
  let color:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning';
  let label: string;

  switch (status) {
    case 'ready':
      color = 'success';
      label = 'Ready';
      break;
    case 'processing':
      color = 'info';
      label = 'Processing';
      break;
    case 'error':
      color = 'error';
      label = 'Error';
      break;
    default:
      color = 'default';
      label = status;
  }

  return <Chip size="small" color={color} label={label} />;
};

// Sample mock data for classes and images
const mockClasses = [
  { id: 'class-1', name: 'Marble', imageCount: 45 },
  { id: 'class-2', name: 'Granite', imageCount: 32 },
  { id: 'class-3', name: 'Ceramic', imageCount: 50 }
];

const mockImages = [
  { id: 'img-1', url: 'https://via.placeholder.com/150x150?text=Marble+1', classId: 'class-1' },
  { id: 'img-2', url: 'https://via.placeholder.com/150x150?text=Marble+2', classId: 'class-1' },
  { id: 'img-3', url: 'https://via.placeholder.com/150x150?text=Granite+1', classId: 'class-2' }
];

// Dataset Details component
const DatasetDetails: React.FC<DatasetDetailsProps> = ({ dataset }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [classes, setClasses] = useState(mockClasses);
  const [images, setImages] = useState(mockImages);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // State for training configuration and progress
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfiguration>({
    modelArchitecture: 'efficientnet',
    pretrainedWeights: 'imagenet',
    splitRatios: { train: 70, validation: 20, test: 10 },
    stratified: true,
    hyperparameters: { batchSize: 32, learningRate: 0.001, epochs: 30 },
    augmentation: { rotation: true, horizontalFlip: true, brightnessContrast: true, crop: false }
  });
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [isStartingTraining, setIsStartingTraining] = useState(false); // Loading state for start button

  // State for tracking save configuration status
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);
  const [saveConfigError, setSaveConfigError] = useState<string | null>(null);
  const [saveConfigSuccess, setSaveConfigSuccess] = useState(false);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Load classes for dataset
  useEffect(() => {
    // This would be replaced with actual API call
    // In a real implementation, we would fetch classes from the backend
    setClasses(mockClasses);
    if (mockClasses.length > 0) {
      setSelectedClass(mockClasses[0].id);
    }
  }, [dataset.id]);

  // Load images for selected class
  useEffect(() => {
    if (!selectedClass) return;

    setLoading(true);
    // This would be replaced with actual API call
    // For demonstration, we'll use mock data and a timeout to simulate loading
    const timer = setTimeout(() => {
      setImages(mockImages.filter(img => img.classId === selectedClass));
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedClass]);

  // Select a class to view images
  const handleSelectClass = (classId: string) => {
    setSelectedClass(classId);
  };
  
  // Handler for top-level TrainingConfiguration changes
  const handleTrainingConfigChange = (field: keyof TrainingConfiguration, value: any) => {
    setTrainingConfig(prev => ({ ...prev, [field]: value }));
  };
  
  // Handler for ModelSelectionControl changes
  const handleModelSelectionChange = (newModelConfig: ModelConfig) => {
    setTrainingConfig(prev => ({
      ...prev,
      modelArchitecture: newModelConfig.architecture,
      pretrainedWeights: newModelConfig.pretrained ? 'imagenet' : 'none', // Map boolean to string
      hyperparameters: newModelConfig.hyperparameters,
    }));
  };

  // Handler for DataAugmentationOptions changes
  const handleAugmentationChange = (newAugmentationOptions: AugmentationOptions) => {
    // Update only the augmentation part of the main config
    setTrainingConfig(prev => ({
      ...prev,
      augmentation: { 
          rotation: newAugmentationOptions.techniques.rotation,
          horizontalFlip: newAugmentationOptions.techniques.horizontalFlip,
          brightnessContrast: newAugmentationOptions.techniques.colorJitter, 
          crop: newAugmentationOptions.techniques.randomCrop, 
          // Add other mappings if needed
      }
    }));
  };

  // Start a new training job using the real API endpoint
  const handleStartTraining = async () => {
    setIsStartingTraining(true);
    setTrainingError(null);
    setCurrentJobId(null); // Clear previous job ID if any

    // Prepare configuration - create a new object with the correct structure
    // instead of using delete which is causing a TypeScript error
    const { stratified, ...restConfig } = trainingConfig;
    const apiConfig = {
      ...restConfig,
      stratifiedSplit: stratified
    };
    
    console.log('Starting training with config:', apiConfig);

    try {
      // Get the base API URL from environment or defaults
      const API_URL = process.env.REACT_APP_API_URL || window.location.origin;
      
      // Make the actual API call to start training
      const response = await fetch(`${API_URL}/api/admin/datasets/${dataset.id}/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization headers if required
          ...(localStorage.getItem('auth_token') 
            ? { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } 
            : {})
        },
        body: JSON.stringify({ config: apiConfig })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (data && data.jobId) {
        console.log('Training job started with ID:', data.jobId);
        setCurrentJobId(data.jobId);
      } else {
        throw new Error('No job ID returned from server');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to start training:', errorMessage);
      setTrainingError(`Failed to start training job: ${errorMessage}`);
    } finally {
      setIsStartingTraining(false);
    }
  };
  
  // Stop a training job using the real API endpoint
  const handleStopTraining = async () => {
    if (!currentJobId) return;
    
    console.log('Stopping training job:', currentJobId);
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || window.location.origin;
      
      // Make API call to stop the training job
      const response = await fetch(`${API_URL}/api/admin/training/${currentJobId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization headers if required
          ...(localStorage.getItem('auth_token') 
            ? { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } 
            : {})
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }
      
      // Clear the job ID to show the config form again
      setCurrentJobId(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to stop training job:', errorMessage);
      alert(`Failed to stop training job: ${errorMessage}`);
    }
  };


  // Render tab content
  const getTabContent = () => {
    switch (activeTab) {
      case 0: // Overview
        return (
          <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Dataset Details
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Name:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">{dataset.name}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Status:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      {renderStatusChip(dataset.status)}
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Description:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {dataset.description || 'No description provided'}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Source / Company:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {dataset.source || 'Not specified'}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Created:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {formatDate(dataset.createdAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Last Updated:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {formatDate(dataset.updatedAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Classes:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">{dataset.classCount}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Images:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">{dataset.imageCount}</Typography>
                    </Grid>
                    {dataset.statistics && (
                      <>
                        <Grid item xs={4}>
                          <Typography variant="body2" color="textSecondary">
                            Dataset Size:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">{dataset.statistics.datasetSizeFormatted}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="body2" color="textSecondary">
                            Avg Images/Class:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">{dataset.statistics.averageImagesPerClass.toFixed(2)}</Typography>
                        </Grid>
                        {dataset.statistics.imageQualityMetrics && (
                          <>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Avg Resolution:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">{dataset.statistics.imageQualityMetrics.averageResolution}</Typography>
                            </Grid>
                          </>
                        )}
                      </>
                    )}
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Class Distribution
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {dataset.statistics?.classDistribution ? (
                    <Box sx={{ height: 250 }}>
                      <BarChart
                        data={dataset.statistics.classDistribution}
                        xKey="name"
                        yKey="count"
                        color="#8884d8"
                      />
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '80%'
                      }}
                    >
                      <AnalyticsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body2" color="textSecondary">
                        No class distribution data available
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Actions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<PlayArrowIcon />}
                      disabled={dataset.status !== 'ready'}
                    >
                      Train Model
                    </Button>
                    <Button variant="outlined" startIcon={<ImageIcon />}>
                      Download Dataset
                    </Button>
                    <Button variant="outlined" startIcon={<SettingsIcon />}>
                      Export Configuration
                    </Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );
      case 1: // Classes & Images
        return (
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ height: '100%' }}>
                  <Typography variant="h6" sx={{ p: 2, pb: 1 }}>
                    Classes
                  </Typography>
                  <Divider />
                  <List sx={{ overflow: 'auto', maxHeight: 500 }}>
                    {classes.map((classItem) => (
                      <ListItemButton
                        key={classItem.id}
                        selected={selectedClass === classItem.id}
                        onClick={() => handleSelectClass(classItem.id)}
                      >
                        <ListItemIcon>
                          <CategoryIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={classItem.name}
                          secondary={`${classItem.imageCount} images`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              </Grid>
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Images{' '}
                    {selectedClass && (
                      <Typography component="span" variant="body2" color="textSecondary">
                        {classes.find(c => c.id === selectedClass)?.name}
                      </Typography>
                    )}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {loading ? (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: 300
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : images.length === 0 ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: 300
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body2" color="textSecondary">
                        No images found for this class
                      </Typography>
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      {images.map((image) => (
                        <Grid item key={image.id} xs={6} sm={4} md={3}>
                          <Card>
                            <Box
                              component="img"
                              src={image.url}
                              alt="Dataset image"
                              sx={{
                                width: '100%',
                                height: 150,
                                objectFit: 'cover'
                              }}
                            />
                            <CardContent sx={{ py: 1 }}>
                              <Typography variant="body2" noWrap>
                                {image.id}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );
      case 2: // Training Configuration
        return (
          <Box sx={{ p: 2 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Training Configuration
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {/* Display error if training failed to start */}
              {trainingError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <AlertTitle>Error Starting Training</AlertTitle>
                  {trainingError}
                </Alert>
              )}

              {/* Conditionally render Training Progress or Configuration Form */}
              {currentJobId ? (
                <Box>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Training In Progress (Job ID: {currentJobId}) 
                  </Typography>
                  {/* Pass datasetId instead of jobId */}
                  <DatasetTrainingProgress datasetId={dataset.id} /> 
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleStopTraining}
                    >
                      Stop Training
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  {/* Model Selection */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Model Selection
                    </Typography>
                    {/* Pass the correct handler and initial config */}
                    <ModelSelectionControl
                      initialConfig={{ // Pass relevant parts of trainingConfig
                        architecture: trainingConfig.modelArchitecture,
                        variant: 'B0', // Need state for variant if configurable
                        pretrained: trainingConfig.pretrainedWeights === 'imagenet',
                        hyperparameters: trainingConfig.hyperparameters
                      }}
                      onChange={handleModelSelectionChange} 
                      // Remove onNestedChange as ModelSelectionControl handles its own state
                    />
                  </Box>
                  
                  {/* Dataset Splitting */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Dataset Splitting
                    </Typography>
                    <SplitRatioControl
                      initialRatio={trainingConfig.splitRatios}
                      onChange={(newSplit) => handleTrainingConfigChange('splitRatios', newSplit)}
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Checkbox 
                              checked={trainingConfig.stratified} 
                              // Add explicit type for event
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTrainingConfigChange('stratified', e.target.checked)} 
                            />
                          }
                          label="Stratified split (maintain class distribution)"
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Hyperparameters are now part of ModelSelectionControl */}
                  
                  {/* Data Augmentation */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      Data Augmentation
                    </Typography>
                    {/* Pass the correct handler and initial options structure */}
                    <DataAugmentationOptions
                      initialOptions={{ // Pass relevant parts of trainingConfig
                        enabled: true, // Assuming always enabled if shown, or add state
                        techniques: {
                          rotation: trainingConfig.augmentation.rotation,
                          horizontalFlip: trainingConfig.augmentation.horizontalFlip,
                          verticalFlip: false, // Add state if needed
                          randomCrop: trainingConfig.augmentation.crop,
                          colorJitter: trainingConfig.augmentation.brightnessContrast,
                          randomErasing: false, // Add state if needed
                          randomNoise: false // Add state if needed
                        },
                        intensities: { // Add state for intensities if needed
                          rotationDegrees: 30,
                          cropScale: 80,
                          brightnessVariation: 25,
                          erasePercent: 5
                        }
                      }}
                      onChange={handleAugmentationChange} 
                    />
                  </Box>
                  
                  {/* Action Buttons */}
                  <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    {/* Display success message if config was saved */}
                    {saveConfigSuccess && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        Configuration saved successfully!
                      </Alert>
                    )}
                    
                    {/* Display error if saving failed */}
                    {saveConfigError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {saveConfigError}
                      </Alert>
                    )}

                    <Button
                      variant="outlined"
                      color="primary"
                      sx={{ mr: 2 }}
                      onClick={handleSaveConfiguration}
                      disabled={isSavingConfiguration}
                      startIcon={isSavingConfiguration ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      {isSavingConfiguration ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={isStartingTraining ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                      disabled={dataset.status !== 'ready' || isStartingTraining}
                      onClick={handleStartTraining}
                    >
                      {isStartingTraining ? 'Starting...' : 'Start Training'}
                    </Button>
                  </Box>
                </>
              )}
            </Paper>
          </Box>
        );
      default:
        return null;
    }
  };
  
  // Save training configuration without starting training
  const handleSaveConfiguration = async () => {
    // Reset status states
    setIsSavingConfiguration(true);
    setSaveConfigError(null);
    setSaveConfigSuccess(false);
    
    // Prepare configuration object
    const { stratified, ...restConfig } = trainingConfig;
    const apiConfig = {
      ...restConfig,
      stratifiedSplit: stratified
    };
    
    console.log('Saving training configuration:', apiConfig);
    
    try {
      // Get the base API URL from environment or defaults
      const API_URL = process.env.REACT_APP_API_URL || window.location.origin;
      
      // Make API call to save the configuration
      const response = await fetch(`${API_URL}/api/admin/datasets/${dataset.id}/configuration`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization headers if required
          ...(localStorage.getItem('auth_token') 
            ? { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } 
            : {})
        },
        body: JSON.stringify({ config: apiConfig })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }
      
      // Show success message
      setSaveConfigSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveConfigSuccess(false);
      }, 3000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to save configuration:', errorMessage);
      setSaveConfigError(`Failed to save configuration: ${errorMessage}`);
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  return (
    <Box>
      <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
        <Tab label="Overview" />
        <Tab label="Classes & Images" />
        <Tab label="Training Configuration" />
      </Tabs>
      <Divider />
      {getTabContent()}
    </Box>
  );
};

export default DatasetDetails;