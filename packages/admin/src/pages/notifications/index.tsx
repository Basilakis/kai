import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { 
  Tabs, 
  Tab, 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  BellIcon, 
  ClockIcon, 
  TemplateIcon, 
  ChartBarIcon 
} from '@heroicons/react/outline';
import Link from 'next/link';

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
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
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

function a11yProps(index: number) {
  return {
    id: `notification-tab-${index}`,
    'aria-controls': `notification-tabpanel-${index}`,
  };
}

/**
 * Notification Management Page
 * 
 * This page provides an interface for managing notifications, including:
 * - Viewing and sending notifications
 * - Managing notification templates
 * - Scheduling notifications
 * - Viewing notification analytics
 */
export default function NotificationsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalSent: 0,
    emailSent: 0,
    smsSent: 0,
    pushSent: 0,
    webhookSent: 0,
    openRate: 0,
    clickRate: 0
  });

  useEffect(() => {
    // Fetch notification statistics
    const fetchStats = async () => {
      setLoading(true);
      try {
        // In a real implementation, this would be an API call
        // const response = await fetch('/api/admin/notifications/stats');
        // const data = await response.json();
        
        // Mock data for now
        setTimeout(() => {
          setStats({
            totalSent: 12458,
            emailSent: 8234,
            smsSent: 2145,
            pushSent: 1562,
            webhookSent: 517,
            openRate: 68.4,
            clickRate: 24.7
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error fetching notification stats:', error);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Layout title="Notification Management">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Notification Management</h1>
            <p className="text-gray-600">Manage and monitor notifications across all channels</p>
          </div>
          <div className="flex space-x-2">
            <Link href="/notifications/send">
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<BellIcon className="h-5 w-5" />}
              >
                Send Notification
              </Button>
            </Link>
            <Link href="/notifications/templates/new">
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<TemplateIcon className="h-5 w-5" />}
              >
                Create Template
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Paper className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="subtitle2" color="textSecondary">Total Notifications</Typography>
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4">{stats.totalSent.toLocaleString()}</Typography>
              )}
            </div>
            <BellIcon className="h-10 w-10 text-blue-500" />
          </div>
        </Paper>
        
        <Paper className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="subtitle2" color="textSecondary">Email Open Rate</Typography>
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4">{stats.openRate}%</Typography>
              )}
            </div>
            <ChartBarIcon className="h-10 w-10 text-green-500" />
          </div>
        </Paper>
        
        <Paper className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="subtitle2" color="textSecondary">SMS Delivered</Typography>
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4">{stats.smsSent.toLocaleString()}</Typography>
              )}
            </div>
            <ChartBarIcon className="h-10 w-10 text-purple-500" />
          </div>
        </Paper>
        
        <Paper className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Typography variant="subtitle2" color="textSecondary">Push Notifications</Typography>
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                <Typography variant="h4">{stats.pushSent.toLocaleString()}</Typography>
              )}
            </div>
            <ChartBarIcon className="h-10 w-10 text-yellow-500" />
          </div>
        </Paper>
      </div>

      {/* Tabs */}
      <Paper className="mb-6">
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="notification management tabs"
          >
            <Tab 
              icon={<BellIcon className="h-5 w-5" />} 
              iconPosition="start" 
              label="Notifications" 
              {...a11yProps(0)} 
            />
            <Tab 
              icon={<TemplateIcon className="h-5 w-5" />} 
              iconPosition="start" 
              label="Templates" 
              {...a11yProps(1)} 
            />
            <Tab 
              icon={<ClockIcon className="h-5 w-5" />} 
              iconPosition="start" 
              label="Scheduled" 
              {...a11yProps(2)} 
            />
            <Tab 
              icon={<ChartBarIcon className="h-5 w-5" />} 
              iconPosition="start" 
              label="Analytics" 
              {...a11yProps(3)} 
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <div className="flex justify-between items-center mb-4">
            <Typography variant="h6">Recent Notifications</Typography>
            <Link href="/notifications/history">
              <Button color="primary">View All</Button>
            </Link>
          </div>
          <Divider className="mb-4" />
          
          {loading ? (
            <div className="flex justify-center p-8">
              <CircularProgress />
            </div>
          ) : (
            <div className="space-y-4">
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Welcome Email</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Sent to 24 new users
                    </Typography>
                  </div>
                  <div className="text-right">
                    <Typography variant="caption" color="textSecondary">
                      Email
                    </Typography>
                    <Typography variant="body2">
                      2 hours ago
                    </Typography>
                  </div>
                </div>
              </Paper>
              
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Payment Reminder</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Sent to 8 users with pending payments
                    </Typography>
                  </div>
                  <div className="text-right">
                    <Typography variant="caption" color="textSecondary">
                      SMS
                    </Typography>
                    <Typography variant="body2">
                      Yesterday
                    </Typography>
                  </div>
                </div>
              </Paper>
              
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">New Feature Announcement</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Sent to all active users
                    </Typography>
                  </div>
                  <div className="text-right">
                    <Typography variant="caption" color="textSecondary">
                      Push, Email
                    </Typography>
                    <Typography variant="body2">
                      2 days ago
                    </Typography>
                  </div>
                </div>
              </Paper>
            </div>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <div className="flex justify-between items-center mb-4">
            <Typography variant="h6">Notification Templates</Typography>
            <Link href="/notifications/templates">
              <Button color="primary">View All</Button>
            </Link>
          </div>
          <Divider className="mb-4" />
          
          {loading ? (
            <div className="flex justify-center p-8">
              <CircularProgress />
            </div>
          ) : (
            <div className="space-y-4">
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Welcome Email</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Email template for new user registration
                    </Typography>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="small" variant="outlined">Edit</Button>
                    <Button size="small" variant="contained">Use</Button>
                  </div>
                </div>
              </Paper>
              
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Payment Confirmation</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Email template for successful payments
                    </Typography>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="small" variant="outlined">Edit</Button>
                    <Button size="small" variant="contained">Use</Button>
                  </div>
                </div>
              </Paper>
              
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Password Reset</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Email template for password reset requests
                    </Typography>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="small" variant="outlined">Edit</Button>
                    <Button size="small" variant="contained">Use</Button>
                  </div>
                </div>
              </Paper>
            </div>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <div className="flex justify-between items-center mb-4">
            <Typography variant="h6">Scheduled Notifications</Typography>
            <Link href="/notifications/scheduled">
              <Button color="primary">View All</Button>
            </Link>
          </div>
          <Divider className="mb-4" />
          
          {loading ? (
            <div className="flex justify-center p-8">
              <CircularProgress />
            </div>
          ) : (
            <div className="space-y-4">
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Monthly Newsletter</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Scheduled for June 1, 2023 at 9:00 AM
                    </Typography>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="small" variant="outlined" color="error">Cancel</Button>
                    <Button size="small" variant="outlined">Edit</Button>
                  </div>
                </div>
              </Paper>
              
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Subscription Renewal Reminder</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Scheduled for May 28, 2023 at 10:00 AM
                    </Typography>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="small" variant="outlined" color="error">Cancel</Button>
                    <Button size="small" variant="outlined">Edit</Button>
                  </div>
                </div>
              </Paper>
              
              <Paper className="p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <Typography variant="subtitle1" className="font-medium">Feature Update Announcement</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Scheduled for June 5, 2023 at 2:00 PM
                    </Typography>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="small" variant="outlined" color="error">Cancel</Button>
                    <Button size="small" variant="outlined">Edit</Button>
                  </div>
                </div>
              </Paper>
            </div>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <div className="flex justify-between items-center mb-4">
            <Typography variant="h6">Notification Analytics</Typography>
            <Link href="/notifications/analytics">
              <Button color="primary">View Detailed Reports</Button>
            </Link>
          </div>
          <Divider className="mb-4" />
          
          {loading ? (
            <div className="flex justify-center p-8">
              <CircularProgress />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Paper className="p-4">
                  <Typography variant="subtitle2" color="textSecondary">Notification Delivery by Channel</Typography>
                  <div className="h-64 flex items-center justify-center">
                    <Typography variant="body2" color="textSecondary">Chart Placeholder</Typography>
                  </div>
                </Paper>
                
                <Paper className="p-4">
                  <Typography variant="subtitle2" color="textSecondary">Engagement Rates</Typography>
                  <div className="h-64 flex items-center justify-center">
                    <Typography variant="body2" color="textSecondary">Chart Placeholder</Typography>
                  </div>
                </Paper>
              </div>
              
              <Paper className="p-4">
                <Typography variant="subtitle2" color="textSecondary">Notification Volume Over Time</Typography>
                <div className="h-64 flex items-center justify-center">
                  <Typography variant="body2" color="textSecondary">Chart Placeholder</Typography>
                </div>
              </Paper>
            </div>
          )}
        </TabPanel>
      </Paper>
    </Layout>
  );
}
