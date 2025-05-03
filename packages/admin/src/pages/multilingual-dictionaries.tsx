import React from 'react';
import { NextPage } from 'next';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon, Translate as TranslateIcon } from '@mui/icons-material';
import AdminLayout from '../components/layouts/AdminLayout';
import MultilingualDictionaryManager from '../components/multilingual/MultilingualDictionaryManager';

/**
 * Multilingual Dictionaries Page
 * 
 * Admin page for managing multilingual property dictionaries.
 */
const MultilingualDictionariesPage: NextPage = () => {
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
              <TranslateIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Multilingual Dictionaries
            </Typography>
          </Breadcrumbs>
          
          <MultilingualDictionaryManager />
        </Box>
      </Container>
    </AdminLayout>
  );
};

export default MultilingualDictionariesPage;
