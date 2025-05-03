import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { Box, Typography, Tabs, Tab, Paper, Alert, AlertTitle } from '@mui/material';
import GrafanaDashboard from '../../components/monitoring/GrafanaDashboard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * TabPanel Component
 */
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`grafana-tabpanel-${index}`}
      aria-labelledby={`grafana-tab-${index}`}
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

/**
 * Grafana Dashboards Page
 * 
 * Displays embedded Grafana dashboards for monitoring the system.
 */
export default function GrafanaDashboards() {
  const [tabValue, setTabValue] = useState(0);
  
  // Get Grafana URL from environment
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://grafana.kai-ml.svc.cluster.local';
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  return (
    <Layout title="Grafana Dashboards">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Grafana Dashboards
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Monitor system performance and health with Grafana dashboards.
        </Typography>
      </Box>
      
      <Alert severity="info" sx={{ mb: 4 }}>
        <AlertTitle>Grafana Integration</AlertTitle>
        These dashboards are embedded from Grafana. For full functionality, you can open them directly in Grafana.
      </Alert>
      
      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Kubernetes Overview" />
          <Tab label="HPA Metrics" />
          <Tab label="Coordinator Service" />
          <Tab label="Supabase Connection Pool" />
          <Tab label="ML Processing" />
          <Tab label="ML Workflows" />
        </Tabs>
      </Paper>
      
      <TabPanel value={tabValue} index={0}>
        <GrafanaDashboard
          title="Kubernetes Overview"
          description="Overview of Kubernetes cluster resources and health."
          url={`${grafanaUrl}/d/kubernetes-overview/kubernetes-overview?orgId=1&refresh=10s&kiosk`}
          height={800}
          refreshInterval={30}
        />
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <GrafanaDashboard
          title="HPA Metrics Dashboard"
          description="Horizontal Pod Autoscaler metrics and scaling events."
          url={`${grafanaUrl}/d/hpa-metrics/kubernetes-hpa-metrics?orgId=1&refresh=10s&kiosk`}
          height={800}
          refreshInterval={30}
        />
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <GrafanaDashboard
          title="Coordinator Service Dashboard"
          description="Metrics for the Coordinator service including queue depths and workflow durations."
          url={`${grafanaUrl}/d/coordinator-service/coordinator-service?orgId=1&refresh=10s&kiosk`}
          height={800}
          refreshInterval={30}
        />
      </TabPanel>
      
      <TabPanel value={tabValue} index={3}>
        <GrafanaDashboard
          title="Supabase Connection Pool Dashboard"
          description="Database connection pool metrics and performance."
          url={`${grafanaUrl}/d/supabase-connection-pool/supabase-connection-pool?orgId=1&refresh=10s&kiosk`}
          height={800}
          refreshInterval={30}
        />
      </TabPanel>
      
      <TabPanel value={tabValue} index={4}>
        <GrafanaDashboard
          title="ML Processing Dashboard"
          description="Metrics for ML processing stages and performance."
          url={`${grafanaUrl}/d/ml-processing/ml-processing?orgId=1&refresh=10s&kiosk`}
          height={800}
          refreshInterval={30}
        />
      </TabPanel>
      
      <TabPanel value={tabValue} index={5}>
        <GrafanaDashboard
          title="ML Workflows Dashboard"
          description="Execution times and resource usage of ML pipelines."
          url={`${grafanaUrl}/d/ml-workflows/ml-workflows?orgId=1&refresh=10s&kiosk`}
          height={800}
          refreshInterval={30}
        />
      </TabPanel>
    </Layout>
  );
}
