import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
  Chip,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { getAdvancedQueueMetrics } from '../../services/queue.service';

// Time range options
const TIME_RANGES = [
  { value: 'day', label: 'Last 24 Hours' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' }
];

// System options
const SYSTEMS = [
  { value: 'all', label: 'All Systems' },
  { value: 'pdf', label: 'PDF Processing' },
  { value: 'crawler', label: 'Web Crawler' }
];

/**
 * Advanced Statistics Dashboard Component
 * 
 * Provides detailed metrics and visualizations for queue processing and training
 */
const AdvancedStatsDashboard: React.FC = () => {
  // Active tab state
  const [activeTab, setActiveTab] = useState<number>(0);
  
  // Filter states
  const [timeRange, setTimeRange] = useState<string>('week');
  const [system, setSystem] = useState<string>('all');
  
  // Data and loading states
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load metrics data
  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const metricsData = await getAdvancedQueueMetrics();
      setMetrics(metricsData);
    } catch (err) {
      setError(`Failed to load metrics: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchMetrics();
    
    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchMetrics();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Filter metrics based on selected time range and system
  const getFilteredMetrics = () => {
    if (!metrics) return null;
    
    // Apply time range filter
    let filtered = { ...metrics };
    
    // Apply system filter
    if (system !== 'all') {
      filtered = {
        ...filtered,
        processingRate: filtered.processingRate?.[system] || {},
        completionRate: filtered.completionRate?.[system] || {},
        errorRate: filtered.errorRate?.[system] || {},
        averageProcessingTime: filtered.averageProcessingTime?.[system] || {}
      };
    }
    
    return filtered;
  };

  // Get filtered metrics
  const filteredMetrics = getFilteredMetrics();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <TimelineIcon sx={{ mr: 1 }} /> Advanced Queue Statistics
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="time-range-label">Time Range</InputLabel>
              <Select
                labelId="time-range-label"
                value={timeRange}
                label="Time Range"
                onChange={(e: React.ChangeEvent<{ value: unknown }>) => setTimeRange(e.target.value as string)}
              >
                {TIME_RANGES.map((range) => (
                  <MenuItem key={range.value} value={range.value}>
                    {range.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="system-label">Queue System</InputLabel>
              <Select
                labelId="system-label"
                value={system}
                label="Queue System"
                onChange={(e: React.ChangeEvent<{ value: unknown }>) => setSystem(e.target.value as string)}
              >
                {SYSTEMS.map((sys) => (
                  <MenuItem key={sys.value} value={sys.value}>
                    {sys.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchMetrics}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="statistics tabs">
          <Tab label="Performance Metrics" id="tab-0" aria-controls="tabpanel-0" />
          <Tab label="Queue Trends" id="tab-1" aria-controls="tabpanel-1" />
          <Tab label="Training Analytics" id="tab-2" aria-controls="tabpanel-2" />
        </Tabs>
      </Box>
      
      {/* Tab Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : !filteredMetrics ? (
        <Alert severity="info">No metrics available for the selected filters.</Alert>
      ) : (
        <>
          {/* Performance Metrics Tab */}
          <Box role="tabpanel" hidden={activeTab !== 0} id="tabpanel-0" aria-labelledby="tab-0">
            {activeTab === 0 && (
              <Grid container spacing={3}>
                {/* Processing Rate */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <SpeedIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">Processing Rate</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {system === 'all' 
                          ? `${filteredMetrics.processingRate?.overall?.toFixed(2) || 0} jobs/hour`
                          : `${filteredMetrics.processingRate?.toFixed(2) || 0} jobs/hour`
                        }
                      </Typography>
                      
                      {system === 'all' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" gutterBottom>By System:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip 
                              label={`PDF: ${filteredMetrics.processingRate?.pdf?.toFixed(2) || 0} jobs/hour`} 
                              color="primary" 
                              variant="outlined" 
                              size="small" 
                            />
                            <Chip 
                              label={`Crawler: ${filteredMetrics.processingRate?.crawler?.toFixed(2) || 0} jobs/hour`} 
                              color="secondary" 
                              variant="outlined" 
                              size="small" 
                            />
                          </Box>
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Peak: {filteredMetrics.processingRate?.peak?.toFixed(2) || 0} jobs/hour
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Low: {filteredMetrics.processingRate?.low?.toFixed(2) || 0} jobs/hour
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Completion Rate */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
                        <Typography variant="h6">Completion Rate</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {system === 'all'
                          ? `${(filteredMetrics.completionRate?.overall || 0) * 100}%`
                          : `${(filteredMetrics.completionRate || 0) * 100}%`
                        }
                      </Typography>
                      
                      {system === 'all' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" gutterBottom>By System:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip 
                              label={`PDF: ${(filteredMetrics.completionRate?.pdf || 0) * 100}%`} 
                              color="primary" 
                              variant="outlined" 
                              size="small" 
                            />
                            <Chip 
                              label={`Crawler: ${(filteredMetrics.completionRate?.crawler || 0) * 100}%`} 
                              color="secondary" 
                              variant="outlined" 
                              size="small" 
                            />
                          </Box>
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Failed: {filteredMetrics.errorRate?.toFixed(2) || 0}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Retried: {filteredMetrics.retryRate?.toFixed(2) || 0}%
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Average Processing Time */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <StorageIcon sx={{ mr: 1, color: 'info.main' }} />
                        <Typography variant="h6">Average Processing Time</Typography>
                      </Box>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {system === 'all'
                          ? `${(filteredMetrics.averageProcessingTime?.overall || 0).toFixed(2)}s`
                          : `${(filteredMetrics.averageProcessingTime || 0).toFixed(2)}s`
                        }
                      </Typography>
                      
                      {system === 'all' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" gutterBottom>By System:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip 
                              label={`PDF: ${(filteredMetrics.averageProcessingTime?.pdf || 0).toFixed(2)}s`} 
                              color="primary" 
                              variant="outlined" 
                              size="small" 
                            />
                            <Chip 
                              label={`Crawler: ${(filteredMetrics.averageProcessingTime?.crawler || 0).toFixed(2)}s`} 
                              color="secondary" 
                              variant="outlined" 
                              size="small" 
                            />
                          </Box>
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Fastest: {filteredMetrics.fastestProcessingTime?.toFixed(2) || 0}s
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Slowest: {filteredMetrics.slowestProcessingTime?.toFixed(2) || 0}s
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Queue Size */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <StorageIcon sx={{ mr: 1, color: 'warning.main' }} />
                        <Typography variant="h6">Queue Status</Typography>
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Pending Jobs</Typography>
                          <Typography variant="h5">
                            {system === 'all'
                              ? filteredMetrics.queueStatus?.pending || 0
                              : filteredMetrics.queueStatus?.[system]?.pending || 0
                            }
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Processing Jobs</Typography>
                          <Typography variant="h5">
                            {system === 'all'
                              ? filteredMetrics.queueStatus?.processing || 0
                              : filteredMetrics.queueStatus?.[system]?.processing || 0
                            }
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">High Priority</Typography>
                          <Typography variant="h6">
                            {system === 'all'
                              ? filteredMetrics.queueStatus?.byPriority?.high || 0
                              : filteredMetrics.queueStatus?.[system]?.byPriority?.high || 0
                            }
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Normal Priority</Typography>
                          <Typography variant="h6">
                            {system === 'all'
                              ? filteredMetrics.queueStatus?.byPriority?.normal || 0
                              : filteredMetrics.queueStatus?.[system]?.byPriority?.normal || 0
                            }
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
          
          {/* Queue Trends Tab */}
          <Box role="tabpanel" hidden={activeTab !== 1} id="tabpanel-1" aria-labelledby="tab-1">
            {activeTab === 1 && (
              <Grid container spacing={3}>
                {/* Hourly Job Counts */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Hourly Job Processing Trend
                      </Typography>
                      <Box 
                        sx={{ 
                          height: 300, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Chart visualization would be rendered here in a production environment
                        </Typography>
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                          <Typography variant="body2" color="text.secondary">Total Jobs Processed</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.totals?.processed || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Typography variant="body2" color="text.secondary">Daily Average</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.averages?.dailyJobs || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Typography variant="body2" color="text.secondary">Peak Hour</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.peaks?.hour || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Typography variant="body2" color="text.secondary">Peak Day</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.peaks?.day || 'N/A'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* System Distribution */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Job Distribution by System
                      </Typography>
                      <Box 
                        sx={{ 
                          height: 200, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Pie chart visualization would be rendered here
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Chip 
                              label={`PDF: ${filteredMetrics.distribution?.pdf || 0}%`} 
                              color="primary" 
                              variant="outlined" 
                              size="small" 
                              sx={{ width: '100%' }}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <Chip 
                              label={`Crawler: ${filteredMetrics.distribution?.crawler || 0}%`} 
                              color="secondary" 
                              variant="outlined" 
                              size="small" 
                              sx={{ width: '100%' }}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Status Distribution */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Job Status Distribution
                      </Typography>
                      <Box 
                        sx={{ 
                          height: 200, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 1
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Pie chart visualization would be rendered here
                        </Typography>
                      </Box>
                      
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={1}>
                          <Grid item xs={4}>
                            <Chip 
                              label={`Completed: ${filteredMetrics.statusDistribution?.completed || 0}%`} 
                              color="success" 
                              variant="outlined" 
                              size="small" 
                              sx={{ width: '100%' }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <Chip 
                              label={`Failed: ${filteredMetrics.statusDistribution?.failed || 0}%`} 
                              color="error" 
                              variant="outlined" 
                              size="small" 
                              sx={{ width: '100%' }}
                            />
                          </Grid>
                          <Grid item xs={4}>
                            <Chip 
                              label={`In Progress: ${filteredMetrics.statusDistribution?.inProgress || 0}%`} 
                              color="warning" 
                              variant="outlined" 
                              size="small" 
                              sx={{ width: '100%' }}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
          
          {/* Training Analytics Tab */}
          <Box role="tabpanel" hidden={activeTab !== 2} id="tabpanel-2" aria-labelledby="tab-2">
            {activeTab === 2 && (
              <Grid container spacing={3}>
                {/* Training Conversion Rate */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Jobs Sent to Training
                      </Typography>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {filteredMetrics.training?.rate 
                          ? `${(filteredMetrics.training.rate * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Of all completed jobs, percentage that were sent to training
                      </Typography>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">PDF Files Trained</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.training?.counts?.pdf || 0}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Crawler Data Trained</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.training?.counts?.crawler || 0}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Training Success Rate */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Training Success Rate
                      </Typography>
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {filteredMetrics.training?.successRate 
                          ? `${(filteredMetrics.training.successRate * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Percentage of training jobs that completed successfully
                      </Typography>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Avg. Training Time</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.training?.avgDuration 
                              ? `${filteredMetrics.training.avgDuration.toFixed(2)}s`
                              : 'N/A'
                            }
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Training Queue Size</Typography>
                          <Typography variant="h6">
                            {filteredMetrics.training?.queueSize || 0}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
                
                {/* Training Data Volume */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Training Data Volume Trend
                      </Typography>
                      <Box 
                        sx={{ 
                          height: 300, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 2
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Line chart visualization would be rendered here in a production environment
                        </Typography>
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Total Data Size</Typography>
                              <Typography variant="h6">
                                {filteredMetrics.training?.dataVolume?.total 
                                  ? `${(filteredMetrics.training.dataVolume.total / (1024 * 1024)).toFixed(2)} MB`
                                  : '0 MB'
                                }
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">PDF Data</Typography>
                              <Typography variant="h6">
                                {filteredMetrics.training?.dataVolume?.pdf 
                                  ? `${(filteredMetrics.training.dataVolume.pdf / (1024 * 1024)).toFixed(2)} MB`
                                  : '0 MB'
                                }
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Crawler Data</Typography>
                              <Typography variant="h6">
                                {filteredMetrics.training?.dataVolume?.crawler 
                                  ? `${(filteredMetrics.training.dataVolume.crawler / (1024 * 1024)).toFixed(2)} MB`
                                  : '0 MB'
                                }
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Growth Rate</Typography>
                              <Typography variant="h6">
                                {filteredMetrics.training?.dataVolume?.growthRate 
                                  ? `${filteredMetrics.training.dataVolume.growthRate}%/day`
                                  : '0%/day'
                                }
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default AdvancedStatsDashboard;