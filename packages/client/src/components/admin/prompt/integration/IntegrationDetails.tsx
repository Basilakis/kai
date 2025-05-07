import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Divider, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { 
  History as HistoryIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon,
  Send as SendIcon,
  Link as LinkIcon,
  Settings as SettingsIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { format } from 'date-fns';
import { CodeEditor } from '../../../common/CodeEditor';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

interface IntegrationDetailsProps {
  integration: {
    id: string;
    name: string;
    systemType: string;
    connectionParameters: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface DataExport {
  id: string;
  integrationId: string;
  exportType: string;
  exportParameters: Record<string, any>;
  status: string;
  result?: Record<string, any>;
  createdAt: string;
  executedAt?: string;
}

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
      id={`integration-tabpanel-${index}`}
      aria-labelledby={`integration-tab-${index}`}
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

const IntegrationDetails: React.FC<IntegrationDetailsProps> = ({ integration }) => {
  const [exports, setExports] = useState<DataExport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabValue, setTabValue] = useState(0);
  const [openCreateExportDialog, setOpenCreateExportDialog] = useState<boolean>(false);
  const [exportFormData, setExportFormData] = useState({
    exportType: 'success_metrics',
    exportParameters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
      endDate: new Date().toISOString(),
      promptIds: [],
      segmentIds: []
    }
  });
  const { enqueueSnackbar } = useSnackbar();

  const fetchExports = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/prompt-integration/exports?integrationId=${integration.id}`);
      if (response.data.success) {
        setExports(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch exports: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching exports: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExports();
  }, [integration.id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateExport = async () => {
    try {
      const response = await axios.post('/api/admin/prompt-integration/exports', {
        integrationId: integration.id,
        exportType: exportFormData.exportType,
        exportParameters: exportFormData.exportParameters
      });
      
      if (response.data.success) {
        enqueueSnackbar('Data export created successfully', { variant: 'success' });
        setOpenCreateExportDialog(false);
        fetchExports();
      } else {
        enqueueSnackbar(`Failed to create export: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error creating export: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    }
  };

  const handleExportFormChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setExportFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleExportParameterChange = (name: string, value: any) => {
    setExportFormData(prev => ({
      ...prev,
      exportParameters: {
        ...prev.exportParameters,
        [name]: value
      }
    }));
  };

  const getSystemTypeLabel = (systemType: string) => {
    switch (systemType) {
      case 'grafana':
        return 'Grafana';
      case 'prometheus':
        return 'Prometheus';
      case 'datadog':
        return 'Datadog';
      case 'elasticsearch':
        return 'Elasticsearch';
      case 'custom_api':
        return 'Custom API';
      case 'google_analytics':
        return 'Google Analytics';
      case 'slack':
        return 'Slack';
      case 'power_bi':
        return 'Power BI';
      case 'webhook':
        return 'Webhook';
      default:
        return systemType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getExportTypeLabel = (exportType: string) => {
    switch (exportType) {
      case 'success_metrics':
        return 'Success Metrics';
      case 'experiment_results':
        return 'Experiment Results';
      case 'segment_analytics':
        return 'Segment Analytics';
      case 'ml_predictions':
        return 'ML Predictions';
      case 'raw_data':
        return 'Raw Data';
      default:
        return exportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'executing':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6">{integration.name}</Typography>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Chip 
            label={integration.isActive ? 'Active' : 'Inactive'} 
            color={integration.isActive ? 'success' : 'default'} 
            sx={{ mr: 1 }}
          />
          <Chip 
            label={getSystemTypeLabel(integration.systemType)} 
            color="primary" 
            variant="outlined"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="integration details tabs">
          <Tab icon={<AssessmentIcon />} label="Overview" />
          <Tab icon={<SettingsIcon />} label="Connection" />
          <Tab icon={<HistoryIcon />} label="Exports" />
          <Tab icon={<CodeIcon />} label="JSON" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Integration Information</Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {format(new Date(integration.createdAt), 'PPP')}
                </Typography>
                <Typography variant="body2">
                  <strong>Last Updated:</strong> {format(new Date(integration.updatedAt), 'PPP')}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {getSystemTypeLabel(integration.systemType)}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> {integration.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Exports Summary</Typography>
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  <>
                    <Typography variant="body2">
                      <strong>Total Exports:</strong> {exports.length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Completed:</strong> {exports.filter(e => e.status === 'completed').length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Pending:</strong> {exports.filter(e => e.status === 'pending').length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Failed:</strong> {exports.filter(e => e.status === 'failed').length}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Recent Exports</Typography>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    startIcon={<AddIcon />}
                    onClick={() => setOpenCreateExportDialog(true)}
                  >
                    Create Export
                  </Button>
                </Box>
                {loading ? (
                  <CircularProgress size={24} />
                ) : exports.length === 0 ? (
                  <Typography>No exports found for this integration</Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Executed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {exports.slice(0, 5).map((export_) => (
                          <TableRow key={export_.id}>
                            <TableCell>{getExportTypeLabel(export_.exportType)}</TableCell>
                            <TableCell>
                              <Chip 
                                label={export_.status.charAt(0).toUpperCase() + export_.status.slice(1)} 
                                color={getStatusColor(export_.status)} 
                                size="small" 
                              />
                            </TableCell>
                            <TableCell>{format(new Date(export_.createdAt), 'PPp')}</TableCell>
                            <TableCell>
                              {export_.executedAt ? format(new Date(export_.executedAt), 'PPp') : 'Not executed'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>Connection Parameters</Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Parameter</TableCell>
                <TableCell>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(integration.connectionParameters).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</TableCell>
                  <TableCell>
                    {key.includes('key') || key.includes('password') || key.includes('secret') ? 
                      '••••••••' : 
                      typeof value === 'object' ? 
                        JSON.stringify(value) : 
                        String(value)
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<LinkIcon />}
          >
            Test Connection
          </Button>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Data Exports</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateExportDialog(true)}
          >
            Create Export
          </Button>
        </Box>
        
        {loading ? (
          <CircularProgress size={24} />
        ) : exports.length === 0 ? (
          <Typography>No exports found for this integration</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Parameters</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Executed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exports.map((export_) => (
                  <TableRow key={export_.id}>
                    <TableCell>{getExportTypeLabel(export_.exportType)}</TableCell>
                    <TableCell>
                      {export_.exportParameters.startDate && (
                        <Typography variant="body2">
                          <strong>Date Range:</strong> {format(new Date(export_.exportParameters.startDate), 'PP')} - {format(new Date(export_.exportParameters.endDate), 'PP')}
                        </Typography>
                      )}
                      {export_.exportParameters.promptIds && (
                        <Typography variant="body2">
                          <strong>Prompts:</strong> {Array.isArray(export_.exportParameters.promptIds) ? export_.exportParameters.promptIds.length : 0}
                        </Typography>
                      )}
                      {export_.exportParameters.experimentId && (
                        <Typography variant="body2">
                          <strong>Experiment:</strong> {export_.exportParameters.experimentId}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={export_.status.charAt(0).toUpperCase() + export_.status.slice(1)} 
                        color={getStatusColor(export_.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{format(new Date(export_.createdAt), 'PPp')}</TableCell>
                    <TableCell>
                      {export_.executedAt ? format(new Date(export_.executedAt), 'PPp') : 'Not executed'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>Integration JSON</Typography>
        <Paper sx={{ p: 2 }}>
          <CodeEditor
            value={JSON.stringify(integration, null, 2)}
            language="json"
            height="300px"
            readOnly
          />
        </Paper>
      </TabPanel>

      {/* Create Export Dialog */}
      <Dialog 
        open={openCreateExportDialog} 
        onClose={() => setOpenCreateExportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Data Export</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Export Type</InputLabel>
                  <Select
                    name="exportType"
                    value={exportFormData.exportType}
                    onChange={handleExportFormChange}
                    label="Export Type"
                  >
                    <MenuItem value="success_metrics">Success Metrics</MenuItem>
                    <MenuItem value="experiment_results">Experiment Results</MenuItem>
                    <MenuItem value="segment_analytics">Segment Analytics</MenuItem>
                    <MenuItem value="ml_predictions">ML Predictions</MenuItem>
                    <MenuItem value="raw_data">Raw Data</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={new Date(exportFormData.exportParameters.startDate)}
                    onChange={(date) => handleExportParameterChange('startDate', date?.toISOString() || new Date().toISOString())}
                    slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="End Date"
                    value={new Date(exportFormData.exportParameters.endDate)}
                    onChange={(date) => handleExportParameterChange('endDate', date?.toISOString() || new Date().toISOString())}
                    slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                  />
                </LocalizationProvider>
              </Grid>
              
              {exportFormData.exportType === 'success_metrics' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Prompt IDs (comma-separated)"
                    value={Array.isArray(exportFormData.exportParameters.promptIds) 
                      ? exportFormData.exportParameters.promptIds.join(',') 
                      : exportFormData.exportParameters.promptIds || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleExportParameterChange('promptIds', value ? value.split(',').map(id => id.trim()) : []);
                    }}
                    margin="normal"
                    helperText="Optional: Leave empty to include all prompts"
                  />
                </Grid>
              )}
              
              {exportFormData.exportType === 'experiment_results' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Experiment ID"
                    value={exportFormData.exportParameters.experimentId || ''}
                    onChange={(e) => handleExportParameterChange('experimentId', e.target.value)}
                    margin="normal"
                    required
                  />
                </Grid>
              )}
              
              {exportFormData.exportType === 'segment_analytics' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Segment IDs (comma-separated)"
                    value={Array.isArray(exportFormData.exportParameters.segmentIds) 
                      ? exportFormData.exportParameters.segmentIds.join(',') 
                      : exportFormData.exportParameters.segmentIds || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleExportParameterChange('segmentIds', value ? value.split(',').map(id => id.trim()) : []);
                    }}
                    margin="normal"
                    required
                  />
                </Grid>
              )}
              
              {exportFormData.exportType === 'raw_data' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>SQL Query</Typography>
                  <CodeEditor
                    value={exportFormData.exportParameters.query || 'SELECT * FROM prompt_usage_analytics LIMIT 100'}
                    onChange={(value) => handleExportParameterChange('query', value)}
                    language="sql"
                    height="200px"
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateExportDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateExport} variant="contained" color="primary">
            Create Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegrationDetails;
