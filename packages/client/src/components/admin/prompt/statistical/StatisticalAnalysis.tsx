import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  PieChart as PieChartIcon,
  BubbleChart as BubbleChartIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface AnalysisResult {
  analysisType: string;
  result: Record<string, any>;
  pValue?: number;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  isSignificant?: boolean;
  sampleSize: number;
}

interface CorrelationData {
  factor1: string;
  factor2: string;
  correlationCoefficient: number;
  pValue: number;
  isSignificant: boolean;
}

interface TrendData {
  date: string;
  value: number;
  trend?: number;
  lowerBound?: number;
  upperBound?: number;
}

const StatisticalAnalysis: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [experimentId, setExperimentId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(new Date().setDate(new Date().getDate() - 30))
  );
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [promptId, setPromptId] = useState<string>('');
  const [segmentInput, setSegmentInput] = useState<string>('');
  const [experimentResults, setExperimentResults] = useState<AnalysisResult[]>([]);
  const [segmentResults, setSegmentResults] = useState<AnalysisResult[]>([]);
  const [correlationData, setCorrelationData] = useState<CorrelationData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loadingExperiment, setLoadingExperiment] = useState<boolean>(false);
  const [loadingSegments, setLoadingSegments] = useState<boolean>(false);
  const [loadingCorrelations, setLoadingCorrelations] = useState<boolean>(false);
  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleExperimentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExperimentId(e.target.value);
  };

  const handlePromptIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPromptId(e.target.value);
  };

  const handleSegmentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSegmentInput(e.target.value);
  };

  const addSegment = () => {
    if (segmentInput && !segmentIds.includes(segmentInput)) {
      setSegmentIds([...segmentIds, segmentInput]);
      setSegmentInput('');
    }
  };

  const removeSegment = (segmentId: string) => {
    setSegmentIds(segmentIds.filter(id => id !== segmentId));
  };

  const analyzeExperiment = async () => {
    if (!experimentId) {
      enqueueSnackbar('Please enter an experiment ID', { variant: 'warning' });
      return;
    }

    if (!startDate || !endDate) {
      enqueueSnackbar('Please select start and end dates', { variant: 'warning' });
      return;
    }

    setLoadingExperiment(true);
    try {
      const response = await axios.post(`/api/admin/prompt-statistical/experiments/${experimentId}/analyze`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (response.data.success) {
        setExperimentResults(response.data.data);
        enqueueSnackbar('Experiment analyzed successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to analyze experiment: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error analyzing experiment: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoadingExperiment(false);
    }
  };

  const compareSegments = async () => {
    if (segmentIds.length < 2) {
      enqueueSnackbar('Please add at least two segments to compare', { variant: 'warning' });
      return;
    }

    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    if (!startDate || !endDate) {
      enqueueSnackbar('Please select start and end dates', { variant: 'warning' });
      return;
    }

    setLoadingSegments(true);
    try {
      const response = await axios.post('/api/admin/prompt-statistical/segments/compare', {
        segmentIds,
        promptId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (response.data.success) {
        setSegmentResults(response.data.data);
        enqueueSnackbar('Segments compared successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to compare segments: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error comparing segments: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoadingSegments(false);
    }
  };

  const analyzeCorrelations = async () => {
    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    if (!startDate || !endDate) {
      enqueueSnackbar('Please select start and end dates', { variant: 'warning' });
      return;
    }

    setLoadingCorrelations(true);
    try {
      const response = await axios.get('/api/admin/prompt-statistical/correlations', {
        params: {
          promptId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      if (response.data.success) {
        setCorrelationData(response.data.data);
        enqueueSnackbar('Correlation analysis completed successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to analyze correlations: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error analyzing correlations: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoadingCorrelations(false);
    }
  };

  const analyzeTrends = async () => {
    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    if (!startDate || !endDate) {
      enqueueSnackbar('Please select start and end dates', { variant: 'warning' });
      return;
    }

    setLoadingTrends(true);
    try {
      const response = await axios.get('/api/admin/prompt-statistical/trends', {
        params: {
          promptId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      if (response.data.success) {
        setTrendData(response.data.data);
        enqueueSnackbar('Trend analysis completed successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to analyze trends: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error analyzing trends: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoadingTrends(false);
    }
  };

  const formatPValue = (pValue?: number) => {
    if (pValue === undefined) return 'N/A';
    if (pValue < 0.001) return '< 0.001';
    return pValue.toFixed(3);
  };

  const formatConfidenceInterval = (lower?: number, upper?: number) => {
    if (lower === undefined || upper === undefined) return 'N/A';
    return `${(lower * 100).toFixed(1)}% to ${(upper * 100).toFixed(1)}%`;
  };

  // Prepare chart data for experiment results
  const prepareExperimentChartData = () => {
    if (!experimentResults.length) return [];

    const zTestResult = experimentResults.find(r => r.analysisType === 'z_test');
    if (!zTestResult) return [];

    return [
      {
        name: 'Control',
        successRate: zTestResult.result.controlProportion * 100,
        color: '#8884d8'
      },
      {
        name: 'Test',
        successRate: zTestResult.result.testProportion * 100,
        color: '#82ca9d'
      }
    ];
  };

  // Prepare chart data for segment results
  const prepareSegmentChartData = () => {
    if (!segmentResults.length) return [];

    return segmentResults.map((result, index) => ({
      name: `Segment ${index + 1}`,
      successRate: result.result.testProportion * 100,
      color: index === 0 ? '#8884d8' : '#82ca9d'
    }));
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Statistical Analysis
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="analysis tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<BarChartIcon />} label="Experiment Analysis" />
          <Tab icon={<TimelineIcon />} label="Segment Comparison" />
          <Tab icon={<PieChartIcon />} label="Correlations" />
          <Tab icon={<TrendingUpIcon />} label="Trend Analysis" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Analyze A/B Test Experiment</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Experiment ID"
                value={experimentId}
                onChange={handleExperimentIdChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={analyzeExperiment}
                  disabled={loadingExperiment}
                  startIcon={loadingExperiment ? <CircularProgress size={20} /> : <BarChartIcon />}
                >
                  Analyze Experiment
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {experimentResults.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Analysis Results</Typography>

              {experimentResults.map((result, index) => (
                <Box key={index} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">
                    {result.analysisType === 'z_test' ? 'Z-Test for Proportions' : 'Chi-Square Test'}
                  </Typography>

                  <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={6}>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Metric</TableCell>
                              <TableCell align="right">Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell>Sample Size</TableCell>
                              <TableCell align="right">{result.sampleSize}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>P-Value</TableCell>
                              <TableCell align="right">{formatPValue(result.pValue)}</TableCell>
                            </TableRow>
                            {result.analysisType === 'z_test' && (
                              <TableRow>
                                <TableCell>Confidence Interval (95%)</TableCell>
                                <TableCell align="right">
                                  {formatConfidenceInterval(result.confidenceIntervalLower, result.confidenceIntervalUpper)}
                                </TableCell>
                              </TableRow>
                            )}
                            {result.analysisType === 'z_test' && (
                              <>
                                <TableRow>
                                  <TableCell>Control Success Rate</TableCell>
                                  <TableCell align="right">{(result.result.controlProportion * 100).toFixed(2)}%</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Test Success Rate</TableCell>
                                  <TableCell align="right">{(result.result.testProportion * 100).toFixed(2)}%</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Difference</TableCell>
                                  <TableCell align="right">
                                    {(result.result.proportionDifference * 100).toFixed(2)}%
                                  </TableCell>
                                </TableRow>
                              </>
                            )}
                            {result.analysisType === 'chi_square_test' && (
                              <TableRow>
                                <TableCell>Chi-Square Statistic</TableCell>
                                <TableCell align="right">{result.result.chiSquare.toFixed(2)}</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      {result.analysisType === 'z_test' && (
                        <Box sx={{ height: 300 }}>
                          <ResponsiveContainer>
                            <BarChart
                              data={prepareExperimentChartData()}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                              <Legend />
                              <Bar dataKey="successRate" name="Success Rate" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      )}
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 2 }}>
                    <Alert
                      severity={result.isSignificant ? "success" : "info"}
                      icon={result.isSignificant ? <CheckCircleIcon /> : <InfoIcon />}
                    >
                      <AlertTitle>
                        {result.isSignificant
                          ? "Statistically Significant Result"
                          : "Not Statistically Significant"}
                      </AlertTitle>
                      {result.isSignificant
                        ? `The difference between control and test is statistically significant (p ${formatPValue(result.pValue)}).`
                        : `The difference between control and test is not statistically significant (p ${formatPValue(result.pValue)}).`}
                      {result.analysisType === 'z_test' && result.result.proportionDifference > 0 && (
                        <Box sx={{ mt: 1 }}>
                          The test variant outperforms the control by {(result.result.proportionDifference * 100).toFixed(2)}%.
                        </Box>
                      )}
                      {result.analysisType === 'z_test' && result.result.proportionDifference < 0 && (
                        <Box sx={{ mt: 1 }}>
                          The control variant outperforms the test by {(Math.abs(result.result.proportionDifference) * 100).toFixed(2)}%.
                        </Box>
                      )}
                    </Alert>
                  </Box>

                  {index < experimentResults.length - 1 && <Divider sx={{ my: 3 }} />}
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Compare User Segments</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prompt ID"
                value={promptId}
                onChange={handlePromptIdChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  label="Segment ID"
                  value={segmentInput}
                  onChange={handleSegmentInputChange}
                  margin="normal"
                />
                <Button
                  variant="contained"
                  onClick={addSegment}
                  sx={{ ml: 1, mb: 1, height: 40 }}
                >
                  Add
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {segmentIds.map((id) => (
                  <Chip
                    key={id}
                    label={id}
                    onDelete={() => removeSegment(id)}
                  />
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={compareSegments}
                  disabled={loadingSegments}
                  startIcon={loadingSegments ? <CircularProgress size={20} /> : <TimelineIcon />}
                >
                  Compare Segments
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {segmentResults.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Comparison Results</Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Segment</TableCell>
                          <TableCell align="right">Success Rate</TableCell>
                          <TableCell align="right">Sample Size</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {segmentResults.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {index === 0 ? 'Reference Segment' : `Segment ${index}`}
                            </TableCell>
                            <TableCell align="right">
                              {index === 0
                                ? (result.result.controlProportion * 100).toFixed(2)
                                : (result.result.testProportion * 100).toFixed(2)
                              }%
                            </TableCell>
                            <TableCell align="right">
                              {index === 0
                                ? result.result.controlTotal
                                : result.result.testTotal
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={prepareSegmentChartData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                        <Legend />
                        <Bar dataKey="successRate" name="Success Rate" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" gutterBottom>Statistical Significance</Typography>

              {segmentResults.map((result, index) => (
                index > 0 && (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Alert
                      severity={result.isSignificant ? "success" : "info"}
                      icon={result.isSignificant ? <CheckCircleIcon /> : <InfoIcon />}
                    >
                      <AlertTitle>
                        {`Segment ${index} vs Reference Segment: `}
                        {result.isSignificant
                          ? "Statistically Significant Difference"
                          : "No Statistically Significant Difference"}
                      </AlertTitle>
                      <Typography variant="body2">
                        P-Value: {formatPValue(result.pValue)}
                      </Typography>
                      <Typography variant="body2">
                        Confidence Interval: {formatConfidenceInterval(result.confidenceIntervalLower, result.confidenceIntervalUpper)}
                      </Typography>
                      {result.result.proportionDifference > 0 && (
                        <Typography variant="body2">
                          Segment {index} outperforms the reference segment by {(result.result.proportionDifference * 100).toFixed(2)}%.
                        </Typography>
                      )}
                      {result.result.proportionDifference < 0 && (
                        <Typography variant="body2">
                          The reference segment outperforms Segment {index} by {(Math.abs(result.result.proportionDifference) * 100).toFixed(2)}%.
                        </Typography>
                      )}
                    </Alert>
                  </Box>
                )
              ))}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Correlation Analysis</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prompt ID"
                value={promptId}
                onChange={handlePromptIdChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={analyzeCorrelations}
                  disabled={loadingCorrelations}
                  startIcon={loadingCorrelations ? <CircularProgress size={20} /> : <PieChartIcon />}
                >
                  Analyze Correlations
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {correlationData.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Correlation Results</Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Factor 1</TableCell>
                          <TableCell>Factor 2</TableCell>
                          <TableCell align="right">Correlation</TableCell>
                          <TableCell align="right">P-Value</TableCell>
                          <TableCell align="right">Significance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {correlationData.map((correlation, index) => (
                          <TableRow key={index}>
                            <TableCell>{correlation.factor1}</TableCell>
                            <TableCell>{correlation.factor2}</TableCell>
                            <TableCell align="right">
                              {correlation.correlationCoefficient.toFixed(3)}
                            </TableCell>
                            <TableCell align="right">
                              {formatPValue(correlation.pValue)}
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={correlation.isSignificant ? "Significant" : "Not Significant"}
                                color={correlation.isSignificant ? "success" : "default"}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer>
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name="Factor 1"
                          domain={[-1, 1]}
                          label={{ value: 'Correlation Coefficient', position: 'bottom' }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name="Factor 2"
                          domain={[0, 0.05]}
                          label={{ value: 'P-Value', angle: -90, position: 'left' }}
                        />
                        <ZAxis
                          type="number"
                          dataKey="z"
                          range={[50, 400]}
                          name="Strength"
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value, name) => [Number(value).toFixed(3), name]}
                        />
                        <Scatter
                          name="Correlations"
                          data={correlationData.map(c => ({
                            x: c.correlationCoefficient,
                            y: c.pValue,
                            z: Math.abs(c.correlationCoefficient) * 100,
                            name: `${c.factor1} vs ${c.factor2}`
                          }))}
                          fill="#8884d8"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3 }}>
                <Alert severity="info">
                  <AlertTitle>Correlation Interpretation</AlertTitle>
                  <Typography variant="body2">
                    Correlation coefficients range from -1 to 1, where:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <Typography variant="body2">
                        <strong>1.0 to 0.7:</strong> Strong positive correlation
                      </Typography>
                    </ListItem>
                    <ListItem>
                      <Typography variant="body2">
                        <strong>0.7 to 0.3:</strong> Moderate positive correlation
                      </Typography>
                    </ListItem>
                    <ListItem>
                      <Typography variant="body2">
                        <strong>0.3 to 0:</strong> Weak positive correlation
                      </Typography>
                    </ListItem>
                    <ListItem>
                      <Typography variant="body2">
                        <strong>0 to -0.3:</strong> Weak negative correlation
                      </Typography>
                    </ListItem>
                    <ListItem>
                      <Typography variant="body2">
                        <strong>-0.3 to -0.7:</strong> Moderate negative correlation
                      </Typography>
                    </ListItem>
                    <ListItem>
                      <Typography variant="body2">
                        <strong>-0.7 to -1.0:</strong> Strong negative correlation
                      </Typography>
                    </ListItem>
                  </List>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    A p-value less than 0.05 indicates statistical significance.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Trend Analysis</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prompt ID"
                value={promptId}
                onChange={handlePromptIdChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={analyzeTrends}
                  disabled={loadingTrends}
                  startIcon={loadingTrends ? <CircularProgress size={20} /> : <TrendingUpIcon />}
                >
                  Analyze Trends
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {trendData.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Trend Results</Typography>

              <Box sx={{ height: 400 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      label={{ value: 'Date', position: 'bottom' }}
                    />
                    <YAxis
                      label={{ value: 'Success Rate (%)', angle: -90, position: 'left' }}
                      domain={[0, 100]}
                    />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Actual"
                      stroke="#8884d8"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="trend"
                      name="Trend"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="upperBound"
                      name="Upper Bound"
                      stroke="#ffc658"
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="lowerBound"
                      name="Lower Bound"
                      stroke="#ff8042"
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Alert severity="info">
                  <AlertTitle>Trend Analysis Interpretation</AlertTitle>
                  <Typography variant="body2">
                    The trend line shows the overall direction of the success rate over time. The upper and lower bounds represent the 95% confidence interval for the trend prediction.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {trendData[trendData.length - 1].trend && trendData[0].trend && (
                      trendData[trendData.length - 1].trend > trendData[0].trend ? (
                        <span>The success rate shows an <strong>increasing trend</strong> over the selected time period.</span>
                      ) : trendData[trendData.length - 1].trend < trendData[0].trend ? (
                        <span>The success rate shows a <strong>decreasing trend</strong> over the selected time period.</span>
                      ) : (
                        <span>The success rate shows a <strong>stable trend</strong> over the selected time period.</span>
                      )
                    )}
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>
        )}
      </TabPanel>
    </Box>
  );
};

export default StatisticalAnalysis;
