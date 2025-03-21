/**
 * Dataset Management Page
 * 
 * Admin interface for uploading, viewing, and managing datasets
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
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
  IconButton,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
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

// API service would be implemented to communicate with the backend
const fetchDatasets = async () => {
  // This would be replaced with actual API call
  return {
    datasets: [
      {
        id: 'dataset-1',
        name: 'Marble Samples',
        description: 'Collection of marble material samples',
        status: 'ready',
        classCount: 3,
        imageCount: 127,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'dataset-2',
        name: 'Tile Collection',
        description: 'Various ceramic and porcelain tiles',
        status: 'ready',
        classCount: 5,
        imageCount: 210,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    total: 2
  };
};

// Interface for dataset data
interface Dataset {
  id: string;
  name: string;
  description?: string;
  status: 'processing' | 'ready' | 'error';
  classCount: number;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

// Main component
const DatasetsPage: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [openUploader, setOpenUploader] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Load datasets on component mount
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        setLoading(true);
        const result = await fetchDatasets();
        setDatasets(result.datasets);
        setError(null);
      } catch (err) {
        setError('Failed to load datasets. Please try again.');
        console.error('Error loading datasets:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDatasets();
  }, []);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
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
      // This would be replaced with actual API call
      // await api.deleteDataset(selectedDataset.id);
      setDatasets(datasets.filter(d => d.id !== selectedDataset.id));
      setOpenDelete(false);
    } catch (err) {
      setError('Failed to delete dataset. Please try again.');
      console.error('Error deleting dataset:', err);
    }
  };

  // Download CSV template
  const handleDownloadTemplate = async () => {
    try {
      // This would be replaced with actual API call
      window.open('/api/admin/datasets/templates/csv', '_blank');
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