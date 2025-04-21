import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
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
  Tooltip,
  LinearProgress,
  Alert
} from '@mui/material';
import { 
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Flag as FlagIcon,
  Add as AddIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

// Mock data for A/B tests
const mockABTests = [
  {
    id: 'ab-001',
    name: 'Material Classifier Optimization',
    status: 'running',
    startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000), // 7 days ago
    samplesCollected: 2450,
    targetSamples: 5000,
    variants: [
      { 
        id: 'control', 
        name: 'Current Production Model', 
        description: 'ResNet50 with standard parameters',
        trafficAllocation: 50,
        metrics: {
          accuracy: 0.923,
          precision: 0.918,
          recall: 0.905,
          f1Score: 0.911,
          inferenceTime: 124 // ms
        }
      },
      { 
        id: 'variant-a', 
        name: 'Optimized Architecture', 
        description: 'EfficientNetB3 with custom head',
        trafficAllocation: 50,
        metrics: {
          accuracy: 0.937,
          precision: 0.932,
          recall: 0.928,
          f1Score: 0.930,
          inferenceTime: 98 // ms
        }
      }
    ],
    primaryMetric: 'accuracy',
    significanceLevel: 0.05,
    statisticalSignificance: {
      pValue: 0.032,
      confidenceInterval: [0.005, 0.023],
      isSignificant: true,
      winningVariant: 'variant-a'
    },
    dailyMetrics: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      'control_accuracy': 0.92 + Math.random() * 0.01,
      'variant-a_accuracy': 0.93 + Math.random() * 0.01,
      'control_inferenceTime': 120 + Math.random() * 10,
      'variant-a_inferenceTime': 95 + Math.random() * 10
    }))
  },
  {
    id: 'ab-002',
    name: 'Text Embedding Comparison',
    status: 'running',
    startDate: new Date(Date.now() - 4 * 24 * 3600 * 1000), // 4 days ago
    samplesCollected: 1280,
    targetSamples: 3000,
    variants: [
      { 
        id: 'control', 
        name: 'Current Embedding Model', 
        description: 'all-MiniLM-L6-v2',
        trafficAllocation: 33,
        metrics: {
          retrievalAccuracy: 0.845,
          meanReciprocalRank: 0.762,
          inferenceTime: 45 // ms
        }
      },
      { 
        id: 'variant-a', 
        name: 'Fine-tuned Embedding', 
        description: 'all-MiniLM-L6-v2 fine-tuned on material data',
        trafficAllocation: 33,
        metrics: {
          retrievalAccuracy: 0.872,
          meanReciprocalRank: 0.791,
          inferenceTime: 46 // ms
        }
      },
      { 
        id: 'variant-b', 
        name: 'Larger Model', 
        description: 'all-mpnet-base-v2',
        trafficAllocation: 34,
        metrics: {
          retrievalAccuracy: 0.891,
          meanReciprocalRank: 0.823,
          inferenceTime: 78 // ms
        }
      }
    ],
    primaryMetric: 'retrievalAccuracy',
    significanceLevel: 0.05,
    statisticalSignificance: {
      pValue: 0.078,
      confidenceInterval: [0.001, 0.092],
      isSignificant: false,
      winningVariant: null
    },
    dailyMetrics: Array.from({ length: 4 }, (_, i) => ({
      day: i + 1,
      'control_retrievalAccuracy': 0.84 + Math.random() * 0.02,
      'variant-a_retrievalAccuracy': 0.86 + Math.random() * 0.02,
      'variant-b_retrievalAccuracy': 0.88 + Math.random() * 0.02,
      'control_inferenceTime': 45 + Math.random() * 5,
      'variant-a_inferenceTime': 46 + Math.random() * 5,
      'variant-b_inferenceTime': 75 + Math.random() * 8
    }))
  }
];

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString();
};

// A/B Testing Panel Component
const ABTestingPanel: React.FC = () => {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('accuracy');

  // Toggle test expansion
  const toggleTestExpansion = (testId: string) => {
    setExpandedTest(expandedTest === testId ? null : testId);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          A/B Tests
        </Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />}>
          New A/B Test
        </Button>
      </Box>

      {/* A/B Tests List */}
      {mockABTests.map((test) => (
        <Card key={test.id} sx={{ mb: 3 }}>
          <CardContent sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" component="div">
                  {test.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Started: {formatDate(test.startDate)} • {test.variants.length} variants
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip 
                  label={test.status} 
                  color={test.status === 'running' ? 'success' : 'default'} 
                  size="small" 
                />
                {test.statisticalSignificance.isSignificant && (
                  <Chip 
                    icon={<FlagIcon />}
                    label="Significant Result" 
                    color="primary" 
                    size="small" 
                  />
                )}
                <IconButton
                  aria-label="expand test"
                  size="small"
                  onClick={() => toggleTestExpansion(test.id)}
                >
                  {expandedTest === test.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
            </Box>

            {/* Progress bar */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Samples: {test.samplesCollected} / {test.targetSamples}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round((test.samplesCollected / test.targetSamples) * 100)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(test.samplesCollected / test.targetSamples) * 100} 
                sx={{ height: 8, borderRadius: 5 }}
              />
            </Box>

            {/* Variants summary */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {test.variants.map((variant) => (
                <Chip 
                  key={variant.id}
                  label={`${variant.name}: ${(variant[test.primaryMetric as keyof typeof variant] as number)?.toFixed(4) || 'N/A'}`}
                  color={test.statisticalSignificance.winningVariant === variant.id ? 'success' : 'default'}
                  variant={variant.id === 'control' ? 'outlined' : 'filled'}
                  size="small"
                />
              ))}
            </Box>

            {/* Expanded details */}
            <Collapse in={expandedTest === test.id} timeout="auto" unmountOnExit>
              <Box sx={{ mt: 3 }}>
                <Grid container spacing={3}>
                  {/* Metrics comparison */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      Performance Comparison
                    </Typography>
                    
                    {/* Metrics selection */}
                    <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                      {Object.keys(test.variants[0].metrics).map((metric) => (
                        <Button 
                          key={metric}
                          variant={selectedMetric === metric ? 'contained' : 'outlined'} 
                          size="small" 
                          onClick={() => setSelectedMetric(metric)}
                        >
                          {metric}
                        </Button>
                      ))}
                    </Box>
                    
                    {/* Bar chart comparison */}
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={test.variants.map(v => ({
                          name: v.name,
                          value: v.metrics[selectedMetric as keyof typeof v.metrics] as number,
                          id: v.id
                        }))}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar 
                          dataKey="value" 
                          fill={(entry) => entry.id === test.statisticalSignificance.winningVariant ? '#4caf50' : '#8884d8'} 
                          name={selectedMetric}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    
                    {/* Statistical significance */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Statistical Analysis
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell component="th" scope="row">p-value</TableCell>
                              <TableCell>{test.statisticalSignificance.pValue.toFixed(4)}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Confidence Interval</TableCell>
                              <TableCell>
                                [{test.statisticalSignificance.confidenceInterval[0].toFixed(4)}, {test.statisticalSignificance.confidenceInterval[1].toFixed(4)}]
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Significance</TableCell>
                              <TableCell>
                                {test.statisticalSignificance.isSignificant ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                                    <CheckCircleIcon fontSize="small" sx={{ mr: 1 }} />
                                    Significant (p &lt; {test.significanceLevel})
                                  </Box>
                                ) : (
                                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                                    <CancelIcon fontSize="small" sx={{ mr: 1 }} />
                                    Not significant yet
                                  </Box>
                                )}
                              </TableCell>
                            </TableRow>
                            {test.statisticalSignificance.winningVariant && (
                              <TableRow>
                                <TableCell component="th" scope="row">Winning Variant</TableCell>
                                <TableCell>
                                  {test.variants.find(v => v.id === test.statisticalSignificance.winningVariant)?.name}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Grid>
                  
                  {/* Trend over time */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      Trend Over Time
                    </Typography>
                    
                    {/* Line chart for trend */}
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={test.dailyMetrics}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }} />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        {test.variants.map((variant) => (
                          <Line
                            key={variant.id}
                            type="monotone"
                            dataKey={`${variant.id}_${selectedMetric}`}
                            name={variant.name}
                            stroke={variant.id === test.statisticalSignificance.winningVariant ? '#4caf50' : 
                                   variant.id === 'control' ? '#8884d8' : '#ff7300'}
                            activeDot={{ r: 8 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    
                    {/* Variant details */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Variant Details
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Variant</TableCell>
                              <TableCell>Traffic</TableCell>
                              <TableCell>Description</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {test.variants.map((variant) => (
                              <TableRow key={variant.id}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {variant.name}
                                    {variant.id === test.statisticalSignificance.winningVariant && (
                                      <CheckCircleIcon fontSize="small" color="success" sx={{ ml: 1 }} />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>{variant.trafficAllocation}%</TableCell>
                                <TableCell>{variant.description}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                    
                    {/* Actions */}
                    {test.statisticalSignificance.isSignificant && (
                      <Box sx={{ mt: 2 }}>
                        <Alert severity="success" sx={{ mb: 2 }}>
                          This test has reached statistical significance. You can promote the winning variant or continue testing.
                        </Alert>
                        <Button 
                          variant="contained" 
                          color="success" 
                          sx={{ mr: 1 }}
                        >
                          Promote Winning Variant
                        </Button>
                        <Button variant="outlined">
                          Continue Testing
                        </Button>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default ABTestingPanel;
