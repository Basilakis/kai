import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { materialPropertyAnalyticsService, PropertyTrendResult } from '../../services/materialPropertyAnalyticsService';

interface PropertyTrendsChartProps {
  property: string;
  materialType?: string;
  timeUnit?: 'day' | 'week' | 'month' | 'year';
  chartType?: 'line' | 'area';
}

const PropertyTrendsChart: React.FC<PropertyTrendsChartProps> = ({
  property,
  materialType,
  timeUnit = 'month',
  chartType = 'line'
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<PropertyTrendResult | null>(null);
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<'day' | 'week' | 'month' | 'year'>(timeUnit);
  const [selectedChartType, setSelectedChartType] = useState<'line' | 'area'>(chartType);
  
  useEffect(() => {
    if (property) {
      loadTrends();
    }
  }, [property, materialType, selectedTimeUnit]);
  
  const loadTrends = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await materialPropertyAnalyticsService.getPropertyTrends(
        property,
        selectedTimeUnit,
        materialType
      );
      
      setTrends(result);
    } catch (error) {
      console.error('Error loading property trends:', error);
      setError('Failed to load property trends. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleTimeUnitChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedTimeUnit(event.target.value as 'day' | 'week' | 'month' | 'year');
  };
  
  const handleChartTypeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedChartType(event.target.value as 'line' | 'area');
  };
  
  const formatDate = (date: string) => {
    const d = new Date(date);
    
    switch (selectedTimeUnit) {
      case 'day':
        return d.toLocaleDateString();
      case 'week':
        return `Week of ${d.toLocaleDateString()}`;
      case 'month':
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
      case 'year':
        return d.getFullYear().toString();
      default:
        return date;
    }
  };
  
  const renderLineChart = () => {
    if (!trends || trends.trends.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No trend data available for this property.
          </Typography>
        </Box>
      );
    }
    
    // Prepare data for line chart
    const data = trends.trends.map(item => ({
      date: item.date,
      value: typeof item.value === 'number' ? item.value : 0,
      count: item.count
    }));
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            label={{ value: 'Date', position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            stroke="#8884d8"
            label={{ value: typeof trends.trends[0]?.value === 'number' ? 'Value' : 'Count', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#82ca9d"
            label={{ value: 'Count', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            labelFormatter={formatDate}
            formatter={(value, name) => [value, name === 'value' ? 'Value' : 'Count']}
          />
          <Legend />
          {typeof trends.trends[0]?.value === 'number' && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
              name="Value"
            />
          )}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="count"
            stroke="#82ca9d"
            name="Count"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };
  
  const renderAreaChart = () => {
    if (!trends || trends.trends.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No trend data available for this property.
          </Typography>
        </Box>
      );
    }
    
    // Prepare data for area chart
    const data = trends.trends.map(item => ({
      date: item.date,
      value: typeof item.value === 'number' ? item.value : 0,
      count: item.count
    }));
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            label={{ value: 'Date', position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            stroke="#8884d8"
            label={{ value: typeof trends.trends[0]?.value === 'number' ? 'Value' : 'Count', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#82ca9d"
            label={{ value: 'Count', angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            labelFormatter={formatDate}
            formatter={(value, name) => [value, name === 'value' ? 'Value' : 'Count']}
          />
          <Legend />
          {typeof trends.trends[0]?.value === 'number' && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.3}
              name="Value"
            />
          )}
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="count"
            stroke="#82ca9d"
            fill="#82ca9d"
            fillOpacity={0.3}
            name="Count"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading property trends...
        </Typography>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }
  
  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">
            Trends of {property}
          </Typography>
          {materialType && (
            <Chip
              label={`Material Type: ${materialType}`}
              size="small"
              color="primary"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="time-unit-label">Time Unit</InputLabel>
            <Select
              labelId="time-unit-label"
              value={selectedTimeUnit}
              onChange={handleTimeUnitChange}
              label="Time Unit"
            >
              <MenuItem value="day">Daily</MenuItem>
              <MenuItem value="week">Weekly</MenuItem>
              <MenuItem value="month">Monthly</MenuItem>
              <MenuItem value="year">Yearly</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="chart-type-label">Chart Type</InputLabel>
            <Select
              labelId="chart-type-label"
              value={selectedChartType}
              onChange={handleChartTypeChange}
              label="Chart Type"
            >
              <MenuItem value="line">Line Chart</MenuItem>
              <MenuItem value="area">Area Chart</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>
      
      <Paper sx={{ p: 3 }}>
        {selectedChartType === 'line' ? renderLineChart() : renderAreaChart()}
      </Paper>
    </Box>
  );
};

export default PropertyTrendsChart;
