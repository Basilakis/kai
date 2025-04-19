import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Typography, 
  Paper, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
  Tooltip,
  Box,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  ExternalLinkIcon,
  RefreshIcon,
  PlayIcon,
  EyeIcon,
  ClipboardCopyIcon
} from '@heroicons/react/outline';
import Layout from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabaseClient';

/**
 * User Profile Webhooks Page
 * 
 * This page allows users to manage their webhook integrations from their profile.
 */
export default function ProfileWebhooksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [],
    isActive: true
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    url: '',
    events: ''
  });

  // Available event types
  const eventTypes = [
    { value: 'user.profile_updated', label: 'Profile Updated' },
    { value: 'subscription.created', label: 'Subscription Created' },
    { value: 'subscription.updated', label: 'Subscription Updated' },
    { value: 'subscription.cancelled', label: 'Subscription Cancelled' },
    { value: 'payment.succeeded', label: 'Payment Succeeded' },
    { value: 'payment.failed', label: 'Payment Failed' },
    { value: 'credit.added', label: 'Credits Added' },
    { value: 'credit.used', label: 'Credits Used' },
    { value: 'content.created', label: 'Content Created' },
    { value: 'content.updated', label: 'Content Updated' },
    { value: 'content.shared', label: 'Content Shared' }
  ];

  useEffect(() => {
    if (user) {
      fetchWebhooks();
    }
  }, [user]);

  const fetchWebhooks = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhook_configurations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load webhooks. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (webhook = null) => {
    if (webhook) {
      setSelectedWebhook(webhook);
      setFormData({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.is_active
      });
    } else {
      setSelectedWebhook(null);
      setFormData({
        name: '',
        url: '',
        events: [],
        isActive: true
      });
    }
    setFormErrors({
      name: '',
      url: '',
      events: ''
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setShowSecret(false);
    setWebhookSecret('');
  };

  const validateForm = () => {
    let valid = true;
    const errors = {
      name: '',
      url: '',
      events: ''
    };

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      valid = false;
    }

    if (!formData.url.trim()) {
      errors.url = 'URL is required';
      valid = false;
    } else if (!isValidUrl(formData.url)) {
      errors.url = 'Please enter a valid URL';
      valid = false;
    }

    if (!formData.events.length) {
      errors.events = 'At least one event must be selected';
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user) return;

    setLoading(true);
    try {
      if (selectedWebhook) {
        // Update existing webhook
        const { error } = await supabase
          .from('webhook_configurations')
          .update({
            name: formData.name,
            url: formData.url,
            events: formData.events,
            is_active: formData.isActive,
            updated_at: new Date()
          })
          .eq('id', selectedWebhook.id)
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        setSnackbar({
          open: true,
          message: 'Webhook updated successfully!',
          severity: 'success'
        });
      } else {
        // Create new webhook
        const { data, error } = await supabase
          .from('webhook_configurations')
          .insert([{
            user_id: user.id,
            name: formData.name,
            url: formData.url,
            events: formData.events,
            is_active: formData.isActive
          }])
          .select();
        
        if (error) throw error;
        
        // Show the secret
        if (data && data[0]) {
          setWebhookSecret(data[0].secret);
          setShowSecret(true);
        }
        
        setSnackbar({
          open: true,
          message: 'Webhook created successfully!',
          severity: 'success'
        });
      }
      
      // Refresh webhooks list
      fetchWebhooks();
      
      if (!showSecret) {
        handleCloseDialog();
      }
    } catch (error) {
      console.error('Error saving webhook:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save webhook. Please try again.',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?') || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('webhook_configurations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setSnackbar({
        open: true,
        message: 'Webhook deleted successfully!',
        severity: 'success'
      });
      
      // Refresh webhooks list
      fetchWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete webhook. Please try again.',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleToggleWebhook = async (id: string, isActive: boolean) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('webhook_configurations')
        .update({ is_active: isActive, updated_at: new Date() })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setSnackbar({
        open: true,
        message: `Webhook ${isActive ? 'activated' : 'deactivated'} successfully!`,
        severity: 'success'
      });
      
      // Refresh webhooks list
      fetchWebhooks();
    } catch (error) {
      console.error('Error updating webhook:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update webhook. Please try again.',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/webhooks/configurations/${id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to test webhook');
      }
      
      setSnackbar({
        open: true,
        message: 'Test webhook sent successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      setSnackbar({
        open: true,
        message: 'Failed to test webhook. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSecret = async (id: string) => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to regenerate the webhook secret? This will invalidate the previous secret.')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/webhooks/configurations/${id}/regenerate-secret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to regenerate webhook secret');
      }
      
      const data = await response.json();
      
      setWebhookSecret(data.data.secret);
      setShowSecret(true);
      
      setSnackbar({
        open: true,
        message: 'Webhook secret regenerated successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error regenerating webhook secret:', error);
      setSnackbar({
        open: true,
        message: 'Failed to regenerate webhook secret. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(webhookSecret);
    setSnackbar({
      open: true,
      message: 'Secret copied to clipboard!',
      severity: 'success'
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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
            <h1 className="text-2xl font-semibold text-gray-800">My Webhooks</h1>
            <p className="text-gray-600">Manage your webhook integrations for external systems</p>
          </div>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<PlusIcon className="h-5 w-5" />}
            onClick={() => handleOpenDialog()}
          >
            Add Webhook
          </Button>
        </div>
      </div>

      <Paper className="mb-6 p-4">
        <Typography variant="h6" className="mb-2">What are webhooks?</Typography>
        <Typography variant="body2" className="mb-4">
          Webhooks allow you to receive real-time notifications about events in your account. 
          When an event occurs, we'll send an HTTP POST request to the URL you specify with 
          information about the event. This allows you to integrate our platform with your 
          own systems and automate workflows.
        </Typography>
        
        <Typography variant="subtitle1" className="mb-2">How to use webhooks:</Typography>
        <ol className="list-decimal pl-5 mb-4 space-y-1">
          <li>Create a webhook endpoint on your server that can receive POST requests</li>
          <li>Add a new webhook here with your endpoint URL</li>
          <li>Select the events you want to receive notifications for</li>
          <li>Use the provided secret to verify that requests are coming from us</li>
          <li>Test your webhook to ensure it's working correctly</li>
        </ol>
        
        <Alert severity="info" className="mb-2">
          <Typography variant="body2">
            <strong>Security tip:</strong> Always verify webhook requests using the secret provided. 
            We include a <code>X-Webhook-Signature</code> header with each request that you can use to verify authenticity.
          </Typography>
        </Alert>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" className="py-8">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" className="py-8">
                    <Typography variant="body1" color="textSecondary">
                      No webhooks found. Click "Add Webhook" to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                webhooks.map((webhook) => (
                  <TableRow key={webhook.id} hover>
                    <TableCell>{webhook.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="truncate max-w-xs">{webhook.url}</span>
                        <IconButton size="small" href={webhook.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLinkIcon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event: string) => (
                          <Chip 
                            key={event} 
                            label={event} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={webhook.is_active ? 'Active' : 'Inactive'} 
                        color={webhook.is_active ? 'success' : 'default'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{formatDate(webhook.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenDialog(webhook)}>
                            <PencilIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Test">
                          <IconButton size="small" onClick={() => handleTestWebhook(webhook.id)}>
                            <PlayIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Logs">
                          <IconButton 
                            size="small" 
                            onClick={() => router.push(`/profile/webhooks/${webhook.id}/logs`)}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Regenerate Secret">
                          <IconButton size="small" onClick={() => handleRegenerateSecret(webhook.id)}>
                            <RefreshIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={webhook.is_active ? 'Deactivate' : 'Activate'}>
                          <IconButton 
                            size="small" 
                            color={webhook.is_active ? 'default' : 'primary'}
                            onClick={() => handleToggleWebhook(webhook.id, !webhook.is_active)}
                          >
                            {webhook.is_active ? (
                              <div className="h-4 w-4 rounded-full bg-green-500"></div>
                            ) : (
                              <div className="h-4 w-4 rounded-full bg-gray-300"></div>
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleDeleteWebhook(webhook.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Webhook Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedWebhook ? 'Edit Webhook' : 'Add Webhook'}
        </DialogTitle>
        <DialogContent>
          {showSecret ? (
            <Box className="my-4">
              <Alert severity="success" className="mb-4">
                <Typography variant="subtitle1" className="font-bold mb-1">
                  Webhook created successfully!
                </Typography>
                <Typography variant="body2">
                  Your webhook secret is shown below. This is the only time you'll see it, so make sure to copy it now.
                </Typography>
              </Alert>
              
              <Box className="flex items-center p-3 bg-gray-100 rounded mb-4">
                <Typography variant="body2" className="font-mono flex-grow">
                  {webhookSecret}
                </Typography>
                <IconButton onClick={handleCopySecret} size="small">
                  <ClipboardCopyIcon className="h-5 w-5" />
                </IconButton>
              </Box>
              
              <Typography variant="body2" className="mb-2">
                <strong>How to use this secret:</strong>
              </Typography>
              <Typography variant="body2" className="mb-4">
                We'll include a <code>X-Webhook-Signature</code> header with each webhook request. 
                This signature is an HMAC SHA-256 hash of the request body, using this secret as the key. 
                You should compute this hash on your server and compare it with the signature to verify 
                that the webhook came from us.
              </Typography>
              
              <Box className="flex justify-end">
                <Button onClick={handleCloseDialog} variant="contained">
                  Done
                </Button>
              </Box>
            </Box>
          ) : (
            <Box component="form" noValidate className="space-y-4 pt-2">
              <TextField
                label="Webhook Name"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!!formErrors.name}
                helperText={formErrors.name}
                required
              />
              
              <TextField
                label="Webhook URL"
                fullWidth
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                error={!!formErrors.url}
                helperText={formErrors.url}
                placeholder="https://example.com/webhook"
                required
              />
              
              <FormControl fullWidth error={!!formErrors.events} required>
                <InputLabel id="events-label">Events</InputLabel>
                <Select
                  labelId="events-label"
                  multiple
                  value={formData.events}
                  onChange={(e) => setFormData({ ...formData, events: e.target.value as string[] })}
                  renderValue={(selected) => (
                    <div className="flex flex-wrap gap-1">
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </div>
                  )}
                >
                  {eventTypes.map((event) => (
                    <MenuItem key={event.value} value={event.value}>
                      {event.label}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.events && <FormHelperText>{formErrors.events}</FormHelperText>}
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  value={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value as boolean })}
                >
                  <MenuItem value={true}>Active</MenuItem>
                  <MenuItem value={false}>Inactive</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        {!showSecret && (
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              color="primary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

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
