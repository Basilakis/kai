import React from 'react';
import { Container, Typography, Box, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CreditUsageDetails from '../../components/subscription/CreditUsageDetails';
import DashboardLayout from '../../layouts/DashboardLayout';

/**
 * Credits page for viewing credit balance and usage
 */
const CreditsPage: React.FC = () => {
  return (
    <DashboardLayout>
      <Container maxWidth="lg">
        <Box mb={4}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/dashboard" color="inherit">
              Dashboard
            </Link>
            <Link component={RouterLink} to="/subscription" color="inherit">
              Subscription
            </Link>
            <Typography color="textPrimary">Credits</Typography>
          </Breadcrumbs>
          
          <Box mt={2}>
            <Typography variant="h4" component="h1" gutterBottom>
              Credits & Usage
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              Manage your credits and view usage across different services.
            </Typography>
          </Box>
        </Box>
        
        <CreditUsageDetails />
      </Container>
    </DashboardLayout>
  );
};

export default CreditsPage;
