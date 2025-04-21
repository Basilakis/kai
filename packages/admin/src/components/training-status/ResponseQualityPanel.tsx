import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  BarChart as BarChartIcon,
  BugReport as BugReportIcon,
  Visibility as VisibilityIcon,
  Flag as FlagIcon,
  Timeline as TimelineIcon
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
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import responseQualityService, { ResponseQualityMetrics, ProblematicResponse } from '../../services/response-quality.service';

// Initial empty state for quality data
const initialQualityData: ResponseQualityMetrics = {
  overallSatisfaction: 87, // percentage
  responseAccuracy: 92, // percentage
  averageRating: 4.3, // out of 5
  totalResponses: 12450,
  ratedResponses: 3240,
  feedbackRate: 26, // percentage

  // Trends over time (last 7 days)
  dailyTrends: [
    { day: 'Mon', satisfaction: 86, accuracy: 91, rating: 4.2, responses: 1820 },
    { day: 'Tue', satisfaction: 88, accuracy: 93, rating: 4.4, responses: 1760 },
    { day: 'Wed', satisfaction: 85, accuracy: 90, rating: 4.1, responses: 1840 },
    { day: 'Thu', satisfaction: 89, accuracy: 94, rating: 4.5, responses: 1720 },
    { day: 'Fri', satisfaction: 87, accuracy: 92, rating: 4.3, responses: 1780 },
    { day: 'Sat', satisfaction: 84, accuracy: 89, rating: 4.0, responses: 1650 },
    { day: 'Sun', satisfaction: 90, accuracy: 95, rating: 4.6, responses: 1880 }
  ],

  // Feedback distribution
  feedbackDistribution: [
    { name: 'Very Satisfied', value: 42, color: '#4caf50' },
    { name: 'Satisfied', value: 35, color: '#8bc34a' },
    { name: 'Neutral', value: 12, color: '#ffeb3b' },
    { name: 'Dissatisfied', value: 8, color: '#ff9800' },
    { name: 'Very Dissatisfied', value: 3, color: '#f44336' }
  ],

  // Error categories
  errorCategories: [
    { category: 'Factual Errors', count: 145, percentage: 38 },
    { category: 'Hallucinations', count: 98, percentage: 26 },
    { category: 'Incomplete Answers', count: 76, percentage: 20 },
    { category: 'Misunderstood Query', count: 42, percentage: 11 },
    { category: 'Other', count: 19, percentage: 5 }
  ],

  // Model comparison
  modelComparison: [
    { model: 'GPT-4', accuracy: 94, satisfaction: 91, latency: 1.2 },
    { model: 'Claude 3', accuracy: 92, satisfaction: 89, latency: 0.9 },
    { model: 'Llama 3', accuracy: 88, satisfaction: 85, latency: 0.7 },
    { model: 'Mistral', accuracy: 86, satisfaction: 83, latency: 0.6 }
  ],

  // Empty arrays for initial state
  errorDistribution: [],
  modelComparison: [],
  dailyTrends: []
};

// Initial empty state for problematic responses
const initialProblematicResponses: ProblematicResponse[] = [
    {
      id: 'resp-001',
      query: 'What materials are best for heat resistance?',
      model: 'GPT-4',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      rating: 1,
      feedback: 'Completely wrong information about ceramic properties',
      errorCategory: 'Factual Errors'
    },
    {
      id: 'resp-002',
      query: 'How do I create a sustainable material board?',
      model: 'Claude 3',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      rating: 2,
      feedback: 'Made up non-existent materials and certifications',
      errorCategory: 'Hallucinations'
    },
    {
      id: 'resp-003',
      query: 'Compare wood and metal durability',
      model: 'Llama 3',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      rating: 2,
      feedback: 'Only discussed wood properties, ignored metal completely',
      errorCategory: 'Incomplete Answers'
    }
  ]
};

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleString();
};

// Response Quality Panel Component
const ResponseQualityPanel: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState('satisfaction');
  const [selectedModel, setSelectedModel] = useState('all');
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for real data
  const [qualityData, setQualityData] = useState<ResponseQualityMetrics>(initialQualityData);
  const [problematicResponses, setProblematicResponses] = useState<ProblematicResponse[]>(initialProblematicResponses);
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  // Handle metric change
  const handleMetricChange = (event: SelectChangeEvent) => {
    setSelectedMetric(event.target.value);
  };

  // Handle model filter change
  const handleModelChange = (event: SelectChangeEvent) => {
    setSelectedModel(event.target.value);
  };

  // Handle time range change
  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value);
    fetchQualityData(event.target.value, selectedModel);
  };

  // Calculate date range based on time range selection
  const getDateRange = (range: string): [Date, Date] => {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7); // Default to 7 days
    }

    return [startDate, endDate];
  };

  // Fetch quality metrics data
  const fetchQualityData = async (range: string = timeRange, modelId: string = selectedModel) => {
    setLoading(true);
    setError(null);

    try {
      const [startDate, endDate] = getDateRange(range);
      const modelParam = modelId !== 'all' ? modelId : undefined;

      const metrics = await responseQualityService.getQualityMetrics(startDate, endDate, modelParam);
      setQualityData(metrics);

      // Extract available models from the comparison data
      if (metrics.modelComparison) {
        const models = metrics.modelComparison.map(model => ({
          id: model.modelId,
          name: model.modelName
        }));
        setAvailableModels(models);
      }
    } catch (err) {
      console.error('Error fetching quality metrics:', err);
      setError('Failed to load quality metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch problematic responses
  const fetchProblematicResponses = async () => {
    setLoading(true);

    try {
      const [startDate, endDate] = getDateRange(timeRange);
      const modelParam = selectedModel !== 'all' ? selectedModel : undefined;

      const filters = {
        modelId: modelParam,
        startDate,
        endDate,
        maxRating: 2 // Only get responses with low ratings
      };

      const responses = await responseQualityService.getProblematicResponses(10, 0, filters);
      setProblematicResponses(responses);
    } catch (err) {
      console.error('Error fetching problematic responses:', err);
      // Don't set error state here to avoid overriding metrics error
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchQualityData();
    fetchProblematicResponses();
  }, []);

  // Refresh data
  const handleRefresh = () => {
    fetchQualityData();
    fetchProblematicResponses();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Response Quality Metrics
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="time-range-label">Time Range</InputLabel>
            <Select
              labelId="time-range-label"
              id="time-range-select"
              value={timeRange}
              label="Time Range"
              onChange={handleTimeRangeChange}
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Overall Satisfaction
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h4" component="div" color={qualityData.overallSatisfaction >= 85 ? 'success.main' : 'warning.main'}>
                  {qualityData.overallSatisfaction?.toFixed(1) || '0'}%
                </Typography>
                <Chip
                  label="+2.3%"
                  color="success"
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={qualityData.overallSatisfaction || 0}
                color={qualityData.overallSatisfaction >= 85 ? 'success' : 'warning'}
                sx={{ height: 4, borderRadius: 5, mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Response Accuracy
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h4" component="div" color={qualityData.responseAccuracy >= 90 ? 'success.main' : 'warning.main'}>
                  {qualityData.responseAccuracy?.toFixed(1) || '0'}%
                </Typography>
                <Chip
                  label="+1.5%"
                  color="success"
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={qualityData.responseAccuracy || 0}
                color={qualityData.responseAccuracy >= 90 ? 'success' : 'warning'}
                sx={{ height: 4, borderRadius: 5, mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Average Rating
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h4" component="div">
                  {qualityData.averageRating?.toFixed(1) || '0'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  / 5
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', mt: 1 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Box
                    key={star}
                    component="span"
                    sx={{
                      color: star <= Math.round(qualityData.averageRating || 0) ? 'warning.main' : 'text.disabled',
                      fontSize: '1.5rem',
                      lineHeight: 1
                    }}
                  >
                    ★
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Feedback Rate
              </Typography>
              <Typography variant="h4" component="div">
                {qualityData.feedbackRate?.toFixed(1) || '0'}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {qualityData.ratedResponses?.toLocaleString() || '0'} / {qualityData.totalResponses?.toLocaleString() || '0'} responses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different sections */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={handleTabChange} aria-label="response quality tabs">
          <Tab icon={<TimelineIcon />} label="Trends" id="quality-tab-0" aria-controls="quality-tabpanel-0" />
          <Tab icon={<BarChartIcon />} label="Error Analysis" id="quality-tab-1" aria-controls="quality-tabpanel-1" />
          <Tab icon={<BugReportIcon />} label="Problematic Responses" id="quality-tab-2" aria-controls="quality-tabpanel-2" />
        </Tabs>
      </Box>

      {/* Trends Tab */}
      {selectedTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Quality Metrics Over Time
                </Typography>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="metric-select-label">Metric</InputLabel>
                  <Select
                    labelId="metric-select-label"
                    id="metric-select"
                    value={selectedMetric}
                    label="Metric"
                    onChange={handleMetricChange}
                  >
                    <MenuItem value="satisfaction">Satisfaction</MenuItem>
                    <MenuItem value="accuracy">Accuracy</MenuItem>
                    <MenuItem value="rating">Rating</MenuItem>
                    <MenuItem value="responses">Response Volume</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={qualityData.dailyTrends || []}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis
                    domain={
                      selectedMetric === 'responses'
                        ? [0, 'auto']
                        : selectedMetric === 'rating'
                          ? [0, 5]
                          : [0, 100]
                    }
                  />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey={selectedMetric}
                    name={
                      selectedMetric === 'satisfaction'
                        ? 'Satisfaction (%)'
                        : selectedMetric === 'accuracy'
                          ? 'Accuracy (%)'
                          : selectedMetric === 'rating'
                            ? 'Average Rating'
                            : 'Response Count'
                    }
                    stroke="#8884d8"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Feedback Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                {qualityData.errorDistribution && qualityData.errorDistribution.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={qualityData.errorDistribution.map(item => ({
                        name: item.category,
                        value: item.count,
                        color: [
                          '#f44336', // red
                          '#ff9800', // orange
                          '#ffeb3b', // yellow
                          '#4caf50', // green
                          '#2196f3', // blue
                          '#9c27b0'  // purple
                        ][qualityData.errorDistribution.indexOf(item) % 6]
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {qualityData.errorDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[
                          '#f44336', // red
                          '#ff9800', // orange
                          '#ffeb3b', // yellow
                          '#4caf50', // green
                          '#2196f3', // blue
                          '#9c27b0'  // purple
                        ][index % 6]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                    <Typography variant="body1" color="text.secondary">
                      No feedback distribution data available
                    </Typography>
                  </Box>
                )}
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Model Performance Comparison
                </Typography>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="model-select-label">Model</InputLabel>
                  <Select
                    labelId="model-select-label"
                    id="model-select"
                    value={selectedModel}
                    label="Model"
                    onChange={handleModelChange}
                  >
                    <MenuItem value="all">All Models</MenuItem>
                    {availableModels.map(model => (
                      <MenuItem key={model.id} value={model.id}>{model.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={qualityData.modelComparison || []}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="model" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="accuracy" name="Accuracy (%)" fill="#8884d8" />
                  <Bar dataKey="satisfaction" name="Satisfaction (%)" fill="#82ca9d" />
                  <Bar dataKey="latency" name="Latency (s)" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Error Analysis Tab */}
      {selectedTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Error Categories
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={qualityData.errorDistribution || []}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="category" />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Error Count" fill="#f44336" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Error Distribution by Model
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                {/* This would ideally use real data, but for now we'll keep the mock data for the radar chart */}
                <RadarChart outerRadius={90} data={[
                  {
                    category: 'Factual Errors',
                    'GPT-4': 12,
                    'Claude 3': 15,
                    'Llama 3': 22,
                    'Mistral': 25
                  },
                  {
                    category: 'Hallucinations',
                    'GPT-4': 8,
                    'Claude 3': 10,
                    'Llama 3': 18,
                    'Mistral': 20
                  },
                  {
                    category: 'Incomplete Answers',
                    'GPT-4': 15,
                    'Claude 3': 12,
                    'Llama 3': 14,
                    'Mistral': 16
                  },
                  {
                    category: 'Misunderstood Query',
                    'GPT-4': 10,
                    'Claude 3': 8,
                    'Llama 3': 12,
                    'Mistral': 14
                  },
                  {
                    category: 'Other',
                    'GPT-4': 5,
                    'Claude 3': 4,
                    'Llama 3': 6,
                    'Mistral': 8
                  }
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis />
                  <Legend />
                  <Radar name="GPT-4" dataKey="GPT-4" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Radar name="Claude 3" dataKey="Claude 3" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Radar name="Llama 3" dataKey="Llama 3" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                  <Radar name="Mistral" dataKey="Mistral" stroke="#ff7300" fill="#ff7300" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Error Trends Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                {/* This would ideally use real data, but for now we'll keep the mock data for error trends */}
                <LineChart
                  data={[
                    { day: 'Mon', 'Factual Errors': 24, 'Hallucinations': 18, 'Incomplete Answers': 15, 'Misunderstood Query': 8 },
                    { day: 'Tue', 'Factual Errors': 22, 'Hallucinations': 16, 'Incomplete Answers': 14, 'Misunderstood Query': 7 },
                    { day: 'Wed', 'Factual Errors': 25, 'Hallucinations': 19, 'Incomplete Answers': 16, 'Misunderstood Query': 9 },
                    { day: 'Thu', 'Factual Errors': 21, 'Hallucinations': 15, 'Incomplete Answers': 13, 'Misunderstood Query': 6 },
                    { day: 'Fri', 'Factual Errors': 23, 'Hallucinations': 17, 'Incomplete Answers': 14, 'Misunderstood Query': 8 },
                    { day: 'Sat', 'Factual Errors': 18, 'Hallucinations': 13, 'Incomplete Answers': 11, 'Misunderstood Query': 5 },
                    { day: 'Sun', 'Factual Errors': 16, 'Hallucinations': 12, 'Incomplete Answers': 10, 'Misunderstood Query': 4 }
                  ]}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Factual Errors" stroke="#f44336" />
                  <Line type="monotone" dataKey="Hallucinations" stroke="#ff9800" />
                  <Line type="monotone" dataKey="Incomplete Answers" stroke="#2196f3" />
                  <Line type="monotone" dataKey="Misunderstood Query" stroke="#4caf50" />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Problematic Responses Tab */}
      {selectedTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Recent Problematic Responses
                </Typography>
                <Button startIcon={<FilterListIcon />} variant="outlined" size="small">
                  Filter
                </Button>
              </Box>
              <TableContainer>
                <Table aria-label="problematic responses table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Query</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Rating</TableCell>
                      <TableCell>Error Category</TableCell>
                      <TableCell>Feedback</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {problematicResponses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell>{response.query}</TableCell>
                        <TableCell>{response.model}</TableCell>
                        <TableCell>{formatDate(response.createdAt)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Box
                                key={star}
                                component="span"
                                sx={{
                                  color: star <= response.rating ? 'warning.main' : 'text.disabled',
                                  fontSize: '1rem',
                                  lineHeight: 1
                                }}
                              >
                                ★
                              </Box>
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={response.errorCategory}
                            color={
                              response.errorCategory === 'Factual Errors' ? 'error' :
                              response.errorCategory === 'Hallucinations' ? 'warning' :
                              'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{response.feedback}</TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Flag for Review">
                            <IconButton size="small">
                              <FlagIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button variant="outlined">
                  View All Problematic Responses
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Improvement Suggestions</Typography>
              <ul>
                <li>Consider fine-tuning models on material science data to reduce factual errors</li>
                <li>Implement stricter hallucination detection for responses about material properties</li>
                <li>Add more comprehensive context for queries about sustainability certifications</li>
                <li>Review and update the knowledge base entries for heat-resistant materials</li>
              </ul>
            </Alert>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ResponseQualityPanel;
