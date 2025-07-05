// packages/admin/src/pages/huggingface-training/jobs.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { HfTrainingJob, HfTrainingJobStatus } from '../../../../shared/src/types/huggingface';
import { hfTrainingJobService } from '../../services/hfTrainingJobService';

const getStatusChipColor = (status: HfTrainingJobStatus) => {
  switch (status) {
    case HfTrainingJobStatus.COMPLETED:
      return 'success';
    case HfTrainingJobStatus.FAILED:
    case HfTrainingJobStatus.CANCELLED:
      return 'error';
    case HfTrainingJobStatus.TRAINING:
      return 'primary';
    case HfTrainingJobStatus.PENDING:
      return 'warning';
    default:
      return 'default';
  }
};

const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<HfTrainingJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hfTrainingJobService.getJobs();
      setJobs(data);
    } catch (err) {
      setError('Failed to fetch training jobs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Training Jobs</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mr: 1 }}
            // onClick={() => /* Open new job dialog */}
          >
            New Job
          </Button>
          <IconButton onClick={fetchJobs} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      
      {!loading && !error && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job: HfTrainingJob) => (
                <TableRow key={job.id}>
                  <TableCell>{job.job_name}</TableCell>
                  <TableCell>
                    <Chip label={job.status} color={getStatusChipColor(job.status)} size="small" />
                  </TableCell>
                  <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {/* Action buttons go here */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default JobsPage;