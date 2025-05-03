import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Tooltip
} from '@mui/material';
import dependencyService from '../../services/dependencyService';

/**
 * Dependency Updates Panel Component
 *
 * Displays the status of dependency updates for the Deployment Dashboard.
 * Shows pending PRs, recently updated packages, and current dependency scan status.
 */
export default function DependencyUpdatesPanel() {
  const [loading, setLoading] = React.useState(true);
  const [updateStatus, setUpdateStatus] = React.useState<{
    pendingPRs: Array<{id: string, title: string, url: string, status: string, type: string}>;
    recentUpdates: Array<{name: string, from: string, to: string, date: string, type: string}>;
    lastScanDate: Date | null;
    scanStatus: 'idle' | 'running' | 'completed' | 'failed';
  }>({
    pendingPRs: [],
    recentUpdates: [],
    lastScanDate: null,
    scanStatus: 'idle'
  });
  const [error, setError] = React.useState<string | null>(null);

  // Function to load dependency update data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get dependency update status from the service
      const scanStatus = await dependencyService.getScanStatus();

      // Get pending PRs and recent updates
      const pendingPRs = await dependencyService.getPendingPRs?.() || [];
      const recentUpdates = await dependencyService.getRecentUpdates?.() || [];

      // Transform to expected format
      const status = {
        pendingPRs,
        recentUpdates,
        lastScanDate: scanStatus.lastRun || null,
        scanStatus: scanStatus.status || 'idle'
      };

      setUpdateStatus(status);
    } catch (err) {
      console.error('Error loading dependency update status:', err);
      setError('Failed to load dependency update status');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  React.useEffect(() => {
    loadData();
  }, []);

  // Function to trigger a dependency scan
  const handleTriggerScan = async () => {
    try {
      setLoading(true);
      await dependencyService.triggerDependencyScan();
      await loadData(); // Refresh data after triggering scan
    } catch (err) {
      console.error('Error triggering dependency scan:', err);
      setError('Failed to trigger dependency scan');
    } finally {
      setLoading(false);
    }
  };

  // Function to render status chip
  const renderStatusChip = (status: string) => {
    switch (status) {
      case 'open':
        return <Chip label="Open" color="primary" size="small" />;
      case 'merged':
        return <Chip label="Merged" color="success" size="small" />;
      case 'closed':
        return <Chip label="Closed" color="error" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Function to render update type chip
  const renderTypeChip = (type: string) => {
    switch (type) {
      case 'safe':
        return <Chip label="Safe" color="success" size="small" />;
      case 'caution':
        return <Chip label="Caution" color="warning" size="small" />;
      case 'major':
        return <Chip label="Major" color="error" size="small" />;
      default:
        return <Chip label={type} size="small" />;
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h3">
          Dependency Updates
        </Typography>
        <Box>
          {updateStatus.scanStatus === 'running' ? (
            <Button
              variant="outlined"
              disabled
              startIcon={<CircularProgress size={16} />}
            >
              Scan in Progress
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={handleTriggerScan}
              disabled={loading}
            >
              Trigger Scan
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Last scan: {updateStatus.lastScanDate
            ? new Date(updateStatus.lastScanDate).toLocaleString()
            : 'Never'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Status: {updateStatus.scanStatus === 'completed'
            ? 'Completed'
            : updateStatus.scanStatus === 'running'
            ? 'Running'
            : updateStatus.scanStatus === 'failed'
            ? 'Failed'
            : 'Idle'}
        </Typography>
      </Box>

      {/* Pending PRs */}
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium' }}>
        Pending Update PRs
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress size={24} />
        </Box>
      ) : updateStatus.pendingPRs.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          No pending dependency update PRs
        </Typography>
      ) : (
        <TableContainer sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PR</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {updateStatus.pendingPRs.map((pr: {id: string, title: string, url: string, status: string, type: string}) => (
                <TableRow key={pr.id} hover>
                  <TableCell>
                    <Tooltip title={pr.title}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {pr.title}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{renderTypeChip(pr.type)}</TableCell>
                  <TableCell>{renderStatusChip(pr.status)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Recent Updates */}
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium' }}>
        Recent Updates
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress size={24} />
        </Box>
      ) : updateStatus.recentUpdates.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No recent dependency updates
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Version Change</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {updateStatus.recentUpdates.map((update: {name: string, from: string, to: string, date: string, type: string}, index: number) => (
                <TableRow key={index} hover>
                  <TableCell>{update.name}</TableCell>
                  <TableCell>
                    {update.from} → {update.to}
                  </TableCell>
                  <TableCell>{renderTypeChip(update.type)}</TableCell>
                  <TableCell>{update.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}