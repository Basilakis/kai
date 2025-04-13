/**
 * Dataset Uploader Component
 *
 * Handles uploading datasets through ZIP, CSV formats, or importing from premade datasets repositories
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';

// Interfaces for component props
interface DatasetUploaderProps {
  onComplete: (dataset: any) => void;
}

// Dataset Uploader Component
const DatasetUploader = ({ onComplete }: DatasetUploaderProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [uploadType, setUploadType] = useState<'zip' | 'csv' | 'premade'>('zip');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activeStep, setActiveStep] = useState(0);

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
  const handleTabChange = (_event: any, newValue: number) => {
    setActiveTab(newValue);
    setUploadType(newValue === 0 ? 'zip' : newValue === 1 ? 'csv' : 'premade');
    setFile(null);
    setError(null);
    setActiveStep(0);
  };

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

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0 && !file && uploadType !== 'premade') {
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

  // Handle upload/import
  const handleUpload = async () => {
    if ((!file && uploadType !== 'premade')) {
      setError('No file selected');
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

      // Create dataset response
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
        <Tab label="ZIP Dataset" />
        <Tab label="CSV Dataset" />
        <Tab label="Premade Datasets" />
      </Tabs>

      <Box sx={{ mt: 2, mb: 3 }}>
        {/* Stepper would go here */}
      </Box>

      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {uploadType === 'premade' ? 'Select Premade Dataset' :
           uploadType === 'zip' ? 'Upload ZIP Dataset' : 'Upload CSV Dataset'}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {uploadType === 'premade' ? 'Browse and select from a collection of public datasets ready for use in training models.' :
           uploadType === 'zip' ? 'Upload a ZIP file containing your dataset. The ZIP should have a folder for each class, with images in each folder.' :
           'Upload a CSV file with your dataset information. The CSV should contain columns for image paths and class names.'}
        </Typography>

        {/* Main content would go here based on the active step */}
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </Box>

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

export default DatasetUploader;