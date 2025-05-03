import React, { useState } from 'react';
import { NextPage } from 'next';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Home as HomeIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import AdminLayout from '../components/layouts/AdminLayout';
import ClassificationMappingManager from '../../client/src/components/classification/ClassificationMappingManager';

enum TabValue {
  SYSTEMS = 'systems',
  CATEGORIES = 'categories',
  MAPPINGS = 'mappings'
}

/**
 * Classification Management Page
 * 
 * Admin page for managing classification systems, categories, and mappings.
 */
const ClassificationManagementPage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<TabValue>(TabValue.MAPPINGS);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

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
              <CategoryIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Classification Management
            </Typography>
          </Breadcrumbs>
          
          <Typography variant="h4" component="h1" gutterBottom>
            Classification Management
          </Typography>
          
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="Classification Systems" value={TabValue.SYSTEMS} />
              <Tab label="Categories" value={TabValue.CATEGORIES} />
              <Tab label="Mappings" value={TabValue.MAPPINGS} />
            </Tabs>
          </Paper>
          
          {activeTab === TabValue.SYSTEMS && (
            <Typography variant="body1">
              Classification Systems management will be implemented in a future update.
            </Typography>
          )}
          
          {activeTab === TabValue.CATEGORIES && (
            <Typography variant="body1">
              Categories management will be implemented in a future update.
            </Typography>
          )}
          
          {activeTab === TabValue.MAPPINGS && (
            <ClassificationMappingManager />
          )}
        </Box>
      </Container>
    </AdminLayout>
  );
};

export default ClassificationManagementPage;
