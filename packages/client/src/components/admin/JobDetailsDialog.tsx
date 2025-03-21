import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Paper,
  Chip,
  CircularProgress,
  Divider,
  Box,
  Tabs,
  Tab,
  Alert,
  IconButton,
  Stack
} from '@mui/material';
import {
  Close as CloseIcon,
  Replay as ReplayIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  PlayArrow as TrainIcon
} from '@mui/icons-material';
import {
  QueueJob,
  getQueueJob,
  getJobLogs,
  getJobResults,
  retryQueueJob,
  cancelQueueJob,
  triggerTrainingForJob
} from '../../services/queue.service';

// Status colors
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`job-details-tabpanel-${index}`}
      aria-labelledby={`job-details-tab-${index}`}
      {...other}
      style={{ maxHeight: '400px', overflow: 'auto' }}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface JobDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  system: 'pdf' | 'crawler';
  onActionComplete: () => void;
}

const JobDetailsDialog: React.FC<JobDetailsDialogProps> = ({
  open,
  onClose,
  jobId,
  system,
  onActionComplete
}) => {
  const [job, setJob] = useState<QueueJob | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [tabValue, setTabValue] = useState(0);

  // Fetch job details
  useEffect(() => {
    if (open && jobId) {
      fetchJobDetails();
    }
  }, [open, jobId, system]);

  const fetchJobDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [jobData, logsData, resultsData] = await Promise.all([
        getQueueJob(jobId, system),
        getJobLogs(jobId, system).catch(() => []),
        getJobResults(jobId, system).catch(() => null)
      ]);
      
      setJob(jobData);
      setLogs(logsData);
      setResults(resultsData);
    } catch (err) {
      setError(`Failed to load job details: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error loading job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAction = async (action: 'retry' | 'cancel' | 'train') => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    
    try {
      let result;
      
      switch (action) {
        case 'retry':
          result = await retryQueueJob(jobId, system);
          setActionSuccess(`Job retried successfully: ${result}`);
          break;
        case 'cancel':
          result = await cancelQueueJob(jobId, system);
          setActionSuccess(`Job canceled successfully: ${result}`);
          break;
        case 'train':
          result = await triggerTrainingForJob(jobId, system);
          setActionSuccess(`Training triggered successfully: ${result}`);
          break;
      }
      
      // Refresh job details
      await fetchJobDetails();
      onActionComplete();
    } catch (err) {
      setActionError(`Failed to ${action} job: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`Error performing ${action} action:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  // For displaying JSON data in a readable format
  const renderJsonData = (data: any) => {
    if (!data) return <Typography>No data available</Typography>;
    
    return (
      <pre style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '10px', 
        borderRadius: '4px',
        overflowX: 'auto',
        maxHeight: '300px'
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  // For displaying status history
  const renderStatusHistory = (history?: Array<{status: string, timestamp: string, message?: string}>) => {
    if (!history || history.length === 0) {
      return <Typography>No status history available</Typography>;
    }
    
    return history.map((item, index) => (
      <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'flex-start' }}>
        <Chip 
          label={statusLabels[item.status] || item.status}
          color={statusColors[item.status] as any || 'default'}
          size="small"
          sx={{ mr: 1, mt: 0.5 }}
        />
        <Box>
          <Typography variant="body2" color="textSecondary">
            {new Date(item.timestamp).toLocaleString()}
          </Typography>
          {item.message && (
            <Typography variant="body2">
              {item.message}
            </Typography>
          )}
        </Box>
      </Box>
    ));
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Job Details
          {job && (
            <Chip 
              label={system === 'pdf' ? 'PDF Processing' : 'Web Crawler'}
              color={system === 'pdf' ? 'primary' : 'secondary'}
              size="small"
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !job ? (
          <Alert severity="warning">Job not found</Alert>
        ) : (
          <>
            {(actionSuccess || actionError) && (
              <Alert 
                severity={actionSuccess ? "success" : "error"} 
                sx={{ mb: 2 }}
                onClose={() => actionSuccess ? setActionSuccess(null) : setActionError(null)}
              >
                {actionSuccess || actionError}
              </Alert>
            )}
          
            {/* Job Summary */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>ID: {job.id}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ mr: 1 }}>Status:</Typography>
                  <Chip 
                    label={statusLabels[job.status] || job.status}
                    color={statusColors[job.status] as any || 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" gutterBottom>
                  Created: {new Date(job.createdAt).toLocaleString()}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Updated: {new Date(job.updatedAt).toLocaleString()}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Priority: {typeof job.priority === 'string' 
                    ? job.priority.charAt(0).toUpperCase() + job.priority.slice(1)
                    : job.priority === 2 ? 'High' : job.priority === 1 ? 'Normal' : 'Low'
                  }
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Source: {job.source}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                {/* Progress and attempts */}
                <Typography variant="subtitle2" gutterBottom>Progress:</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CircularProgress
                    variant="determinate"
                    value={job.progress > 100 ? 100 : job.progress}
                    size={24}
                    thickness={7}
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="body2">
                    {Math.round(job.progress)}%
                  </Typography>
                </Box>
                
                <Typography variant="body2" gutterBottom>
                  Attempts: {job.attempts} of {job.maxAttempts}
                </Typography>
                
                {job.metrics && (
                  <>
                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>Metrics:</Typography>
                    {job.metrics.processingTime !== undefined && (
                      <Typography variant="body2" gutterBottom>
                        Processing Time: {job.metrics.processingTime} seconds
                      </Typography>
                    )}
                    {job.metrics.pagesProcessed !== undefined && (
                      <Typography variant="body2" gutterBottom>
                        Pages Processed: {job.metrics.pagesProcessed}
                      </Typography>
                    )}
                    {job.metrics.pagesCrawled !== undefined && (
                      <Typography variant="body2" gutterBottom>
                        Pages Crawled: {job.metrics.pagesCrawled}
                      </Typography>
                    )}
                    {job.metrics.fileSize !== undefined && (
                      <Typography variant="body2" gutterBottom>
                        File Size: {(job.metrics.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </Typography>
                    )}
                    {job.metrics.dataSize !== undefined && (
                      <Typography variant="body2" gutterBottom>
                        Data Size: {(job.metrics.dataSize / (1024 * 1024)).toFixed(2)} MB
                      </Typography>
                    )}
                  </>
                )}
              </Grid>
              
              {/* Failed job specific - error message */}
              {job.status === 'failed' && job.error && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'error.lighter', borderLeft: '4px solid', borderColor: 'error.main' }}>
                    <Typography variant="subtitle2">Error:</Typography>
                    <Typography variant="body2">
                      {job.error}
                    </Typography>
                  </Paper>
                </Grid>
              )}
              
              {/* PDF specific info */}
              {system === 'pdf' && job.filePath && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2">File Path:</Typography>
                  <Typography variant="body2">
                    {job.filePath}
                  </Typography>
                </Grid>
              )}
              
              {/* Crawler specific info */}
              {system === 'crawler' && job.config && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2">URL:</Typography>
                  <Typography variant="body2">
                    {job.config.url}
                  </Typography>
                  
                  {job.config.provider && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>Provider:</Typography>
                      <Typography variant="body2">
                        {job.config.provider}
                      </Typography>
                    </>
                  )}
                </Grid>
              )}
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            {/* Tabs for Logs, Results, and Status History */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="job details tabs">
                <Tab label="Status History" />
                <Tab label="Logs" />
                <Tab label="Results" />
                {system === 'crawler' && <Tab label="Config" />}
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              {renderStatusHistory(job.statusHistory)}
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              {logs.length > 0 ? (
                <Paper sx={{ bgcolor: '#f5f5f5', p: 2, maxHeight: '300px', overflow: 'auto' }}>
                  {logs.map((log, index) => (
                    <Typography key={index} variant="body2" component="div" sx={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'pre-wrap',
                      mb: 0.5,
                      color: log.includes('ERROR') ? 'error.main' : 
                             log.includes('WARN') ? 'warning.main' : 'inherit'
                    }}>
                      {log}
                    </Typography>
                  ))}
                </Paper>
              ) : (
                <Typography>No logs available</Typography>
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              {renderJsonData(results)}
            </TabPanel>
            
            {system === 'crawler' && (
              <TabPanel value={tabValue} index={3}>
                {renderJsonData(job.config)}
              </TabPanel>
            )}
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Box>
          {job && (
            <Stack direction="row" spacing={1}>
              {job.status === 'failed' && (
                <Button
                  startIcon={<ReplayIcon />}
                  variant="outlined"
                  color="primary"
                  onClick={() => handleAction('retry')}
                  disabled={actionLoading}
                >
                  Retry
                </Button>
              )}
              
              {(job.status === 'pending' || job.status === 'processing' || job.status === 'running') && (
                <Button
                  startIcon={<CancelIcon />}
                  variant="outlined"
                  color="error"
                  onClick={() => handleAction('cancel')}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
              )}
              
              {job.status === 'completed' && system === 'crawler' && !job.trainingJobId && (
                <Button
                  startIcon={<TrainIcon />}
                  variant="outlined"
                  color="secondary"
                  onClick={() => handleAction('train')}
                  disabled={actionLoading}
                >
                  Train Model
                </Button>
              )}
              
              {job.status === 'completed' && (
                <Button
                  startIcon={<DownloadIcon />}
                  variant="outlined"
                  color="info"
                  disabled={!results}
                >
                  Download Results
                </Button>
              )}
            </Stack>
          )}
        </Box>
        
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default JobDetailsDialog;