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
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon,
  History as HistoryIcon,
  BarChart as BarChartIcon,
  Info as InfoIcon,
  Tune as TuneIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  BugReport as BugReportIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { format } from 'date-fns';
import { CodeEditor } from '../../../common/CodeEditor';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

interface MLModelDetailsProps {
  model: {
    id: string;
    name: string;
    description?: string;
    modelType: string;
    modelParameters: Record<string, any>;
    trainingDataQuery?: string;
    trainingMetrics?: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastTrainedAt?: string;
  };
  onRefresh?: () => void;
}

interface ModelVersion {
  id: string;
  modelId: string;
  versionNumber: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingDate: string;
  isActive: boolean;
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
      id={`model-tabpanel-${index}`}
      aria-labelledby={`model-tab-${index}`}
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

const MLModelDetails: React.FC<MLModelDetailsProps> = ({ model, onRefresh }) => {
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [trainingLoading, setTrainingLoading] = useState<boolean>(false);
  const [tabValue, setTabValue] = useState(0);
  const [modelPerformance, setModelPerformance] = useState<any>(null);
  const [featureImportance, setFeatureImportance] = useState<any[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/prompt-ml/models/${model.id}/versions`);
      if (response.data.success) {
        setVersions(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch model versions: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching model versions: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchModelPerformance = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/prompt-ml/models/${model.id}/performance`);
      if (response.data.success) {
        setModelPerformance(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch model performance: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching model performance: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatureImportance = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/prompt-ml/feature-importance?modelId=${model.id}`);
      if (response.data.success) {
        setFeatureImportance(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch feature importance: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching feature importance: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    setTrainingLoading(true);
    try {
      const response = await axios.post(`/api/admin/prompt-ml/models/${model.id}/train`);
      if (response.data.success) {
        enqueueSnackbar('Model training started successfully', { variant: 'success' });
        if (onRefresh) {
          onRefresh();
        }
      } else {
        enqueueSnackbar(`Failed to start model training: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error starting model training: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setTrainingLoading(false);
    }
  };

  useEffect(() => {
    if (model?.id) {
      fetchVersions();
      fetchModelPerformance();
      fetchFeatureImportance();
    }
  }, [model.id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Prepare chart data for training metrics
  const prepareMetricsChartData = () => {
    if (!versions.length) return [];

    return versions.map(version => ({
      version: version.versionNumber,
      accuracy: version.accuracy ? version.accuracy * 100 : 0,
      precision: version.precision ? version.precision * 100 : 0,
      recall: version.recall ? version.recall * 100 : 0,
      f1Score: version.f1Score ? version.f1Score * 100 : 0
    }));
  };

  const getModelTypeLabel = (modelType: string) => {
    switch (modelType) {
      case 'neural_network':
        return 'Neural Network';
      case 'lstm':
        return 'LSTM';
      case 'transformer':
        return 'Transformer';
      case 'random_forest':
        return 'Random Forest';
      case 'gradient_boosting':
        return 'Gradient Boosting';
      default:
        return modelType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getModelTypeColor = (modelType: string) => {
    switch (modelType) {
      case 'neural_network':
        return 'primary';
      case 'lstm':
        return 'secondary';
      case 'transformer':
        return 'info';
      case 'random_forest':
        return 'success';
      case 'gradient_boosting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPromptTypeLabel = (promptType: string) => {
    switch (promptType) {
      case 'material_specific':
        return 'Material Specific';
      case 'agent':
        return 'Agent';
      case 'rag':
        return 'RAG';
      case 'general':
        return 'General Purpose';
      default:
        return promptType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6">{model.name}</Typography>
          {model.description && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {model.description}
            </Typography>
          )}
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Chip
            label={model.isActive ? 'Active' : 'Inactive'}
            color={model.isActive ? 'success' : 'default'}
            sx={{ mr: 1 }}
          />
          <Chip
            label={`Type: ${model.modelType}`}
            color="primary"
            variant="outlined"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="model details tabs">
          <Tab icon={<AssessmentIcon />} label="Overview" />
          <Tab icon={<HistoryIcon />} label="Versions" />
          <Tab icon={<CodeIcon />} label="Configuration" />
          <Tab icon={<TimelineIcon />} label="Metrics" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Model Information</Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {format(new Date(model.createdAt), 'PPP')}
                </Typography>
                <Typography variant="body2">
                  <strong>Last Updated:</strong> {format(new Date(model.updatedAt), 'PPP')}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {model.modelType}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> {model.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Latest Metrics</Typography>
                {model.trainingMetrics ? (
                  <>
                    <Typography variant="body2">
                      <strong>Accuracy:</strong> {model.trainingMetrics.accuracy ? `${(model.trainingMetrics.accuracy * 100).toFixed(2)}%` : 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Precision:</strong> {model.trainingMetrics.precision ? `${(model.trainingMetrics.precision * 100).toFixed(2)}%` : 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Recall:</strong> {model.trainingMetrics.recall ? `${(model.trainingMetrics.recall * 100).toFixed(2)}%` : 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>F1 Score:</strong> {model.trainingMetrics.f1Score ? `${(model.trainingMetrics.f1Score * 100).toFixed(2)}%` : 'N/A'}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2">No training metrics available</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Model Parameters</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Input Dimension:</strong> {model.modelParameters.inputDimension}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Hidden Layers:</strong> {JSON.stringify(model.modelParameters.hiddenLayers)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Activation:</strong> {model.modelParameters.activation}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Output Activation:</strong> {model.modelParameters.outputActivation}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2">
                      <strong>Optimizer:</strong> {model.modelParameters.optimizer}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Loss Function:</strong> {model.modelParameters.loss}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Version</TableCell>
                <TableCell>Training Date</TableCell>
                <TableCell>Accuracy</TableCell>
                <TableCell>Precision</TableCell>
                <TableCell>Recall</TableCell>
                <TableCell>F1 Score</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : versions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No versions found
                  </TableCell>
                </TableRow>
              ) : (
                versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>{version.versionNumber}</TableCell>
                    <TableCell>{format(new Date(version.trainingDate), 'PPP')}</TableCell>
                    <TableCell>{version.accuracy ? `${(version.accuracy * 100).toFixed(2)}%` : 'N/A'}</TableCell>
                    <TableCell>{version.precision ? `${(version.precision * 100).toFixed(2)}%` : 'N/A'}</TableCell>
                    <TableCell>{version.recall ? `${(version.recall * 100).toFixed(2)}%` : 'N/A'}</TableCell>
                    <TableCell>{version.f1Score ? `${(version.f1Score * 100).toFixed(2)}%` : 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={version.isActive ? 'Active' : 'Inactive'}
                        color={version.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>Model Parameters</Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <CodeEditor
            value={JSON.stringify(model.modelParameters, null, 2)}
            language="json"
            height="200px"
            readOnly
          />
        </Paper>

        <Typography variant="h6" gutterBottom>Training Data Query</Typography>
        <Paper sx={{ p: 2 }}>
          <CodeEditor
            value={model.trainingDataQuery || '-- No query available'}
            language="sql"
            height="200px"
            readOnly
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>Training Metrics History</Typography>
        {versions.length === 0 ? (
          <Typography variant="body1">No training metrics available</Typography>
        ) : (
          <Box sx={{ height: 400, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart
                data={prepareMetricsChartData()}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="version" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#8884d8" name="Accuracy" />
                <Line type="monotone" dataKey="precision" stroke="#82ca9d" name="Precision" />
                <Line type="monotone" dataKey="recall" stroke="#ffc658" name="Recall" />
                <Line type="monotone" dataKey="f1Score" stroke="#ff8042" name="F1 Score" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
};

export default MLModelDetails;
