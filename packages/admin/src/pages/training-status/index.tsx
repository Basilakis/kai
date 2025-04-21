import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  CompareArrows as CompareArrowsIcon,
  Storage as StorageIcon,
  ViewInAr as ViewInArIcon,
  Refresh as RefreshIcon,
  ThumbsUpDown as ThumbsUpDownIcon
} from '@mui/icons-material';
import Layout from '../../components/Layout';
import TrainingProgressPanel from '../../components/training-status/TrainingProgressPanel';
import ABTestingPanel from '../../components/training-status/ABTestingPanel';
import ModelPerformancePanel from '../../components/training-status/ModelPerformancePanel';
import VectorDatabasePanel from '../../components/training-status/VectorDatabasePanel';
import VisualizationPanel from '../../components/training-status/VisualizationPanel';
import ResponseQualityPanel from '../../components/training-status/ResponseQualityPanel';

// Interface for tab panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab Panel component
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`training-tabpanel-${index}`}
      aria-labelledby={`training-tab-${index}`}
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

// Training Status Dashboard page
export default function TrainingStatusDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Refresh data
  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would fetch the latest data
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to refresh data. Please try again.');
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <Layout title="Training Status Dashboard">
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Training Status Dashboard
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>

        {lastUpdated && (
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated.toLocaleString()}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Active Training Jobs
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h3" component="div" sx={{ mr: 2 }}>
                  3
                </Typography>
                <Chip label="2 GPU, 1 CPU" size="small" color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                A/B Tests
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h3" component="div" sx={{ mr: 2 }}>
                  2
                </Typography>
                <Chip label="1 Significant" size="small" color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Model Versions
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h3" component="div">
                  12
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div" gutterBottom>
                Vector DB Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="h3" component="div" sx={{ mr: 2 }}>
                  98%
                </Typography>
                <Chip label="Healthy" size="small" color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for different sections */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="training dashboard tabs">
          <Tab icon={<TimelineIcon />} label="Training Progress" id="training-tab-0" aria-controls="training-tabpanel-0" />
          <Tab icon={<CompareArrowsIcon />} label="A/B Testing" id="training-tab-1" aria-controls="training-tabpanel-1" />
          <Tab icon={<BarChartIcon />} label="Model Performance" id="training-tab-2" aria-controls="training-tabpanel-2" />
          <Tab icon={<ViewInArIcon />} label="3D Visualization" id="training-tab-3" aria-controls="training-tabpanel-3" />
          <Tab icon={<StorageIcon />} label="Vector Database" id="training-tab-4" aria-controls="training-tabpanel-4" />
          <Tab icon={<ThumbsUpDownIcon />} label="Response Quality" id="training-tab-5" aria-controls="training-tabpanel-5" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <TrainingProgressPanel />
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <ABTestingPanel />
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        <ModelPerformancePanel />
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        <VisualizationPanel />
      </TabPanel>
      <TabPanel value={activeTab} index={4}>
        <VectorDatabasePanel />
      </TabPanel>
      <TabPanel value={activeTab} index={5}>
        <ResponseQualityPanel />
      </TabPanel>
    </Layout>
  );
}
