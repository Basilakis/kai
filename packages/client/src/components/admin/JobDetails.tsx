/// <reference path="../../types/mui.d.ts" />
/// <reference path="../../types/mui-icons.d.ts" />

import React, { useState, useEffect } from 'react';
// Import MUI components from barrel file
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  // Divider, // Commented out to avoid unused variable warning
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Collapse,
  TextField,
  Alert
} from '../mui';

// Import MUI icons from barrel file
import {
  RefreshIcon,
  CancelIcon,
  ReplayIcon,
  DownloadIcon,
  ExpandMoreIcon,
  ExpandLessIcon,
  CodeIcon,
  VisibilityIcon
} from '../mui-icons';

// Import from the shared utility package using consistent naming
import {
  formatFileSize,
  // formatRelativeTime, // Commented out to avoid unused variable warning
  // formatDate, // Commented out to avoid unused variable warning
  formatRelativeDate,
  formatLocalizedDateTime
} from '../../../../shared/src/utils/formatting';

// Service imports
import { getQueueJob, retryQueueJob, cancelQueueJob, getJobLogs, getJobResults } from '../../services/queue.service';

// Status colors (for UI components)
const statusColors: Record<string, string> = {
  pending: 'info',
  processing: 'warning',
  running: 'warning',
  completed: 'success',
  failed: 'error',
  canceled: 'default',
  retrying: 'warning',
  training: 'secondary'
};

// Status labels (human-readable)
const statusLabels: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
  retrying: 'Retrying',
  training: 'Training'
};

// Interface for component props
interface JobDetailsProps {
  jobId: string;
  system: 'pdf' | 'crawler';
  onClose?: () => void;
  onRefresh?: () => void;
}

/**
 * JobDetails Component
 *
 * Displays detailed information about a specific queue job
 */
const JobDetails: React.FC<JobDetailsProps> = ({ jobId, system, onClose, onRefresh }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<number>(0);

  // Data states
  const [job, setJob] = useState<any | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // UI states
  const [configExpanded, setConfigExpanded] = useState<boolean>(true);
  const [statusExpanded, setStatusExpanded] = useState<boolean>(true);
  const [metricsExpanded, setMetricsExpanded] = useState<boolean>(false);
  const [fullScreenMode, setFullScreenMode] = useState<boolean>(false);

  // Load job data
  const fetchJobData = async () => {
    setLoading(true);
    setError(null);
    try {
      const jobData = await getQueueJob(jobId, system);
      setJob(jobData);
    } catch (err) {
      setError(`Failed to load job details: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Load job logs
  const fetchJobLogs = async () => {
    if (activeTab !== 1) return;

    setLogsLoading(true);
    try {
      const logsData = await getJobLogs(jobId, system);
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to load job logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Load job results
  const fetchJobResults = async () => {
    if (activeTab !== 2) return;

    setResultsLoading(true);
    try {
      const resultsData = await getJobResults(jobId, system);
      setResults(resultsData);
    } catch (err) {
      console.error('Failed to load job results:', err);
    } finally {
      setResultsLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchJobData();
  }, [jobId, system]);

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === 1) {
      fetchJobLogs();
    } else if (activeTab === 2) {
      fetchJobResults();
    }
  }, [activeTab]);

  // Handle tab change
  const handleTabChange = (_event: any, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle job actions
  const handleJobAction = async (type: 'retry' | 'cancel') => {
    setActionSuccess(null);
    setActionError(null);

    try {
      let message: string;

      if (type === 'retry') {
        message = await retryQueueJob(jobId, system);
      } else {
        message = await cancelQueueJob(jobId, system);
      }

      setActionSuccess(message);
      // Refresh job data
      fetchJobData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(`Failed to ${type} job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Clear action state after a delay
      setTimeout(() => {
        setActionSuccess(null);
        setActionError(null);
      }, 5000);
    }
  };

  // Handle downloading job results
  const handleDownloadResults = () => {
    if (!results) return;

    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataUri);
    downloadLink.setAttribute('download', `job-${jobId}-results.json`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Toggle section expansion
  const toggleSection = (section: 'config' | 'status' | 'metrics') => {
    if (section === 'config') setConfigExpanded(!configExpanded);
    else if (section === 'status') setStatusExpanded(!statusExpanded);
    else if (section === 'metrics') setMetricsExpanded(!metricsExpanded);
  };

  // Toggle full screen mode
  const toggleFullScreen = () => {
    setFullScreenMode(!fullScreenMode);
  };

  // Format timestamps using shared utility
  const formatTimestamp = (date: Date) => {
    return formatLocalizedDateTime(date.toISOString());
  };

  // Handle refreshing data
  const handleRefresh = () => {
    fetchJobData();
    if (activeTab === 1) fetchJobLogs();
    if (activeTab === 2) fetchJobResults();
    if (onRefresh) onRefresh();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!job) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        No job found with ID: {jobId}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        position: fullScreenMode ? 'fixed' : 'relative',
        top: fullScreenMode ? 0 : 'auto',
        left: fullScreenMode ? 0 : 'auto',
        right: fullScreenMode ? 0 : 'auto',
        bottom: fullScreenMode ? 0 : 'auto',
        zIndex: fullScreenMode ? 1300 : 'auto',
        backgroundColor: 'background.paper',
        height: fullScreenMode ? '100vh' : 'auto',
        overflow: 'auto'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
        <Typography variant="h5">
          Job Details {system === 'pdf' ? '(PDF Processing)' : '(Web Crawler)'}
        </Typography>
        <Box>
          <IconButton onClick={handleRefresh} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={toggleFullScreen} title={fullScreenMode ? "Exit Full Screen" : "Full Screen"}>
            <VisibilityIcon />
          </IconButton>
          {onClose && (
            <Button onClick={onClose} variant="outlined" size="small" sx={{ ml: 1 }}>
              Close
            </Button>
          )}
        </Box>
      </Box>

      {/* Action Feedback */}
      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {actionSuccess}
        </Alert>
      )}

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {/* Job ID and Status */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">Job ID</Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
              {job.id}
            </Typography>
            <Typography variant="body2" color="text.secondary">Source</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {job.source || (system === 'pdf' ? 'PDF Upload' : 'Web Crawler')}
            </Typography>
            <Typography variant="body2" color="text.secondary">Created</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {formatTimestamp(new Date(job.createdAt))} ({formatRelativeDate(job.createdAt)})
            </Typography>
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="body2" color="text.secondary">Status</Typography>
            <Chip
              label={statusLabels[job.status] || job.status}
              color={statusColors[job.status] as any || 'default'}
              sx={{ mb: 2, fontSize: '1rem', py: 2, px: 1 }}
            />
            <Box sx={{ mt: 'auto' }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => handleJobAction('cancel')}
                disabled={['completed', 'failed', 'canceled'].includes(job.status)}
                sx={{ mr: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<ReplayIcon />}
                onClick={() => handleJobAction('retry')}
                disabled={['pending', 'processing', 'running', 'retrying', 'training'].includes(job.status)}
              >
                Retry
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="job details tabs">
          <Tab label="Details" id="job-tab-0" aria-controls="job-tabpanel-0" />
          <Tab label="Logs" id="job-tab-1" aria-controls="job-tabpanel-1" />
          <Tab label="Results" id="job-tab-2" aria-controls="job-tabpanel-2" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box role="tabpanel" hidden={activeTab !== 0} id="job-tabpanel-0" aria-labelledby="job-tab-0">
        {activeTab === 0 && (
          <>
            {/* Configuration */}
            <Paper sx={{ mb: 3, overflow: 'hidden' }}>
              <Box
                onClick={() => toggleSection('config')}
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'action.hover'
                }}
              >
                <Typography variant="h6">Configuration</Typography>
                <IconButton size="small">
                  {configExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={configExpanded}>
                <Box sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    {system === 'pdf' ? (
                      <>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">File Path</Typography>
                          <Typography variant="body1" sx={{ mb: 2, wordBreak: 'break-all' }}>
                            {job.filePath}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">Priority</Typography>
                          <Typography variant="body1" sx={{ mb: 2 }}>
                            {typeof job.priority === 'string'
                              ? job.priority.charAt(0).toUpperCase() + job.priority.slice(1)
                              : job.priority === 2 ? 'High' : job.priority === 1 ? 'Normal' : 'Low'}
                          </Typography>
                        </Grid>
                      </>
                    ) : (
                      <>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">URL</Typography>
                          <Typography variant="body1" sx={{ mb: 2, wordBreak: 'break-all' }}>
                            {job.config?.url}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">Provider</Typography>
                          <Typography variant="body1" sx={{ mb: 2 }}>
                            {job.config?.provider || 'Unknown'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">Priority</Typography>
                          <Typography variant="body1" sx={{ mb: 2 }}>
                            {typeof job.priority === 'string'
                              ? job.priority.charAt(0).toUpperCase() + job.priority.slice(1)
                              : job.priority === 2 ? 'High' : job.priority === 1 ? 'Normal' : 'Low'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary">Auto Train</Typography>
                          <Typography variant="body1" sx={{ mb: 2 }}>
                            {job.config?.autoTrain ? 'Yes' : 'No'}
                          </Typography>
                        </Grid>
                      </>
                    )}
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Full Configuration</Typography>
                      <TextField
                        multiline
                        fullWidth
                        variant="outlined"
                        value={system === 'pdf'
                          ? JSON.stringify(job.options || {}, null, 2)
                          : JSON.stringify(job.config || {}, null, 2)
                        }
                        InputProps={{
                          readOnly: true,
                          startAdornment: (
                            <Box sx={{ mr: 1, color: 'text.secondary' }}>
                              <CodeIcon fontSize="small" />
                            </Box>
                          ),
                        }}
                        sx={{
                          fontFamily: 'monospace',
                          '& .MuiOutlinedInput-root': {
                            fontFamily: 'monospace',
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Collapse>
            </Paper>

            {/* Status History */}
            <Paper sx={{ mb: 3, overflow: 'hidden' }}>
              <Box
                onClick={() => toggleSection('status')}
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'action.hover'
                }}
              >
                <Typography variant="h6">Status History</Typography>
                <IconButton size="small">
                  {statusExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={statusExpanded}>
                <Box sx={{ p: 2 }}>
                  <List>
                    {job.statusHistory?.length > 0 ? (
                      job.statusHistory.map((statusEntry: any, index: number) => (
                        <ListItem key={index} divider={index < job.statusHistory.length - 1}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Chip
                                  label={statusLabels[statusEntry.status] || statusEntry.status}
                                  color={statusColors[statusEntry.status] as any || 'default'}
                                  size="small"
                                  sx={{ mr: 2 }}
                                />
                                {statusEntry.message || `Status changed to ${statusEntry.status}`}
                              </Box>
                            }
                            secondary={formatTimestamp(new Date(statusEntry.timestamp))}
                          />
                        </ListItem>
                      ))
                    ) : (
                      <ListItem>
                        <ListItemText primary="No status history available" />
                      </ListItem>
                    )}
                  </List>
                </Box>
              </Collapse>
            </Paper>

            {/* Metrics and Performance */}
            <Paper sx={{ mb: 3, overflow: 'hidden' }}>
              <Box
                onClick={() => toggleSection('metrics')}
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'action.hover'
                }}
              >
                <Typography variant="h6">Metrics and Performance</Typography>
                <IconButton size="small">
                  {metricsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={metricsExpanded}>
                <Box sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">Processing Time</Typography>
                          <Typography variant="h6">
                            {job.metrics?.processingTime ? `${(job.metrics.processingTime / 1000).toFixed(2)}s` : 'N/A'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">Attempts</Typography>
                          <Typography variant="h6">
                            {job.attempts || 1} / {job.maxAttempts || 3}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">Progress</Typography>
                          <Typography variant="h6">
                            {job.progress !== undefined ? `${job.progress}%` : 'N/A'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    {system === 'crawler' && (
                      <>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Pages Crawled</Typography>
                              <Typography variant="h6">
                                {job.metrics?.pagesCrawled || 'N/A'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Data Size</Typography>
                              <Typography variant="h6">
                                {job.metrics?.dataSize
                                  ? formatFileSize(job.metrics.dataSize)
                                  : 'N/A'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Training Status</Typography>
                              <Typography variant="h6">
                                {job.trainingJobId
                                  ? <Chip
                                      label="Sent to Training"
                                      color="secondary"
                                      size="small"
                                    />
                                  : 'Not Trained'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </>
                    )}
                    {system === 'pdf' && (
                      <>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Pages Processed</Typography>
                              <Typography variant="h6">
                                {job.metrics?.pagesProcessed || 'N/A'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">File Size</Typography>
                              <Typography variant="h6">
                                {job.metrics?.fileSize
                                  ? formatFileSize(job.metrics.fileSize)
                                  : 'N/A'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">Training Status</Typography>
                              <Typography variant="h6">
                                {job.trainingJobId
                                  ? <Chip
                                      label="Sent to Training"
                                      color="secondary"
                                      size="small"
                                    />
                                  : 'Not Trained'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Box>
              </Collapse>
            </Paper>
          </>
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 1} id="job-tabpanel-1" aria-labelledby="job-tab-1">
        {activeTab === 1 && (
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Processing Logs</Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={fetchJobLogs}
                disabled={logsLoading}
                size="small"
              >
                Refresh Logs
              </Button>
            </Box>
            {logsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : logs.length > 0 ? (
              <TextField
                multiline
                fullWidth
                variant="outlined"
                value={logs.join('\n')}
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                  }
                }}
              />
            ) : (
              <Alert severity="info">No logs available for this job</Alert>
            )}
          </Paper>
        )}
      </Box>

      <Box role="tabpanel" hidden={activeTab !== 2} id="job-tabpanel-2" aria-labelledby="job-tab-2">
        {activeTab === 2 && (
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Job Results</Typography>
              <Box>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={fetchJobResults}
                  disabled={resultsLoading}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  Refresh
                </Button>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadResults}
                  disabled={!results || resultsLoading}
                  variant="outlined"
                  size="small"
                >
                  Download
                </Button>
              </Box>
            </Box>
            {resultsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : !results ? (
              <Alert severity="info">
                {job.status === 'completed'
                  ? 'No results available for this job'
                  : 'Results will be available once the job completes'}
              </Alert>
            ) : (
              <TextField
                multiline
                fullWidth
                variant="outlined"
                value={JSON.stringify(results, null, 2)}
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'monospace',
                  }
                }}
              />
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default JobDetails;