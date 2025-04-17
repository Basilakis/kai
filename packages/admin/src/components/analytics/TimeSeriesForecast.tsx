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
  Grid
} from '../../components/mui';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import axios from 'axios';

/**
 * Time-Series Forecast Component
 * 
 * This component allows users to generate and visualize time-series forecasts
 * for analytics data.
 */
const TimeSeriesForecast: React.FC = () => {
  // State for form inputs
  const [eventType, setEventType] = useState<string>('');
  const [resourceType, setResourceType] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [forecastPeriods, setForecastPeriods] = useState<number>(7);
  const [interval, setInterval] = useState<string>('day');
  
  // State for API response
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<any | null>(null);
  
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
      const response = await axios.post('/api/analytics/predictive/forecast', {
        eventType: eventType || undefined,
        resourceType: resourceType || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        forecastPeriods,
        interval
      });
      
      setForecastData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate forecast');
    } finally {
      setLoading(false);
    }
  };
  
  // Prepare chart data
  const prepareChartData = () => {
    if (!forecastData) return [];
    
    // Combine historical and forecast data
    const historicalData = forecastData.historical.map((item: any) => ({
      ...item,
      date: new Date(item.date).getTime(),
      type: 'historical'
    }));
    
    const forecastDataPoints = forecastData.forecast.map((item: any) => ({
      ...item,
      date: new Date(item.date).getTime(),
      type: 'forecast'
    }));
    
    return [...historicalData, ...forecastDataPoints];
  };
  
  // Format date for chart tooltip
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM dd, yyyy');
  };
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Time-Series Forecast
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
                <TextField
                  fullWidth
                  margin="normal"
                  label="Forecast Periods"
                  type="number"
                  value={forecastPeriods}
                  onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 30 }}
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
              
              <Grid item xs={12}>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Generate Forecast'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
          
          {forecastData && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Forecast Results
              </Typography>
              
              <Box sx={{ mt: 2, mb: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Model: {forecastData.modelInfo.name} v{forecastData.modelInfo.version}
                  {forecastData.modelInfo.accuracy && ` • Accuracy: ${(forecastData.modelInfo.accuracy * 100).toFixed(1)}%`}
                  {forecastData.modelInfo.confidence && ` • Confidence: ${(forecastData.modelInfo.confidence * 100).toFixed(1)}%`}
                </Typography>
              </Box>
              
              <Box height={400}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prepareChartData()}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatDate}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={formatDate}
                      formatter={(value: any, name: string) => [value, name === 'count' ? 'Events' : name]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={{ strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                      name="Historical"
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ strokeWidth: 2 }}
                      name="Forecast"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default TimeSeriesForecast;
