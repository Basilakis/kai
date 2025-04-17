/**
 * Dataset Uploader Component
 *
 * Handles uploading datasets through ZIP, CSV formats, or importing from premade datasets repositories
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Tab,
  Tabs,
  Typography,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  Card,
  CardContent,
} from '../mui';
import {
  UploadFileIcon,
  CloudUploadIcon,
  DeleteIcon,
  CheckCircleIcon,
  WarningIcon
} from '../mui-icons';

// Interfaces for component props and types
interface DatasetUploaderProps {
  onComplete: (dataset: any) => void;
}

// CSV Column mapping interface
interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  required: boolean;
  valid: boolean;
  errorMessage?: string;
}

// CSV Preview data
interface CsvPreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
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

  // Constants for required fields and standard target fields
  const REQUIRED_FIELDS = ['imagePath', 'className'];
  const TARGET_FIELDS = [
    { value: 'imagePath', label: 'Image Path', description: 'Path to the image file', required: true },
    { value: 'className', label: 'Class Name', description: 'Category or label for the image', required: true },
    { value: 'imageUrl', label: 'Image URL', description: 'URL to fetch the image from (alternative to path)', required: false },
    { value: 'metadata', label: 'Metadata', description: 'Additional data about the image', required: false },
    { value: 'ignore', label: 'Ignore', description: 'Skip this column', required: false }
  ];

  // CSV Preview state
  const [csvPreview, setCsvPreview] = useState<CsvPreviewData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationPassed, setValidationPassed] = useState(false);
  
  // Dataset configuration
  const [datasetConfig, setDatasetConfig] = useState({
    name: '',
    description: '',
    source: '',
    splitRatio: { train: 70, validation: 20, test: 10 }
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
  const handleTabChange = (_event: any, newValue: number) => {
    setActiveTab(newValue);
    setUploadType(newValue === 0 ? 'zip' : newValue === 1 ? 'csv' : 'premade');
    setFile(null);
    setError(null);
    setActiveStep(0);
    setCsvPreview(null);
    setColumnMappings([]);
    setValidationErrors([]);
    setValidationPassed(false);
    setDatasetConfig({
      name: '',
      description: '',
      source: '',
      splitRatio: { train: 70, validation: 20, test: 10 }
    });
  };

  // Common file handling logic
  const handleFileChange = (selectedFile: File) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (uploadType === 'zip' && extension !== 'zip') {
      setError('Please select a ZIP file (.zip extension)');
      return;
    }

    if (uploadType === 'csv' && extension !== 'csv') {
      setError('Please select a CSV file (.csv extension)');
      return;
    }

    setFile(selectedFile);
    setDatasetConfig({
      ...datasetConfig,
      name: selectedFile.name.split('.')[0]
    });
    setName(selectedFile.name.split('.')[0]);
    setError(null);
    
    // For CSV files, parse and preview the content
    if (uploadType === 'csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const csvContent = event.target?.result as string;
          parseAndPreviewCsv(csvContent);
        } catch (err) {
          console.error('CSV parsing error:', err);
          setError('Error parsing CSV file. Please check the format.');
        }
      };
      reader.readAsText(selectedFile);
    }
    
    setActiveStep(1);
  };
  
  // Parse CSV content for preview and mapping
  const parseAndPreviewCsv = (csvContent: string) => {
    // Simple CSV parser - would be replaced with a more robust solution in production
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(header => header.trim());
    
    // Get a preview of first 5 rows
    const previewRows = lines.slice(1, 6).map(line => line.split(',').map(cell => cell.trim()));
    
    setCsvPreview({
      headers,
      rows: previewRows,
      totalRows: lines.length - 1
    });
    
    // Initialize column mappings with best guess based on header names
    const initialMappings = headers.map(header => {
      const normalizedHeader = header.toLowerCase();
      let targetField = 'ignore';
      
      // Try to automatically match columns
      if (normalizedHeader.includes('image') && (normalizedHeader.includes('path') || normalizedHeader.includes('file'))) {
        targetField = 'imagePath';
      } else if (normalizedHeader.includes('image') && normalizedHeader.includes('url')) {
        targetField = 'imageUrl';
      } else if (normalizedHeader.includes('class') || normalizedHeader.includes('category') || normalizedHeader.includes('label')) {
        targetField = 'className';
      } else if (normalizedHeader.includes('meta') || normalizedHeader.includes('data')) {
        targetField = 'metadata';
      }
      
      return {
        sourceColumn: header,
        targetField,
        required: targetField === 'imagePath' || targetField === 'className',
        valid: true
      };
    });
    
    setColumnMappings(initialMappings);
    validateColumnMappings(initialMappings);
  };
  
  // Handle column mapping change
  const handleMappingChange = (index: number, targetField: string) => {
    const newMappings = [...columnMappings];
    newMappings[index] = {
      ...newMappings[index],
      targetField,
      required: targetField === 'imagePath' || targetField === 'className'
    };
    
    setColumnMappings(newMappings);
    validateColumnMappings(newMappings);
  };
  
  // Validate column mappings
  const validateColumnMappings = (mappings: ColumnMapping[]) => {
    const errors: string[] = [];
    
    // Check for required fields
    const hasImagePath = mappings.some(m => m.targetField === 'imagePath');
    const hasClassName = mappings.some(m => m.targetField === 'className');
    
    if (!hasImagePath) {
      errors.push('Missing required mapping: Image Path');
    }
    
    if (!hasClassName) {
      errors.push('Missing required mapping: Class Name');
    }
    
    // Check for duplicate mappings (except 'ignore')
    const nonIgnoreMappings = mappings
      .filter(m => m.targetField !== 'ignore')
      .map(m => m.targetField);
    
    const duplicates = nonIgnoreMappings.filter(
      (field, index) => nonIgnoreMappings.indexOf(field) !== index
    );
    
    if (duplicates.length > 0) {
      // Convert to array first using Array.from to fix TypeScript error
      errors.push(`Duplicate mappings: ${Array.from(new Set(duplicates)).join(', ')}`);
    }
    
    setValidationErrors(errors);
    setValidationPassed(errors.length === 0);
  };

  // Handle configuration changes
  const handleConfigChange = (field: string, value: any) => {
    setDatasetConfig({
      ...datasetConfig,
      [field]: value
    });
  };

  // Handle next step
  const handleNext = () => {
    // Validation for step 0 (file selection)
    if (activeStep === 0 && !file && uploadType !== 'premade') {
      setError('Please select a file');
      return;
    }

    // Validation for step 1 (configuration)
    if (activeStep === 1) {
      if (!datasetConfig.name.trim()) {
        setError('Please enter a name for the dataset');
        return;
      }
      
      // For CSV, validate column mappings
      if (uploadType === 'csv' && !validationPassed) {
        setError('Please fix the column mapping errors before proceeding');
        return;
      }
    }

    // Final step - upload dataset
    if (activeStep === steps.length - 1) {
      handleUpload();
    } else {
      setActiveStep(activeStep + 1);
      setError(null);
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
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
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

        {/* Error display */}
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {/* Main content based on active step */}
        {activeStep === 0 && (
          <Box sx={{ mt: 3 }}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '2px dashed #ccc',
                borderRadius: 2,
                cursor: 'pointer',
                mb: 2
              }}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                type="file"
                id="file-upload-input"
                style={{ display: 'none' }}
                accept={uploadType === 'zip' ? '.zip' : '.csv'}
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Click to select {uploadType.toUpperCase()} file
              </Typography>
              <Typography variant="body2" color="textSecondary">
                or drag and drop file here
              </Typography>
            </Paper>
            
            {file && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                <Chip 
                  icon={<CheckCircleIcon />} 
                  label={file.name} 
                  color="success" 
                  variant="outlined"
                  onDelete={() => setFile(null)}
                  deleteIcon={<DeleteIcon />}
                />
              </Box>
            )}
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Dataset Configuration
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Dataset Name"
                    value={datasetConfig.name}
                    onChange={(e) => handleConfigChange('name', e.target.value)}
                    required
                    error={!datasetConfig.name.trim()}
                    helperText={!datasetConfig.name.trim() ? 'Name is required' : ''}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={3}
                    value={datasetConfig.description}
                    onChange={(e) => handleConfigChange('description', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Source / Company"
                    value={datasetConfig.source}
                    onChange={(e) => handleConfigChange('source', e.target.value)}
                  />
                </Grid>
              </Grid>
              
              {/* CSV Column Mapping */}
              {uploadType === 'csv' && csvPreview && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    CSV Column Mapping
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Map your CSV columns to the required dataset fields. Preview shows first {csvPreview.rows.length} of {csvPreview.totalRows} rows.
                  </Typography>
                  
                  {/* Validation errors */}
                  {validationErrors.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <AlertTitle>Validation Errors</AlertTitle>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {validationErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                  
                  {/* Mapping table */}
                  <TableContainer component={Paper} sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>CSV Column</TableCell>
                          <TableCell>Map To</TableCell>
                          <TableCell>Preview</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {columnMappings.map((mapping, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {mapping.sourceColumn}
                              {mapping.required && (
                                <Chip size="small" label="Required" color="primary" sx={{ ml: 1 }} />
                              )}
                            </TableCell>
                            <TableCell>
                              <FormControl fullWidth size="small" error={!mapping.valid}>
                                <Select
                                  value={mapping.targetField}
                                  onChange={(e) => handleMappingChange(idx, e.target.value)}
                                >
                                  {TARGET_FIELDS.map((field) => (
                                    <MenuItem key={field.value} value={field.value}>
                                      {field.label} {field.required && "*"}
                                    </MenuItem>
                                  ))}
                                </Select>
                                {!mapping.valid && (
                                  <FormHelperText>{mapping.errorMessage}</FormHelperText>
                                )}
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              {csvPreview.rows[0] && csvPreview.rows[0][idx] ? (
                                <span>{csvPreview.rows[0][idx]}</span>
                              ) : (
                                <Typography variant="body2" color="textSecondary">
                                  (empty)
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  {/* Preview data */}
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Data Preview
                    </Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {csvPreview.headers.map((header, idx) => (
                              <TableCell key={idx}>{header}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {csvPreview.rows.map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              {row.map((cell, cellIdx) => (
                                <TableCell key={cellIdx}>{cell}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        )}
        
        {activeStep === 2 && (
          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Upload Summary
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Dataset Name:
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {datasetConfig.name}
                  </Typography>
                </Grid>
                
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    File:
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {file?.name}
                  </Typography>
                </Grid>
                
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Type:
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {uploadType.toUpperCase()} Dataset
                  </Typography>
                </Grid>
                
                {uploadType === 'csv' && (
                  <>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Total Rows:
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {csvPreview?.totalRows || 0}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
              
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" paragraph>
                  Please confirm to start uploading the dataset. This process may take some time depending on the file size.
                </Typography>
                
                {uploading && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <CircularProgress variant="determinate" value={progress} size={60} />
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      {progress < 100 ? 'Uploading and processing...' : 'Processing complete!'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
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