import React, { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '../../components/mui';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ZAxis } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import axios from 'axios';

/**
 * Anomaly Detection Component
 * 
 * This component allows users to detect and visualize anomalies
 * in analytics data.
 */
const AnomalyDetection: React.FC = () => {
  // State for form inputs
  const [eventType, setEventType] = useState<string>('');
  const [resourceType, setResourceType] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [interval, setInterval] = useState<string>('day');
  const [threshold, setThreshold] = useState<number>(2.0);
  
  // State for API response
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [anomalyData, setAnomalyData] = useState<any | null>(null);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      setError('Start date and end date are required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/analytics/predictive/anomalies', {
        eventType: eventType || undefined,
        resourceType: resourceType || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval,
        threshold
      });
      
      setAnomalyData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to detect anomalies');
    } finally {
      setLoading(false);
    }
  };
  
  // Prepare chart data
  const prepareChartData = () => {
    if (!anomalyData) return { timeSeriesData: [], anomalyData: [] };
    
    // Format time series data
    const timeSeriesData = anomalyData.timeSeries.map((item: any) => ({
      ...item,
      date: new Date(item.date).getTime(),
      isAnomaly: false
    }));
    
    // Format anomaly data
    const anomalyPoints = anomalyData.anomalies.map((item: any) => ({
      ...item,
      date: new Date(item.date).getTime(),
      isAnomaly: true
    }));
    
    return { timeSeriesData, anomalyPoints };
  };
  
  // Format date for chart tooltip
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM dd, yyyy');
  };
  
  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#f44336';
      case 'medium':
        return '#ff9800';
      case 'low':
        return '#2196f3';
      default:
        return '#757575';
    }
  };
  
  // Prepare data for chart
  const { timeSeriesData, anomalyPoints } = prepareChartData();
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Anomaly Detection
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="event-type-label">Event Type</InputLabel>
                  <Select
                    labelId="event-type-label"
                    value={eventType}
                    label="Event Type"
                    onChange={(e) => setEventType(e.target.value)}
                  >
                    <MenuItem value="">All Events</MenuItem>
                    <MenuItem value="search">Search</MenuItem>
                    <MenuItem value="view">View</MenuItem>
                    <MenuItem value="download">Download</MenuItem>
                    <MenuItem value="agent_prompt">Agent Prompt</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="resource-type-label">Resource Type</InputLabel>
                  <Select
                    labelId="resource-type-label"
                    value={resourceType}
                    label="Resource Type"
                    onChange={(e) => setResourceType(e.target.value)}
                  >
                    <MenuItem value="">All Resources</MenuItem>
                    <MenuItem value="material">Material</MenuItem>
                    <MenuItem value="catalog">Catalog</MenuItem>
                    <MenuItem value="collection">Collection</MenuItem>
                    <MenuItem value="model">Model</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="interval-label">Interval</InputLabel>
                  <Select
                    labelId="interval-label"
                    value={interval}
                    label="Interval"
                    onChange={(e) => setInterval(e.target.value)}
                  >
                    <MenuItem value="hour">Hour</MenuItem>
                    <MenuItem value="day">Day</MenuItem>
                    <MenuItem value="week">Week</MenuItem>
                    <MenuItem value="month">Month</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  margin="normal"
                  label="Threshold (Standard Deviations)"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  inputProps={{ min: 1, max: 5, step: 0.1 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Detect Anomalies'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
          
          {anomalyData && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Anomaly Detection Results
              </Typography>
              
              <Box sx={{ mt: 2, mb: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Mean: {anomalyData.statistics.mean.toFixed(2)} • 
                  Standard Deviation: {anomalyData.statistics.stdDev.toFixed(2)} • 
                  Threshold: {anomalyData.statistics.threshold.toFixed(1)} standard deviations
                </Typography>
              </Box>
              
              <Box height={400}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid />
                    <XAxis 
                      type="number" 
                      dataKey="date" 
                      name="Date" 
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatDate}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="count" 
                      name="Count" 
                    />
                    <ZAxis range={[60, 60]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: any, name: string) => [value, name === 'date' ? 'Date' : 'Count']}
                      labelFormatter={(value) => formatDate(value)}
                    />
                    <Legend />
                    
                    {/* Reference line for mean */}
                    <ReferenceLine 
                      y={anomalyData.statistics.mean} 
                      stroke="#8884d8" 
                      strokeDasharray="3 3"
                      label={{ value: 'Mean', position: 'insideBottomRight' }}
                    />
                    
                    {/* Reference lines for threshold */}
                    <ReferenceLine 
                      y={anomalyData.statistics.mean + anomalyData.statistics.stdDev * anomalyData.statistics.threshold} 
                      stroke="#ff7300" 
                      strokeDasharray="3 3"
                      label={{ value: 'Upper Threshold', position: 'insideTopRight' }}
                    />
                    <ReferenceLine 
                      y={anomalyData.statistics.mean - anomalyData.statistics.stdDev * anomalyData.statistics.threshold} 
                      stroke="#ff7300" 
                      strokeDasharray="3 3"
                      label={{ value: 'Lower Threshold', position: 'insideBottomRight' }}
                    />
                    
                    {/* Normal data points */}
                    <Scatter 
                      name="Normal Data" 
                      data={timeSeriesData} 
                      fill="#8884d8"
                    />
                    
                    {/* Anomaly data points */}
                    <Scatter 
                      name="Anomalies" 
                      data={anomalyPoints} 
                      fill="#ff7300"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </Box>
              
              {anomalyData.anomalies.length > 0 ? (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Detected Anomalies
                  </Typography>
                  
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Count</TableCell>
                          <TableCell>Expected (Mean)</TableCell>
                          <TableCell>Z-Score</TableCell>
                          <TableCell>Severity</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {anomalyData.anomalies.map((anomaly: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{format(parseISO(anomaly.date), 'MMM dd, yyyy')}</TableCell>
                            <TableCell>{anomaly.count}</TableCell>
                            <TableCell>{anomaly.mean.toFixed(2)}</TableCell>
                            <TableCell>{anomaly.zScore.toFixed(2)}</TableCell>
                            <TableCell>
                              <Chip 
                                label={anomaly.severity.toUpperCase()} 
                                size="small"
                                sx={{ 
                                  backgroundColor: getSeverityColor(anomaly.severity),
                                  color: 'white'
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mt: 4 }}>
                  No anomalies detected with the current threshold.
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default AnomalyDetection;
