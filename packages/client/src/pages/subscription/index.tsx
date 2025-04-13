import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { navigate } from 'gatsby';
import { useUser } from '../../providers/UserProvider';
import SubscriptionPlans from '../../components/subscription/SubscriptionPlans';
import PaymentForm from '../../components/subscription/PaymentForm';
import CreditManagement from '../../components/subscription/CreditManagement';
import { getCurrentSubscription, cancelSubscription } from '../../services/subscriptionService';
import { SubscriptionTier, UserSubscription } from '../../types/subscription';
import Layout from '../../components/layout/Layout';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`subscription-tabpanel-${index}`}
      aria-labelledby={`subscription-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const SubscriptionPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useUser();
  const [tabValue, setTabValue] = useState<number>(0);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getCurrentSubscription();
      setSubscription(response.data);
      setSubscriptionTier(response.data.tier);
    } catch (err: any) {
      console.error('Error loading subscription data:', err);
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadSubscriptionData();
    }
  }, [isAuthenticated, isLoading]);

  const handleSelectPlan = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
  };

  const handleSubscriptionSuccess = () => {
    setSelectedTier(null);
    loadSubscriptionData();
    // Show the current subscription tab
    setTabValue(0);
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      setCancelError(null);
      
      await cancelSubscription();
      
      // Reload subscription data
      await loadSubscriptionData();
      
      // Close dialog
      setCancelDialogOpen(false);
    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setCancelError(err.message || 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { state: { from: '/subscription' } });
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <Layout>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress />
          </Box>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg">
        <Box mb={4}>
          <Typography variant="h3" component="h1" gutterBottom>
            Subscription Management
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Manage your subscription, credits, and payment methods
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {selectedTier ? (
          <Box>
            <Typography variant="h5" gutterBottom>
              Subscribe to {selectedTier.name} Plan
            </Typography>
            <PaymentForm
              selectedTier={selectedTier}
              onSuccess={handleSubscriptionSuccess}
              onCancel={() => setSelectedTier(null)}
            />
          </Box>
        ) : (
          <>
            <Paper sx={{ mb: 4 }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab label="Current Subscription" />
                <Tab label="Available Plans" />
                <Tab label="Credits" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                {loading ? (
                  <Box display="flex" justifyContent="center" my={4}>
                    <CircularProgress />
                  </Box>
                ) : subscription ? (
                  <Box p={2}>
                    <Typography variant="h5" gutterBottom>
                      {subscriptionTier?.name} Plan
                    </Typography>
                    
                    <Box display="flex" alignItems="center" mb={2}>
                      <Typography variant="body1" sx={{ mr: 1 }}>
                        Status:
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: subscription.status === 'active' ? 'success.main' : 
                                 subscription.status === 'trialing' ? 'info.main' : 
                                 'error.main'
                        }}
                      >
                        {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body1" gutterBottom>
                      Price: {subscriptionTier?.price ? 
                        `$${subscriptionTier.price}/${subscriptionTier.billingInterval}` : 
                        'Free'}
                    </Typography>
                    
                    {subscription.currentPeriodEnd && (
                      <Typography variant="body1" gutterBottom>
                        Current Period Ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </Typography>
                    )}
                    
                    {subscription.cancelAtPeriodEnd && (
                      <Alert severity="warning" sx={{ mt: 2, mb: 3 }}>
                        Your subscription will be canceled at the end of the current billing period.
                      </Alert>
                    )}
                    
                    <Box mt={3}>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => setTabValue(1)}
                        sx={{ mr: 2 }}
                      >
                        Change Plan
                      </Button>
                      
                      {subscription.status !== 'canceled' && !subscription.cancelAtPeriodEnd && (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => setCancelDialogOpen(true)}
                        >
                          Cancel Subscription
                        </Button>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Box p={2} textAlign="center">
                    <Typography variant="body1" gutterBottom>
                      You don't have an active subscription.
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => setTabValue(1)}
                      sx={{ mt: 2 }}
                    >
                      View Available Plans
                    </Button>
                  </Box>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <SubscriptionPlans onSelectPlan={handleSelectPlan} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <CreditManagement />
              </TabPanel>
            </Paper>
          </>
        )}
        
        {/* Cancel Subscription Dialog */}
        <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogContent>
            <Typography variant="body1" paragraph>
              Are you sure you want to cancel your subscription?
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Your subscription will remain active until the end of the current billing period.
              After that, you will be downgraded to the free plan.
            </Typography>
            
            {cancelError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {cancelError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>
              Keep Subscription
            </Button>
            <Button
              onClick={handleCancelSubscription}
              color="error"
              disabled={cancelLoading}
            >
              {cancelLoading ? <CircularProgress size={24} /> : 'Cancel Subscription'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default SubscriptionPage;
