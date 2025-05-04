import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
  CircularProgress,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  Badge,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Image as ImageIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType, MaterialTypeChip } from '../../client/src/components/common/MaterialTypeSelector';
import ModelComparisonPanel from './ModelComparisonPanel';
import ActiveLearningPanel from './ActiveLearningPanel';
import CrossPropertyModelPanel from './CrossPropertyModelPanel';
import SpecializedCrawlerPanel from './SpecializedCrawlerPanel';

/**
 * Visual Property Manager Component
 *
 * This component manages visual property references for the Visual Reference Library.
 * It allows admins to upload, view, and manage visual references for material properties.
 */
const VisualPropertyManager: React.FC = () => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [selectedMaterialType, setSelectedMaterialType] = useState<MaterialType>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPropertyName, setUploadPropertyName] = useState<string>('');
  const [uploadPropertyValue, setUploadPropertyValue] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [trainingJobs, setTrainingJobs] = useState<Record<string, any>>({});
  const [filterDialogOpen, setFilterDialogOpen] = useState<boolean>(false);
  const [batchTrainingDialogOpen, setbatchTrainingDialogOpen] = useState<boolean>(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [crawlerImportDialogOpen, setCrawlerImportDialogOpen] = useState<boolean>(false);
  const [crawlerJobs, setCrawlerJobs] = useState<any[]>([]);
  const [selectedCrawlerJob, setSelectedCrawlerJob] = useState<string>('');
  const [crawlerImportOptions, setCrawlerImportOptions] = useState({
    propertyName: '',
    materialType: 'tile' as MaterialType,
    autoClassify: true,
    maxImages: 100
  });
  const [optimizationOptions, setOptimizationOptions] = useState<{
    useTransferLearning: boolean;
    useDataAugmentation: boolean;
    batchSize: number;
    epochs: number;
  }>({
    useTransferLearning: true,
    useDataAugmentation: true,
    batchSize: 32,
    epochs: 20
  });
  const [filterOptions, setFilterOptions] = useState<{
    searchTerm: string;
    hasModel: boolean | null;
    minAccuracy: number | null;
    sortBy: 'name' | 'referenceCount' | 'accuracy' | 'lastTrained';
    sortDirection: 'asc' | 'desc';
  }>({
    searchTerm: '',
    hasModel: null,
    minAccuracy: null,
    sortBy: 'name',
    sortDirection: 'asc'
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Load properties
  useEffect(() => {
    loadProperties();
  }, [selectedMaterialType]);

  // Apply filters when properties or filter options change
  useEffect(() => {
    applyFilters();
  }, [properties, filterOptions]);

  // Load properties from API
  const loadProperties = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ai/visual-reference/properties', {
        params: {
          materialType: selectedMaterialType !== 'all' ? selectedMaterialType : undefined
        }
      });

      setProperties(response.data.properties || []);

      // Check training job status for properties with models
      const propertiesWithModels = response.data.properties.filter((p: any) => p.modelPath);

      if (propertiesWithModels.length > 0) {
        const jobsStatus: Record<string, any> = {};

        propertiesWithModels.forEach((property: any) => {
          jobsStatus[`${property.materialType}-${property.name}`] = {
            status: 'completed',
            accuracy: property.modelAccuracy || 0,
            lastTrained: property.lastTrainedAt
          };
        });

        setTrainingJobs(prevJobs => ({ ...prevJobs, ...jobsStatus }));
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      showSnackbar('Error loading properties', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to properties
  const applyFilters = () => {
    let result = [...properties];

    // Apply search filter
    if (filterOptions.searchTerm) {
      const searchTerm = filterOptions.searchTerm.toLowerCase();
      result = result.filter(property =>
        property.name.toLowerCase().includes(searchTerm) ||
        property.displayName?.toLowerCase().includes(searchTerm) ||
        property.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply model filter
    if (filterOptions.hasModel !== null) {
      result = result.filter(property =>
        filterOptions.hasModel ? !!property.modelPath : !property.modelPath
      );
    }

    // Apply accuracy filter
    if (filterOptions.minAccuracy !== null) {
      result = result.filter(property =>
        property.modelAccuracy && property.modelAccuracy >= filterOptions.minAccuracy
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (filterOptions.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'referenceCount':
          comparison = (a.referenceCount || 0) - (b.referenceCount || 0);
          break;
        case 'accuracy':
          comparison = (a.modelAccuracy || 0) - (b.modelAccuracy || 0);
          break;
        case 'lastTrained':
          const aDate = a.lastTrainedAt ? new Date(a.lastTrainedAt).getTime() : 0;
          const bDate = b.lastTrainedAt ? new Date(b.lastTrainedAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
      }

      return filterOptions.sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredProperties(result);
  };

  // Show snackbar
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Handle material type change
  const handleMaterialTypeChange = (value: MaterialType) => {
    setSelectedMaterialType(value);
  };

  // Handle property selection
  const handlePropertySelect = (property: any) => {
    setSelectedProperty(property);
  };

  // Handle upload dialog open
  const handleOpenUploadDialog = () => {
    setUploadDialogOpen(true);
    setUploadFiles([]);
    setUploadPropertyName('');
    setUploadPropertyValue('');
  };

  // Handle upload dialog close
  const handleCloseUploadDialog = () => {
    setUploadDialogOpen(false);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setUploadFiles(Array.from(event.target.files));
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadPropertyName || !uploadPropertyValue || uploadFiles.length === 0) {
      showSnackbar('Please fill all fields and select files', 'warning');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('propertyName', uploadPropertyName);
      formData.append('propertyValue', uploadPropertyValue);
      formData.append('materialType', selectedMaterialType);

      uploadFiles.forEach(file => {
        formData.append('files', file);
      });

      await api.post('/api/ai/visual-reference/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showSnackbar('Files uploaded successfully', 'success');
      handleCloseUploadDialog();
      loadProperties();
    } catch (error) {
      console.error('Error uploading files:', error);
      showSnackbar('Error uploading files', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle train model
  const handleTrainModel = async (propertyName: string, materialType: string) => {
    try {
      // Update training job status
      const jobKey = `${materialType}-${propertyName}`;
      setTrainingJobs(prevJobs => ({
        ...prevJobs,
        [jobKey]: {
          status: 'pending',
          startTime: new Date()
        }
      }));

      // Start training
      const response = await api.post('/api/ai/visual-reference/train', {
        propertyName,
        materialType
      });

      showSnackbar(`Training started for ${propertyName}`, 'success');

      // Update training job with job ID
      if (response.data && response.data.job) {
        setTrainingJobs(prevJobs => ({
          ...prevJobs,
          [jobKey]: {
            ...prevJobs[jobKey],
            jobId: response.data.job.id
          }
        }));

        // Poll for job status
        pollTrainingJobStatus(jobKey, response.data.job.id);
      }
    } catch (error) {
      console.error('Error starting training:', error);
      showSnackbar('Error starting training', 'error');

      // Update training job status
      const jobKey = `${materialType}-${propertyName}`;
      setTrainingJobs(prevJobs => ({
        ...prevJobs,
        [jobKey]: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  };

  // Poll training job status
  const pollTrainingJobStatus = (jobKey: string, jobId: string) => {
    // In a real implementation, this would poll an API endpoint
    // For now, we'll simulate the polling with a timeout

    // Simulate training progress
    const progressInterval = setInterval(() => {
      setTrainingJobs(prevJobs => {
        const job = prevJobs[jobKey];

        if (!job || job.status === 'completed' || job.status === 'failed') {
          clearInterval(progressInterval);
          return prevJobs;
        }

        // Simulate progress
        const progress = job.progress || 0;
        const newProgress = Math.min(progress + 0.1, 0.9);

        return {
          ...prevJobs,
          [jobKey]: {
            ...job,
            progress: newProgress
          }
        };
      });
    }, 3000);

    // Simulate completion after 30 seconds
    setTimeout(() => {
      clearInterval(progressInterval);

      setTrainingJobs(prevJobs => {
        const job = prevJobs[jobKey];

        if (!job || job.status === 'completed' || job.status === 'failed') {
          return prevJobs;
        }

        // Simulate successful completion
        return {
          ...prevJobs,
          [jobKey]: {
            status: 'completed',
            progress: 1.0,
            accuracy: 0.85 + Math.random() * 0.1,
            lastTrained: new Date()
          }
        };
      });

      // Reload properties to get updated model info
      loadProperties();

    }, 30000);
  };

  // Handle filter dialog open
  const handleOpenFilterDialog = () => {
    setFilterDialogOpen(true);
  };

  // Handle filter dialog close
  const handleCloseFilterDialog = () => {
    setFilterDialogOpen(false);
  };

  // Handle filter change
  const handleFilterChange = (name: string, value: any) => {
    setFilterOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setFilterOptions({
      searchTerm: '',
      hasModel: null,
      minAccuracy: null,
      sortBy: 'name',
      sortDirection: 'asc'
    });
  };

  // Handle property selection for batch training
  const handlePropertySelection = (propertyId: string) => {
    setSelectedProperties(prev => {
      if (prev.includes(propertyId)) {
        return prev.filter(id => id !== propertyId);
      } else {
        return [...prev, propertyId];
      }
    });
  };

  // Handle select all properties
  const handleSelectAllProperties = () => {
    if (selectedProperties.length === filteredProperties.length) {
      // If all are selected, deselect all
      setSelectedProperties([]);
    } else {
      // Otherwise, select all
      setSelectedProperties(filteredProperties.map(property => property.id));
    }
  };

  // Handle batch training dialog open
  const handleOpenBatchTrainingDialog = () => {
    if (selectedProperties.length === 0) {
      showSnackbar('Please select at least one property to train', 'warning');
      return;
    }
    setbatchTrainingDialogOpen(true);
  };

  // Handle batch training dialog close
  const handleCloseBatchTrainingDialog = () => {
    setbatchTrainingDialogOpen(false);
  };

  // Handle optimization option change
  const handleOptimizationOptionChange = (name: string, value: any) => {
    setOptimizationOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle batch training start
  const handleBatchTrainingStart = async () => {
    try {
      const selectedPropertiesToTrain = filteredProperties.filter(
        property => selectedProperties.includes(property.id)
      );

      // Start training for each selected property
      for (const property of selectedPropertiesToTrain) {
        const jobKey = `${property.materialType}-${property.name}`;

        // Update training job status
        setTrainingJobs(prevJobs => ({
          ...prevJobs,
          [jobKey]: {
            status: 'pending',
            startTime: new Date(),
            property: property.name,
            materialType: property.materialType
          }
        }));

        // Start training with optimization options
        const response = await api.post('/api/ai/visual-reference/train', {
          propertyName: property.name,
          materialType: property.materialType,
          options: optimizationOptions
        });

        // Update training job with job ID
        if (response.data && response.data.job) {
          setTrainingJobs(prevJobs => ({
            ...prevJobs,
            [jobKey]: {
              ...prevJobs[jobKey],
              jobId: response.data.job.id
            }
          }));

          // Poll for job status
          pollTrainingJobStatus(jobKey, response.data.job.id);
        }
      }

      showSnackbar(`Batch training started for ${selectedPropertiesToTrain.length} properties`, 'success');
      handleCloseBatchTrainingDialog();
      setActiveTab(1); // Switch to Training Jobs tab
      setSelectedProperties([]); // Clear selection
    } catch (error) {
      console.error('Error starting batch training:', error);
      showSnackbar('Error starting batch training', 'error');
    }
  };

  // Handle export dialog open
  const handleOpenExportDialog = () => {
    if (selectedProperties.length === 0) {
      showSnackbar('Please select at least one property to export', 'warning');
      return;
    }
    setExportDialogOpen(true);
  };

  // Handle export dialog close
  const handleCloseExportDialog = () => {
    setExportDialogOpen(false);
  };

  // Handle export format change
  const handleExportFormatChange = (format: 'json' | 'csv') => {
    setExportFormat(format);
  };

  // Handle export
  const handleExport = async () => {
    try {
      const selectedPropertiesToExport = filteredProperties.filter(
        property => selectedProperties.includes(property.id)
      );

      // Get references for each selected property
      const exportData: any = {};

      for (const property of selectedPropertiesToExport) {
        const response = await api.get(`/api/ai/visual-reference/properties/${property.name}/references`, {
          params: {
            materialType: property.materialType
          }
        });

        exportData[`${property.materialType}-${property.name}`] = {
          property: property,
          references: response.data.references || []
        };
      }

      // Create export file
      let exportContent = '';
      let filename = '';

      if (exportFormat === 'json') {
        exportContent = JSON.stringify(exportData, null, 2);
        filename = `visual-references-export-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        // CSV format
        const csvRows = ['material_type,property_name,property_value,image_path,created_at'];

        for (const key in exportData) {
          const { property, references } = exportData[key];

          for (const reference of references) {
            csvRows.push(`${property.materialType},${property.name},${reference.propertyValue},${reference.imagePath},${reference.createdAt}`);
          }
        }

        exportContent = csvRows.join('\n');
        filename = `visual-references-export-${new Date().toISOString().slice(0, 10)}.csv`;
      }

      // Create download link
      const blob = new Blob([exportContent], { type: exportFormat === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSnackbar(`Exported ${selectedPropertiesToExport.length} properties`, 'success');
      handleCloseExportDialog();
      setSelectedProperties([]); // Clear selection
    } catch (error) {
      console.error('Error exporting properties:', error);
      showSnackbar('Error exporting properties', 'error');
    }
  };

  // Handle import dialog open
  const handleOpenImportDialog = () => {
    setImportDialogOpen(true);
  };

  // Handle import dialog close
  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportFile(null);
  };

  // Handle import file selection
  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setImportFile(event.target.files[0]);
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!importFile) {
      showSnackbar('Please select a file to import', 'warning');
      return;
    }

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', importFile);

      // Send import request
      const response = await api.post('/api/ai/visual-reference/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showSnackbar(`Imported ${response.data.importedCount} references`, 'success');
      handleCloseImportDialog();
      loadProperties(); // Reload properties
    } catch (error) {
      console.error('Error importing properties:', error);
      showSnackbar('Error importing properties', 'error');
    }
  };

  // Handle crawler import dialog open
  const handleOpenCrawlerImportDialog = () => {
    setCrawlerImportDialogOpen(true);
    loadCrawlerJobs();
  };

  // Handle crawler import dialog close
  const handleCloseCrawlerImportDialog = () => {
    setCrawlerImportDialogOpen(false);
    setSelectedCrawlerJob('');
  };

  // Load crawler jobs
  const loadCrawlerJobs = async () => {
    try {
      const response = await api.get('/api/crawlers/jobs', {
        params: {
          status: 'completed'
        }
      });

      setCrawlerJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error loading crawler jobs:', error);
      showSnackbar('Error loading crawler jobs', 'error');
    }
  };

  // Handle crawler import option change
  const handleCrawlerImportOptionChange = (name: string, value: any) => {
    setCrawlerImportOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle crawler import
  const handleCrawlerImport = async () => {
    if (!selectedCrawlerJob) {
      showSnackbar('Please select a crawler job', 'warning');
      return;
    }

    if (!crawlerImportOptions.propertyName) {
      showSnackbar('Please enter a property name', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Send import request
      const response = await api.post(`/api/ai/visual-reference/import/crawler/${selectedCrawlerJob}`, {
        propertyName: crawlerImportOptions.propertyName,
        materialType: crawlerImportOptions.materialType,
        autoClassify: crawlerImportOptions.autoClassify,
        maxImages: crawlerImportOptions.maxImages
      });

      showSnackbar(`Imported ${response.data.imagesImported} images`, 'success');
      handleCloseCrawlerImportDialog();
      loadProperties(); // Reload properties
    } catch (error) {
      console.error('Error importing from crawler:', error);
      showSnackbar('Error importing from crawler', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Visual Property Reference Library
      </Typography>
      <Typography variant="body1" paragraph>
        Manage visual references for material properties. These references are used to train models
        that can recognize properties from images.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <MaterialTypeSelector
            value={selectedMaterialType}
            onChange={handleMaterialTypeChange}
            label="Filter by Material Type"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenUploadDialog}
            fullWidth
          >
            Add References
          </Button>
        </Grid>
        <Grid item xs={12} md={2}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={handleOpenFilterDialog}
            fullWidth
          >
            Filters
          </Button>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleOpenBatchTrainingDialog}
              disabled={selectedProperties.length === 0}
              sx={{ flex: 1 }}
            >
              Batch Train ({selectedProperties.length})
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={handleOpenExportDialog}
              disabled={selectedProperties.length === 0}
              sx={{ flex: 1 }}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={handleOpenImportDialog}
              sx={{ flex: 1 }}
            >
              Import File
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={handleOpenCrawlerImportDialog}
              sx={{ flex: 1 }}
            >
              Import from Crawler
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Properties" />
        <Tab label="Training Jobs" />
        <Tab label="Model Comparison" />
        <Tab label="Active Learning" />
        <Tab label="Cross-Property Models" />
        <Tab label="Specialized Crawlers" />
      </Tabs>

      {activeTab === 0 ? (
        // Properties Tab
        loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : filteredProperties.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6">
              No visual property references found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {properties.length === 0 ?
                "Add some visual references to get started" :
                "No properties match the current filters. Try adjusting your filters."}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {filteredProperties.map((property) => {
              const jobKey = `${property.materialType}-${property.name}`;
              const trainingJob = trainingJobs[jobKey];
              const isTraining = trainingJob && trainingJob.status === 'pending';
              const hasModel = !!property.modelPath;

              return (
                <Grid item xs={12} sm={6} md={4} key={property.id}>
                  <Card
                    sx={{
                      position: 'relative',
                      border: selectedProperties.includes(property.id) ? '2px solid' : 'none',
                      borderColor: 'primary.main'
                    }}
                    onClick={() => handlePropertySelection(property.id)}
                  >
                    {isTraining && (
                      <LinearProgress
                        variant="determinate"
                        value={(trainingJob.progress || 0) * 100}
                        sx={{ height: 4 }}
                      />
                    )}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '50%'
                      }}
                    >
                      <Checkbox
                        checked={selectedProperties.includes(property.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handlePropertySelection(property.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Box>
                    <CardMedia
                      component="img"
                      height="140"
                      image={property.previewImage || '/placeholder-image.jpg'}
                      alt={property.name}
                    />
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="h6" gutterBottom>
                          {property.displayName || property.name}
                        </Typography>
                        {hasModel && (
                          <Tooltip title={`Model accuracy: ${(property.modelAccuracy * 100).toFixed(1)}%`}>
                            <Chip
                              icon={<AutoAwesomeIcon />}
                              label={`${(property.modelAccuracy * 100).toFixed(1)}%`}
                              size="small"
                              color="success"
                              sx={{ ml: 1 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <MaterialTypeChip
                          materialType={property.materialType as MaterialType}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={`${property.referenceCount} references`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {property.description || 'No description available'}
                      </Typography>
                    </CardContent>
                    <CardActions onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePropertySelect(property);
                        }}
                        startIcon={<ImageIcon />}
                      >
                        View References
                      </Button>
                      <Button
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrainModel(property.name, property.materialType);
                        }}
                        disabled={isTraining}
                        startIcon={isTraining ? <CircularProgress size={16} /> : <PsychologyIcon />}
                      >
                        {isTraining ? 'Training...' : hasModel ? 'Retrain' : 'Train Model'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )
      ) : (
        // Training Jobs Tab
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Training Jobs
          </Typography>

          {Object.keys(trainingJobs).length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
              No training jobs found. Start training a model to see it here.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {Object.entries(trainingJobs).map(([jobKey, job]) => {
                const [materialType, propertyName] = jobKey.split('-');
                const statusColor =
                  job.status === 'completed' ? 'success' :
                  job.status === 'failed' ? 'error' :
                  'warning';
                const statusIcon =
                  job.status === 'completed' ? <CheckCircleIcon /> :
                  job.status === 'failed' ? <ErrorIcon /> :
                  <CircularProgress size={16} />;

                return (
                  <Grid item xs={12} key={jobKey}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6">
                              {propertyName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <MaterialTypeChip
                                materialType={materialType as MaterialType}
                                size="small"
                                sx={{ mr: 1 }}
                              />
                              <Chip
                                icon={statusIcon}
                                label={job.status}
                                size="small"
                                color={statusColor}
                                sx={{ mr: 1 }}
                              />
                              {job.accuracy && (
                                <Chip
                                  icon={<AutoAwesomeIcon />}
                                  label={`Accuracy: ${(job.accuracy * 100).toFixed(1)}%`}
                                  size="small"
                                  color="success"
                                />
                              )}
                            </Box>
                          </Box>

                          <Box>
                            {job.status === 'pending' && (
                              <CircularProgress
                                variant="determinate"
                                value={(job.progress || 0) * 100}
                                size={40}
                              />
                            )}
                            {job.status === 'completed' && (
                              <Button
                                size="small"
                                startIcon={<RefreshIcon />}
                                onClick={() => handleTrainModel(propertyName, materialType)}
                              >
                                Retrain
                              </Button>
                            )}
                          </Box>
                        </Box>

                        {job.status === 'pending' && (
                          <Box sx={{ mt: 2 }}>
                            <LinearProgress
                              variant="determinate"
                              value={(job.progress || 0) * 100}
                            />
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                              Training in progress... {Math.round((job.progress || 0) * 100)}%
                            </Typography>
                          </Box>
                        )}

                        {job.status === 'failed' && job.error && (
                          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                            Error: {job.error}
                          </Typography>
                        )}

                        {job.lastTrained && (
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
                            Last trained: {new Date(job.lastTrained).toLocaleString()}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Paper>
      ) : activeTab === 2 ? (
        // Model Comparison Tab
        <Box>
          {selectedProperty ? (
            <ModelComparisonPanel
              propertyName={selectedProperty.name}
              materialType={selectedProperty.materialType as MaterialType}
            />
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Select a Property to Compare Models
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Please select a property from the Properties tab to compare its models.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setActiveTab(0)}
                sx={{ mt: 2 }}
              >
                Go to Properties Tab
              </Button>
            </Paper>
          )}
        </Box>
      ) : activeTab === 3 ? (
        // Active Learning Tab
        <Box>
          {selectedProperty ? (
            <ActiveLearningPanel
              propertyName={selectedProperty.name}
              materialType={selectedProperty.materialType as MaterialType}
              modelId={selectedProperty.modelId || ''}
            />
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Select a Property for Active Learning
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Please select a property with a trained model from the Properties tab to start active learning.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setActiveTab(0)}
                sx={{ mt: 2 }}
              >
                Go to Properties Tab
              </Button>
            </Paper>
          )}
        </Box>
      ) : activeTab === 4 ? (
        // Cross-Property Models Tab
        <Box>
          <CrossPropertyModelPanel
            materialType={selectedMaterialType}
          />
        </Box>
      ) : activeTab === 5 ? (
        // Specialized Crawlers Tab
        <Box>
          <SpecializedCrawlerPanel
            materialType={selectedMaterialType}
          />
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={handleCloseUploadDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Visual References</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Property Name"
              value={uploadPropertyName}
              onChange={(e) => setUploadPropertyName(e.target.value)}
              required
              helperText="Name of the property (e.g., 'color', 'texture')"
            />
            <TextField
              fullWidth
              label="Property Value"
              value={uploadPropertyValue}
              onChange={(e) => setUploadPropertyValue(e.target.value)}
              required
              helperText="Value of the property (e.g., 'red', 'glossy')"
            />
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
              >
                Select Images
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </Button>
              {uploadFiles.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {uploadFiles.length} files selected
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUploadDialog}>Cancel</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={handleCloseFilterDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Advanced Filters</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Search"
              value={filterOptions.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder="Search by name or description"
            />

            <FormControl fullWidth>
              <InputLabel>Has Model</InputLabel>
              <Select
                value={filterOptions.hasModel === null ? '' : filterOptions.hasModel.toString()}
                label="Has Model"
                onChange={(e) => handleFilterChange('hasModel', e.target.value === '' ? null : e.target.value === 'true')}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="true">Yes</MenuItem>
                <MenuItem value="false">No</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Minimum Accuracy</InputLabel>
              <Select
                value={filterOptions.minAccuracy === null ? '' : filterOptions.minAccuracy.toString()}
                label="Minimum Accuracy"
                onChange={(e) => handleFilterChange('minAccuracy', e.target.value === '' ? null : parseFloat(e.target.value as string))}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="0.7">70%</MenuItem>
                <MenuItem value="0.8">80%</MenuItem>
                <MenuItem value="0.9">90%</MenuItem>
                <MenuItem value="0.95">95%</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={filterOptions.sortBy}
                label="Sort By"
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              >
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="referenceCount">Reference Count</MenuItem>
                <MenuItem value="accuracy">Accuracy</MenuItem>
                <MenuItem value="lastTrained">Last Trained</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Sort Direction</InputLabel>
              <Select
                value={filterOptions.sortDirection}
                label="Sort Direction"
                onChange={(e) => handleFilterChange('sortDirection', e.target.value)}
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetFilters}>Reset</Button>
          <Button onClick={handleCloseFilterDialog}>Apply</Button>
        </DialogActions>
      </Dialog>

      {/* Batch Training Dialog */}
      <Dialog
        open={batchTrainingDialogOpen}
        onClose={handleCloseBatchTrainingDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Batch Training</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Properties ({selectedProperties.length})
            </Typography>

            <Box sx={{ mb: 3, maxHeight: '200px', overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Grid container spacing={1}>
                {filteredProperties
                  .filter(property => selectedProperties.includes(property.id))
                  .map(property => (
                    <Grid item xs={6} sm={4} key={property.id}>
                      <Chip
                        label={`${property.name} (${property.materialType})`}
                        onDelete={() => handlePropertySelection(property.id)}
                        sx={{ mb: 1 }}
                      />
                    </Grid>
                  ))
                }
              </Grid>
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              Performance Optimization Options
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Batch Size</InputLabel>
                  <Select
                    value={optimizationOptions.batchSize}
                    label="Batch Size"
                    onChange={(e) => handleOptimizationOptionChange('batchSize', Number(e.target.value))}
                  >
                    <MenuItem value={8}>8 (Low Memory Usage)</MenuItem>
                    <MenuItem value={16}>16</MenuItem>
                    <MenuItem value={32}>32 (Balanced)</MenuItem>
                    <MenuItem value={64}>64</MenuItem>
                    <MenuItem value={128}>128 (High Performance)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Training Epochs</InputLabel>
                  <Select
                    value={optimizationOptions.epochs}
                    label="Training Epochs"
                    onChange={(e) => handleOptimizationOptionChange('epochs', Number(e.target.value))}
                  >
                    <MenuItem value={5}>5 (Fast, Lower Accuracy)</MenuItem>
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20 (Balanced)</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100 (Slow, Higher Accuracy)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset">
                  <Typography variant="subtitle2" gutterBottom>
                    Transfer Learning
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={optimizationOptions.useTransferLearning}
                      onChange={(e) => handleOptimizationOptionChange('useTransferLearning', e.target.checked)}
                    />
                    <Typography variant="body2">
                      Use pre-trained models to improve accuracy and reduce training time
                    </Typography>
                  </Box>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset">
                  <Typography variant="subtitle2" gutterBottom>
                    Data Augmentation
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={optimizationOptions.useDataAugmentation}
                      onChange={(e) => handleOptimizationOptionChange('useDataAugmentation', e.target.checked)}
                    />
                    <Typography variant="body2">
                      Generate additional training data through transformations
                    </Typography>
                  </Box>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Performance Impact
              </Typography>
              <Typography variant="body2">
                With current settings, training {selectedProperties.length} properties will take approximately{' '}
                {Math.round(selectedProperties.length * optimizationOptions.epochs * 1.5 / 60)} minutes.
                {optimizationOptions.useTransferLearning ? ' Transfer learning will improve accuracy by ~15%.' : ''}
                {optimizationOptions.useDataAugmentation ? ' Data augmentation will improve accuracy by ~10%.' : ''}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseBatchTrainingDialog}>Cancel</Button>
          <Button
            onClick={handleBatchTrainingStart}
            variant="contained"
            color="primary"
          >
            Start Batch Training
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={handleCloseExportDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Visual References</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Properties ({selectedProperties.length})
            </Typography>

            <Box sx={{ mb: 3, maxHeight: '200px', overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Grid container spacing={1}>
                {filteredProperties
                  .filter(property => selectedProperties.includes(property.id))
                  .map(property => (
                    <Grid item xs={6} sm={4} key={property.id}>
                      <Chip
                        label={`${property.name} (${property.materialType})`}
                        onDelete={() => handlePropertySelection(property.id)}
                        sx={{ mb: 1 }}
                      />
                    </Grid>
                  ))
                }
              </Grid>
            </Box>

            <Typography variant="subtitle1" gutterBottom>
              Export Format
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Card
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: exportFormat === 'json' ? '2px solid' : '1px solid',
                    borderColor: exportFormat === 'json' ? 'primary.main' : 'divider'
                  }}
                  onClick={() => handleExportFormatChange('json')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Checkbox
                      checked={exportFormat === 'json'}
                      onChange={() => handleExportFormatChange('json')}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Typography variant="subtitle2">JSON Format</Typography>
                  </Box>
                  <Typography variant="body2">
                    Complete data with all metadata. Best for importing into other systems.
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={6}>
                <Card
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: exportFormat === 'csv' ? '2px solid' : '1px solid',
                    borderColor: exportFormat === 'csv' ? 'primary.main' : 'divider'
                  }}
                  onClick={() => handleExportFormatChange('csv')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Checkbox
                      checked={exportFormat === 'csv'}
                      onChange={() => handleExportFormatChange('csv')}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Typography variant="subtitle2">CSV Format</Typography>
                  </Box>
                  <Typography variant="body2">
                    Simple tabular format. Best for viewing in spreadsheet applications.
                  </Typography>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Export Details
              </Typography>
              <Typography variant="body2">
                This will export {selectedProperties.length} properties with all their visual references.
                The export will include property metadata, reference images, and training data.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExportDialog}>Cancel</Button>
          <Button
            onClick={handleExport}
            variant="contained"
            color="primary"
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={handleCloseImportDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import Visual References</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Import visual references from a JSON or CSV file. The file should contain property information and reference data.
            </Typography>

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
                Select Import File
                <input
                  type="file"
                  hidden
                  accept=".json,.csv"
                  onChange={handleImportFileSelect}
                />
              </Button>

              {importFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Selected file: {importFile.name} ({Math.round(importFile.size / 1024)} KB)
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Import Details
              </Typography>
              <Typography variant="body2">
                The system will automatically detect the file format (JSON or CSV) and import the data accordingly.
                Existing properties with the same name and material type will be updated with the imported data.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>Cancel</Button>
          <Button
            onClick={handleImport}
            variant="contained"
            color="primary"
            disabled={!importFile}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Crawler Import Dialog */}
      <Dialog
        open={crawlerImportDialogOpen}
        onClose={handleCloseCrawlerImportDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import from Crawler</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Import visual references from a completed crawler job. The crawler job should have collected images that can be used as visual references.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Select Crawler Job
                </Typography>

                {crawlerJobs.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No completed crawler jobs found. Run a crawler job first.
                  </Typography>
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>Crawler Job</InputLabel>
                    <Select
                      value={selectedCrawlerJob}
                      onChange={(e) => setSelectedCrawlerJob(e.target.value as string)}
                      label="Crawler Job"
                    >
                      <MenuItem value="">Select a job</MenuItem>
                      {crawlerJobs.map((job) => (
                        <MenuItem key={job.id} value={job.id}>
                          {job.config?.name || job.id} ({new Date(job.completedAt).toLocaleDateString()})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {selectedCrawlerJob && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2">
                      Job Details
                    </Typography>
                    {crawlerJobs.filter(job => job.id === selectedCrawlerJob).map(job => (
                      <Box key={job.id}>
                        <Typography variant="body2">
                          <strong>URL:</strong> {job.config?.url}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Pages Processed:</strong> {job.stats?.pagesVisited || 0}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Images Found:</strong> {job.stats?.imagesExtracted || 0}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Import Options
                </Typography>

                <TextField
                  label="Property Name"
                  value={crawlerImportOptions.propertyName}
                  onChange={(e) => handleCrawlerImportOptionChange('propertyName', e.target.value)}
                  fullWidth
                  required
                  margin="normal"
                />

                <MaterialTypeSelector
                  value={crawlerImportOptions.materialType}
                  onChange={(value) => handleCrawlerImportOptionChange('materialType', value)}
                  label="Material Type"
                  sx={{ mt: 2, mb: 2 }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Auto-Classify Images</InputLabel>
                  <Select
                    value={crawlerImportOptions.autoClassify ? 'true' : 'false'}
                    onChange={(e) => handleCrawlerImportOptionChange('autoClassify', e.target.value === 'true')}
                    label="Auto-Classify Images"
                  >
                    <MenuItem value="true">Yes - Use AI to classify images</MenuItem>
                    <MenuItem value="false">No - Use property name as value</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Max Images to Import"
                  type="number"
                  value={crawlerImportOptions.maxImages}
                  onChange={(e) => handleCrawlerImportOptionChange('maxImages', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 1, max: 1000 }
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Import Process
              </Typography>
              <Typography variant="body2">
                The system will download images from the crawler job results and import them as visual references.
                If auto-classification is enabled, the system will analyze each image to determine its properties.
                Otherwise, all images will be assigned the same property value.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCrawlerImportDialog}>Cancel</Button>
          <Button
            onClick={handleCrawlerImport}
            variant="contained"
            color="primary"
            disabled={!selectedCrawlerJob || !crawlerImportOptions.propertyName || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Import from Crawler'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VisualPropertyManager;
