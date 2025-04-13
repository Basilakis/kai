import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button
} from '../../components/mui';
import type { SelectChangeEvent } from '@mui/material';
// Import custom LineChart component
import LineChart from '../charts/LineChart';

// Removed placeholder LineChart component

interface MetricsVisualizerProps {
  metricsData: Array<{
    timestamp: number;
    loss?: number;
    accuracy?: number;
    progress?: number;
    [key: string]: any;
  }>;
  jobId: string;
}

/**
 * MetricsVisualizer Component
 *
 * Displays training metrics in interactive charts.
 */
const MetricsVisualizer: React.FC<MetricsVisualizerProps> = ({ metricsData, jobId }) => {
  const [timeRange, setTimeRange] = useState<string>('all');
  const [metrics, setMetrics] = useState<string[]>(['loss', 'accuracy']);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

   // Filter metrics data based on selected time range
   const getFilteredData = () => {
    if (timeRange === 'all') {
      return metricsData;
    }

    const now = Date.now();
    const rangeMs = parseInt(timeRange) * 60 * 1000; // Convert minutes to ms
    return metricsData.filter(point => (now - point.timestamp) < rangeMs);
  };

  const filteredData = getFilteredData();

  // Handle time range change
  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value);
  };

  // Handle metric selection change
  const handleMetricChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    setMetrics(typeof value === 'string' ? value.split(',') : value);
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  // Download metrics data as CSV
  const downloadMetricsCSV = () => {
    // Create CSV content
    const headers = ['timestamp', ...Object.keys(metricsData[0] || {})].filter(h => h !== '__typename');
    const rows = metricsData.map(point => {
      return headers.map(header => {
        if (header === 'timestamp') {
          return new Date(point.timestamp).toISOString();
        }
        return point[header] !== undefined ? point[header] : '';
      }).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `training-metrics-${jobId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box>
      {/* Controls for metric visualization */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="time-range-label">Time Range</InputLabel>
              <Select
                labelId="time-range-label"
                id="time-range-select"
                value={timeRange}
                label="Time Range"
                onChange={handleTimeRangeChange}
              >
                <MenuItem value="all">All Data</MenuItem>
                <MenuItem value="5">Last 5 Minutes</MenuItem>
                <MenuItem value="15">Last 15 Minutes</MenuItem>
                <MenuItem value="30">Last 30 Minutes</MenuItem>
                <MenuItem value="60">Last Hour</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="metrics-label">Metrics</InputLabel>
              <Select
                labelId="metrics-label"
                id="metrics-select"
                multiple
                value={metrics}
                label="Metrics"
                onChange={handleMetricChange}
                renderValue={(selected: string[]) => selected.join(', ')}
              >
                <MenuItem value="loss">Loss</MenuItem>
                <MenuItem value="accuracy">Accuracy</MenuItem>
                <MenuItem value="progress">Progress</MenuItem>
                <MenuItem value="learning_rate">Learning Rate</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color={autoRefresh ? 'primary' : 'inherit'}
                onClick={toggleAutoRefresh}
                sx={{ mr: 1 }}
              >
                {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
              </Button>

              <Button
                variant="outlined"
                onClick={downloadMetricsCSV}
                disabled={metricsData.length === 0}
              >
                Export CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Metrics charts */}
      <Grid container spacing={3}>
        {metrics.includes('loss') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Loss
                </Typography>
                <LineChart
                  data={filteredData}
                  xKey="timestamp"
                  yKey="loss"
                  color="#f44336"
                />
              </CardContent>
            </Card>
          </Grid>
        )}

        {metrics.includes('accuracy') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Accuracy
                </Typography>
                <LineChart
                  data={filteredData}
                  xKey="timestamp"
                  yKey="accuracy"
                  color="#4caf50"
                />
              </CardContent>
            </Card>
          </Grid>
        )}

        {metrics.includes('progress') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Progress
                </Typography>
                <LineChart
                  data={filteredData}
                  xKey="timestamp"
                  yKey="progress"
                  color="#2196f3"
                />
              </CardContent>
            </Card>
          </Grid>
        )}

        {metrics.includes('learning_rate') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Learning Rate
                </Typography>
                <LineChart
                  data={filteredData}
                  xKey="timestamp"
                  yKey="learning_rate"
                  color="#9c27b0"
                />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Show message if no metrics selected */}
      {metrics.length === 0 && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Please select at least one metric to display.
          </Typography>
        </Box>
      )}

      {/* Show message if no data available */}
      {metricsData.length === 0 && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No metrics data available for this job yet.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MetricsVisualizer;