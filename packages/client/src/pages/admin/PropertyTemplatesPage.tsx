import React from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import AdminLayout from '../../layouts/AdminLayout';
import PropertyTemplateManager from '../../components/propertyTemplates/PropertyTemplateManager';

/**
 * Property Templates Admin Page
 */
const PropertyTemplatesPage: React.FC = () => {
  return (
    <AdminLayout>
      <Container maxWidth="xl">
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Property Templates
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Manage property templates for material inheritance. Templates define default properties
            that can be inherited by materials based on their type and category.
          </Typography>
        </Paper>
        
        <PropertyTemplateManager />
      </Container>
    </AdminLayout>
  );
};

export default PropertyTemplatesPage;
