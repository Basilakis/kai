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
  Chip,
  Card,
  CardContent
} from '@mui/material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis
} from 'recharts';
import { materialPropertyAnalyticsService, PropertyCorrelationResult } from '../../services/materialPropertyAnalyticsService';

interface PropertyCorrelationChartProps {
  property1: string;
  property2: string;
  materialType?: string;
}

const PropertyCorrelationChart: React.FC<PropertyCorrelationChartProps> = ({
  property1,
  property2,
  materialType
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [correlation, setCorrelation] = useState<PropertyCorrelationResult | null>(null);
  
  useEffect(() => {
    if (property1 && property2) {
      loadCorrelation();
    }
  }, [property1, property2, materialType]);
  
  const loadCorrelation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await materialPropertyAnalyticsService.getPropertyCorrelation(
        property1,
        property2,
        materialType
      );
      
      setCorrelation(result);
    } catch (error) {
      console.error('Error loading property correlation:', error);
      setError('Failed to load property correlation. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const getCorrelationStrength = (coefficient: number): string => {
    const absCoefficient = Math.abs(coefficient);
    
    if (absCoefficient >= 0.8) {
      return coefficient >= 0 ? 'Strong Positive' : 'Strong Negative';
    } else if (absCoefficient >= 0.5) {
      return coefficient >= 0 ? 'Moderate Positive' : 'Moderate Negative';
    } else if (absCoefficient >= 0.3) {
      return coefficient >= 0 ? 'Weak Positive' : 'Weak Negative';
    } else {
      return 'Very Weak or No Correlation';
    }
  };
  
  const getCorrelationColor = (coefficient: number): string => {
    const absCoefficient = Math.abs(coefficient);
    
    if (absCoefficient >= 0.8) {
      return coefficient >= 0 ? '#4caf50' : '#f44336';
    } else if (absCoefficient >= 0.5) {
      return coefficient >= 0 ? '#8bc34a' : '#ff5722';
    } else if (absCoefficient >= 0.3) {
      return coefficient >= 0 ? '#cddc39' : '#ff9800';
    } else {
      return '#9e9e9e';
    }
  };
  
  const renderScatterChart = () => {
    if (!correlation || correlation.dataPoints.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No correlation data available for these properties.
          </Typography>
        </Box>
      );
    }
    
    // Check if data is numeric
    const isNumeric = typeof correlation.dataPoints[0].x === 'number' && typeof correlation.dataPoints[0].y === 'number';
    
    if (!isNumeric) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            Scatter plot is only available for numeric properties.
          </Typography>
        </Box>
      );
    }
    
    // Prepare data for scatter chart
    const data = correlation.dataPoints.map(point => ({
      x: point.x,
      y: point.y
    }));
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={property1}
            label={{ value: property1, position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={property2}
            label={{ value: property2, angle: -90, position: 'insideLeft' }}
          />
          <ZAxis range={[50, 50]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name) => [value, name === 'x' ? property1 : property2]}
          />
          <Legend />
          <Scatter
            name="Properties"
            data={data}
            fill={getCorrelationColor(correlation.correlationCoefficient)}
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };
  
  const renderCorrelationInfo = () => {
    if (!correlation) {
      return null;
    }
    
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Correlation Analysis
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mr: 2 }}>
              Correlation Coefficient:
            </Typography>
            <Chip
              label={correlation.correlationCoefficient.toFixed(2)}
              sx={{
                bgcolor: getCorrelationColor(correlation.correlationCoefficient),
                color: 'white'
              }}
            />
          </Box>
          <Typography variant="body1" paragraph>
            <strong>Interpretation:</strong> {getCorrelationStrength(correlation.correlationCoefficient)}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {correlation.correlationCoefficient > 0
              ? 'As one property increases, the other tends to increase as well.'
              : correlation.correlationCoefficient < 0
                ? 'As one property increases, the other tends to decrease.'
                : 'There is no clear relationship between these properties.'}
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Based on {correlation.dataPoints.length} data points.
          </Typography>
        </CardContent>
      </Card>
    );
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading property correlation...
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">
          Correlation between {property1} and {property2}
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
      
      <Paper sx={{ p: 3 }}>
        {renderScatterChart()}
      </Paper>
      
      {renderCorrelationInfo()}
    </Box>
  );
};

export default PropertyCorrelationChart;
