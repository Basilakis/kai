/**
 * Dataset Details Component
 * 
 * Displays detailed information about a dataset, including classes and sample images
 */

import React, { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Typography,
  useTheme
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Category as CategoryIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';

// Interface for component props
interface DatasetDetailsProps {
  dataset: {
    id: string;
    name: string;
    description?: string;
    status: 'processing' | 'ready' | 'error';
    classCount: number;
    imageCount: number;
    source?: string;
    createdAt: string;
    updatedAt: string;
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
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    Class Distribution
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
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
                      Class distribution visualization would appear here
                    </Typography>
                  </Box>
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
              <Typography variant="body1" paragraph>
                Configure training parameters for this dataset. These settings will be used when you
                initiate model training.
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Training configuration UI would be implemented here, including:
              </Typography>
              <ul>
                <li>
                  <Typography variant="body2" color="textSecondary">
                    Model selection (architecture)
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="textSecondary">
                    Dataset splitting options (train/validation/test)
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="textSecondary">
                    Hyperparameter settings
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="textSecondary">
                    Data augmentation options
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="textSecondary">
                    Transfer learning settings
                  </Typography>
                </li>
              </ul>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  disabled={dataset.status !== 'ready'}
                >
                  Start Training
                </Button>
              </Box>
            </Paper>
          </Box>
        );
      default:
        return null;
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