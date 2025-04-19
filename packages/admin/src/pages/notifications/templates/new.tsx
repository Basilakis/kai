import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import NotificationTemplateEditor from '../../../components/notifications/NotificationTemplateEditor';
import { 
  Typography, 
  Button, 
  Breadcrumbs,
  Snackbar,
  Alert
} from '@mui/material';
import Link from 'next/link';

/**
 * Create New Template Page
 * 
 * This page provides an interface for creating a new notification template.
 */
export default function CreateTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const handleSaveTemplate = async (template: any) => {
    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/notification-templates', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(template)
      // });
      // const data = await response.json();
      
      // Mock success
      setTimeout(() => {
        setSnackbar({
          open: true,
          message: 'Template created successfully!',
          severity: 'success'
        });
        setLoading(false);
        
        // Redirect to templates list after a short delay
        setTimeout(() => {
          router.push('/notifications/templates');
        }, 1500);
      }, 1000);
    } catch (error) {
      console.error('Error creating template:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create template. Please try again.',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Layout title="Create Notification Template">
      <div className="mb-6">
        <Breadcrumbs aria-label="breadcrumb" className="mb-2">
          <Link href="/notifications" color="inherit">
            Notifications
          </Link>
          <Link href="/notifications/templates" color="inherit">
            Templates
          </Link>
          <Typography color="textPrimary">Create New</Typography>
        </Breadcrumbs>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Create Notification Template</h1>
            <p className="text-gray-600">Create a new template for notifications</p>
          </div>
          <Link href="/notifications/templates">
            <Button variant="outlined">Cancel</Button>
          </Link>
        </div>
      </div>

      <NotificationTemplateEditor 
        onSave={handleSaveTemplate}
        loading={loading}
      />
      
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
