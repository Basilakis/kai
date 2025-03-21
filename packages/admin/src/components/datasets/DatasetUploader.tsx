/**
 * Dataset Uploader Component
 * 
 * Handles uploading datasets through ZIP or CSV formats
 */

import React, { useState, useCallback, useRef } from 'react';
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
  Folder as FolderIcon
} from '@mui/icons-material';

// Interface for component props
interface DatasetUploaderProps {
  onComplete: (dataset: any) => void;
}

// Interface for CSV mapping
interface CsvMapping {
  source: string;
  target: string;
  transform?: (value: string) => any;
  defaultValue?: any;
}

// Dataset Uploader Component
const DatasetUploader: React.FC<DatasetUploaderProps> = ({ onComplete }) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [uploadType, setUploadType] = useState<'zip' | 'csv'>('zip');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvMapping, setCsvMapping] = useState<CsvMapping[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [hasMappingChanged, setHasMappingChanged] = useState(false);

  // Define upload steps
  const steps = [
    'Select File',
    uploadType === 'csv' ? 'Configure Mapping' : 'Configure Settings',
    'Upload & Process'
  ];

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setUploadType(newValue === 0 ? 'zip' : 'csv');
    setFile(null);
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
  React.useEffect(() => {
    if (file && uploadType === 'csv' && activeStep === 1) {
      loadCsvMapping();
    }
  }, [file, uploadType, activeStep]);

  // Handle upload
  const handleUpload = async () => {
    if (!file) return;

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

      // Mock dataset response
      const dataset = {
        id: `dataset-${Date.now()}`,
        name,
        description,
        status: 'ready',
        classCount: 3,
        imageCount: 25,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
              Upload & Process
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
                  {progress < 50 ? 'Uploading...' : 'Processing...'}
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
      <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
        <Tab label="ZIP Dataset" icon={<FolderIcon />} iconPosition="start" />
        <Tab label="CSV Dataset" icon={<DescriptionIcon />} iconPosition="start" />
      </Tabs>
      <Divider />

      <Box sx={{ mt: 2, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
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
          {activeStep === steps.length - 1 ? 'Upload' : 'Next'}
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