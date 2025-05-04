import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';

/**
 * Visual Reference Crawler Component
 * 
 * This component allows admins to crawl websites for visual references.
 */
const VisualReferenceCrawler: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [crawlConfig, setCrawlConfig] = useState({
    startUrls: [''],
    maxPages: 100,
    maxDepth: 3,
    includePatterns: [''],
    excludePatterns: [],
    imageSelectors: ['.product-image img', '.gallery img', 'img.product']
  });
  const [crawlOptions, setCrawlOptions] = useState({
    propertyName: '',
    materialType: 'tile' as MaterialType,
    propertyValues: [''],
    autoClassify: true,
    maxImages: 100
  });
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Load providers and jobs
  useEffect(() => {
    loadProviders();
    loadJobs();
  }, []);

  // Load crawler providers
  const loadProviders = async () => {
    try {
      const response = await api.get('/api/ai/visual-reference/crawler/providers');
      setProviders(response.data.providers || []);
      
      if (response.data.providers?.length > 0) {
        setSelectedProvider(response.data.providers[0].id);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  // Load crawler jobs
  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ai/visual-reference/crawler/jobs');
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    
    if (newValue === 1) {
      loadJobs();
    }
  };

  // Handle provider change
  const handleProviderChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedProvider(event.target.value as string);
    setCredentials({});
  };

  // Handle credential change
  const handleCredentialChange = (name: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle crawl config change
  const handleCrawlConfigChange = (name: string, value: any) => {
    setCrawlConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle crawl option change
  const handleCrawlOptionChange = (name: string, value: any) => {
    setCrawlOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle start URL change
  const handleStartUrlChange = (index: number, value: string) => {
    const newStartUrls = [...crawlConfig.startUrls];
    newStartUrls[index] = value;
    setCrawlConfig(prev => ({
      ...prev,
      startUrls: newStartUrls
    }));
  };

  // Handle add start URL
  const handleAddStartUrl = () => {
    setCrawlConfig(prev => ({
      ...prev,
      startUrls: [...prev.startUrls, '']
    }));
  };

  // Handle property value change
  const handlePropertyValueChange = (index: number, value: string) => {
    const newPropertyValues = [...crawlOptions.propertyValues];
    newPropertyValues[index] = value;
    setCrawlOptions(prev => ({
      ...prev,
      propertyValues: newPropertyValues
    }));
  };

  // Handle add property value
  const handleAddPropertyValue = () => {
    setCrawlOptions(prev => ({
      ...prev,
      propertyValues: [...prev.propertyValues, '']
    }));
  };

  // Handle start crawl
  const handleStartCrawl = async () => {
    setLoading(true);
    try {
      // Validate inputs
      if (!crawlOptions.propertyName) {
        alert('Property name is required');
        setLoading(false);
        return;
      }

      if (crawlConfig.startUrls.some(url => !url)) {
        alert('Start URLs cannot be empty');
        setLoading(false);
        return;
      }

      // Start the crawl job
      const response = await api.post('/api/ai/visual-reference/crawler/jobs', {
        propertyName: crawlOptions.propertyName,
        materialType: crawlOptions.materialType,
        provider: selectedProvider,
        crawlConfig,
        options: {
          propertyValues: crawlOptions.propertyValues.filter(v => v),
          autoClassify: crawlOptions.autoClassify,
          maxImages: crawlOptions.maxImages,
          credentials
        }
      });

      alert(`Crawl job started: ${response.data.jobId}`);
      setActiveTab(1); // Switch to jobs tab
      loadJobs();
    } catch (error) {
      console.error('Error starting crawl:', error);
      alert('Error starting crawl job');
    } finally {
      setLoading(false);
    }
  };

  // Handle view job details
  const handleViewJobDetails = (job: any) => {
    setSelectedJob(job);
    setDialogOpen(true);
  };

  // Handle close dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedJob(null);
  };

  // Get selected provider
  const getSelectedProvider = () => {
    return providers.find(p => p.id === selectedProvider);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Visual Reference Crawler
      </Typography>
      <Typography variant="body1" paragraph>
        Crawl websites to collect visual references for the Visual Reference Library.
      </Typography>

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="New Crawl" icon={<CloudDownloadIcon />} iconPosition="start" />
        <Tab label="Crawl Jobs" icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {activeTab === 0 ? (
        // New Crawl Tab
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Crawler Configuration
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Crawler Provider</InputLabel>
                <Select
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  label="Crawler Provider"
                >
                  {providers.map(provider => (
                    <MenuItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {getSelectedProvider()?.requiresCredentials && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    API Credentials
                  </Typography>
                  {getSelectedProvider()?.credentialFields.map((field: any) => (
                    <TextField
                      key={field.name}
                      label={field.label}
                      type={field.type}
                      value={credentials[field.name] || ''}
                      onChange={(e) => handleCredentialChange(field.name, e.target.value)}
                      required={field.required}
                      fullWidth
                      margin="dense"
                    />
                  ))}
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Start URLs
              </Typography>
              {crawlConfig.startUrls.map((url, index) => (
                <TextField
                  key={index}
                  label={`Start URL ${index + 1}`}
                  value={url}
                  onChange={(e) => handleStartUrlChange(index, e.target.value)}
                  fullWidth
                  margin="dense"
                />
              ))}
              <Button
                size="small"
                onClick={handleAddStartUrl}
                sx={{ mt: 1 }}
              >
                Add URL
              </Button>

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Max Pages"
                    type="number"
                    value={crawlConfig.maxPages}
                    onChange={(e) => handleCrawlConfigChange('maxPages', parseInt(e.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Max Depth"
                    type="number"
                    value={crawlConfig.maxDepth}
                    onChange={(e) => handleCrawlConfigChange('maxDepth', parseInt(e.target.value))}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <SearchIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Visual Reference Options
              </Typography>

              <TextField
                label="Property Name"
                value={crawlOptions.propertyName}
                onChange={(e) => handleCrawlOptionChange('propertyName', e.target.value)}
                fullWidth
                required
                margin="normal"
              />

              <MaterialTypeSelector
                value={crawlOptions.materialType}
                onChange={(value) => handleCrawlOptionChange('materialType', value)}
                label="Material Type"
                sx={{ mt: 2, mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Auto-Classify Images</InputLabel>
                <Select
                  value={crawlOptions.autoClassify ? 'true' : 'false'}
                  onChange={(e) => handleCrawlOptionChange('autoClassify', e.target.value === 'true')}
                  label="Auto-Classify Images"
                >
                  <MenuItem value="true">Yes - Use AI to classify images</MenuItem>
                  <MenuItem value="false">No - Use property values below</MenuItem>
                </Select>
              </FormControl>

              {!crawlOptions.autoClassify && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Property Values
                  </Typography>
                  {crawlOptions.propertyValues.map((value, index) => (
                    <TextField
                      key={index}
                      label={`Property Value ${index + 1}`}
                      value={value}
                      onChange={(e) => handlePropertyValueChange(index, e.target.value)}
                      fullWidth
                      margin="dense"
                    />
                  ))}
                  <Button
                    size="small"
                    onClick={handleAddPropertyValue}
                    sx={{ mt: 1 }}
                  >
                    Add Value
                  </Button>
                </>
              )}

              <TextField
                label="Max Images"
                type="number"
                value={crawlOptions.maxImages}
                onChange={(e) => handleCrawlOptionChange('maxImages', parseInt(e.target.value))}
                fullWidth
                margin="normal"
              />

              <Button
                variant="contained"
                color="primary"
                onClick={handleStartCrawl}
                disabled={loading}
                fullWidth
                sx={{ mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Start Crawl'}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        // Crawl Jobs Tab
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              Crawl Jobs
            </Typography>
            <Button
              size="small"
              onClick={loadJobs}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              Refresh
            </Button>
          </Box>

          {loading ? (
            <CircularProgress />
          ) : jobs.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
              No crawl jobs found. Start a new crawl to see it here.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {jobs.map(job => (
                <Grid item xs={12} key={job.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="h6">
                            {job.propertyName} ({job.materialType})
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <Chip
                              label={job.provider}
                              size="small"
                              sx={{ mr: 1 }}
                            />
                            <Chip
                              label={job.status}
                              size="small"
                              color={
                                job.status === 'completed' ? 'success' :
                                job.status === 'failed' ? 'error' :
                                'warning'
                              }
                              sx={{ mr: 1 }}
                            />
                            {job.imagesAdded && (
                              <Chip
                                label={`${job.imagesAdded} images added`}
                                size="small"
                                color="primary"
                              />
                            )}
                          </Box>
                        </Box>
                        
                        <Button
                          size="small"
                          onClick={() => handleViewJobDetails(job)}
                        >
                          View Details
                        </Button>
                      </Box>
                      
                      {job.status === 'processing' && (
                        <Box sx={{ mt: 2 }}>
                          <LinearProgress />
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
                        Started: {new Date(job.startedAt).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}

      {/* Job Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedJob && (
          <>
            <DialogTitle>
              Crawl Job Details: {selectedJob.propertyName} ({selectedJob.materialType})
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Job Information</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>Status:</strong> {selectedJob.status}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Provider:</strong> {selectedJob.provider}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Started:</strong> {new Date(selectedJob.startedAt).toLocaleString()}
                    </Typography>
                    {selectedJob.completedAt && (
                      <Typography variant="body2">
                        <strong>Completed:</strong> {new Date(selectedJob.completedAt).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Results</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      <strong>Pages Processed:</strong> {selectedJob.pagesProcessed || 0}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Images Processed:</strong> {selectedJob.imagesProcessed || 0}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Images Added:</strong> {selectedJob.imagesAdded || 0}
                    </Typography>
                    {selectedJob.error && (
                      <Typography variant="body2" color="error">
                        <strong>Error:</strong> {selectedJob.error}
                      </Typography>
                    )}
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Crawler Configuration</Typography>
                  <Box sx={{ mt: 1, maxHeight: '200px', overflow: 'auto' }}>
                    <pre>{JSON.stringify(selectedJob.config, null, 2)}</pre>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default VisualReferenceCrawler;
