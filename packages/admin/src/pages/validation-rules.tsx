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
  Rule as RuleIcon
} from '@mui/icons-material';
import AdminLayout from '../components/layouts/AdminLayout';
import ValidationRuleManager from '../components/validation/ValidationRuleManager';

/**
 * Validation Rules Page
 * 
 * Admin page for managing validation rules.
 */
const ValidationRulesPage: NextPage = () => {
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
              <RuleIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Validation Rules
            </Typography>
          </Breadcrumbs>
          
          <Typography variant="h4" component="h1" gutterBottom>
            Advanced Property Validation
          </Typography>
          
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="body1" paragraph>
              Advanced Property Validation allows you to define sophisticated validation rules for material properties.
              These rules ensure data consistency and accuracy by validating property values against defined constraints.
            </Typography>
            
            <Typography variant="body1" paragraph>
              You can create various types of validation rules:
            </Typography>
            
            <ul>
              <li><strong>Range Validation:</strong> Validate numeric values against minimum and maximum constraints</li>
              <li><strong>Pattern Validation:</strong> Validate string values against regular expression patterns</li>
              <li><strong>Enumeration Validation:</strong> Validate values against a list of allowed values</li>
              <li><strong>Dependency Validation:</strong> Validate values based on the values of other properties</li>
              <li><strong>Custom Validation:</strong> Apply custom validation functions</li>
              <li><strong>Composite Validation:</strong> Combine multiple validation rules with logical operators</li>
            </ul>
          </Paper>
          
          <ValidationRuleManager />
        </Box>
      </Container>
    </AdminLayout>
  );
};

export default ValidationRulesPage;
