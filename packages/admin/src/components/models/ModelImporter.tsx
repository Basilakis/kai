/**
 * Model Importer Component
 *
 * Handles importing pre-trained models from various sources:
 * - Local upload (.pt, .pb, .h5, .onnx files)
 * - HuggingFace Hub
 * - Public model repositories
 * - Custom URLs
 */

/// <reference path="../../types/jsx.d.ts" />
/// <reference path="../../types/global.d.ts" />
/// <reference path="../../types/react-app.d.ts" />
/// <reference path="../../types/jsx-intrinsic.d.ts" />
/// <reference path="../../types/mui-extensions.d.ts" />

// Note: This component has several unused imports that are kept for future use.
// These imports are marked with eslint-disable comments to suppress warnings.

import * as React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FormControlLabel,
  FormHelperText,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Paper,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Radio,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  RadioGroup,
  Select,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
  alpha
} from '../../components/mui';
import type { SelectChangeEvent } from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Code as CodeIcon,
  Description as DescriptionIcon,
  Link as LinkIcon,
  Storage as StorageIcon
} from '@mui/icons-material';

// Type declarations
interface ModelImporterProps {
  onComplete: (model: any) => void;
}

// Interface for model frameworks
interface ModelFramework {
  id: string;
  name: string;
  fileExtensions: string[];
}

// Model frameworks supported by the system
const MODEL_FRAMEWORKS: ModelFramework[] = [
  { id: 'tensorflow', name: 'TensorFlow', fileExtensions: ['.pb', '.h5', '.tflite', '.savedmodel'] },
  { id: 'pytorch', name: 'PyTorch', fileExtensions: ['.pt', '.pth'] },
  { id: 'onnx', name: 'ONNX', fileExtensions: ['.onnx'] },
  { id: 'custom', name: 'Custom Format', fileExtensions: ['.bin', '.model'] }
];

// Model repository options
const MODEL_REPOSITORIES = [
  { id: 'huggingface', name: 'HuggingFace Hub', baseUrl: 'https://huggingface.co/' },
  { id: 'tfhub', name: 'TensorFlow Hub', baseUrl: 'https://tfhub.dev/' },
  { id: 'pytorch_hub', name: 'PyTorch Hub', baseUrl: 'https://pytorch.org/hub/' },
  { id: 'model_zoo', name: 'ONNX Model Zoo', baseUrl: 'https://github.com/onnx/models/' }
];

// Function to convert model size to readable format
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Main component
const ModelImporter: React.FC<ModelImporterProps> = ({ onComplete }) => {
  const theme = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = React.useState(0);
  const [importType, setImportType] = React.useState<'file' | 'repository' | 'url'>('file');
  const [file, setFile] = React.useState<File | null>(null);
  const [repositoryUrl, setRepositoryUrl] = React.useState('');
  const [customUrl, setCustomUrl] = React.useState('');
  const [modelId, setModelId] = React.useState('');
  const [modelName, setModelName] = React.useState('');
  const [modelDescription, setModelDescription] = React.useState('');
  const [framework, setFramework] = React.useState('');
  const [repository, setRepository] = React.useState('huggingface');
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [activeStep, setActiveStep] = React.useState(0);

  // Define steps based on import type
  const getSteps = () => {
    if (importType === 'file') {
      return ['Select File', 'Configure Model', 'Import & Process'];
    } else if (importType === 'repository') {
      return ['Select Repository', 'Configure Model', 'Import & Process'];
    } else {
      return ['Enter URL', 'Configure Model', 'Import & Process'];
    }
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent<Element, Event>, newValue: number) => {
    setActiveTab(newValue);
    setImportType(newValue === 0 ? 'file' : newValue === 1 ? 'repository' : 'url');
    setFile(null);
    setRepositoryUrl('');
    setCustomUrl('');
    setError(null);
    setActiveStep(0);
  };

  // Handle file selection via click
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection via drag & drop
  const handleFileDrop = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const droppedFile = event.dataTransfer.files[0];
      handleFileChange(droppedFile);
    }
  }, []);

  // Common file handling logic
  const handleFileChange = (selectedFile: File) => {
    // Validate file extension
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = MODEL_FRAMEWORKS.flatMap(f => f.fileExtensions);

    if (!validExtensions.includes(fileExtension)) {
      setError(`Unsupported file format. Please select a valid model file: ${validExtensions.join(', ')}`);
      return;
    }

    setFile(selectedFile);

    // Try to determine the framework from file extension
    const detectedFramework = MODEL_FRAMEWORKS.find(f =>
      f.fileExtensions.includes(fileExtension)
    )?.id || '';

    setFramework(detectedFramework);

    // Set default name from filename
    setModelName(selectedFile.name.split('.')[0].replace(/_/g, ' '));

    setError(null);
    setActiveStep(1);
  };

  // Handle input change for uploaded file
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFileChange(event.target.files[0]);
    }
  };

  // Handle repository selection and URL
  const handleRepositoryChange = (e: SelectChangeEvent) => {
    const repoId = e.target.value as string;
    setRepository(repoId);

    // Find selected repository
    const repo = MODEL_REPOSITORIES.find(r => r.id === repoId);
    if (repo) {
      setRepositoryUrl(repo.baseUrl);
    }
  };

  // Handle model ID change
  const handleModelIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setModelId(id);

    // Auto-generate a name if empty
    if (!modelName && id) {
      setModelName(id.split('/').pop()?.replace(/-/g, ' ') || '');
    }
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0) {
      // Validate first step
      if (importType === 'file' && !file) {
        setError('Please select a model file');
        return;
      } else if (importType === 'repository' && !modelId) {
        setError('Please enter a model ID');
        return;
      } else if (importType === 'url' && !customUrl) {
        setError('Please enter a valid URL');
        return;
      } else {
        setError(null);
      }
    } else if (activeStep === 1) {
      // Validate second step
      if (!modelName) {
        setError('Please enter a name for the model');
        return;
      } else if (importType !== 'file' && !framework) {
        setError('Please select the model framework');
        return;
      } else {
        setError(null);
      }
    }

    if (activeStep === getSteps().length - 1) {
      handleImport();
    } else {
      setActiveStep(activeStep + 1);
    }
  };

  // Handle back
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  // API base URL for model operations
  const API_BASE_URL = process.env.API_URL || '/api';

  // Upload file to server with progress tracking
  const uploadFile = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', modelName);
      formData.append('description', modelDescription || 'Imported model');
      formData.append('framework', framework);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/admin/models/upload`, true);

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (err) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred during upload'));
      };

      xhr.send(formData);
    });
  };

  // Import model from repository
  const importFromRepository = async (): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/admin/models/import-repository`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repository,
        modelId,
        name: modelName,
        description: modelDescription,
        framework,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to import model: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Import model from URL
  const importFromUrl = async (): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/admin/models/import-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: customUrl,
        name: modelName,
        description: modelDescription,
        framework,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to import model: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Process a model after it's been uploaded/imported
  const processModel = async (modelId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/admin/models/${modelId}/process`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to process model: ${response.statusText}`);
    }
    
    return response.json();
  };

  // Handle import based on the type
  const handleImport = async () => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      let modelResponse;

      // Handle different import types
      if (importType === 'file' && file) {
        // Upload file and track progress
        modelResponse = await uploadFile(file);
      } else if (importType === 'repository') {
        // Start progress for repository import
        setProgress(10);
        modelResponse = await importFromRepository();
        setProgress(70);
      } else if (importType === 'url') {
        // Start progress for URL import
        setProgress(10);
        modelResponse = await importFromUrl();
        setProgress(70);
      } else {
        throw new Error('Invalid import type or missing data');
      }

      // Process the model (e.g., validation, optimization, etc.)
      setProgress(80);
      const processedModel = await processModel(modelResponse.id);
      setProgress(100);

      // Complete the import
      onComplete(processedModel);
    } catch (err) {
      console.error('Error importing model:', err);
      setError(err instanceof Error ? err.message : 'Failed to import model');
      setUploading(false);
    }
  };

  // Render step content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ p: 3 }}>
            {importType === 'file' && (
              <>
                <Typography variant="h6" gutterBottom>
                  Upload Model File
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Upload a model file from your computer. Supported formats include TensorFlow (.pb, .h5),
                  PyTorch (.pt, .pth), ONNX (.onnx), and other common model formats.
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
                      bgcolor: alpha(theme.palette.primary.light || '#90caf9', 0.1)
                    }
                  }}
                  onDrop={handleFileDrop}
                  onDragOver={(e: React.DragEvent) => e.preventDefault()}
                  onClick={handleFileClick}
                >
                  {file ? (
                    <Box>
                      <DescriptionIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body1" gutterBottom>
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {formatFileSize(file.size)}
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" gutterBottom>
                        Drag & drop your model file here or click to browse
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Supported formats: .pb, .h5, .tflite, .pt, .pth, .onnx
                      </Typography>
                    </Box>
                  )}
                  {/* Using a hidden TextField component instead of a native input element */}
                  <TextField
                    type="file"
                    inputRef={fileInputRef}
                    sx={{ display: 'none' }}
                    inputProps={{
                      accept: ".pb,.h5,.tflite,.pt,.pth,.onnx,.bin,.model"
                    }}
                    onChange={handleFileInputChange}
                  />
                </Box>
              </>
            )}

            {importType === 'repository' && (
              <>
                <Typography variant="h6" gutterBottom>
                  Import from Model Repository
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Import a pre-trained model from a public model repository such as HuggingFace Hub,
                  TensorFlow Hub, or PyTorch Hub.
                </Typography>

                <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
                  <InputLabel>Repository</InputLabel>
                  <Select
                    value={repository}
                    onChange={handleRepositoryChange}
                    label="Repository"
                  >
                    {MODEL_REPOSITORIES.map((repo) => (
                      <MenuItem key={repo.id} value={repo.id}>
                        {repo.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Select the model repository</FormHelperText>
                </FormControl>

                <TextField
                  fullWidth
                  label="Model ID / Path"
                  variant="outlined"
                  value={modelId}
                  onChange={handleModelIdChange}
                  placeholder={repository === 'huggingface' ? 'facebook/bart-large-cnn' : 'Path to model'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {repositoryUrl}
                      </InputAdornment>
                    ),
                  }}
                  helperText="Enter the model ID or path in the repository"
                  sx={{ mb: 3 }}
                />
              </>
            )}

            {importType === 'url' && (
              <>
                <Typography variant="h6" gutterBottom>
                  Import from URL
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Import a pre-trained model from a direct URL. The system will download the model file
                  and import it into the local model repository.
                </Typography>

                <TextField
                  fullWidth
                  label="Model URL"
                  variant="outlined"
                  value={customUrl}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/path/to/model.h5"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Enter the direct URL to the model file"
                  sx={{ mb: 3 }}
                />
              </>
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
              Configure Model Details
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Provide information about the model to make it easier to find and use in the system.
            </Typography>

            <TextField
              fullWidth
              label="Model Name"
              variant="outlined"
              value={modelName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelName(e.target.value)}
              sx={{ mb: 3 }}
              required
            />

            <TextField
              fullWidth
              label="Description"
              variant="outlined"
              value={modelDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelDescription(e.target.value)}
              multiline
              rows={3}
              sx={{ mb: 3 }}
            />

            {(importType !== 'file' || !framework) && (
              <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
                <InputLabel>Framework</InputLabel>
                <Select
                  value={framework}
                  onChange={(e: SelectChangeEvent) => setFramework(e.target.value)}
                  label="Framework"
                  required
                >
                  {MODEL_FRAMEWORKS.map((fw) => (
                    <MenuItem key={fw.id} value={fw.id}>
                      {fw.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Select the framework this model was built with</FormHelperText>
              </FormControl>
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
              Import & Process
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Importing and processing the model. This may take a few minutes depending on the size.
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
                  Model Imported Successfully!
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Your model is now ready to use.
                </Typography>
              </Box>
            ) : uploading && (
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography variant="body2" color="textSecondary" component="span">
                  {progress < 50 ? 'Downloading...' : 'Processing...'}
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
        <Tab label="Upload File" icon={<CloudUploadIcon />} iconPosition="start" />
        <Tab label="From Repository" icon={<StorageIcon />} iconPosition="start" />
        <Tab label="From URL" icon={<LinkIcon />} iconPosition="start" />
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
          {activeStep === getSteps().length - 1 ? 'Import' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

// Custom alpha function as a fallback if the MUI alpha function fails
// This is not used directly but kept as a reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function customAlpha(color: string, opacity: number): string {
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0');
}

export default ModelImporter;