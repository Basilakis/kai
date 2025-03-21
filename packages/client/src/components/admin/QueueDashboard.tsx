import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Chip,
  Divider,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Replay as ReplayIcon,
  Info as InfoIcon,
  FilterList as FilterIcon,
  Delete as DeleteIcon,
  PlaylistRemove as ClearQueueIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import {
  getQueueJobs,
  getQueueStats,
  getSourceFilters,
  retryQueueJob,
  cancelQueueJob,
  clearQueue,
  QueueJob,
  QueueSystem,
  QueueStats
} from '../../services/queue.service';
import JobDetailsDialog from './JobDetailsDialog';
import queueEventsService, { QueueEventType } from '../../services/queueEvents.service';

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

// Queue system labels
const queueSystemLabels: Record<QueueSystem, string> = {
  pdf: 'PDF Processing',
  crawler: 'Web Crawler',
  all: 'All Systems'
};

// Convert priority to a human-readable string
const getPriorityLabel = (priority: number | string): string => {
  if (typeof priority === 'string') {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
  return priority === 2 ? 'High' : priority === 1 ? 'Normal' : 'Low';
};

/**
 * Unified Queue Dashboard Component
 * 
 * Displays a dashboard for managing both PDF and crawler queue systems in one place
 */
const QueueDashboard: React.FC = () => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [pdfSourceFilters, setPdfSourceFilters] = useState<string[]>([]);
  const [crawlerSourceFilters, setCrawlerSourceFilters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<{ type: 'retry' | 'cancel', jobId: string, system: 'pdf' | 'crawler' } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Job details dialog state
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    jobId: string;
    system: 'pdf' | 'crawler';
  }>({
    open: false,
    jobId: '',
    system: 'pdf'
  });
  
  // Clear queue dialog state
  const [clearQueueDialog, setClearQueueDialog] = useState<{
    open: boolean;
    system: 'pdf' | 'crawler';
  }>({
    open: false,
    system: 'pdf'
  });
  
  // Clear queue loading and result states
  const [clearQueueLoading, setClearQueueLoading] = useState<boolean>(false);
  const [clearQueueResult, setClearQueueResult] = useState<{
    success: boolean;
    message: string;
    count: number;
  } | null>(null);

  // Filters
  const [filter, setFilter] = useState<{
    queueSystem: QueueSystem;
    status: string;
    source: string;
  }>({
    queueSystem: 'all',
    status: '',
    source: ''
  });

  // Pagination
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Load data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsData, statsData, sourceFiltersData] = await Promise.all([
        getQueueJobs(filter),
        getQueueStats(),
        getSourceFilters()
      ]);
      
      setJobs(jobsData);
      setStats(statsData);
      setSourceFilters(sourceFiltersData.all);
      setPdfSourceFilters(sourceFiltersData.pdf);
      setCrawlerSourceFilters(sourceFiltersData.crawler);
    } catch (err) {
      setError('Failed to load queue data. Please try again.');
      console.error('Error loading queue data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open job details dialog
  const handleOpenDetails = (jobId: string, system: 'pdf' | 'crawler') => {
    setDetailsDialog({
      open: true,
      jobId,
      system
    });
  };
  
  // Close job details dialog
  const handleCloseDetails = () => {
    setDetailsDialog(prev => ({
      ...prev,
      open: false
    }));
  };
  
  // Open clear queue confirmation dialog
  const handleOpenClearQueueDialog = (system: 'pdf' | 'crawler') => {
    setClearQueueDialog({
      open: true,
      system
    });
  };
  
  // Close clear queue confirmation dialog
  const handleCloseClearQueueDialog = () => {
    setClearQueueDialog(prev => ({
      ...prev,
      open: false
    }));
    
    // Clear the result state after a delay
    setTimeout(() => {
      setClearQueueResult(null);
    }, 5000);
  };
  
  // Handle clear queue action
  const handleClearQueue = async () => {
    const { system } = clearQueueDialog;
    
    setClearQueueLoading(true);
    setClearQueueResult(null);
    
    try {
      const result = await clearQueue(system);
      
      setClearQueueResult({
        success: true,
        message: result.message,
        count: result.count
      });
      
      // Refresh data after clearing
      fetchData();
    } catch (err) {
      setClearQueueResult({
        success: false,
        message: `Failed to clear ${system} queue: ${err instanceof Error ? err.message : String(err)}`,
        count: 0
      });
    } finally {
      setClearQueueLoading(false);
    }
  };

  // Real-time updates
  const [isLiveUpdatesEnabled, setIsLiveUpdatesEnabled] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  
  const handleQueueEvent = useCallback((event: any) => {
    // Automatically refresh data when receiving certain events
    if ([QueueEventType.JOB_ADDED, QueueEventType.JOB_COMPLETED, QueueEventType.JOB_FAILED].includes(event.type)) {
      fetchData();
    }
    
    // For progress updates, find and update the specific job in the list
    if (event.type === QueueEventType.JOB_PROGRESS && event.data && event.data.id) {
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === event.data.id 
            ? { ...job, progress: event.data.progress, status: event.data.status } 
            : job
        )
      );
    }
  }, []);
  
  // Initialize Supabase Realtime connection
  useEffect(() => {
    if (isLiveUpdatesEnabled) {
      // Initialize the queue events service
      queueEventsService.initialize().catch(err => {
        console.error('Failed to initialize real-time updates:', err);
        setConnectionStatus('error');
      });
      
      setConnectionStatus('connecting');
      
      // Subscribe to all events from both queues
      const unsubscribe = queueEventsService.subscribe('*', '*', (event) => {
        setConnectionStatus('connected');
        handleQueueEvent(event);
      });
      
      return () => {
        // Clean up subscription
        unsubscribe();
        
        // Close connection when disabled
        if (isLiveUpdatesEnabled) {
          queueEventsService.close().catch(console.error);
        }
      };
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isLiveUpdatesEnabled, handleQueueEvent]);
  
  // Initial data load
  useEffect(() => {
    fetchData();
  }, []);
  
  // Load when filter changes
  useEffect(() => {
    fetchData();
  }, [filter]);

  // Handle filter changes
  const handleFilterChange = (field: keyof typeof filter, value: string) => {
    setFilter(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0); // Reset pagination when filter changes
  };

  // Handle pagination changes
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Toggle real-time updates
  const toggleLiveUpdates = () => {
    const newState = !isLiveUpdatesEnabled;
    setIsLiveUpdatesEnabled(newState);
    
    if (!newState) {
      // Unsubscribe from all events when disabling
      queueEventsService.unsubscribeAll('*', '*');
      setConnectionStatus('disconnected');
    } else {
      // Initialize when enabling
      queueEventsService.initialize().catch(console.error);
    }
  };

  // Handle job actions
  const handleJobAction = async (type: 'retry' | 'cancel', jobId: string, system: 'pdf' | 'crawler') => {
    setAction({ type, jobId, system });
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
      // Refresh data after action
      fetchData();
    } catch (err) {
      setActionError(`Failed to ${type} job: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Clear action state after a delay
      setTimeout(() => {
        setAction(null);
        setActionSuccess(null);
        setActionError(null);
      }, 5000);
    }
  };

  // Handle action complete event from job details dialog
  const handleActionComplete = () => {
    fetchData();
  };

  // Format job creation date
  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Display status chip
  const renderStatusChip = (status: string) => {
    const color = statusColors[status] || 'default';
    const label = statusLabels[status] || status;
    
    return (
      <Chip
        label={label}
        color={color as any}
        size="small"
        variant="outlined"
      />
    );
  };

  // Calculate jobs to display based on pagination
  const displayedJobs = jobs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography variant="h4">
          Queue Management
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearQueueIcon />}
              onClick={() => handleOpenClearQueueDialog('pdf')}
              sx={{ mr: 2 }}
            >
              Clear PDF Queue
            </Button>
            
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearQueueIcon />}
              onClick={() => handleOpenClearQueueDialog('crawler')}
              sx={{ mr: 2 }}
            >
              Clear Crawler Queue
            </Button>
          </Box>
          
          <Button
            variant={isLiveUpdatesEnabled ? "contained" : "outlined"}
            color={isLiveUpdatesEnabled ? "success" : "primary"}
            onClick={toggleLiveUpdates}
            startIcon={<RefreshIcon />}
            sx={{ mr: 2 }}
          >
            {isLiveUpdatesEnabled ? "Live Updates: ON" : "Live Updates: OFF"}
          </Button>
          
          {isLiveUpdatesEnabled && (
            <Chip 
              size="small"
              label={`Status: ${connectionStatus}`}
              color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'warning'}
              sx={{ mr: 2 }}
            />
          )}
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
      {/* Job Details Dialog */}
      <JobDetailsDialog
        open={detailsDialog.open}
        onClose={handleCloseDetails}
        jobId={detailsDialog.jobId}
        system={detailsDialog.system}
        onActionComplete={handleActionComplete}
      />
      
      {/* Clear Queue Confirmation Dialog */}
      <Dialog
        open={clearQueueDialog.open}
        onClose={handleCloseClearQueueDialog}
        aria-labelledby="clear-queue-dialog-title"
      >
        <DialogTitle id="clear-queue-dialog-title">
          Clear {clearQueueDialog.system === 'pdf' ? 'PDF Processing' : 'Web Crawler'} Queue
        </DialogTitle>
        <DialogContent>
          {clearQueueResult ? (
            <Alert 
              severity={clearQueueResult.success ? "success" : "error"}
              sx={{ mb: 2 }}
            >
              {clearQueueResult.message}
              {clearQueueResult.success && clearQueueResult.count > 0 && (
                <Typography variant="body2">
                  Cleared {clearQueueResult.count} jobs from the queue.
                </Typography>
              )}
            </Alert>
          ) : (
            <DialogContentText>
              Are you sure you want to clear all jobs from the {clearQueueDialog.system === 'pdf' ? 'PDF Processing' : 'Web Crawler'} queue?
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                This action will remove all jobs that are not currently in processing state.
              </Typography>
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClearQueueDialog} color="primary">
            {clearQueueResult ? 'Close' : 'Cancel'}
          </Button>
          {!clearQueueResult && (
            <Button 
              onClick={handleClearQueue} 
              color="error" 
              variant="contained"
              disabled={clearQueueLoading}
              startIcon={clearQueueLoading ? <CircularProgress size={18} /> : <DeleteIcon />}
            >
              Clear Queue
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
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
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* PDF Stats */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  PDF Processing Queue
                </Typography>
                <Typography variant="h3">
                  {stats.pdf.total}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {Object.entries(stats.pdf.byStatus).map(([status, count]) => (
                    <Chip
                      key={status}
                      label={`${statusLabels[status] || status}: ${count}`}
                      color={statusColors[status] as any || 'default'}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Crawler Stats */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Web Crawler Queue
                </Typography>
                <Typography variant="h3">
                  {stats.crawler.total}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {Object.entries(stats.crawler.byStatus).map(([status, count]) => (
                    <Chip
                      key={status}
                      label={`${statusLabels[status] || status}: ${count}`}
                      color={statusColors[status] as any || 'default'}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  By Provider:
                </Typography>
                <Box>
                  {Object.entries(stats.crawler.byProvider).map(([provider, count]) => (
                    <Chip
                      key={provider}
                      label={`${provider}: ${count}`}
                      variant="outlined"
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <FilterIcon sx={{ mr: 1 }} /> Filter Jobs
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="queue-system-label">Queue System</InputLabel>
              <Select
                labelId="queue-system-label"
                value={filter.queueSystem}
                label="Queue System"
                onChange={(e: React.ChangeEvent<{ value: unknown }>) => handleFilterChange('queueSystem', e.target.value as QueueSystem)}
              >
                <MenuItem value="all">All Systems</MenuItem>
                <MenuItem value="pdf">PDF Processing</MenuItem>
                <MenuItem value="crawler">Web Crawler</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                value={filter.status}
                label="Status"
                onChange={(e: React.ChangeEvent<{ value: unknown }>) => handleFilterChange('status', e.target.value as string)}
              >
                <MenuItem value="">Any Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="canceled">Canceled</MenuItem>
                <MenuItem value="retrying">Retrying</MenuItem>
                <MenuItem value="training">Training</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="source-label">Source</InputLabel>
              <Select
                labelId="source-label"
                value={filter.source}
                label="Source"
                onChange={(e: React.ChangeEvent<{ value: unknown }>) => handleFilterChange('source', e.target.value as string)}
              >
                <MenuItem value="">Any Source</MenuItem>
                {filter.queueSystem === 'pdf' || filter.queueSystem === 'all' 
                  ? pdfSourceFilters.map(source => (
                      <MenuItem key={`pdf-${source}`} value={source}>
                        PDF: {source}
                      </MenuItem>
                    ))
                  : null
                }
                {filter.queueSystem === 'crawler' || filter.queueSystem === 'all'
                  ? crawlerSourceFilters.map(source => (
                      <MenuItem key={`crawler-${source}`} value={source}>
                        Crawler: {source}
                      </MenuItem>
                    ))
                  : null
                }
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          {!isLiveUpdatesEnabled && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>
          )}
        </Box>
      </Paper>
      
      {/* Jobs Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Queue System</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading queue data...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : displayedJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1">
                      No jobs found matching the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayedJobs.map((job) => (
                  <TableRow 
                    key={job.id}
                    sx={{
                      '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                      backgroundColor: job.error ? 'rgba(255, 0, 0, 0.04)' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Tooltip title={job.id}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 100 }}>
                          {job.id.substring(0, 8)}...
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={queueSystemLabels[job.system as QueueSystem]} 
                        size="small"
                        color={job.system === 'pdf' ? 'primary' : 'secondary'}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={job.config?.url || job.filePath || ''}>
                        <Typography variant="body2">
                          {job.source}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {renderStatusChip(job.status)}
                    </TableCell>
                    <TableCell>
                      {getPriorityLabel(job.priority)}
                    </TableCell>
                    <TableCell>
                      {typeof job.progress === 'number' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={job.createdAt.toLocaleString()}>
                        <Typography variant="body2">
                          {formatDate(new Date(job.createdAt))}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {job.status === 'failed' && (
                          <Tooltip title="Retry Job">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleJobAction('retry', job.id, job.system)}
                              disabled={!!action}
                            >
                              <ReplayIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {(job.status === 'pending' || job.status === 'processing' || job.status === 'running') && (
                          <Tooltip title="Cancel Job">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleJobAction('cancel', job.id, job.system)}
                              disabled={!!action}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        <Tooltip title="Job Details">
                          <IconButton 
                            size="small" 
                            color="info"
                            onClick={() => handleOpenDetails(job.id, job.system)}
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={jobs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Paper>
    </Box>
  );
};

export default QueueDashboard;