import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { 
  Typography, 
  Paper, 
  Button, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  Chip,
  Grid,
  Box,
  Divider,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  BellIcon, 
  MailIcon, 
  PhoneIcon, 
  GlobeIcon,
  UserGroupIcon,
  CalendarIcon
} from '@heroicons/react/outline';
import Link from 'next/link';

/**
 * Send Notification Page
 * 
 * This page provides an interface for sending notifications to users
 * through various channels (email, SMS, push, in-app).
 */
export default function SendNotificationPage() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    channels: ['email'],
    recipients: 'all',
    userGroups: [],
    specificUsers: '',
    templateId: '',
    schedule: false,
    scheduledDate: '',
    scheduledTime: ''
  });
  const [formErrors, setFormErrors] = useState({
    title: '',
    message: '',
    channels: '',
    recipients: '',
    userGroups: '',
    specificUsers: '',
    scheduledDate: '',
    scheduledTime: ''
  });

  // Available channels
  const channels = [
    { value: 'email', label: 'Email', icon: MailIcon },
    { value: 'sms', label: 'SMS', icon: PhoneIcon },
    { value: 'push', label: 'Push Notification', icon: BellIcon },
    { value: 'in_app', label: 'In-App Notification', icon: BellIcon },
    { value: 'webhook', label: 'Webhook', icon: GlobeIcon }
  ];

  // Available user groups
  const userGroups = [
    { value: 'all_users', label: 'All Users' },
    { value: 'active_users', label: 'Active Users' },
    { value: 'inactive_users', label: 'Inactive Users' },
    { value: 'free_tier', label: 'Free Tier Users' },
    { value: 'basic_tier', label: 'Basic Tier Users' },
    { value: 'premium_tier', label: 'Premium Tier Users' },
    { value: 'enterprise_tier', label: 'Enterprise Tier Users' }
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/notification-templates');
      // const data = await response.json();
      
      // Mock data for now
      setTemplates([
        { id: '1', name: 'Welcome Email', type: 'email' },
        { id: '2', name: 'Password Reset', type: 'email' },
        { id: '3', name: 'Payment Confirmation', type: 'email' },
        { id: '4', name: 'New Feature Announcement', type: 'email' },
        { id: '5', name: 'Payment Reminder', type: 'sms' }
      ]);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const validateForm = () => {
    let valid = true;
    const errors = {
      title: '',
      message: '',
      channels: '',
      recipients: '',
      userGroups: '',
      specificUsers: '',
      scheduledDate: '',
      scheduledTime: ''
    };

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
      valid = false;
    }

    if (!formData.message.trim()) {
      errors.message = 'Message is required';
      valid = false;
    }

    if (!formData.channels.length) {
      errors.channels = 'At least one channel must be selected';
      valid = false;
    }

    if (formData.recipients === 'groups' && !formData.userGroups.length) {
      errors.userGroups = 'At least one user group must be selected';
      valid = false;
    }

    if (formData.recipients === 'specific' && !formData.specificUsers.trim()) {
      errors.specificUsers = 'Please enter at least one user ID or email';
      valid = false;
    }

    if (formData.schedule) {
      if (!formData.scheduledDate) {
        errors.scheduledDate = 'Date is required for scheduled notifications';
        valid = false;
      }
      
      if (!formData.scheduledTime) {
        errors.scheduledTime = 'Time is required for scheduled notifications';
        valid = false;
      }
    }

    setFormErrors(errors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/notifications/send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // });
      
      // Mock success
      setTimeout(() => {
        setSnackbar({
          open: true,
          message: formData.schedule 
            ? 'Notification scheduled successfully!' 
            : 'Notification sent successfully!',
          severity: 'success'
        });
        setLoading(false);
        
        // Reset form
        setFormData({
          title: '',
          message: '',
          channels: ['email'],
          recipients: 'all',
          userGroups: [],
          specificUsers: '',
          templateId: '',
          schedule: false,
          scheduledDate: '',
          scheduledTime: ''
        });
      }, 1500);
    } catch (error) {
      console.error('Error sending notification:', error);
      setSnackbar({
        open: true,
        message: 'Failed to send notification. Please try again.',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Layout title="Send Notification">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Send Notification</h1>
            <p className="text-gray-600">Send notifications to users through multiple channels</p>
          </div>
          <Link href="/notifications">
            <Button variant="outlined">Back to Notifications</Button>
          </Link>
        </div>
      </div>

      <Paper className="p-6">
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            {/* Notification Content */}
            <Grid item xs={12}>
              <Typography variant="h6" className="mb-2">Notification Content</Typography>
              <Divider className="mb-4" />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Notification Title"
                fullWidth
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                error={!!formErrors.title}
                helperText={formErrors.title}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="template-label">Use Template (Optional)</InputLabel>
                <Select
                  labelId="template-label"
                  value={formData.templateId}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value as string })}
                >
                  <MenuItem value="">None</MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Select a template or create a custom message
                </FormHelperText>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Message"
                fullWidth
                multiline
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                error={!!formErrors.message}
                helperText={formErrors.message}
                required
              />
            </Grid>
            
            {/* Delivery Channels */}
            <Grid item xs={12}>
              <Typography variant="h6" className="mb-2">Delivery Channels</Typography>
              <Divider className="mb-4" />
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth error={!!formErrors.channels} required>
                <InputLabel id="channels-label">Channels</InputLabel>
                <Select
                  labelId="channels-label"
                  multiple
                  value={formData.channels}
                  onChange={(e) => setFormData({ ...formData, channels: e.target.value as string[] })}
                  renderValue={(selected) => (
                    <div className="flex flex-wrap gap-1">
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </div>
                  )}
                >
                  {channels.map((channel) => (
                    <MenuItem key={channel.value} value={channel.value}>
                      <div className="flex items-center">
                        <channel.icon className="h-5 w-5 mr-2" />
                        {channel.label}
                      </div>
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.channels && <FormHelperText>{formErrors.channels}</FormHelperText>}
              </FormControl>
            </Grid>
            
            {/* Recipients */}
            <Grid item xs={12}>
              <Typography variant="h6" className="mb-2">Recipients</Typography>
              <Divider className="mb-4" />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel id="recipients-label">Recipients</InputLabel>
                <Select
                  labelId="recipients-label"
                  value={formData.recipients}
                  onChange={(e) => setFormData({ ...formData, recipients: e.target.value as string })}
                >
                  <MenuItem value="all">All Users</MenuItem>
                  <MenuItem value="groups">User Groups</MenuItem>
                  <MenuItem value="specific">Specific Users</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {formData.recipients === 'groups' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!formErrors.userGroups} required>
                  <InputLabel id="user-groups-label">User Groups</InputLabel>
                  <Select
                    labelId="user-groups-label"
                    multiple
                    value={formData.userGroups}
                    onChange={(e) => setFormData({ ...formData, userGroups: e.target.value as string[] })}
                    renderValue={(selected) => (
                      <div className="flex flex-wrap gap-1">
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </div>
                    )}
                  >
                    {userGroups.map((group) => (
                      <MenuItem key={group.value} value={group.value}>
                        {group.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.userGroups && <FormHelperText>{formErrors.userGroups}</FormHelperText>}
                </FormControl>
              </Grid>
            )}
            
            {formData.recipients === 'specific' && (
              <Grid item xs={12} md={6}>
                <TextField
                  label="User IDs or Emails"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.specificUsers}
                  onChange={(e) => setFormData({ ...formData, specificUsers: e.target.value })}
                  error={!!formErrors.specificUsers}
                  helperText={formErrors.specificUsers || "Enter user IDs or emails, separated by commas"}
                  required
                />
              </Grid>
            )}
            
            {/* Scheduling */}
            <Grid item xs={12}>
              <Typography variant="h6" className="mb-2">Scheduling</Typography>
              <Divider className="mb-4" />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="schedule-label">Scheduling</InputLabel>
                <Select
                  labelId="schedule-label"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value as boolean })}
                >
                  <MenuItem value={false}>Send Immediately</MenuItem>
                  <MenuItem value={true}>Schedule for Later</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {formData.schedule && (
              <>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Date"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    error={!!formErrors.scheduledDate}
                    helperText={formErrors.scheduledDate}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Time"
                    type="time"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    error={!!formErrors.scheduledTime}
                    helperText={formErrors.scheduledTime}
                    required
                  />
                </Grid>
              </>
            )}
            
            {/* Submit Button */}
            <Grid item xs={12} className="mt-4">
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : 
                  formData.schedule ? <CalendarIcon className="h-5 w-5" /> : <BellIcon className="h-5 w-5" />
                }
              >
                {loading ? 'Processing...' : formData.schedule ? 'Schedule Notification' : 'Send Notification'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
      
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
