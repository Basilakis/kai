import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
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
  Box
} from '@mui/material';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  ExternalLinkIcon,
  RefreshIcon,
  PlayIcon,
  EyeIcon
} from '@heroicons/react/outline';
import Link from 'next/link';

/**
 * Webhook Management Page
 * 
 * This page provides an interface for managing webhook integrations, including:
 * - Creating and editing webhook configurations
 * - Testing webhook endpoints
 * - Viewing webhook delivery logs
 */
export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
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
    { value: 'user.registered', label: 'User Registered' },
    { value: 'user.login', label: 'User Login' },
    { value: 'subscription.created', label: 'Subscription Created' },
    { value: 'subscription.updated', label: 'Subscription Updated' },
    { value: 'subscription.cancelled', label: 'Subscription Cancelled' },
    { value: 'payment.succeeded', label: 'Payment Succeeded' },
    { value: 'payment.failed', label: 'Payment Failed' },
    { value: 'content.created', label: 'Content Created' },
    { value: 'content.updated', label: 'Content Updated' },
    { value: 'content.deleted', label: 'Content Deleted' }
  ];

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/webhooks');
      // const data = await response.json();
      
      // Mock data for now
      setTimeout(() => {
        setWebhooks([
          {
            id: '1',
            name: 'User Registration Webhook',
            url: 'https://example.com/webhooks/user-registration',
            events: ['user.registered'],
            isActive: true,
            createdAt: '2023-05-15T10:30:00Z',
            lastTriggered: '2023-05-20T14:22:00Z',
            successRate: 98.5
          },
          {
            id: '2',
            name: 'Payment Webhook',
            url: 'https://example.com/webhooks/payments',
            events: ['payment.succeeded', 'payment.failed'],
            isActive: true,
            createdAt: '2023-04-10T08:15:00Z',
            lastTriggered: '2023-05-21T09:45:00Z',
            successRate: 100
          },
          {
            id: '3',
            name: 'Content Webhook',
            url: 'https://example.com/webhooks/content',
            events: ['content.created', 'content.updated', 'content.deleted'],
            isActive: false,
            createdAt: '2023-03-22T16:40:00Z',
            lastTriggered: '2023-05-18T11:30:00Z',
            successRate: 92.3
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
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
        isActive: webhook.isActive
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
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (selectedWebhook) {
        // Update existing webhook
        // In a real implementation, this would be an API call
        // await fetch(`/api/admin/webhooks/${selectedWebhook.id}`, {
        //   method: 'PUT',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(formData)
        // });
        
        // Mock update
        setWebhooks(webhooks.map(webhook => 
          webhook.id === selectedWebhook.id 
            ? { ...webhook, ...formData } 
            : webhook
        ));
      } else {
        // Create new webhook
        // In a real implementation, this would be an API call
        // const response = await fetch('/api/admin/webhooks', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(formData)
        // });
        // const data = await response.json();
        
        // Mock create
        const newWebhook = {
          id: `${webhooks.length + 1}`,
          ...formData,
          createdAt: new Date().toISOString(),
          lastTriggered: null,
          successRate: null
        };
        setWebhooks([...webhooks, newWebhook]);
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving webhook:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/webhooks/${id}`, {
      //   method: 'DELETE'
      // });
      
      // Mock delete
      setWebhooks(webhooks.filter(webhook => webhook.id !== id));
    } catch (error) {
      console.error('Error deleting webhook:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebhook = async (id: string, isActive: boolean) => {
    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/webhooks/${id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ isActive })
      // });
      
      // Mock update
      setWebhooks(webhooks.map(webhook => 
        webhook.id === id 
          ? { ...webhook, isActive } 
          : webhook
      ));
    } catch (error) {
      console.error('Error updating webhook:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/webhooks/${id}/test`, {
      //   method: 'POST'
      // });
      
      alert('Test webhook sent successfully!');
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Failed to send test webhook.');
    }
  };

  const handleRegenerateSecret = async (id: string) => {
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch(`/api/admin/webhooks/${id}/regenerate-secret`, {
      //   method: 'POST'
      // });
      // const data = await response.json();
      
      alert('Webhook secret regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating webhook secret:', error);
      alert('Failed to regenerate webhook secret.');
    }
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

  return (
    <Layout title="Webhook Management">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Webhook Management</h1>
            <p className="text-gray-600">Manage webhook integrations for external systems</p>
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

      <Paper className="mb-6">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Triggered</TableCell>
                <TableCell>Success Rate</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" className="py-8">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" className="py-8">
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
                        label={webhook.isActive ? 'Active' : 'Inactive'} 
                        color={webhook.isActive ? 'success' : 'default'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{formatDate(webhook.lastTriggered)}</TableCell>
                    <TableCell>
                      {webhook.successRate !== null ? (
                        <Chip 
                          label={`${webhook.successRate}%`} 
                          color={webhook.successRate > 95 ? 'success' : webhook.successRate > 80 ? 'warning' : 'error'} 
                          size="small" 
                        />
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
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
                            component={Link} 
                            href={`/webhooks/${webhook.id}/logs`}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Regenerate Secret">
                          <IconButton size="small" onClick={() => handleRegenerateSecret(webhook.id)}>
                            <RefreshIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={webhook.isActive ? 'Deactivate' : 'Activate'}>
                          <IconButton 
                            size="small" 
                            color={webhook.isActive ? 'default' : 'primary'}
                            onClick={() => handleToggleWebhook(webhook.id, !webhook.isActive)}
                          >
                            {webhook.isActive ? (
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
        </DialogContent>
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
      </Dialog>
    </Layout>
  );
}
