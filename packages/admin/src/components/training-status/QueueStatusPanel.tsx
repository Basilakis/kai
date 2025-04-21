import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  LinearProgress, 
  Chip,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

// Mock data for training queue
const mockQueueData = {
  activeJobs: 3,
  queuedJobs: 7,
  completedJobs: 42,
  failedJobs: 2,
  processingRate: 4.2, // jobs per hour
  estimatedWaitTime: 100, // minutes
  queueHealth: 'healthy', // 'healthy', 'degraded', 'unhealthy'
  resourceUtilization: {
    gpu: 85, // percentage
    cpu: 62, // percentage
    memory: 58 // percentage
  },
  jobTypes: [
    { type: 'Classification', count: 4, color: '#4caf50' },
    { type: 'Embedding', count: 3, color: '#2196f3' },
    { type: '3D Generation', count: 2, color: '#ff9800' },
    { type: 'Fine-tuning', count: 1, color: '#9c27b0' }
  ],
  recentJobs: [
    { id: 'job-001', name: 'Material Classifier v2.1', status: 'running', progress: 67, timeRemaining: '2h 30m' },
    { id: 'job-002', name: 'Text Embedding Model', status: 'running', progress: 32, timeRemaining: '4h 15m' },
    { id: 'job-003', name: '3D Model Generator', status: 'queued', progress: 0, timeRemaining: 'Waiting' }
  ]
};

// Queue Status Panel Component
const QueueStatusPanel: React.FC = () => {
  const [queueData, setQueueData] = useState(mockQueueData);
  const [loading, setLoading] = useState(false);
  const [queuePaused, setQueuePaused] = useState(false);

  // Refresh queue data
  const refreshQueueData = async () => {
    setLoading(true);
    
    // In a real implementation, this would fetch data from an API
    // For now, we'll just simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setLoading(false);
  };

  // Toggle queue pause state
  const toggleQueuePause = () => {
    setQueuePaused(!queuePaused);
    // In a real implementation, this would call an API to pause/resume the queue
  };

  // Load initial data
  useEffect(() => {
    refreshQueueData();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header with controls */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-gray-900">Training Queue</h3>
          {queueData.queueHealth !== 'healthy' && (
            <Chip 
              icon={<WarningIcon />}
              label={queueData.queueHealth === 'degraded' ? 'Queue Degraded' : 'Queue Unhealthy'} 
              color={queueData.queueHealth === 'degraded' ? 'warning' : 'error'}
              size="small"
              className="ml-3"
            />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outlined"
            color={queuePaused ? 'success' : 'warning'}
            size="small"
            startIcon={queuePaused ? <PlayIcon /> : <PauseIcon />}
            onClick={toggleQueuePause}
          >
            {queuePaused ? 'Resume Queue' : 'Pause Queue'}
          </Button>
          <Tooltip title="Queue Settings">
            <IconButton size="small">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh Data">
            <IconButton 
              size="small" 
              onClick={refreshQueueData}
              disabled={loading}
            >
              <RefreshIcon className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Queue stats */}
      <div className="p-6">
        <Grid container spacing={3}>
          {/* Queue metrics */}
          <Grid item xs={12} md={8}>
            <Grid container spacing={3}>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Active Jobs
                    </Typography>
                    <Typography variant="h5" component="div" color="primary.main">
                      {queueData.activeJobs}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Queued Jobs
                    </Typography>
                    <Typography variant="h5" component="div" color="warning.main">
                      {queueData.queuedJobs}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Processing Rate
                    </Typography>
                    <Typography variant="h5" component="div">
                      {queueData.processingRate}
                      <Typography variant="caption" component="span" sx={{ ml: 0.5 }}>
                        jobs/hr
                      </Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Est. Wait Time
                    </Typography>
                    <Typography variant="h5" component="div">
                      {queueData.estimatedWaitTime}
                      <Typography variant="caption" component="span" sx={{ ml: 0.5 }}>
                        min
                      </Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Resource utilization */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Resource Utilization
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    GPU: {queueData.resourceUtilization.gpu}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={queueData.resourceUtilization.gpu} 
                    color={queueData.resourceUtilization.gpu > 90 ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 5 }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    CPU: {queueData.resourceUtilization.cpu}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={queueData.resourceUtilization.cpu} 
                    color={queueData.resourceUtilization.cpu > 90 ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 5 }}
                  />
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Memory: {queueData.resourceUtilization.memory}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={queueData.resourceUtilization.memory} 
                    color={queueData.resourceUtilization.memory > 90 ? 'error' : 'primary'}
                    sx={{ height: 8, borderRadius: 5 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Grid>

          {/* Job type distribution */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              Job Type Distribution
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {queueData.jobTypes.map((jobType) => (
                <Box key={jobType.type} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box 
                    sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      bgcolor: jobType.color,
                      mr: 1 
                    }} 
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {jobType.type}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {jobType.count}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>

        {/* Recent jobs */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Recent Jobs
          </Typography>
          <Grid container spacing={2}>
            {queueData.recentJobs.map((job) => (
              <Grid item xs={12} sm={4} key={job.id}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: '70%' }}>
                        {job.name}
                      </Typography>
                      <Chip 
                        label={job.status} 
                        color={job.status === 'running' ? 'success' : 'warning'} 
                        size="small" 
                      />
                    </Box>
                    {job.status === 'running' && (
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Progress
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {job.progress}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={job.progress} 
                          sx={{ height: 4, borderRadius: 5 }}
                        />
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Time remaining: {job.timeRemaining}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </div>
    </div>
  );
};

export default QueueStatusPanel;
