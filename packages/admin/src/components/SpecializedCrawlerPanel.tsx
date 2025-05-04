import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import { Add, Delete, Edit, PlayArrow } from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';

/**
 * Specialized Crawler Panel Component
 */
const SpecializedCrawlerPanel: React.FC<{
  materialType: MaterialType;
}> = ({ materialType }) => {
  // State
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    propertyName: '',
    crawlerType: 'jina',
    description: '',
    baseConfig: {
      startUrl: '',
      maxPages: 100,
      maxDepth: 3
    },
    extractionRules: {
      imageSelectors: ['.product-image img'],
      dataSelectors: {
        title: 'h1',
        description: '.description'
      }
    }
  });
  const [error, setError] = useState(null);

  // Load configs
  useEffect(() => {
    loadConfigs();
  }, [materialType]);

  // Load crawler configs
  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ai/specialized-crawler/configs', {
        params: { materialType }
      });
      setConfigs(response.data.configs || []);
    } catch (error) {
      console.error('Error loading configs:', error);
      setError('Error loading crawler configurations');
    } finally {
      setLoading(false);
    }
  };

  // Handle form change
  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle create config
  const handleCreateConfig = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/ai/specialized-crawler/configs', {
        ...formData,
        materialType
      });
      setCreateDialogOpen(false);
      loadConfigs();
    } catch (error) {
      console.error('Error creating config:', error);
      setError('Error creating crawler configuration');
    } finally {
      setLoading(false);
    }
  };

  // Handle run crawler
  const handleRunCrawler = async (configId) => {
    setLoading(true);
    try {
      const response = await api.post(`/api/ai/specialized-crawler/configs/${configId}/run`);
      alert(`Crawler job started: ${response.data.jobId}`);
    } catch (error) {
      console.error('Error running crawler:', error);
      setError('Error running crawler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Specialized Crawlers: {materialType}
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Crawler
        </Button>
      </Box>
      
      {loading ? (
        <CircularProgress />
      ) : configs.length === 0 ? (
        <Alert severity="info">
          No specialized crawlers found. Create one to get started.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {configs.map(config => (
            <Grid item xs={12} md={6} key={config.id}>
              <Card sx={{ p: 2 }}>
                <Typography variant="h6">{config.name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Property: {config.propertyName}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={() => handleRunCrawler(config.id)}
                    sx={{ mr: 1 }}
                  >
                    Run
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setSelectedConfig(config)}
                  >
                    Edit
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Create Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Create Specialized Crawler</Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                fullWidth
                margin="normal"
              />
              
              <TextField
                label="Property Name"
                value={formData.propertyName}
                onChange={(e) => handleFormChange('propertyName', e.target.value)}
                fullWidth
                margin="normal"
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Crawler Type</InputLabel>
                <Select
                  value={formData.crawlerType}
                  onChange={(e) => handleFormChange('crawlerType', e.target.value)}
                  label="Crawler Type"
                >
                  <MenuItem value="jina">Jina AI</MenuItem>
                  <MenuItem value="firecrawl">FireCrawl</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                fullWidth
                multiline
                rows={3}
                margin="normal"
              />
              
              <TextField
                label="Start URL"
                value={formData.baseConfig.startUrl}
                onChange={(e) => handleFormChange('baseConfig', {
                  ...formData.baseConfig,
                  startUrl: e.target.value
                })}
                fullWidth
                margin="normal"
              />
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateDialogOpen(false)} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCreateConfig}
              disabled={!formData.name || !formData.propertyName}
            >
              Create
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default SpecializedCrawlerPanel;
