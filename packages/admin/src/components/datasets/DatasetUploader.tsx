/**
 * Dataset Uploader Component
 * 
 * Handles uploading datasets through ZIP, CSV formats, or importing from premade datasets repositories
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Folder as FolderIcon,
  Storage as StorageIcon,
  Search as SearchIcon,
  ImportExport as ImportExportIcon
} from '@mui/icons-material';

// Interfaces for component props
interface DatasetUploaderProps {
  onComplete: (dataset: any) => void;
}

// Interface for dataset repositories
interface DatasetRepository {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  logo?: string;
}

// Interface for premade dataset
interface PremadeDataset {
  id: string;
  name: string;
  description: string;
  repository: string;
  categories: string[];
  size: number; // In MB
  imageCount: number;
  classCount: number;
  format: string;
  license: string;
  citation?: string;
  thumbnailUrl?: string;
}

// Interface for CSV mapping
interface CsvMapping {
  source: string;
  target: string;
  transform?: (value: string) => any;
  defaultValue?: any;
}

// Popular dataset repositories
const DATASET_REPOSITORIES: DatasetRepository[] = [
  {
    id: 'kaggle',
    name: 'Kaggle Datasets',
    description: 'Public datasets from Kaggle, includes a variety of image classification datasets',
    baseUrl: 'https://www.kaggle.com/datasets',
    logo: 'https://www.kaggle.com/static/images/site-logo.png'
  },
  {
    id: 'tensorflow',
    name: 'TensorFlow Datasets',
    description: 'Collection of ready-to-use datasets from TensorFlow',
    baseUrl: 'https://www.tensorflow.org/datasets',
    logo: 'https://www.tensorflow.org/images/tf_logo_social.png'
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Datasets',
    description: 'Public datasets for machine learning from Hugging Face',
    baseUrl: 'https://huggingface.co/datasets',
    logo: 'https://huggingface.co/front/assets/huggingface_logo.svg'
  },
  {
    id: 'imageNet',
    name: 'ImageNet',
    description: 'Standard computer vision dataset with millions of labeled images',
    baseUrl: 'https://image-net.org/',
    logo: 'https://image-net.org/assets/logo.svg'
  }
];

// Sample premade datasets
const PREMADE_DATASETS: PremadeDataset[] = [
  {
    id: 'imagenet-mini',
    name: 'ImageNet Mini',
    description: 'A smaller subset of ImageNet with 1000 classes and 50,000 images',
    repository: 'imageNet',
    categories: ['general', 'classification'],
    size: 6800,
    imageCount: 50000,
    classCount: 1000,
    format: 'zip',
    license: 'ImageNet License',
    thumbnailUrl: 'https://miro.medium.com/max/1400/1*TYAuT3loV7hA_dZMGur2KQ.jpeg'
  },
  {
    id: 'cifar-10',
    name: 'CIFAR-10',
    description: '60,000 32x32 color images in 10 classes, with 6,000 images per class',
    repository: 'tensorflow',
    categories: ['general', 'classification'],
    size: 170,
    imageCount: 60000,
    classCount: 10,
    format: 'binary',
    license: 'MIT',
    thumbnailUrl: 'https://production-media.paperswithcode.com/datasets/CIFAR-10-0000000431-07a032f6_ROQoXCo.jpg'
  },
  {
    id: 'materials-dataset',
    name: 'Materials Recognition Dataset',
    description: 'Dataset for recognizing different materials surfaces, textures, and types',
    repository: 'kaggle',
    categories: ['materials', 'classification', 'textures'],
    size: 2400,
    imageCount: 5000,
    classCount: 25,
    format: 'zip',
    license: 'CC BY-SA 4.0',
    thumbnailUrl: 'https://storage.googleapis.com/kaggle-datasets-images/679/1290/f432bca5ce6eb8a9317e36a5303361ad/dataset-card.jpg'
  },
  {
    id: 'dtd',
    name: 'Describable Textures Dataset',
    description: 'Collection of textural images in the wild organized according to human perception',
    repository: 'huggingface',
    categories: ['textures', 'classification'],
    size: 600,
    imageCount: 5640,
    classCount: 47,
    format: 'zip',
    license: 'MIT',
    thumbnailUrl: 'https://huggingface.co/datasets/dtd/resolve/main/visualizations.png'
  }
];

// Dataset Uploader Component
const DatasetUploader: React.FC<DatasetUploaderProps> = ({ onComplete }) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [uploadType, setUploadType] = useState<'zip' | 'csv' | 'premade'>('zip');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvMapping, setCsvMapping] = useState<CsvMapping[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [hasMappingChanged, setHasMappingChanged] = useState(false);
  
  // Additional state for premade datasets
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<PremadeDataset | null>(null);
  const [filteredDatasets, setFilteredDatasets] = useState<PremadeDataset[]>(PREMADE_DATASETS);
  const [datasetOptions, setDatasetOptions] = useState<{
    includeMetadata: boolean;
    selectedClasses: string[];
  }>({
    includeMetadata: true,
    selectedClasses: []
  });

  // Define upload steps based on upload type
  const getSteps = () => {
    if (uploadType === 'zip') {
      return ['Select File', 'Configure Settings', 'Upload & Process'];
    } else if (uploadType === 'csv') {
      return ['Select File', 'Configure Mapping', 'Upload & Process'];
    } else {
      return ['Select Dataset', 'Configure Options', 'Import & Process'];
    }
  };
  
  const steps = getSteps();

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setUploadType(newValue === 0 ? 'zip' : newValue === 1 ? 'csv' : 'premade');
    setFile(null);
    setSelectedDataset(null);
    setError(null);
    setActiveStep(0);
  };

  // Handle file selection via click
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection via drag & drop
  const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const droppedFile = event.dataTransfer.files[0];
      handleFileChange(droppedFile);
    }
  }, [uploadType]);

  // Common file handling logic
  const handleFileChange = (selectedFile: File) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (uploadType === 'zip' && extension !== 'zip') {
      setError('Please select a ZIP file');
      return;
    }

    if (uploadType === 'csv' && extension !== 'csv') {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setName(selectedFile.name.split('.')[0]);
    setError(null);
    setActiveStep(1);
  };

  // Handle input change for uploaded file
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFileChange(event.target.files[0]);
    }
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0 && !file) {
      setError('Please select a file');
      return;
    }

    if (activeStep === 1 && !name) {
      setError('Please enter a name for the dataset');
      return;
    }

    if (activeStep === steps.length - 1) {
      handleUpload();
    } else {
      setActiveStep(activeStep + 1);
    }
  };

  // Handle back
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  // Load CSV column mapping
  const loadCsvMapping = async () => {
    if (!file || uploadType !== 'csv') return;

    try {
      setHasMappingChanged(false);
      // This would be replaced with actual CSV parsing logic
      // For now, we'll just set some default mappings
      setCsvMapping([
        { source: 'image_path', target: 'image_path' },
        { source: 'class_name', target: 'class_name' },
        { source: 'material_id', target: 'material_id' },
        { source: 'color', target: 'color' },
        { source: 'finish', target: 'finish' }
      ]);
    } catch (err) {
      console.error('Error loading CSV mapping:', err);
      setError('Failed to parse CSV headers');
    }
  };

  // Effect to load CSV mapping when a CSV file is selected
  useEffect(() => {
    if (file && uploadType === 'csv' && activeStep === 1) {
      loadCsvMapping();
    }
  }, [file, uploadType, activeStep]);
  
  // Effect to filter datasets based on search query
  useEffect(() => {
    if (uploadType === 'premade') {
      const filtered = PREMADE_DATASETS.filter(dataset => {
        const matchesQuery = searchQuery === '' || 
          dataset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dataset.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dataset.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()));
          
        const matchesRepo = selectedRepository === '' || dataset.repository === selectedRepository;
        
        return matchesQuery && matchesRepo;
      });
      
      setFilteredDatasets(filtered);
    }
  }, [searchQuery, selectedRepository, uploadType]);
  
  // Handle repository selection
  const handleRepositoryChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedRepository(event.target.value as string);
  };
  
  // Handle dataset selection
  const handleDatasetSelect = (dataset: PremadeDataset) => {
    setSelectedDataset(dataset);
    setName(dataset.name);
    setDescription(dataset.description);
    setActiveStep(1);
  };
  
  // Handle dataset option changes
  const handleOptionChange = (option: string, value: any) => {
    setDatasetOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  // Handle upload/import
  const handleUpload = async () => {
    if ((!file && uploadType !== 'premade') || (uploadType === 'premade' && !selectedDataset)) {
      setError('No file or dataset selected');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate upload progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // This would be replaced with actual API call
      // For demonstration, we'll create a mock result
      await new Promise(resolve => setTimeout(resolve, 5000));
      clearInterval(interval);
      setProgress(100);

      // Create dataset response based on upload type
      let dataset: any;
      
      if (uploadType === 'premade' && selectedDataset) {
        dataset = {
          id: `dataset-${Date.now()}`,
          name,
          description,
          status: 'ready',
          classCount: selectedDataset.classCount,
          imageCount: selectedDataset.imageCount,
          source: selectedDataset.repository,
          sourceId: selectedDataset.id,
          license: selectedDataset.license,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        dataset = {
          id: `dataset-${Date.now()}`,
          name,
          description,
          status: 'ready',
          classCount: 3,
          imageCount: 25,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      };
      // Complete upload
      onComplete(dataset);
    } catch (err) {
      console.error('Error uploading dataset:', err);
      setError('Failed to upload dataset');
      setUploading(false);
    }
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    window.open('/api/admin/datasets/templates/csv', '_blank');
  };

  // Handle CSV mapping changes
  const handleMappingChange = (index: number, field: string, value: string) => {
    const updatedMapping = [...csvMapping];
    updatedMapping[index] = { ...updatedMapping[index], [field]: value };
    setCsvMapping(updatedMapping);
    setHasMappingChanged(true);
  };

  // Render step content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        if (uploadType === 'premade') {
          return (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Select Premade Dataset
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Browse and select from a collection of public datasets ready for use in training models.
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Search Datasets"
                      variant="outlined"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, description, or category"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Repository</InputLabel>
                      <Select
                        value={selectedRepository}
                        onChange={handleRepositoryChange}
                        label="Repository"
                      >
                        <MenuItem value="">All Repositories</MenuItem>
                        {DATASET_REPOSITORIES.map((repo) => (
                          <MenuItem key={repo.id} value={repo.id}>
                            {repo.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
              
              {filteredDatasets.length === 0 ? (
                <Typography variant="body1" align="center" color="textSecondary" sx={{ mt: 4 }}>
                  No datasets found matching your criteria.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {filteredDatasets.map((dataset) => (
                    <Grid item xs={12} sm={6} md={4} key={dataset.id}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          height: '100%', 
                          cursor: 'pointer',
                          border: selectedDataset?.id === dataset.id ? '2px solid' : '1px solid',
                          borderColor: selectedDataset?.id === dataset.id ? 'primary.main' : 'divider',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: 3,
                            borderColor: 'primary.main'
                          }
                        }}
                        onClick={() => handleDatasetSelect(dataset)}
                      >
                        <Box sx={{ height: 140, mb: 2, overflow: 'hidden', borderRadius: 1, bgcolor: 'grey.100' }}>
                          {dataset.thumbnailUrl ? (
                            <Box
                              component="img"
                              src={dataset.thumbnailUrl}
                              alt={dataset.name}
                              sx={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover'
                              }}
                            />
                          ) : (
                            <Box sx={{ 
                              height: '100%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center' 
                            }}>
                              <StorageIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
                            </Box>
                          )}
                        </Box>
                        
                        <Typography variant="h6" gutterBottom noWrap>
                          {dataset.name}
                        </Typography>
                        
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1, height: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dataset.description}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="caption" color="primary">
                            {DATASET_REPOSITORIES.find(r => r.id === dataset.repository)?.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatFileSize(dataset.size)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="textSecondary">
                            {dataset.classCount} classes
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {dataset.imageCount} images
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
              
              {error && (
                <Typography color="error" sx={{ mt: 2 }}>
                  {error}
                </Typography>
              )}
            </Box>
          );
        }
        
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {uploadType === 'zip' ? 'Upload ZIP Dataset' : 'Upload CSV Dataset'}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              {uploadType === 'zip' 
                ? 'Upload a ZIP file containing your dataset. The ZIP should have a folder for each class, with images in each folder.'
                : 'Upload a CSV file with your dataset information. The CSV should contain columns for image paths and class names.'}
            </Typography>

            <Box
              sx={{
                mt: 2,
                mb: 3,
                p: 3,
                border: `2px dashed ${theme.palette.divider}`,
                borderRadius: 1,
                bgcolor: 'background.paper',
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.light, 0.1)
                }
              }}
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={handleFileClick}
            >
              {file ? (
                <Box>
                  <DescriptionIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                  <Typography variant="body1" gutterBottom>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body1" gutterBottom>
                    Drag & drop your {uploadType.toUpperCase()} file here or click to browse
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {uploadType === 'zip' 
                      ? 'Supporting .zip files up to 500MB' 
                      : 'Supporting .csv files up to 10MB'}
                  </Typography>
                </Box>
              )}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept={uploadType === 'zip' ? '.zip' : '.csv'}
                onChange={handleFileInputChange}
              />
            </Box>

            {uploadType === 'csv' && (
              <Box sx={{ textAlign: 'center', mt: 1 }}>
                <Button 
                  size="small" 
                  onClick={handleDownloadTemplate}
                  startIcon={<DescriptionIcon />}
                >
                  Download CSV Template
                </Button>
              </Box>
            )}

            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        );
      case 1:
        if (uploadType === 'premade' && selectedDataset) {
          return (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Configure Dataset Options
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Customize how the dataset should be imported and what data to include.
              </Typography>
              
              <TextField
                fullWidth
                label="Dataset Name"
                variant="outlined"
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Description"
                variant="outlined"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={3}
                sx={{ mb: 3 }}
              />
              
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Import Options
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch 
                      checked={datasetOptions.includeMetadata}
                      onChange={(e) => handleOptionChange('includeMetadata', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Include metadata (annotations, labels, etc.)"
                />
                
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Dataset Details
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        Size
                      </Typography>
                      <Typography variant="body1">
                        {formatFileSize(selectedDataset.size)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        Images
                      </Typography>
                      <Typography variant="body1">
                        {selectedDataset.imageCount}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        Classes
                      </Typography>
                      <Typography variant="body1">
                        {selectedDataset.classCount}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        License
                      </Typography>
                      <Typography variant="body1">
                        {selectedDataset.license}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
              
              {error && (
                <Typography color="error" sx={{ mt: 2 }}>
                  {error}
                </Typography>
              )}
            </Box>
          );
        }
        
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {uploadType === 'csv' ? 'Configure Column Mapping' : 'Dataset Settings'}
            </Typography>

            <TextField
              fullWidth
              label="Dataset Name"
              variant="outlined"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Description"
              variant="outlined"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              sx={{ mb: 3 }}
            />

            {uploadType === 'csv' && (
              <>
                <Typography variant="subtitle1" gutterBottom>
                  Column Mapping
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Map columns from your CSV to the required fields. Drag columns to reorder.
                </Typography>

                <Box sx={{ overflow: 'auto', maxHeight: 300 }}>
                  {csvMapping.map((mapping, index) => (
                    <Paper key={index} sx={{ p: 2, mb: 2, borderLeft: '4px solid', borderColor: 'primary.main' }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={5}>
                          <TextField
                            fullWidth
                            label="Source Column"
                            value={mapping.source}
                            onChange={(e) => handleMappingChange(index, 'source', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={2} sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="textSecondary">
                            maps to
                          </Typography>
                        </Grid>
                        <Grid item xs={5}>
                          <FormControl fullWidth>
                            <InputLabel>Target Field</InputLabel>
                            <Select
                              value={mapping.target}
                              onChange={(e) => handleMappingChange(index, 'target', e.target.value as string)}
                            >
                              <MenuItem value="image_path">Image Path</MenuItem>
                              <MenuItem value="class_name">Class Name</MenuItem>
                              <MenuItem value="material_id">Material ID</MenuItem>
                              <MenuItem value="color">Color</MenuItem>
                              <MenuItem value="finish">Finish</MenuItem>
                              <MenuItem value="size">Size</MenuItem>
                              <MenuItem value="manufacturer">Manufacturer</MenuItem>
                              <MenuItem value="additional_metadata">Additional Metadata</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Box>
              </>
            )}

            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        );
      case 2:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {uploadType === 'premade' ? 'Import & Process' : 'Upload & Process'}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Uploading and processing your dataset. This may take a few minutes depending on the size.
            </Typography>

            <Box sx={{ mt: 3, mb: 3 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
                {progress}% Complete
              </Typography>
            </Box>

            {progress === 100 ? (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary" gutterBottom>
                  Dataset Uploaded Successfully!
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Your dataset is now ready to use.
                </Typography>
              </Box>
            ) : uploading && (
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography variant="body2" color="textSecondary" component="span">
                  {uploadType === 'premade' 
                    ? (progress < 50 ? 'Downloading...' : 'Processing...') 
                    : (progress < 50 ? 'Uploading...' : 'Processing...')}
                </Typography>
              </Box>
            )}

            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Tabs 
        value={activeTab} 
        onChange={handleTabChange} 
        indicatorColor="primary" 
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="ZIP Dataset" icon={<FolderIcon />} iconPosition="start" />
        <Tab label="CSV Dataset" icon={<DescriptionIcon />} iconPosition="start" />
        <Tab label="Premade Datasets" icon={<ImportExportIcon />} iconPosition="start" />
      </Tabs>
      <Divider />

      <Box sx={{ mt: 2, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {getSteps().map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {getStepContent(activeStep)}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
        <Button
          disabled={activeStep === 0 || uploading}
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleNext}
          disabled={uploading || (progress === 100)}
        >
          {activeStep === steps.length - 1 ? (uploadType === 'premade' ? 'Import' : 'Upload') : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

// Function to reduce color opacity for hover effects
function alpha(color: string, opacity: number): string {
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0');
}

export default DatasetUploader;