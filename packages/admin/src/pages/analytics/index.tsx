import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Tabs,
  Tab,
  Alert,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Divider
} from '../../components/mui';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PieChartIcon from '@mui/icons-material/PieChart';
import HistoryIcon from '@mui/icons-material/History';
import ForumIcon from '@mui/icons-material/Forum';
import InsightsIcon from '@mui/icons-material/Insights';
import TimelineIcon from '@mui/icons-material/Timeline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PersonIcon from '@mui/icons-material/Person';

// Import predictive analytics components
import TimeSeriesForecast from '../../components/analytics/TimeSeriesForecast';
import AnomalyDetection from '../../components/analytics/AnomalyDetection';
import UserBehaviorPrediction from '../../components/analytics/UserBehaviorPrediction';
import analyticsService, {
  AnalyticsEvent,
  AnalyticsStats,
  TopQuery,
  TopPrompt,
  TopMaterial
} from '../../services/analyticsService';

/**
 * Analytics Dashboard
 * Provides visualizations and metrics for system usage:
 * - User search patterns
 * - Agent AI prompt analysis
 * - API request statistics
 * - Material view trends
 */
const AnalyticsPage: React.FC = () => {
  // State for analytics data
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [trends, setTrends] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [topSearches, setTopSearches] = useState<TopQuery[]>([]);
  const [topPrompts, setTopPrompts] = useState<TopPrompt[]>([]);
  const [topMaterials, setTopMaterials] = useState<TopMaterial[]>([]);

  // State for UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [predictiveTab, setPredictiveTab] = useState(0);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date | null>(new Date()); // today
  const [eventType, setEventType] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Fetch initial analytics data
  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Fetch filtered analytics data when filters change
  useEffect(() => {
    if (activeTab === 1) { // Only refresh trends data when on the trends tab
      fetchTrends();
    }
  }, [activeTab, timeframe]);

  // Handle tab change
  // @ts-ignore - Using SyntheticEvent from our type declaration
  const handleTabChange = (_event: React.SyntheticEvent<Element, Event>, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle predictive tab change
  // @ts-ignore - Using SyntheticEvent from our type declaration
  const handlePredictiveTabChange = (_event: React.SyntheticEvent<Element, Event>, newValue: number) => {
    setPredictiveTab(newValue);
  };

  // Fetch all analytics data
  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch analytics stats
      const statsData = await analyticsService.getStats(startDate || undefined, endDate || undefined);
      setStats(statsData);

      // Fetch trends data
      await fetchTrends();

      // Fetch top searches
      const searchesData = await analyticsService.getTopSearchQueries(10, startDate || undefined, endDate || undefined);
      setTopSearches(searchesData);

      // Fetch top agent prompts
      const promptsData = await analyticsService.getTopAgentPrompts(10, startDate || undefined, endDate || undefined);
      setTopPrompts(promptsData);

      // Fetch top materials
      const materialsData = await analyticsService.getTopMaterials(10, startDate || undefined, endDate || undefined);
      setTopMaterials(materialsData);

      // Fetch events
      const eventsData = await analyticsService.getEvents({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        eventType: eventType || undefined,
        limit: rowsPerPage,
        skip: page * rowsPerPage,
        sort: { timestamp: 'desc' }
      });
      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError(`Failed to load analytics data: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trends data
  const fetchTrends = async () => {
    try {
      const trendsData = await analyticsService.getTrends({
        timeframe,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        eventType: eventType || undefined
      });
      setTrends(trendsData);
    } catch (error) {
      console.error('Error fetching trends data:', error);
      setError(`Failed to load trends data: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Handle filter changes
  const handleFilterChange = () => {
    fetchAnalyticsData();
  };

  // Handle clearing all analytics data
  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all analytics data? This action cannot be undone.')) {
      try {
        setLoading(true);
        await analyticsService.clearData();
        setStats(null);
        setTrends({});
        setEvents([]);
        setTopSearches([]);
        setTopPrompts([]);
        setTopMaterials([]);
        alert('Analytics data has been cleared successfully.');
      } catch (error) {
        console.error('Error clearing analytics data:', error);
        setError(`Failed to clear analytics data: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle pagination change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
    fetchAnalyticsData();
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    fetchAnalyticsData();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convert trends data to chart format
  const getTrendsChartData = () => {
    return Object.entries(trends).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Convert stats data to pie chart format
  const getEventTypePieData = () => {
    if (!stats) return [];
    return Object.entries(stats.byEventType).map(([name, value]) => ({
      name,
      value
    }));
  };

  // Convert stats data to pie chart format
  const getResourceTypePieData = () => {
    if (!stats) return [];
    return Object.entries(stats.byResourceType).map(([name, value]) => ({
      name,
      value
    }));
  };

  // Render the summary dashboard
  const renderSummaryDashboard = () => {
    if (loading && !stats) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading analytics data...</Typography>
        </Box>
      );
    }

    if (!stats) {
      return (
        <Alert severity="info" sx={{ mb: 3 }}>
          No analytics data available. Start using the system to generate analytics.
        </Alert>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Summary Stats */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Events
              </Typography>
              <Typography variant="h4">
                {stats.total.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Search Queries
              </Typography>
              <Typography variant="h4">
                {(stats.byEventType['search'] || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Agent Prompts
              </Typography>
              <Typography variant="h4">
                {(stats.byEventType['agent_prompt'] || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                API Requests
              </Typography>
              <Typography variant="h4">
                {(stats.byEventType['api_request'] || 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Event Type Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Event Type Distribution
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getEventTypePieData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getEventTypePieData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Resource Type Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resource Type Distribution
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getResourceTypePieData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getResourceTypePieData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Searches */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Search Queries
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Query</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topSearches.map((search) => (
                      <TableRow key={search.query}>
                        <TableCell component="th" scope="row">
                          {search.query}
                        </TableCell>
                        <TableCell align="right">{search.count}</TableCell>
                      </TableRow>
                    ))}
                    {topSearches.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          No search queries recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Agent Prompts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Agent Prompts
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Prompt</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topPrompts.map((prompt) => (
                      <TableRow key={prompt.prompt}>
                        <TableCell component="th" scope="row">
                          {prompt.prompt.length > 50
                            ? `${prompt.prompt.substring(0, 50)}...`
                            : prompt.prompt}
                        </TableCell>
                        <TableCell align="right">{prompt.count}</TableCell>
                      </TableRow>
                    ))}
                    {topPrompts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          No agent prompts recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Response Time */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Response Time by Event Type (ms)
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(stats.averageResponseTime).map(([name, value]) => ({
                      name,
                      value
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" name="Response Time (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render the trends chart
  const renderTrendsChart = () => {
    const chartData = getTrendsChartData();

    if (loading && Object.keys(trends).length === 0) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading trends data...</Typography>
        </Box>
      );
    }

    if (Object.keys(trends).length === 0) {
      return (
        <Alert severity="info" sx={{ mb: 3 }}>
          No trends data available for the selected timeframe.
        </Alert>
      );
    }

    return (
      <Box>
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <FormControl sx={{ minWidth: 120, mr: 2 }}>
            <InputLabel id="timeframe-label">Timeframe</InputLabel>
            <Select
              labelId="timeframe-label"
              value={timeframe}
              label="Timeframe"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeframe(e.target.value as 'day' | 'week' | 'month')}
            >
              <MenuItem value="day">Daily</MenuItem>
              <MenuItem value="week">Weekly</MenuItem>
              <MenuItem value="month">Monthly</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Event Trends Over Time
            </Typography>
            <Box height={400}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} name="Event Count" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  };

  // Render the events table
  const renderEventsTable = () => {
    if (loading && events.length === 0) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading events data...</Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Analytics Events
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Event Type</TableCell>
                    <TableCell>Resource Type</TableCell>
                    <TableCell>Query/Action</TableCell>
                    <TableCell>User ID</TableCell>
                    <TableCell align="right">Response Time (ms)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.timestamp ? formatDate(event.timestamp) : 'N/A'}</TableCell>
                      <TableCell>{event.event_type}</TableCell>
                      <TableCell>{event.resource_type || 'N/A'}</TableCell>
                      <TableCell>
                        {event.query
                          ? (event.query.length > 30 ? `${event.query.substring(0, 30)}...` : event.query)
                          : 'N/A'}
                      </TableCell>
                      <TableCell>{event.user_id || 'Anonymous'}</TableCell>
                      <TableCell align="right">{event.response_time || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No events match the current filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={-1} // We don't know the total count without a separate API call
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelDisplayedRows={({ from, to }: { from: number; to: number }) => `${from}-${to}`}
            />
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box p={3}>
        {/* Header Section */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Analytics Dashboard</Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={handleClearData}
            disabled={loading}
          >
            Clear All Analytics Data
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filter Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue: Date | null) => setStartDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="End Date"
                value={endDate}
                minDate={startDate || undefined}
                onChange={(newValue: Date | null) => setEndDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="event-type-label">Event Type</InputLabel>
                <Select
                  labelId="event-type-label"
                  value={eventType}
                  label="Event Type"
                  onChange={(e: { target: { value: string } }) => setEventType(e.target.value)}
                >
                  <MenuItem value="">All Events</MenuItem>
                  <MenuItem value="search">Search</MenuItem>
                  <MenuItem value="agent_prompt">Agent Prompt</MenuItem>
                  <MenuItem value="api_request">API Request</MenuItem>
                  <MenuItem value="material_view">Material View</MenuItem>
                  <MenuItem value="recognition">Recognition</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleFilterChange}
                disabled={loading}
                fullWidth
              >
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Main content with tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab icon={<InsightsIcon />} label="Summary" />
            <Tab icon={<TrendingUpIcon />} label="Trends" />
            <Tab icon={<HistoryIcon />} label="Events" />
            <Tab icon={<TimelineIcon />} label="Predictive" />
          </Tabs>
        </Paper>

        <Box>
          {/* Summary Dashboard Tab */}
          {activeTab === 0 && renderSummaryDashboard()}

          {/* Trends Chart Tab */}
          {activeTab === 1 && renderTrendsChart()}

          {/* Events Table Tab */}
          {activeTab === 2 && renderEventsTable()}

          {/* Predictive Analytics Tab */}
          {activeTab === 3 && (
            <Box>
              <Paper sx={{ mb: 3 }}>
                <Tabs
                  value={predictiveTab}
                  onChange={handlePredictiveTabChange}
                  indicatorColor="primary"
                  textColor="primary"
                  variant="fullWidth"
                >
                  <Tab icon={<TimelineIcon />} label="Forecasting" />
                  <Tab icon={<ErrorOutlineIcon />} label="Anomaly Detection" />
                  <Tab icon={<PersonIcon />} label="User Behavior" />
                </Tabs>
              </Paper>

              {/* Time-Series Forecasting */}
              {predictiveTab === 0 && <TimeSeriesForecast />}

              {/* Anomaly Detection */}
              {predictiveTab === 1 && <AnomalyDetection />}

              {/* User Behavior Prediction */}
              {predictiveTab === 2 && <UserBehaviorPrediction />}
            </Box>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default AnalyticsPage;