import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Breadcrumbs,
  Link
} from '../../components/mui';
import Layout from '../../components/Layout';
import TrainingMonitor from '../../components/training/TrainingMonitor';

/**
 * TrainingMonitoringPage
 *
 * Admin interface for monitoring and managing ML model training
 * with real-time visualization, parameter tuning, and checkpoint management.
 */
const TrainingMonitoringPage: React.FC = () => {
  return (
    <Layout>
      <Container maxWidth="xl">
        <Box sx={{ my: 3 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link color="inherit" href="/admin">
              Dashboard
            </Link>
            <Typography color="text.primary">Training Monitor</Typography>
          </Breadcrumbs>

          <Typography variant="h4" component="h1" gutterBottom>
            Training Monitoring
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Monitor and manage ML model training with real-time visualization and controls.
          </Typography>

          <Paper sx={{ p: 0, overflow: 'hidden' }}>
            <TrainingMonitor />
          </Paper>
        </Box>
      </Container>
    </Layout>
  );
};

export default TrainingMonitoringPage;