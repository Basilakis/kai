import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  LinearProgress, 
  Button, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Divider,
  Tooltip
} from '@mui/material';
import { 
  PlayArrow as PlayIcon, 
  Stop as StopIcon, 
  Save as SaveIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

// Mock data for training jobs
const mockTrainingJobs = [
  {
    id: 'job-001',
    name: 'Material Classifier v2.1',
    status: 'running',
    progress: 67,
    startTime: new Date(Date.now() - 3600000 * 5), // 5 hours ago
    estimatedCompletion: new Date(Date.now() + 3600000 * 2.5), // 2.5 hours from now
    epochs: { current: 34, total: 50 },
    metrics: {
      train_loss: 0.0823,
      train_accuracy: 0.9245,
      val_loss: 0.1245,
      val_accuracy: 0.8934
    },
    gpu: 'Tesla V100',
    batchSize: 64,
    learningRate: 0.001,
    dataset: 'materials-dataset-v3',
    checkpoints: [
      { epoch: 10, accuracy: 0.8245, saved: true },
      { epoch: 20, accuracy: 0.8634, saved: true },
      { epoch: 30, accuracy: 0.8823, saved: true }
    ],
    historyData: Array.from({ length: 34 }, (_, i) => ({
      epoch: i + 1,
      train_loss: 0.5 * Math.exp(-0.05 * (i + 1)) + 0.05 + Math.random() * 0.02,
      val_loss: 0.5 * Math.exp(-0.04 * (i + 1)) + 0.08 + Math.random() * 0.03,
      train_accuracy: 0.6 + 0.3 * (1 - Math.exp(-0.08 * (i + 1))) + Math.random() * 0.02,
      val_accuracy: 0.6 + 0.28 * (1 - Math.exp(-0.07 * (i + 1))) + Math.random() * 0.03
    }))
  },
  {
    id: 'job-002',
    name: 'Text Embedding Model',
    status: 'running',
    progress: 32,
    startTime: new Date(Date.now() - 3600000 * 2), // 2 hours ago
    estimatedCompletion: new Date(Date.now() + 3600000 * 4.5), // 4.5 hours from now
    epochs: { current: 16, total: 50 },
    metrics: {
      train_loss: 0.1245,
      train_accuracy: 0.8756,
      val_loss: 0.1567,
      val_accuracy: 0.8523
    },
    gpu: 'RTX 3090',
    batchSize: 32,
    learningRate: 0.0005,
    dataset: 'text-corpus-2023',
    checkpoints: [
      { epoch: 5, accuracy: 0.7845, saved: true },
      { epoch: 10, accuracy: 0.8234, saved: true },
      { epoch: 15, accuracy: 0.8523, saved: true }
    ],
    historyData: Array.from({ length: 16 }, (_, i) => ({
      epoch: i + 1,
      train_loss: 0.6 * Math.exp(-0.06 * (i + 1)) + 0.1 + Math.random() * 0.02,
      val_loss: 0.6 * Math.exp(-0.05 * (i + 1)) + 0.15 + Math.random() * 0.03,
      train_accuracy: 0.5 + 0.35 * (1 - Math.exp(-0.1 * (i + 1))) + Math.random() * 0.02,
      val_accuracy: 0.5 + 0.32 * (1 - Math.exp(-0.09 * (i + 1))) + Math.random() * 0.03
    }))
  },
  {
    id: 'job-003',
    name: '3D Model Generator',
    status: 'queued',
    progress: 0,
    startTime: null,
    estimatedCompletion: null,
    epochs: { current: 0, total: 100 },
    metrics: {
      train_loss: null,
      train_accuracy: null,
      val_loss: null,
      val_accuracy: null
    },
    gpu: 'Pending',
    batchSize: 16,
    learningRate: 0.0002,
    dataset: '3d-models-dataset',
    checkpoints: [],
    historyData: []
  }
];

// Format date for display
const formatDate = (date: Date | null) => {
  if (!date) return 'N/A';
  return date.toLocaleString();
};

// Format time remaining
const formatTimeRemaining = (date: Date | null) => {
  if (!date) return 'N/A';
  
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Completed';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${diffHours}h ${diffMinutes}m`;
};

// Training Progress Panel Component
const TrainingProgressPanel: React.FC = () => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('accuracy');

  // Toggle job expansion
  const toggleJobExpansion = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Training Jobs
        </Typography>
        <Button variant="contained" color="primary">
          New Training Job
        </Button>
      </Box>

      {/* Training Jobs List */}
      <TableContainer component={Paper}>
        <Table aria-label="training jobs table">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Job Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Time Remaining</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockTrainingJobs.map((job) => (
              <React.Fragment key={job.id}>
                <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                  <TableCell>
                    <IconButton
                      aria-label="expand row"
                      size="small"
                      onClick={() => toggleJobExpansion(job.id)}
                    >
                      {expandedJob === job.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    {job.name}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={job.status} 
                      color={
                        job.status === 'running' ? 'success' : 
                        job.status === 'queued' ? 'warning' : 
                        'default'
                      } 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={job.progress} 
                          sx={{ height: 10, borderRadius: 5 }}
                        />
                      </Box>
                      <Box sx={{ minWidth: 35 }}>
                        <Typography variant="body2" color="text.secondary">
                          {`${Math.round(job.progress)}%`}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{formatDate(job.startTime)}</TableCell>
                  <TableCell>{formatTimeRemaining(job.estimatedCompletion)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {job.status === 'running' ? (
                        <Tooltip title="Stop Training">
                          <IconButton size="small" color="error">
                            <StopIcon />
                          </IconButton>
                        </Tooltip>
                      ) : job.status === 'queued' ? (
                        <Tooltip title="Start Training">
                          <IconButton size="small" color="success">
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      
                      {job.status === 'running' && (
                        <Tooltip title="Save Checkpoint">
                          <IconButton size="small" color="primary">
                            <SaveIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
                
                {/* Expanded details */}
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={expandedJob === job.id} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 2 }}>
                        <Grid container spacing={3}>
                          {/* Training metrics */}
                          <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom component="div">
                              Training Metrics
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                              <Button 
                                variant={selectedMetric === 'accuracy' ? 'contained' : 'outlined'} 
                                size="small" 
                                onClick={() => setSelectedMetric('accuracy')}
                                sx={{ mr: 1 }}
                              >
                                Accuracy
                              </Button>
                              <Button 
                                variant={selectedMetric === 'loss' ? 'contained' : 'outlined'} 
                                size="small" 
                                onClick={() => setSelectedMetric('loss')}
                              >
                                Loss
                              </Button>
                            </Box>
                            
                            {job.historyData.length > 0 ? (
                              <ResponsiveContainer width="100%" height={300}>
                                <LineChart
                                  data={job.historyData}
                                  margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                  }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="epoch" />
                                  <YAxis />
                                  <RechartsTooltip />
                                  <Legend />
                                  {selectedMetric === 'accuracy' ? (
                                    <>
                                      <Line 
                                        type="monotone" 
                                        dataKey="train_accuracy" 
                                        name="Training Accuracy" 
                                        stroke="#8884d8" 
                                        activeDot={{ r: 8 }} 
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="val_accuracy" 
                                        name="Validation Accuracy" 
                                        stroke="#82ca9d" 
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <Line 
                                        type="monotone" 
                                        dataKey="train_loss" 
                                        name="Training Loss" 
                                        stroke="#ff7300" 
                                        activeDot={{ r: 8 }} 
                                      />
                                      <Line 
                                        type="monotone" 
                                        dataKey="val_loss" 
                                        name="Validation Loss" 
                                        stroke="#387908" 
                                      />
                                    </>
                                  )}
                                </LineChart>
                              </ResponsiveContainer>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No training data available yet.
                              </Typography>
                            )}
                          </Grid>
                          
                          {/* Job details and checkpoints */}
                          <Grid item xs={12} md={6}>
                            <Typography variant="h6" gutterBottom component="div">
                              Job Details
                            </Typography>
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableBody>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Dataset</TableCell>
                                    <TableCell>{job.dataset}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">GPU</TableCell>
                                    <TableCell>{job.gpu}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Batch Size</TableCell>
                                    <TableCell>{job.batchSize}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Learning Rate</TableCell>
                                    <TableCell>{job.learningRate}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Current Epoch</TableCell>
                                    <TableCell>{job.epochs.current} / {job.epochs.total}</TableCell>
                                  </TableRow>
                                  {job.metrics.train_loss !== null && (
                                    <TableRow>
                                      <TableCell component="th" scope="row">Current Loss</TableCell>
                                      <TableCell>{job.metrics.train_loss.toFixed(4)} (train) / {job.metrics.val_loss?.toFixed(4) || 'N/A'} (val)</TableCell>
                                    </TableRow>
                                  )}
                                  {job.metrics.train_accuracy !== null && (
                                    <TableRow>
                                      <TableCell component="th" scope="row">Current Accuracy</TableCell>
                                      <TableCell>{(job.metrics.train_accuracy * 100).toFixed(2)}% (train) / {(job.metrics.val_accuracy * 100).toFixed(2)}% (val)</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            
                            <Divider sx={{ my: 2 }} />
                            
                            <Typography variant="h6" gutterBottom component="div">
                              Checkpoints
                            </Typography>
                            {job.checkpoints.length > 0 ? (
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Epoch</TableCell>
                                      <TableCell>Accuracy</TableCell>
                                      <TableCell>Actions</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {job.checkpoints.map((checkpoint, index) => (
                                      <TableRow key={index}>
                                        <TableCell>{checkpoint.epoch}</TableCell>
                                        <TableCell>{(checkpoint.accuracy * 100).toFixed(2)}%</TableCell>
                                        <TableCell>
                                          <IconButton size="small" color="primary">
                                            <ViewIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton size="small" color="primary">
                                            <DownloadIcon fontSize="small" />
                                          </IconButton>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No checkpoints saved yet.
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TrainingProgressPanel;
