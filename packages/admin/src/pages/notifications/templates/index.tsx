import React, { useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
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
  TextField,
  InputAdornment,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  SearchIcon,
  DocumentDuplicateIcon,
  EyeIcon
} from '@heroicons/react/outline';
import Link from 'next/link';

/**
 * Notification Templates Page
 * 
 * This page provides an interface for managing notification templates.
 */
export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTemplates(templates);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTemplates(templates.filter(template => 
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.type.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/notification-templates');
      // const data = await response.json();
      
      // Mock data for now
      setTimeout(() => {
        setTemplates([
          {
            id: '1',
            name: 'Welcome Email',
            description: 'Email template for new user registration',
            type: 'email',
            format: 'html',
            subject: 'Welcome to our platform!',
            content: '<h1>Welcome {{userName}}!</h1><p>Thank you for joining our platform. We\'re excited to have you on board.</p>',
            variables: ['userName'],
            createdAt: '2023-04-15T10:30:00Z',
            updatedAt: '2023-05-10T14:22:00Z'
          },
          {
            id: '2',
            name: 'Password Reset',
            description: 'Email template for password reset requests',
            type: 'email',
            format: 'html',
            subject: 'Password Reset Request',
            content: '<h1>Password Reset</h1><p>Hello {{userName}},</p><p>We received a request to reset your password. Click the link below to reset it:</p><p><a href="{{resetLink}}">Reset Password</a></p>',
            variables: ['userName', 'resetLink'],
            createdAt: '2023-04-10T08:15:00Z',
            updatedAt: '2023-05-05T09:45:00Z'
          },
          {
            id: '3',
            name: 'Payment Confirmation',
            description: 'Email template for successful payments',
            type: 'email',
            format: 'html',
            subject: 'Payment Confirmation',
            content: '<h1>Payment Confirmation</h1><p>Hello {{userName}},</p><p>Your payment of {{amount}} has been successfully processed.</p><p>Order ID: {{orderId}}</p>',
            variables: ['userName', 'amount', 'orderId'],
            createdAt: '2023-03-22T16:40:00Z',
            updatedAt: '2023-05-12T11:30:00Z'
          },
          {
            id: '4',
            name: 'Payment Reminder',
            description: 'SMS template for payment reminders',
            type: 'sms',
            format: 'text',
            content: 'Hi {{userName}}, this is a reminder that your payment of {{amount}} is due on {{dueDate}}. Please log in to your account to make a payment.',
            variables: ['userName', 'amount', 'dueDate'],
            createdAt: '2023-05-01T12:00:00Z',
            updatedAt: '2023-05-01T12:00:00Z'
          },
          {
            id: '5',
            name: 'New Feature Announcement',
            description: 'Push notification for new feature announcements',
            type: 'push',
            format: 'json',
            content: '{\n  "title": "New Feature Alert!",\n  "body": "Check out our new {{featureName}} feature!",\n  "data": {\n    "url": "{{featureUrl}}"\n  }\n}',
            variables: ['featureName', 'featureUrl'],
            createdAt: '2023-05-05T09:30:00Z',
            updatedAt: '2023-05-05T09:30:00Z'
          }
        ]);
        setFilteredTemplates([
          {
            id: '1',
            name: 'Welcome Email',
            description: 'Email template for new user registration',
            type: 'email',
            format: 'html',
            subject: 'Welcome to our platform!',
            content: '<h1>Welcome {{userName}}!</h1><p>Thank you for joining our platform. We\'re excited to have you on board.</p>',
            variables: ['userName'],
            createdAt: '2023-04-15T10:30:00Z',
            updatedAt: '2023-05-10T14:22:00Z'
          },
          {
            id: '2',
            name: 'Password Reset',
            description: 'Email template for password reset requests',
            type: 'email',
            format: 'html',
            subject: 'Password Reset Request',
            content: '<h1>Password Reset</h1><p>Hello {{userName}},</p><p>We received a request to reset your password. Click the link below to reset it:</p><p><a href="{{resetLink}}">Reset Password</a></p>',
            variables: ['userName', 'resetLink'],
            createdAt: '2023-04-10T08:15:00Z',
            updatedAt: '2023-05-05T09:45:00Z'
          },
          {
            id: '3',
            name: 'Payment Confirmation',
            description: 'Email template for successful payments',
            type: 'email',
            format: 'html',
            subject: 'Payment Confirmation',
            content: '<h1>Payment Confirmation</h1><p>Hello {{userName}},</p><p>Your payment of {{amount}} has been successfully processed.</p><p>Order ID: {{orderId}}</p>',
            variables: ['userName', 'amount', 'orderId'],
            createdAt: '2023-03-22T16:40:00Z',
            updatedAt: '2023-05-12T11:30:00Z'
          },
          {
            id: '4',
            name: 'Payment Reminder',
            description: 'SMS template for payment reminders',
            type: 'sms',
            format: 'text',
            content: 'Hi {{userName}}, this is a reminder that your payment of {{amount}} is due on {{dueDate}}. Please log in to your account to make a payment.',
            variables: ['userName', 'amount', 'dueDate'],
            createdAt: '2023-05-01T12:00:00Z',
            updatedAt: '2023-05-01T12:00:00Z'
          },
          {
            id: '5',
            name: 'New Feature Announcement',
            description: 'Push notification for new feature announcements',
            type: 'push',
            format: 'json',
            content: '{\n  "title": "New Feature Alert!",\n  "body": "Check out our new {{featureName}} feature!",\n  "data": {\n    "url": "{{featureUrl}}"\n  }\n}',
            variables: ['featureName', 'featureUrl'],
            createdAt: '2023-05-05T09:30:00Z',
            updatedAt: '2023-05-05T09:30:00Z'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/notification-templates/${id}`, {
      //   method: 'DELETE'
      // });
      
      // Mock delete
      setTemplates(templates.filter(template => template.id !== id));
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateTemplate = async (template: any) => {
    setLoading(true);
    try {
      // Create a duplicate template
      const duplicateTemplate = {
        ...template,
        id: `${parseInt(template.id) + 100}`, // Mock new ID
        name: `${template.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/notification-templates', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(duplicateTemplate)
      // });
      
      // Mock create
      setTemplates([...templates, duplicateTemplate]);
    } catch (error) {
      console.error('Error duplicating template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewTemplate = (template: any) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getTemplateTypeChip = (type: string) => {
    switch (type) {
      case 'email':
        return <Chip label="Email" color="primary" size="small" />;
      case 'sms':
        return <Chip label="SMS" color="secondary" size="small" />;
      case 'push':
        return <Chip label="Push" color="success" size="small" />;
      case 'in_app':
        return <Chip label="In-App" color="info" size="small" />;
      default:
        return <Chip label={type} size="small" />;
    }
  };

  const getTemplateFormatChip = (format: string) => {
    switch (format) {
      case 'html':
        return <Chip label="HTML" variant="outlined" size="small" />;
      case 'text':
        return <Chip label="Text" variant="outlined" size="small" />;
      case 'markdown':
        return <Chip label="Markdown" variant="outlined" size="small" />;
      case 'json':
        return <Chip label="JSON" variant="outlined" size="small" />;
      default:
        return <Chip label={format} variant="outlined" size="small" />;
    }
  };

  const renderPreviewContent = () => {
    if (!previewTemplate) return null;
    
    try {
      if (previewTemplate.format === 'html') {
        return (
          <div>
            {previewTemplate.type === 'email' && (
              <div className="mb-4 p-2 bg-gray-100 rounded">
                <strong>Subject:</strong> {previewTemplate.subject}
              </div>
            )}
            <div 
              className="p-4 border rounded bg-white" 
              dangerouslySetInnerHTML={{ __html: previewTemplate.content }} 
            />
          </div>
        );
      } else if (previewTemplate.format === 'text' || previewTemplate.format === 'markdown') {
        return (
          <div>
            {previewTemplate.type === 'email' && (
              <div className="mb-4 p-2 bg-gray-100 rounded">
                <strong>Subject:</strong> {previewTemplate.subject}
              </div>
            )}
            <pre className="p-4 border rounded bg-white whitespace-pre-wrap">
              {previewTemplate.content}
            </pre>
          </div>
        );
      } else if (previewTemplate.format === 'json') {
        try {
          // Try to parse JSON
          const jsonContent = JSON.parse(previewTemplate.content);
          
          return (
            <pre className="p-4 border rounded bg-white whitespace-pre-wrap">
              {JSON.stringify(jsonContent, null, 2)}
            </pre>
          );
        } catch (e) {
          return (
            <div className="p-4 border rounded bg-red-50 text-red-500">
              Invalid JSON format: {String(e)}
            </div>
          );
        }
      }
      
      return (
        <div className="p-4 border rounded bg-gray-50">
          Preview not available for this format.
        </div>
      );
    } catch (e) {
      return (
        <div className="p-4 border rounded bg-red-50 text-red-500">
          Error rendering preview: {String(e)}
        </div>
      );
    }
  };

  return (
    <Layout title="Notification Templates">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Notification Templates</h1>
            <p className="text-gray-600">Manage templates for notifications across all channels</p>
          </div>
          <Link href="/notifications/templates/new">
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<PlusIcon className="h-5 w-5" />}
            >
              Create Template
            </Button>
          </Link>
        </div>
      </div>

      <Paper className="p-4 mb-6">
        <TextField
          fullWidth
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Format</TableCell>
                <TableCell>Variables</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" className="py-8">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" className="py-8">
                    <Typography variant="body1" color="textSecondary">
                      No templates found. Click "Create Template" to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id} hover>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>{template.description}</TableCell>
                    <TableCell>{getTemplateTypeChip(template.type)}</TableCell>
                    <TableCell>{getTemplateFormatChip(template.format)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.variables && template.variables.map((variable: string) => (
                          <Chip 
                            key={variable} 
                            label={variable} 
                            size="small" 
                            variant="outlined" 
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(template.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Tooltip title="Preview">
                          <IconButton size="small" onClick={() => handlePreviewTemplate(template)}>
                            <EyeIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small" 
                            component={Link} 
                            href={`/notifications/templates/edit/${template.id}`}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton size="small" onClick={() => handleDuplicateTemplate(template)}>
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleDeleteTemplate(template.id)}
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

      {/* Template Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={handleClosePreview}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {previewTemplate?.name} Preview
        </DialogTitle>
        <DialogContent dividers>
          {renderPreviewContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
          {previewTemplate && (
            <Button 
              component={Link} 
              href={`/notifications/templates/edit/${previewTemplate.id}`}
              color="primary"
            >
              Edit Template
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
