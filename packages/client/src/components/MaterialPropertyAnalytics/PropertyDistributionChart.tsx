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
  Grid,
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { materialPropertyAnalyticsService, PropertyDistributionResult } from '../../services/materialPropertyAnalyticsService';

interface PropertyDistributionChartProps {
  property: string;
  materialType?: string;
  chartType?: 'bar' | 'pie';
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

const PropertyDistributionChart: React.FC<PropertyDistributionChartProps> = ({
  property,
  materialType,
  chartType = 'bar'
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<PropertyDistributionResult | null>(null);
  const [selectedChartType, setSelectedChartType] = useState<'bar' | 'pie'>(chartType);
  
  useEffect(() => {
    if (property) {
      loadDistribution();
    }
  }, [property, materialType]);
  
  const loadDistribution = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await materialPropertyAnalyticsService.getPropertyDistribution(
        property,
        materialType
      );
      
      setDistribution(result);
    } catch (error) {
      console.error('Error loading property distribution:', error);
      setError('Failed to load property distribution. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChartTypeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedChartType(event.target.value as 'bar' | 'pie');
  };
  
  const formatValue = (value: string | number) => {
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, {
        maximumFractionDigits: 2
      });
    }
    
    return value;
  };
  
  const renderBarChart = () => {
    if (!distribution || distribution.distribution.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No data available for this property.
          </Typography>
        </Box>
      );
    }
    
    // Prepare data for bar chart
    const data = distribution.distribution.map(item => ({
      name: formatValue(item.value),
      count: item.count,
      percentage: Math.round(item.percentage * 100)
    }));
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={70}
            interval={0}
          />
          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Percentage (%)', angle: 90, position: 'insideRight' }} />
          <Tooltip
            formatter={(value, name) => [value, name === 'count' ? 'Count' : 'Percentage (%)']}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
          <Bar yAxisId="right" dataKey="percentage" fill="#82ca9d" name="Percentage (%)" />
        </BarChart>
      </ResponsiveContainer>
    );
  };
  
  const renderPieChart = () => {
    if (!distribution || distribution.distribution.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No data available for this property.
          </Typography>
        </Box>
      );
    }
    
    // Prepare data for pie chart
    const data = distribution.distribution.map(item => ({
      name: formatValue(item.value),
      value: item.count
    }));
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            outerRadius={150}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => [value, props.payload.name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };
  
  const renderStatistics = () => {
    if (!distribution || !distribution.statistics) {
      return null;
    }
    
    const { statistics } = distribution;
    
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Statistics
          </Typography>
          <Grid container spacing={2}>
            {statistics.min !== undefined && (
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Minimum
                </Typography>
                <Typography variant="body1">
                  {formatValue(statistics.min)}
                </Typography>
              </Grid>
            )}
            {statistics.max !== undefined && (
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Maximum
                </Typography>
                <Typography variant="body1">
                  {formatValue(statistics.max)}
                </Typography>
              </Grid>
            )}
            {statistics.mean !== undefined && (
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Mean
                </Typography>
                <Typography variant="body1">
                  {formatValue(statistics.mean)}
                </Typography>
              </Grid>
            )}
            {statistics.median !== undefined && (
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Median
                </Typography>
                <Typography variant="body1">
                  {formatValue(statistics.median)}
                </Typography>
              </Grid>
            )}
            {statistics.mode !== undefined && (
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Mode
                </Typography>
                <Typography variant="body1">
                  {formatValue(statistics.mode)}
                </Typography>
              </Grid>
            )}
            {statistics.stdDev !== undefined && (
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Std. Deviation
                </Typography>
                <Typography variant="body1">
                  {formatValue(statistics.stdDev)}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading property distribution...
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
            Distribution of {property}
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
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="chart-type-label">Chart Type</InputLabel>
          <Select
            labelId="chart-type-label"
            value={selectedChartType}
            onChange={handleChartTypeChange}
            label="Chart Type"
          >
            <MenuItem value="bar">Bar Chart</MenuItem>
            <MenuItem value="pie">Pie Chart</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      <Paper sx={{ p: 3 }}>
        {selectedChartType === 'bar' ? renderBarChart() : renderPieChart()}
      </Paper>
      
      {renderStatistics()}
    </Box>
  );
};

export default PropertyDistributionChart;
