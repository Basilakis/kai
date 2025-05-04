import React from 'react';
import { NextPage } from 'next';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon, List as ListIcon } from '@mui/icons-material';
import AdminLayout from '../components/layouts/AdminLayout';
import MetadataFieldManager from '../components/MetadataFieldManager';

/**
 * Metadata Fields Page
 * 
 * Admin page for managing metadata field definitions.
 */
const MetadataFieldsPage: NextPage = () => {
  return (
    <AdminLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: 3 }}>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              color="inherit"
              href="/dashboard"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Dashboard
            </Link>
            <Typography
              sx={{ display: 'flex', alignItems: 'center' }}
              color="text.primary"
            >
              <ListIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Metadata Fields
            </Typography>
          </Breadcrumbs>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Metadata Fields
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage metadata fields for different material types. These fields define the properties that can be
              stored for each material and are used for OCR extraction, ML training, and search functionality.
            </Typography>
          </Box>
          
          <MetadataFieldManager />
        </Box>
      </Container>
    </AdminLayout>
  );
};

export default MetadataFieldsPage;
