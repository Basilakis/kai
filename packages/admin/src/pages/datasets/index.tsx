/**
 * Dataset Management Page
 *
 * Admin interface for uploading, viewing, and managing datasets
 */

/// <reference path="../../types/mui-icon-modules.d.ts" />

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Card,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  IconButton,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MenuItem,
  Paper,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Select,
  Tab,
  Tabs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TextField,
  Typography,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useTheme
} from '../../components/mui';
import {
  Add as AddIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CloudUpload as CloudUploadIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Delete as DeleteIcon,
  Download as DownloadIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Edit as EditIcon,
  Folder as FolderIcon,
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';
import Layout from '../../components/Layout';

// Dataset upload components
import DatasetUploader from '../../components/datasets/DatasetUploader';
import DatasetList from '../../components/datasets/DatasetList';
import DatasetDetails from '../../components/datasets/DatasetDetails';

// API URL base
const API_BASE_URL = '/api/admin/datasets';

// API service for dataset operations
const datasetApi = {
  // Fetch all datasets
  fetchDatasets: async (filter?: string): Promise<{ datasets: any[], total: number }> => {
    try {
      const url = filter 
        ? `${API_BASE_URL}?status=${filter}` 
        : API_BASE_URL;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch datasets: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching datasets:', error);
      throw error;
    }
  },
  
  // Delete a dataset
  deleteDataset: async (datasetId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${datasetId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete dataset: ${response.statusText}`);
    }
  },
  
  // Download CSV template
  getTemplateUrl: (): string => {
    return `${API_BASE_URL}/templates/csv`;
  },
  
  // Get dataset details
  getDatasetDetails: async (datasetId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/${datasetId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset details: ${response.statusText}`);
    }
    
    return await response.json();
  }
};

// Interface for dataset data
interface Dataset {
  id: string;
  name: string;
  description?: string;
  status: 'processing' | 'ready' | 'error';
  classCount: number;
  imageCount: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

// Main component
const DatasetsPage: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [openUploader, setOpenUploader] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Load datasets on component mount or tab change
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        setLoading(true);
        
        // Get filter based on active tab
        const filter = activeTab === 0 ? undefined :
                      activeTab === 1 ? 'ready' :
                      activeTab === 2 ? 'processing' : 
                      'error';
                      
        const result = await datasetApi.fetchDatasets(filter);
        
        // Cast the datasets to match our interface
        setDatasets(result.datasets.map(dataset => ({
          ...dataset,
          // Ensure status is one of the expected values
          status: ['processing', 'ready', 'error'].includes(dataset.status)
            ? dataset.status as 'processing' | 'ready' | 'error'
            : 'processing' // Default to processing if unknown status
        })) as Dataset[]);
        
        setError(null);
      } catch (err) {
        setError('Failed to load datasets. Please try again.');
        console.error('Error loading datasets:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDatasets();
  }, [activeTab]); // Reload when tab changes

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Open dataset uploader dialog
  const handleOpenUploader = () => {
    setOpenUploader(true);
  };

  // Close dataset uploader dialog
  const handleCloseUploader = () => {
    setOpenUploader(false);
  };

  // Handle upload complete
  const handleUploadComplete = (newDataset: Dataset) => {
    setDatasets([...datasets, newDataset]);
    setOpenUploader(false);
  };

  // View dataset details
  const handleViewDataset = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setOpenDetail(true);
  };

  // Close dataset details dialog
  const handleCloseDetail = () => {
    setOpenDetail(false);
  };

  // Open delete confirmation dialog
  const handleOpenDelete = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setOpenDelete(true);
  };

  // Close delete confirmation dialog
  const handleCloseDelete = () => {
    setOpenDelete(false);
  };

  // Delete dataset
  const handleDeleteDataset = async () => {
    if (!selectedDataset) return;

    try {
      setLoading(true);
      // Call API to delete dataset
      await datasetApi.deleteDataset(selectedDataset.id);
      
      // Update local state
      setDatasets(datasets.filter(d => d.id !== selectedDataset.id));
      setOpenDelete(false);
      setLoading(false);
    } catch (err) {
      setError('Failed to delete dataset. Please try again.');
      console.error('Error deleting dataset:', err);
      setLoading(false);
    }
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    try {
      const templateUrl = datasetApi.getTemplateUrl();
      window.open(templateUrl, '_blank');
    } catch (err) {
      setError('Failed to download CSV template. Please try again.');
      console.error('Error downloading template:', err);
    }
  };

  return (
    <Layout>
      <Container maxWidth="xl">
        <Box sx={{ py: 3 }}>
          <Grid container justifyContent="space-between" alignItems="center" spacing={2}>
            <Grid item>
              <Typography variant="h4" component="h1" gutterBottom>
                Dataset Management
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                Upload, manage, and train on image datasets
              </Typography>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ mr: 1 }}
              >
                CSV Template
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleOpenUploader}
              >
                Upload Dataset
              </Button>
            </Grid>
          </Grid>

          <Paper sx={{ mt: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
              <Tab label="All Datasets" icon={<ViewListIcon />} iconPosition="start" />
              <Tab label="Ready" icon={<PlayArrowIcon />} iconPosition="start" />
              <Tab label="Processing" icon={<RefreshIcon />} iconPosition="start" />
              <Tab label="Error" icon={<InfoIcon />} iconPosition="start" />
            </Tabs>
            <Divider />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="error">{error}</Typography>
                <Button
                  variant="outlined"
                  onClick={() => window.location.reload()}
                  sx={{ mt: 2 }}
                >
                  Retry
                </Button>
              </Box>
            ) : datasets.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <FolderIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Datasets Found
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Start by uploading a dataset using ZIP or CSV files
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleOpenUploader}
                >
                  Upload Dataset
                </Button>
              </Box>
            ) : (
              <DatasetList
                datasets={datasets}
                onView={handleViewDataset}
                onDelete={handleOpenDelete}
              />
            )}
          </Paper>
        </Box>

        {/* Dataset Upload Dialog */}
        <Dialog
          open={openUploader}
          onClose={handleCloseUploader}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Upload Dataset</DialogTitle>
          <DialogContent>
            <DatasetUploader onComplete={handleUploadComplete} />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseUploader}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Dataset Detail Dialog */}
        <Dialog
          open={openDetail}
          onClose={handleCloseDetail}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Dataset Details</DialogTitle>
          <DialogContent>
            {selectedDataset && (
              <DatasetDetails dataset={selectedDataset} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDetail}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={openDelete}
          onClose={handleCloseDelete}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the dataset "{selectedDataset?.name}"?
              This action cannot be undone and will remove all associated class and image data.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDelete}>Cancel</Button>
            <Button onClick={handleDeleteDataset} color="error">Delete</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default DatasetsPage;