import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  BarChart as BarChartIcon,
  CreditCard as CreditCardIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { 
  getAllSubscriptionTiers, 
  getAllUserSubscriptions,
  getSubscriptionAnalytics,
  updateUserSubscription,
  addCreditsToUser,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier
} from '../../services/subscriptionService';
import { SubscriptionTier, UserSubscription, SubscriptionAnalytics } from '../../types/subscription';
import SubscriptionTierForm from './SubscriptionTierForm';
import SubscriptionAnalyticsChart from './SubscriptionAnalyticsChart';

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
      id={`subscription-admin-tabpanel-${index}`}
      aria-labelledby={`subscription-admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const AdminSubscriptionManagement: React.FC = () => {
  const [tabValue, setTabValue] = useState<number>(0);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [tierDialogOpen, setTierDialogOpen] = useState<boolean>(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [tierToDelete, setTierToDelete] = useState<SubscriptionTier | null>(null);
  const [addCreditsDialogOpen, setAddCreditsDialogOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<number>(100);
  const [creditDescription, setCreditDescription] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load data based on active tab
      if (tabValue === 0) {
        // Subscription Tiers
        const tiersResponse = await getAllSubscriptionTiers();
        setTiers(tiersResponse.data);
      } else if (tabValue === 1) {
        // User Subscriptions
        const subscriptionsResponse = await getAllUserSubscriptions(rowsPerPage, page * rowsPerPage, searchTerm, statusFilter);
        setSubscriptions(subscriptionsResponse.data);
      } else if (tabValue === 2) {
        // Analytics
        const analyticsResponse = await getSubscriptionAnalytics();
        setAnalytics(analyticsResponse.data);
      }
    } catch (err: any) {
      console.error('Error loading subscription data:', err);
      setError(err.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tabValue, page, rowsPerPage, searchTerm, statusFilter]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenTierDialog = (tier?: SubscriptionTier) => {
    setEditingTier(tier || null);
    setTierDialogOpen(true);
  };

  const handleCloseTierDialog = () => {
    setTierDialogOpen(false);
    setEditingTier(null);
  };

  const handleOpenDeleteDialog = (tier: SubscriptionTier) => {
    setTierToDelete(tier);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setTierToDelete(null);
  };

  const handleOpenAddCreditsDialog = (userId: string) => {
    setSelectedUser(userId);
    setCreditAmount(100);
    setCreditDescription('Admin credit adjustment');
    setAddCreditsDialogOpen(true);
  };

  const handleCloseAddCreditsDialog = () => {
    setAddCreditsDialogOpen(false);
    setSelectedUser('');
  };

  const handleSaveTier = async (tier: SubscriptionTier) => {
    try {
      setLoading(true);
      
      if (editingTier) {
        // Update existing tier
        await updateSubscriptionTier(tier.id, tier);
      } else {
        // Create new tier
        await createSubscriptionTier(tier);
      }
      
      // Reload tiers
      const tiersResponse = await getAllSubscriptionTiers();
      setTiers(tiersResponse.data);
      
      // Close dialog
      handleCloseTierDialog();
    } catch (err: any) {
      console.error('Error saving subscription tier:', err);
      setError(err.message || 'Failed to save subscription tier');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTier = async () => {
    if (!tierToDelete) return;
    
    try {
      setLoading(true);
      
      // Delete tier
      await deleteSubscriptionTier(tierToDelete.id);
      
      // Reload tiers
      const tiersResponse = await getAllSubscriptionTiers();
      setTiers(tiersResponse.data);
      
      // Close dialog
      handleCloseDeleteDialog();
    } catch (err: any) {
      console.error('Error deleting subscription tier:', err);
      setError(err.message || 'Failed to delete subscription tier');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = async () => {
    try {
      setLoading(true);
      
      // Add credits to user
      await addCreditsToUser(selectedUser, creditAmount, creditDescription);
      
      // Close dialog
      handleCloseAddCreditsDialog();
      
      // Reload subscriptions
      if (tabValue === 1) {
        const subscriptionsResponse = await getAllUserSubscriptions(rowsPerPage, page * rowsPerPage, searchTerm, statusFilter);
        setSubscriptions(subscriptionsResponse.data);
      }
    } catch (err: any) {
      console.error('Error adding credits:', err);
      setError(err.message || 'Failed to add credits');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscriptionStatus = async (subscriptionId: string, status: string) => {
    try {
      setLoading(true);
      
      // Update subscription status
      await updateUserSubscription(subscriptionId, { status });
      
      // Reload subscriptions
      const subscriptionsResponse = await getAllUserSubscriptions(rowsPerPage, page * rowsPerPage, searchTerm, statusFilter);
      setSubscriptions(subscriptionsResponse.data);
    } catch (err: any) {
      console.error('Error updating subscription status:', err);
      setError(err.message || 'Failed to update subscription status');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'info';
      case 'past_due':
        return 'warning';
      case 'canceled':
        return 'error';
      case 'incomplete':
        return 'warning';
      case 'paused':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Subscription Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Subscription Tiers" />
          <Tab label="User Subscriptions" />
          <Tab label="Analytics" />
        </Tabs>

        {/* Subscription Tiers Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">Manage Subscription Tiers</Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenTierDialog()}
            >
              Add New Tier
            </Button>
          </Box>
          
          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Billing Interval</TableCell>
                    <TableCell>Public</TableCell>
                    <TableCell>Stripe Price ID</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        No subscription tiers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    tiers.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell>{tier.name}</TableCell>
                        <TableCell>
                          {tier.price === 0 ? 'Free' : `${tier.currency.toUpperCase()} ${tier.price}`}
                        </TableCell>
                        <TableCell>{tier.billingInterval}</TableCell>
                        <TableCell>
                          <Chip 
                            label={tier.isPublic ? 'Public' : 'Private'} 
                            color={tier.isPublic ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {tier.stripePriceId || 'Not set'}
                        </TableCell>
                        <TableCell>{formatDate(tier.createdAt)}</TableCell>
                        <TableCell>
                          <Tooltip title="Edit">
                            <IconButton onClick={() => handleOpenTierDialog(tier)} size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton 
                              onClick={() => handleOpenDeleteDialog(tier)} 
                              size="small"
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* User Subscriptions Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box mb={3}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Search by User ID or Email"
                  fullWidth
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status Filter</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Status Filter"
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="trialing">Trialing</MenuItem>
                    <MenuItem value="past_due">Past Due</MenuItem>
                    <MenuItem value="canceled">Canceled</MenuItem>
                    <MenuItem value="incomplete">Incomplete</MenuItem>
                    <MenuItem value="paused">Paused</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadData}
                  fullWidth
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
          </Box>
          
          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User ID</TableCell>
                      <TableCell>Tier</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>Next Billing</TableCell>
                      <TableCell>Credits</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subscriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No subscriptions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      subscriptions.map((subscription) => (
                        <TableRow key={subscription.id}>
                          <TableCell>{subscription.userId}</TableCell>
                          <TableCell>{subscription.tier?.name || subscription.tierId}</TableCell>
                          <TableCell>
                            <Chip 
                              label={subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)} 
                              color={getStatusColor(subscription.status) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{formatDate(subscription.startDate)}</TableCell>
                          <TableCell>{formatDate(subscription.currentPeriodEnd)}</TableCell>
                          <TableCell>{subscription.user?.credits || 0}</TableCell>
                          <TableCell>
                            <Tooltip title="View Details">
                              <IconButton size="small">
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Add Credits">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleOpenAddCreditsDialog(subscription.userId)}
                              >
                                <CreditCardIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Subscription History">
                              <IconButton size="small">
                                <HistoryIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <TablePagination
                component="div"
                count={-1} // We don't know the total count, so use -1 to show "..."
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </>
          )}
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">Subscription Analytics</Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
            >
              Refresh
            </Button>
          </Box>
          
          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : analytics ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Revenue Overview
                    </Typography>
                    <Typography variant="h3" component="div" color="primary">
                      ${analytics.revenue.monthly.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Monthly Recurring Revenue (MRR)
                    </Typography>
                    
                    <Box mt={2}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="textSecondary">
                            Annual Revenue (ARR)
                          </Typography>
                          <Typography variant="h6">
                            ${analytics.revenue.annual.toFixed(2)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="textSecondary">
                            Average Revenue Per User
                          </Typography>
                          <Typography variant="h6">
                            ${analytics.revenue.averagePerUser.toFixed(2)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Subscription Metrics
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Total Subscribers
                        </Typography>
                        <Typography variant="h6">
                          {analytics.subscribers.total}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Active Subscribers
                        </Typography>
                        <Typography variant="h6">
                          {analytics.subscribers.active}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Churn Rate
                        </Typography>
                        <Typography variant="h6">
                          {(analytics.churnRate * 100).toFixed(2)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Conversion Rate
                        </Typography>
                        <Typography variant="h6">
                          {(analytics.conversionRate * 100).toFixed(2)}%
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Subscription Distribution
                    </Typography>
                    <SubscriptionAnalyticsChart data={analytics.tierDistribution} />
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recent Activity
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Event</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>User</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.recentActivity.map((activity, index) => (
                            <TableRow key={index}>
                              <TableCell>{activity.event}</TableCell>
                              <TableCell>{formatDate(activity.date)}</TableCell>
                              <TableCell>{activity.userId}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Credit Usage
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Feature</TableCell>
                            <TableCell>Credits Used</TableCell>
                            <TableCell>Percentage</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.creditUsage.map((usage, index) => (
                            <TableRow key={index}>
                              <TableCell>{usage.feature}</TableCell>
                              <TableCell>{usage.credits}</TableCell>
                              <TableCell>{(usage.percentage * 100).toFixed(2)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              No analytics data available
            </Alert>
          )}
        </TabPanel>
      </Paper>
      
      {/* Subscription Tier Dialog */}
      <Dialog 
        open={tierDialogOpen} 
        onClose={handleCloseTierDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTier ? 'Edit Subscription Tier' : 'Create New Subscription Tier'}
        </DialogTitle>
        <DialogContent>
          <SubscriptionTierForm 
            tier={editingTier}
            onSave={handleSaveTier}
            onCancel={handleCloseTierDialog}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Tier Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Subscription Tier</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete the "{tierToDelete?.name}" subscription tier?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Warning: This action cannot be undone. Users subscribed to this tier will need to be migrated.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteTier} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Add Credits Dialog */}
      <Dialog open={addCreditsDialogOpen} onClose={handleCloseAddCreditsDialog}>
        <DialogTitle>Add Credits to User</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            User ID: {selectedUser}
          </Typography>
          
          <TextField
            label="Credit Amount"
            type="number"
            fullWidth
            value={creditAmount}
            onChange={(e) => setCreditAmount(Math.max(1, parseInt(e.target.value) || 0))}
            margin="normal"
            InputProps={{
              inputProps: { min: 1 }
            }}
          />
          
          <TextField
            label="Description"
            fullWidth
            value={creditDescription}
            onChange={(e) => setCreditDescription(e.target.value)}
            margin="normal"
            placeholder="Reason for adding credits"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddCreditsDialog}>Cancel</Button>
          <Button 
            onClick={handleAddCredits} 
            color="primary"
            variant="contained"
            disabled={!creditAmount || !creditDescription}
          >
            Add Credits
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminSubscriptionManagement;
