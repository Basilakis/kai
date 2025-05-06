import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as ResolveIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from '../../components/Layout';
import { useApi } from '../../hooks/useApi';

// Alert types
enum AlertType {
  LOW_SUCCESS_RATE = 'low_success_rate',
  LOW_RATING = 'low_rating',
  HIGH_RESPONSE_TIME = 'high_response_time',
  HIGH_FAILURE_RATE = 'high_failure_rate'
}

// Alert data interface
interface AlertData {
  id: string;
  promptId: string;
  alertType: AlertType;
  threshold: number;
  currentValue: number;
  isActive: boolean;
  triggeredAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  promptName?: string;
}

// Analytics data interface
interface AnalyticsData {
  id: string;
  promptId: string;
  date: string;
  totalUses: number;
  successfulUses: number;
  failedUses: number;
  averageRating?: number;
  averageResponseTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

// Setting data interface
interface SettingData {
  id?: string;
  promptId: string;
  settingType: AlertType;
  threshold: number;
  isActive: boolean;
  notificationEmail?: string;
}

// Prompt data interface
interface PromptData {
  id: string;
  name: string;
  promptType: string;
}

// Prompt Monitoring Page
export default function PromptMonitoringPage() {
  // State
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openSettingDialog, setOpenSettingDialog] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [currentSetting, setCurrentSetting] = useState<SettingData>({
    promptId: '',
    settingType: AlertType.LOW_SUCCESS_RATE,
    threshold: 80,
    isActive: true
  });
  
  // API hook
  const api = useApi();
  
  // Load data on mount
  useEffect(() => {
    fetchPrompts();
    fetchAlerts();
  }, []);
  
  // Fetch prompts
  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/prompts');
      if (response.success) {
        setPrompts(response.data);
        if (response.data.length > 0) {
          setSelectedPromptId(response.data[0].id);
          fetchAnalytics(response.data[0].id);
        }
      } else {
        setError(response.message || 'Failed to fetch prompts');
      }
    } catch (err) {
      setError('Error fetching prompts: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch alerts
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const response = await api.get('/api/admin/prompt-monitoring/alerts');
      if (response.success) {
        // Enrich alerts with prompt names
        const enrichedAlerts = await Promise.all(response.data.map(async (alert: AlertData) => {
          try {
            const promptResponse = await api.get(`/api/admin/prompts/${alert.promptId}`);
            if (promptResponse.success) {
              return {
                ...alert,
                promptName: promptResponse.data.name
              };
            }
            return alert;
          } catch (err) {
            return alert;
          }
        }));
        setAlerts(enrichedAlerts);
      } else {
        setError(response.message || 'Failed to fetch alerts');
      }
    } catch (err) {
      setError('Error fetching alerts: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAlertsLoading(false);
    }
  };
  
  // Fetch analytics
  const fetchAnalytics = async (promptId: string) => {
    if (!promptId) return;
    
    setAnalyticsLoading(true);
    try {
      const response = await api.get(`/api/admin/prompt-monitoring/analytics/${promptId}`, {
        params: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      });
      if (response.success) {
        setAnalytics(response.data);
      } else {
        setError(response.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Error fetching analytics: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAnalyticsLoading(false);
    }
  };
  
  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    try {
      const response = await api.post(`/api/admin/prompt-monitoring/alerts/${alertId}/resolve`);
      if (response.success) {
        setSuccess('Alert resolved successfully');
        fetchAlerts();
      } else {
        setError(response.message || 'Failed to resolve alert');
      }
    } catch (err) {
      setError('Error resolving alert: ' + (err instanceof Error ? err.message : String(err)));
    }
  };
  
  // Save setting
  const saveSetting = async () => {
    try {
      if (!currentSetting.promptId) {
        setError('Please select a prompt');
        return;
      }
      
      const response = await api.post(`/api/admin/prompt-monitoring/settings/${currentSetting.promptId}`, currentSetting);
      if (response.success) {
        setSuccess('Setting saved successfully');
        setOpenSettingDialog(false);
      } else {
        setError(response.message || 'Failed to save setting');
      }
    } catch (err) {
      setError('Error saving setting: ' + (err instanceof Error ? err.message : String(err)));
    }
  };
  
  // Handle prompt change
  const handlePromptChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const promptId = event.target.value as string;
    setSelectedPromptId(promptId);
    fetchAnalytics(promptId);
  };
  
  // Handle setting dialog open
  const handleOpenSettingDialog = () => {
    setCurrentSetting({
      promptId: selectedPromptId,
      settingType: AlertType.LOW_SUCCESS_RATE,
      threshold: 80,
      isActive: true
    });
    setOpenSettingDialog(true);
  };
  
  // Handle setting dialog close
  const handleCloseSettingDialog = () => {
    setOpenSettingDialog(false);
  };
  
  // Handle setting field change
  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setCurrentSetting({
      ...currentSetting,
      [name as string]: value
    });
  };
  
  // Get alert type label
  const getAlertTypeLabel = (type: AlertType) => {
    switch (type) {
      case AlertType.LOW_SUCCESS_RATE:
        return 'Low Success Rate';
      case AlertType.LOW_RATING:
        return 'Low Rating';
      case AlertType.HIGH_RESPONSE_TIME:
        return 'High Response Time';
      case AlertType.HIGH_FAILURE_RATE:
        return 'High Failure Rate';
      default:
        return type;
    }
  };
  
  // Get alert type color
  const getAlertTypeColor = (type: AlertType) => {
    switch (type) {
      case AlertType.LOW_SUCCESS_RATE:
        return 'error';
      case AlertType.LOW_RATING:
        return 'warning';
      case AlertType.HIGH_RESPONSE_TIME:
        return 'info';
      case AlertType.HIGH_FAILURE_RATE:
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Get alert type icon
  const getAlertTypeIcon = (type: AlertType) => {
    switch (type) {
      case AlertType.LOW_SUCCESS_RATE:
        return <ErrorIcon />;
      case AlertType.LOW_RATING:
        return <WarningIcon />;
      case AlertType.HIGH_RESPONSE_TIME:
        return <InfoIcon />;
      case AlertType.HIGH_FAILURE_RATE:
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };
  
  // Format analytics data for chart
  const formatAnalyticsForChart = () => {
    return analytics.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      successRate: item.totalUses > 0 ? (item.successfulUses / item.totalUses) * 100 : 0,
      totalUses: item.totalUses,
      averageRating: item.averageRating || 0,
      averageResponseTime: item.averageResponseTimeMs ? item.averageResponseTimeMs / 1000 : 0 // Convert to seconds
    }));
  };
  
  return (
    <Layout title="Prompt Monitoring">
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Prompt Monitoring
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Monitor prompt performance and set up alerts
        </Typography>
      </Box>
      
      {/* Error and success messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
      
      <Grid container spacing={3}>
        {/* Active Alerts */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Active Alerts</Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchAlerts}
                disabled={alertsLoading}
              >
                Refresh
              </Button>
            </Box>
            
            {alertsLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Prompt</TableCell>
                      <TableCell>Threshold</TableCell>
                      <TableCell>Current Value</TableCell>
                      <TableCell>Triggered At</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No active alerts
                        </TableCell>
                      </TableRow>
                    ) : (
                      alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <Chip
                              icon={getAlertTypeIcon(alert.alertType as AlertType)}
                              label={getAlertTypeLabel(alert.alertType as AlertType)}
                              color={getAlertTypeColor(alert.alertType as AlertType) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{alert.promptName || alert.promptId}</TableCell>
                          <TableCell>{alert.threshold}%</TableCell>
                          <TableCell>{alert.currentValue.toFixed(2)}%</TableCell>
                          <TableCell>{new Date(alert.triggeredAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => resolveAlert(alert.id)}>
                              <ResolveIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
        
        {/* Analytics */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Prompt Analytics</Typography>
              <Box display="flex" gap={2}>
                <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="prompt-select-label">Prompt</InputLabel>
                  <Select
                    labelId="prompt-select-label"
                    value={selectedPromptId}
                    onChange={handlePromptChange as any}
                    label="Prompt"
                  >
                    {prompts.map((prompt) => (
                      <MenuItem key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(date) => date && setStartDate(date)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={(date) => date && setEndDate(date)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </LocalizationProvider>
                <Button
                  variant="outlined"
                  startIcon={<TimelineIcon />}
                  onClick={() => fetchAnalytics(selectedPromptId)}
                  disabled={analyticsLoading || !selectedPromptId}
                >
                  Update
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={handleOpenSettingDialog}
                  disabled={!selectedPromptId}
                >
                  Alert Settings
                </Button>
              </Box>
            </Box>
            
            {analyticsLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                {analytics.length === 0 ? (
                  <Box display="flex" justifyContent="center" p={4}>
                    <Typography variant="body1" color="textSecondary">
                      No analytics data available for the selected prompt and date range
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={3}>
                    {/* Success Rate Chart */}
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardHeader title="Success Rate" />
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={formatAnalyticsForChart()}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis domain={[0, 100]} unit="%" />
                              <ChartTooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="successRate"
                                name="Success Rate"
                                stroke="#8884d8"
                                activeDot={{ r: 8 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Usage Chart */}
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardHeader title="Usage" />
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={formatAnalyticsForChart()}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <ChartTooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="totalUses"
                                name="Total Uses"
                                stroke="#82ca9d"
                                activeDot={{ r: 8 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Rating Chart */}
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardHeader title="Average Rating" />
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={formatAnalyticsForChart()}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis domain={[0, 5]} />
                              <ChartTooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="averageRating"
                                name="Average Rating"
                                stroke="#ffc658"
                                activeDot={{ r: 8 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Response Time Chart */}
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardHeader title="Average Response Time (seconds)" />
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={formatAnalyticsForChart()}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <ChartTooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="averageResponseTime"
                                name="Response Time (s)"
                                stroke="#ff7300"
                                activeDot={{ r: 8 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Alert Settings Dialog */}
      <Dialog open={openSettingDialog} onClose={handleCloseSettingDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Alert Settings
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }} noValidate>
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="setting-type-label">Alert Type</InputLabel>
              <Select
                labelId="setting-type-label"
                id="settingType"
                name="settingType"
                value={currentSetting.settingType}
                label="Alert Type"
                onChange={handleSettingChange as any}
              >
                <MenuItem value={AlertType.LOW_SUCCESS_RATE}>Low Success Rate</MenuItem>
                <MenuItem value={AlertType.LOW_RATING}>Low Rating</MenuItem>
                <MenuItem value={AlertType.HIGH_RESPONSE_TIME}>High Response Time</MenuItem>
                <MenuItem value={AlertType.HIGH_FAILURE_RATE}>High Failure Rate</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="threshold"
              label="Threshold"
              name="threshold"
              type="number"
              value={currentSetting.threshold}
              onChange={handleSettingChange}
              helperText={
                currentSetting.settingType === AlertType.LOW_SUCCESS_RATE
                  ? "Alert when success rate falls below this percentage"
                  : currentSetting.settingType === AlertType.LOW_RATING
                  ? "Alert when average rating falls below this value (1-5)"
                  : currentSetting.settingType === AlertType.HIGH_RESPONSE_TIME
                  ? "Alert when response time exceeds this value (ms)"
                  : "Alert when failure rate exceeds this percentage"
              }
            />
            
            <TextField
              margin="normal"
              fullWidth
              id="notificationEmail"
              label="Notification Email (optional)"
              name="notificationEmail"
              value={currentSetting.notificationEmail || ''}
              onChange={handleSettingChange}
              helperText="Email to notify when alert is triggered"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSettingDialog}>Cancel</Button>
          <Button onClick={saveSetting} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
