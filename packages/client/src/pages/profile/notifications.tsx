import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Switch, 
  FormControlLabel, 
  Divider, 
  Button, 
  CircularProgress,
  Alert,
  Snackbar,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton
} from '@mui/material';
import { 
  ChevronDownIcon, 
  BellIcon, 
  MailIcon, 
  PhoneIcon, 
  DeviceMobileIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/outline';
import Layout from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabaseClient';

/**
 * User Profile Notifications Page
 * 
 * This page allows users to manage their notification preferences and view their notification history.
 */
export default function ProfileNotificationsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<any>({
    email_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    in_app_enabled: true,
    marketing_enabled: true,
    transaction_enabled: true,
    social_enabled: true,
    security_enabled: true
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  // Event type preferences
  const eventTypePreferences = [
    { key: 'user.registered', label: 'Account Registration', defaultChannels: ['email'] },
    { key: 'user.login', label: 'Account Login', defaultChannels: ['email', 'push'] },
    { key: 'user.password_reset', label: 'Password Reset', defaultChannels: ['email'] },
    { key: 'subscription.created', label: 'Subscription Created', defaultChannels: ['email', 'in_app'] },
    { key: 'subscription.updated', label: 'Subscription Updated', defaultChannels: ['email', 'in_app'] },
    { key: 'subscription.cancelled', label: 'Subscription Cancelled', defaultChannels: ['email', 'in_app'] },
    { key: 'payment.succeeded', label: 'Payment Succeeded', defaultChannels: ['email', 'in_app'] },
    { key: 'payment.failed', label: 'Payment Failed', defaultChannels: ['email', 'sms', 'in_app'] },
    { key: 'credit.balance_low', label: 'Credit Balance Low', defaultChannels: ['email', 'push', 'in_app'] },
    { key: 'credit.added', label: 'Credits Added', defaultChannels: ['email', 'in_app'] },
    { key: 'content.shared', label: 'Content Shared With You', defaultChannels: ['email', 'push', 'in_app'] }
  ];

  useEffect(() => {
    if (user) {
      fetchPreferences();
      fetchNotifications();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/preferences');
      
      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setPreferences(data.data);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load notification preferences. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        throw error;
      }
      
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }
      
      setSnackbar({
        open: true,
        message: 'Notification preferences updated successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update notification preferences. Please try again.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChannel = (channel: string, enabled: boolean) => {
    setPreferences({
      ...preferences,
      [`${channel}_enabled`]: enabled
    });
  };

  const handleToggleEventChannel = (eventType: string, channel: string, enabled: boolean) => {
    setPreferences({
      ...preferences,
      [`${eventType}_${channel}`]: enabled
    });
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/mark-all-as-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
      
      // Update local state
      setNotifications(notifications.map(notification => ({
        ...notification,
        is_read: true
      })));
      
      setSnackbar({
        open: true,
        message: 'All notifications marked as read!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      setSnackbar({
        open: true,
        message: 'Failed to mark notifications as read. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/notifications/mark-as-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [id] })
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === id ? { ...notification, is_read: true } : notification
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setSnackbar({
        open: true,
        message: 'Failed to mark notification as read. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [id] })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      // Update local state
      setNotifications(notifications.filter(notification => notification.id !== id));
      
      setSnackbar({
        open: true,
        message: 'Notification deleted successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete notification. Please try again.',
        severity: 'error'
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleTestNotification = async (type: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send test ${type} notification`);
      }
      
      setSnackbar({
        open: true,
        message: `Test ${type} notification sent successfully!`,
        severity: 'success'
      });
      
      // Refresh notifications for in-app notifications
      if (type === 'in_app') {
        setTimeout(() => {
          fetchNotifications();
        }, 1000);
      }
    } catch (error) {
      console.error(`Error sending test ${type} notification:`, error);
      setSnackbar({
        open: true,
        message: `Failed to send test ${type} notification. Please try again.`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const isEventChannelEnabled = (eventType: string, channel: string) => {
    // Check if there's a specific preference for this event+channel
    if (preferences[`${eventType}_${channel}`] !== undefined) {
      return preferences[`${eventType}_${channel}`];
    }
    
    // Otherwise, fall back to the channel's global setting
    return preferences[`${channel}_enabled`] !== false;
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <CircularProgress />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Notification Preferences</h1>
            <p className="text-gray-600">Manage how you receive notifications from our platform</p>
          </div>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleSavePreferences}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Preferences'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Paper className="mb-6">
            <div className="p-4 border-b">
              <Typography variant="h6">Notification Channels</Typography>
              <Typography variant="body2" color="textSecondary">
                Choose which channels you want to receive notifications on
              </Typography>
            </div>
            
            <div className="p-4 space-y-4">
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.email_enabled !== false}
                    onChange={(e) => handleToggleChannel('email', e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <div className="flex items-center">
                    <MailIcon className="h-5 w-5 mr-2 text-blue-500" />
                    <span>Email Notifications</span>
                  </div>
                }
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.sms_enabled !== false}
                    onChange={(e) => handleToggleChannel('sms', e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <div className="flex items-center">
                    <PhoneIcon className="h-5 w-5 mr-2 text-green-500" />
                    <span>SMS Notifications</span>
                  </div>
                }
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.push_enabled !== false}
                    onChange={(e) => handleToggleChannel('push', e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <div className="flex items-center">
                    <DeviceMobileIcon className="h-5 w-5 mr-2 text-purple-500" />
                    <span>Push Notifications</span>
                  </div>
                }
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.in_app_enabled !== false}
                    onChange={(e) => handleToggleChannel('in_app', e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <div className="flex items-center">
                    <BellIcon className="h-5 w-5 mr-2 text-yellow-500" />
                    <span>In-App Notifications</span>
                  </div>
                }
              />
              
              <Divider className="my-4" />
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => handleTestNotification('email')}
                  disabled={loading || preferences.email_enabled === false}
                >
                  Test Email
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => handleTestNotification('sms')}
                  disabled={loading || preferences.sms_enabled === false}
                >
                  Test SMS
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => handleTestNotification('in_app')}
                  disabled={loading || preferences.in_app_enabled === false}
                >
                  Test In-App
                </Button>
              </div>
            </div>
          </Paper>
          
          <Paper className="mb-6">
            <div className="p-4 border-b">
              <Typography variant="h6">Notification Categories</Typography>
              <Typography variant="body2" color="textSecondary">
                Choose which types of notifications you want to receive
              </Typography>
            </div>
            
            <div className="p-4 space-y-4">
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.transaction_enabled !== false}
                    onChange={(e) => setPreferences({ ...preferences, transaction_enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label="Transactional (payments, subscriptions, account changes)"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.security_enabled !== false}
                    onChange={(e) => setPreferences({ ...preferences, security_enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label="Security (login attempts, password changes)"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.social_enabled !== false}
                    onChange={(e) => setPreferences({ ...preferences, social_enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label="Social (mentions, shares, comments)"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.marketing_enabled !== false}
                    onChange={(e) => setPreferences({ ...preferences, marketing_enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label="Marketing (new features, promotions, newsletters)"
              />
            </div>
          </Paper>
          
          <Paper>
            <div className="p-4 border-b">
              <Typography variant="h6">Event-Specific Preferences</Typography>
              <Typography variant="body2" color="textSecondary">
                Fine-tune which channels to use for specific events
              </Typography>
            </div>
            
            <div className="p-4">
              {eventTypePreferences.map((event) => (
                <Accordion key={event.key} className="mb-2">
                  <AccordionSummary expandIcon={<ChevronDownIcon className="h-5 w-5" />}>
                    <Typography>{event.label}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <div className="space-y-2">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEventChannelEnabled(event.key, 'email')}
                            onChange={(e) => handleToggleEventChannel(event.key, 'email', e.target.checked)}
                            color="primary"
                            disabled={preferences.email_enabled === false}
                          />
                        }
                        label={
                          <div className="flex items-center">
                            <MailIcon className="h-4 w-4 mr-2 text-blue-500" />
                            <span>Email</span>
                          </div>
                        }
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEventChannelEnabled(event.key, 'sms')}
                            onChange={(e) => handleToggleEventChannel(event.key, 'sms', e.target.checked)}
                            color="primary"
                            disabled={preferences.sms_enabled === false}
                          />
                        }
                        label={
                          <div className="flex items-center">
                            <PhoneIcon className="h-4 w-4 mr-2 text-green-500" />
                            <span>SMS</span>
                          </div>
                        }
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEventChannelEnabled(event.key, 'push')}
                            onChange={(e) => handleToggleEventChannel(event.key, 'push', e.target.checked)}
                            color="primary"
                            disabled={preferences.push_enabled === false}
                          />
                        }
                        label={
                          <div className="flex items-center">
                            <DeviceMobileIcon className="h-4 w-4 mr-2 text-purple-500" />
                            <span>Push</span>
                          </div>
                        }
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEventChannelEnabled(event.key, 'in_app')}
                            onChange={(e) => handleToggleEventChannel(event.key, 'in_app', e.target.checked)}
                            color="primary"
                            disabled={preferences.in_app_enabled === false}
                          />
                        }
                        label={
                          <div className="flex items-center">
                            <BellIcon className="h-4 w-4 mr-2 text-yellow-500" />
                            <span>In-App</span>
                          </div>
                        }
                      />
                    </div>
                  </AccordionDetails>
                </Accordion>
              ))}
            </div>
          </Paper>
        </div>
        
        <div>
          <Paper>
            <div className="p-4 border-b flex justify-between items-center">
              <Typography variant="h6">Recent Notifications</Typography>
              <Button 
                variant="text" 
                size="small"
                onClick={handleMarkAllAsRead}
                disabled={loading || notifications.every(n => n.is_read)}
              >
                Mark All Read
              </Button>
            </div>
            
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center items-center p-8">
                <CircularProgress />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <Typography variant="body1" color="textSecondary">
                  No notifications yet
                </Typography>
              </div>
            ) : (
              <List>
                {notifications.map((notification) => (
                  <ListItem 
                    key={notification.id} 
                    className={`border-b ${!notification.is_read ? 'bg-blue-50' : ''}`}
                  >
                    <ListItemText
                      primary={
                        <div className="flex items-center">
                          <Typography variant="subtitle2" className="mr-2">
                            {notification.title}
                          </Typography>
                          {!notification.is_read && (
                            <Chip 
                              label="New" 
                              size="small" 
                              color="primary" 
                              className="h-5"
                            />
                          )}
                        </div>
                      }
                      secondary={
                        <div>
                          <Typography variant="body2" className="text-gray-600">
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" className="text-gray-500">
                            {formatDate(notification.created_at)}
                          </Typography>
                        </div>
                      }
                    />
                    <ListItemSecondaryAction>
                      <div className="flex space-x-1">
                        {!notification.is_read && (
                          <IconButton 
                            edge="end" 
                            size="small" 
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          </IconButton>
                        )}
                        <IconButton 
                          edge="end" 
                          size="small" 
                          onClick={() => handleDeleteNotification(notification.id)}
                        >
                          <TrashIcon className="h-5 w-5 text-red-500" />
                        </IconButton>
                      </div>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </div>
      </div>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
