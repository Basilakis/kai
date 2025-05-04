import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Grid,
  Button,
  Link
} from '@mui/material';
import {
  Warning as WarningIcon,
  ErrorOutline as ErrorOutlineIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { materialPropertyAnalyticsService, PropertyAnomalyResult } from '../../services/materialPropertyAnalyticsService';

interface PropertyAnomaliesTableProps {
  property: string;
  materialType?: string;
  onMaterialSelect?: (materialId: string) => void;
}

const PropertyAnomaliesTable: React.FC<PropertyAnomaliesTableProps> = ({
  property,
  materialType,
  onMaterialSelect
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<PropertyAnomalyResult | null>(null);
  const [threshold, setThreshold] = useState<number>(2.5);
  
  useEffect(() => {
    if (property) {
      loadAnomalies();
    }
  }, [property, materialType]);
  
  const loadAnomalies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await materialPropertyAnalyticsService.getPropertyAnomalies(
        property,
        materialType,
        threshold
      );
      
      setAnomalies(result);
    } catch (error) {
      console.error('Error loading property anomalies:', error);
      setError('Failed to load property anomalies. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleThresholdChange = (event: Event, newValue: number | number[]) => {
    setThreshold(newValue as number);
  };
  
  const handleThresholdChangeCommitted = () => {
    loadAnomalies();
  };
  
  const formatValue = (value: string | number) => {
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, {
        maximumFractionDigits: 2
      });
    }
    
    return value;
  };
  
  const getZScoreColor = (zScore: number) => {
    const absZScore = Math.abs(zScore);
    
    if (absZScore >= 3) {
      return '#f44336'; // Red for extreme outliers
    } else if (absZScore >= 2) {
      return '#ff9800'; // Orange for moderate outliers
    } else {
      return '#4caf50'; // Green for normal values
    }
  };
  
  const renderStatistics = () => {
    if (!anomalies) {
      return null;
    }
    
    const { statistics } = anomalies;
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Property Statistics
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" color="textSecondary">
                Mean
              </Typography>
              <Typography variant="body1">
                {formatValue(statistics.mean)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" color="textSecondary">
                Std. Deviation
              </Typography>
              <Typography variant="body1">
                {formatValue(statistics.stdDev)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" color="textSecondary">
                Minimum
              </Typography>
              <Typography variant="body1">
                {formatValue(statistics.min)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" color="textSecondary">
                Maximum
              </Typography>
              <Typography variant="body1">
                {formatValue(statistics.max)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" color="textSecondary">
                1st Quartile
              </Typography>
              <Typography variant="body1">
                {formatValue(statistics.q1)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="subtitle2" color="textSecondary">
                3rd Quartile
              </Typography>
              <Typography variant="body1">
                {formatValue(statistics.q3)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  const renderThresholdSlider = () => {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Z-Score Threshold for Anomalies
        </Typography>
        <Box sx={{ px: 2 }}>
          <Slider
            value={threshold}
            onChange={handleThresholdChange}
            onChangeCommitted={handleThresholdChangeCommitted}
            step={0.1}
            marks={[
              { value: 1, label: '1σ' },
              { value: 2, label: '2σ' },
              { value: 3, label: '3σ' }
            ]}
            min={1}
            max={4}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}σ`}
          />
        </Box>
        <Typography variant="body2" color="textSecondary">
          A higher threshold means only more extreme outliers will be shown.
          Standard thresholds: 2σ (95% confidence), 3σ (99.7% confidence).
        </Typography>
      </Box>
    );
  };
  
  const renderAnomaliesTable = () => {
    if (!anomalies || anomalies.anomalies.length === 0) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          No anomalies found for this property with the current threshold.
        </Alert>
      );
    }
    
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Material</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Z-Score</TableCell>
              <TableCell>Deviation</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {anomalies.anomalies.map((anomaly) => (
              <TableRow key={anomaly.materialId}>
                <TableCell>{anomaly.materialName}</TableCell>
                <TableCell>{formatValue(anomaly.value)}</TableCell>
                <TableCell>
                  <Chip
                    label={anomaly.zScore.toFixed(2)}
                    size="small"
                    sx={{
                      bgcolor: getZScoreColor(anomaly.zScore),
                      color: 'white'
                    }}
                    icon={
                      Math.abs(anomaly.zScore) >= 3 ? (
                        <ErrorOutlineIcon />
                      ) : (
                        <WarningIcon />
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {anomaly.zScore > 0 ? (
                      <TrendingUpIcon color="error" sx={{ mr: 1 }} />
                    ) : (
                      <TrendingDownIcon color="error" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="body2">
                      {anomaly.zScore > 0 ? 'Above' : 'Below'} average by{' '}
                      {formatValue(Math.abs(anomaly.value - anomalies.statistics.mean))}
                      {' '}
                      ({Math.abs(anomaly.zScore).toFixed(1)} standard deviations)
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {onMaterialSelect && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onMaterialSelect(anomaly.materialId)}
                    >
                      View Material
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading property anomalies...
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
          Anomalies in {property}
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
      
      {renderStatistics()}
      {renderThresholdSlider()}
      {renderAnomaliesTable()}
    </Box>
  );
};

export default PropertyAnomaliesTable;
