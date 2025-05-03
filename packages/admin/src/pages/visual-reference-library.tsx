import React from 'react';
import { NextPage } from 'next';
import {
  Box,
  Container,
  Typography,
  Paper,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Home as HomeIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import AdminLayout from '../components/layouts/AdminLayout';
import VisualReferenceManager from '../components/visualReference/VisualReferenceManager';

/**
 * Visual Reference Library Page
 * 
 * Admin page for managing the Visual Reference Library.
 */
const VisualReferenceLibraryPage: NextPage = () => {
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
              <ImageIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Visual Reference Library
            </Typography>
          </Breadcrumbs>
          
          <Typography variant="h4" component="h1" gutterBottom>
            Visual Reference Library
          </Typography>
          
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="body1" paragraph>
              The Visual Reference Library is a centralized repository of visual examples for material properties, 
              finishes, textures, and other characteristics. It helps users understand what specific property values 
              look like visually and provides training data for AI models.
            </Typography>
            
            <Typography variant="body1" paragraph>
              Use this page to manage visual references, upload images, and add annotations to highlight specific features.
            </Typography>
          </Paper>
          
          <VisualReferenceManager />
        </Box>
      </Container>
    </AdminLayout>
  );
};

export default VisualReferenceLibraryPage;
