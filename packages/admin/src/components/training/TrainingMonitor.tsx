/// <reference path="../../types/mui-icon-modules.d.ts" />

import React, { useState, useEffect, useRef, useCallback } from 'react'; // Explicit hook imports
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  IconButton,
  LinearProgress // Import official LinearProgress
} from '../../components/mui';
// Import MUI Icons from barrel file
import {
  RefreshIcon,
  PlayArrowIcon,
  CheckCircleIcon,
  ErrorOutlineIcon,
  HistoryIcon
} from '../../components/mui-icons';

// Import our implemented components
import MetricsVisualizer from './MetricsVisualizer';
import ParameterTuner from './ParameterTuner';
import CheckpointManager from './CheckpointManager';

// Note: We've updated the CheckpointManagerProps interface in CheckpointManager.tsx
// to include the additional props we need

// WebSocket connection URL (from environment or default)
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';

// Training progress event interface
interface TrainingProgressEvent {
  jobId: string;
  type: 'start' | 'progress' | 'complete' | 'error';
  timestamp: number;
  data: {
    progress?: number;
    currentEpoch?: number;
    totalEpochs?: number;
    loss?: number;
    accuracy?: number;
    eta?: number;
    error?: string;
    message?: string;
    modelType?: string;
    parameter_updates?: Record<string, number | string>;
    current_learning_rate?: number;
    [key: string]: any;
  };
}

// Active job information
interface ActiveJob {
  jobId: string;
  modelType: string;
  createdAt: number;
  status: 'start' | 'progress' | 'complete' | 'error';
  progress: number;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  accuracy?: number;
  eta?: number;
  data?: any; // Add data property to store additional job data
  metrics: Array<{
    timestamp: number;
    loss?: number;
    accuracy?: number;
    progress: number;
    [key: string]: any;
  }>;
}

/**
 * TrainingMonitor Component
 *
 * Provides real-time monitoring and control of ML model training jobs
 * through WebSocket connection to the training progress server.
 */
const TrainingMonitor: React.FC = () => {
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null); // Use imported hook

  // State for tracking active training jobs
  const [activeJobs, setActiveJobs] = useState<Record<string, ActiveJob>>({}); // Use imported hook
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null); // Use imported hook
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected'); // Use imported hook
  const [error, setError] = useState<string | null>(null); // Use imported hook
  const [currentTab, setCurrentTab] = useState<'metrics' | 'parameters' | 'checkpoints'>('metrics');

  // Establish WebSocket connection
  // Wrap the entire function definition in useCallback
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    setError(null);

    // Create new WebSocket connection
    const ws = new WebSocket(`${WS_URL}/training-progress`);

    ws.onopen = () => {
      setConnectionStatus('connected');

      // Authenticate and request active jobs
      // Get user ID from local storage or authentication context
      // In a real implementation, this would come from an auth provider
      const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId') || 'admin-user';
      
      ws.send(JSON.stringify({
        type: 'auth',
        userId: userId
      }));
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      // Try to reconnect after delay
      setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (err) => {
      setError(`WebSocket error: ${err}`);
      setConnectionStatus('disconnected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    wsRef.current = ws;
  }, []); // Empty dependency array: connectWebSocket doesn't depend on props/state

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (message: any) => { // Not using useCallback here as it's called internally
    // Handle different message types
    if (message.type === 'auth_success') {
      console.log('Authentication successful');
      // Request active jobs after successful auth
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'get_active_jobs'
        }));
      }
    }
    else if (message.type === 'active_jobs') {
      // Handle list of active jobs
      const { jobs } = message;
      if (Array.isArray(jobs)) {
        // Subscribe to each active job
        jobs.forEach(jobId => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'subscribe',
              jobId
            }));
          }
        });
      }
    }
    else if (message.jobId) {
      // This is a training progress event
      const progressEvent = message as TrainingProgressEvent;

      setActiveJobs(prevJobs => {
        const updatedJobs = { ...prevJobs };

        // If this is a new job, initialize it
        if (!updatedJobs[progressEvent.jobId]) {
          if (progressEvent.type === 'start') {
            updatedJobs[progressEvent.jobId] = {
              jobId: progressEvent.jobId,
              modelType: progressEvent.data.modelType || 'unknown',
              createdAt: progressEvent.timestamp,
              status: progressEvent.type,
              progress: 0,
              metrics: []
            };
          }
        } else {
          // Update existing job
          const job = updatedJobs[progressEvent.jobId];
          job.status = progressEvent.type;

          if (progressEvent.data.progress !== undefined) {
            job.progress = progressEvent.data.progress;
          }

          if (progressEvent.data.currentEpoch !== undefined) {
            job.currentEpoch = progressEvent.data.currentEpoch;
          }

          if (progressEvent.data.totalEpochs !== undefined) {
            job.totalEpochs = progressEvent.data.totalEpochs;
          }

          if (progressEvent.data.loss !== undefined ||
              progressEvent.data.accuracy !== undefined ||
              progressEvent.data.progress !== undefined) {

            // Add new metrics data point
            job.metrics.push({
              timestamp: progressEvent.timestamp,
              loss: progressEvent.data.loss,
              accuracy: progressEvent.data.accuracy,
              progress: progressEvent.data.progress || job.progress
            });
          }

          // Update other fields
          if (progressEvent.data.loss !== undefined) {
            job.loss = progressEvent.data.loss;
          }

          if (progressEvent.data.accuracy !== undefined) {
            job.accuracy = progressEvent.data.accuracy;
          }

          if (progressEvent.data.eta !== undefined) {
            job.eta = progressEvent.data.eta;
          }
        }

        // If no job is selected and we have active jobs, select the first one
        if (!selectedJobId && Object.keys(updatedJobs).length > 0) {
          setSelectedJobId(Object.keys(updatedJobs)[0]);
        }

        return updatedJobs;
      });
    }
  };

  // Subscribe to a job's progress updates
  const subscribeToJob = (jobId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        jobId
      }));
      setSelectedJobId(jobId);
    }
  };

  // Unsubscribe from a job's progress updates
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const unsubscribeFromJob = (jobId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        jobId
      }));
    }
  };

  // Handle parameter adjustment
  // Wrap the entire function definition in useCallback
  const handleParameterAdjustment = useCallback((parameters: Record<string, number | string>) => {
    // Need selectedJobId from state, so it should be a dependency if used directly
    // However, it's better to pass it if needed or get it from a ref if stable
    // For now, assuming selectedJobId is stable or handled via closure
    if (!selectedJobId) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'adjust_parameters',
        jobId: selectedJobId,
        parameters
      }));
    }
  }, [selectedJobId]); // Add selectedJobId as dependency

  // Connect WebSocket on component mount
  useEffect(() => {
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]); // Keep dependency

  // Get selected job
  const selectedJob = selectedJobId ? activeJobs[selectedJobId] : null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Training Monitor
      </Typography>

      {/* Connection status */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <Chip
          color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'connecting' ? 'warning' : 'error'}
          label={connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          sx={{ mr: 2 }}
        />
        {connectionStatus !== 'connected' && (
          <Button
            variant="outlined"
            size="small"
            onClick={connectWebSocket}
            startIcon={<RefreshIcon />} // Use imported icon
          >
            Reconnect
          </Button>
        )}
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Active jobs list */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Active Training Jobs
        </Typography>
        {Object.keys(activeJobs).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No active training jobs found.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {Object.values(activeJobs).map(job => (
              <Grid item xs={12} sm={6} md={4} key={job.jobId}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    border: selectedJobId === job.jobId ? '2px solid primary.main' : undefined
                  }}
                  onClick={() => subscribeToJob(job.jobId)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" noWrap title={job.jobId}>
                        {job.jobId.substring(0, 8)}...
                      </Typography>
                      <Chip
                        size="small"
                        color={
                          job.status === 'complete' ? 'success' :
                          job.status === 'error' ? 'error' :
                          'primary'
                        }
                        label={job.status.toUpperCase()}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Model: {job.modelType}
                    </Typography>
                    {job.currentEpoch !== undefined && job.totalEpochs !== undefined && (
                      <Typography variant="body2" noWrap>
                        Epoch: {job.currentEpoch}/{job.totalEpochs}
                      </Typography>
                    )}
                    <LinearProgress
                      variant="determinate"
                      value={job.progress * 100}
                      sx={{ mt: 1, mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        {Math.round(job.progress * 100)}%
                      </Typography>
                      {job.eta !== undefined && (
                        <Typography variant="body2">
                          ETA: {Math.round(job.eta)}s
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Selected job details */}
      {selectedJob && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Job: {selectedJob.jobId}
            </Typography>
            <Box>
              <Chip
                icon={
                  selectedJob.status === 'complete' ? <CheckCircleIcon /> :
                  selectedJob.status === 'error' ? <ErrorOutlineIcon /> : // Use ErrorOutlineIcon
                  selectedJob.status === 'progress' ? <PlayArrowIcon /> :
                  <HistoryIcon />
                }
                color={
                  selectedJob.status === 'complete' ? 'success' :
                  selectedJob.status === 'error' ? 'error' :
                  'primary'
                }
                label={selectedJob.status.toUpperCase()}
                sx={{ ml: 1 }}
              />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              {/* Model type */}
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Model Type
                    </Typography>
                    <Typography variant="h6">
                      {selectedJob.modelType}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Progress */}
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Progress
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ mr: 1 }}>
                        {Math.round(selectedJob.progress * 100)}%
                      </Typography>
                      <CircularProgress
                        size={24}
                        variant="determinate"
                        value={selectedJob.progress * 100}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Epochs */}
              <Grid item xs={12} sm={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Epochs
                    </Typography>
                    <Typography variant="h6">
                      {selectedJob.currentEpoch !== undefined && selectedJob.totalEpochs !== undefined ?
                        `${selectedJob.currentEpoch}/${selectedJob.totalEpochs}` :
                        'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Latest metrics (if available) */}
              {(selectedJob.loss !== undefined || selectedJob.accuracy !== undefined) && (
                <>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">
                          Loss
                        </Typography>
                        <Typography variant="h6">
                          {selectedJob.loss !== undefined ? selectedJob.loss.toFixed(4) : 'N/A'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">
                          Accuracy
                        </Typography>
                        <Typography variant="h6">
                          {selectedJob.accuracy !== undefined ?
                            `${(selectedJob.accuracy * 100).toFixed(2)}%` :
                            'N/A'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>

          {/* Tabs for different views */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant={currentTab === 'metrics' ? 'contained' : 'outlined'}
              onClick={() => setCurrentTab('metrics')}
              sx={{ mr: 1 }}
            >
              Metrics
            </Button>
            <Button
              variant={currentTab === 'parameters' ? 'contained' : 'outlined'}
              onClick={() => setCurrentTab('parameters')}
              sx={{ mr: 1 }}
            >
              Parameters
            </Button>
            <Button
              variant={currentTab === 'checkpoints' ? 'contained' : 'outlined'}
              onClick={() => setCurrentTab('checkpoints')}
            >
              Checkpoints
            </Button>
          </Box>

          <Box sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }} />

          {/* Tab content */}
          <Box>
            {currentTab === 'metrics' && (
              <MetricsVisualizer
                metricsData={selectedJob.metrics}
                jobId={selectedJob.jobId}
              />
            )}

            {currentTab === 'parameters' && (
              <ParameterTuner
                jobId={selectedJob.jobId}
                currentParameters={selectedJob.data}
                onAdjustParameters={handleParameterAdjustment}
                modelType={selectedJob.modelType}
              />
            )}

            {currentTab === 'checkpoints' && (
              <CheckpointManager
                jobId={selectedJob.jobId}
                modelType={selectedJob.modelType}
                // Placeholder async functions for checkpoint actions
                onRollback={async (checkpointId: string) => {
                  try {
                    // Call the API to roll back to a checkpoint
                    const response = await fetch(`/api/admin/training/${selectedJob.jobId}/checkpoints/${checkpointId}/rollback`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Failed to roll back: ${response.statusText}`);
                    }
                    
                    // Notify the WebSocket server about the rollback
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: 'checkpoint_action',
                        action: 'rollback',
                        jobId: selectedJob.jobId,
                        checkpointId
                      }));
                    }
                    
                    return true;
                  } catch (error) {
                    setError(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
                    return false;
                  }
                }}
                onCreateCheckpoint={async (description: string, tags: string[]) => {
                  try {
                    // Call the API to create a checkpoint
                    const response = await fetch(`/api/admin/training/${selectedJob.jobId}/checkpoints`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        description,
                        tags
                      })
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Failed to create checkpoint: ${response.statusText}`);
                    }
                    
                    // Notify the WebSocket server about the new checkpoint
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: 'checkpoint_action',
                        action: 'create',
                        jobId: selectedJob.jobId,
                        description,
                        tags
                      }));
                    }
                    
                    return true;
                  } catch (error) {
                    setError(`Checkpoint creation failed: ${error instanceof Error ? error.message : String(error)}`);
                    return false;
                  }
                }}
                onDeleteCheckpoint={async (checkpointId: string) => {
                  try {
                    // Call the API to delete a checkpoint
                    const response = await fetch(`/api/admin/training/${selectedJob.jobId}/checkpoints/${checkpointId}`, {
                      method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Failed to delete checkpoint: ${response.statusText}`);
                    }
                    
                    // Notify the WebSocket server about the deletion
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: 'checkpoint_action',
                        action: 'delete',
                        jobId: selectedJob.jobId,
                        checkpointId
                      }));
                    }
                    
                    return true;
                  } catch (error) {
                    setError(`Checkpoint deletion failed: ${error instanceof Error ? error.message : String(error)}`);
                    return false;
                  }
                }}
              />
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default TrainingMonitor;