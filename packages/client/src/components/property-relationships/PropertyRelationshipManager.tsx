import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Tabs, 
  Tab, 
  Paper, 
  Button,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';
import { PropertyRelationshipList } from './PropertyRelationshipList';
import { PropertyRelationshipForm } from './PropertyRelationshipForm';
import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';

interface PropertyRelationshipManagerProps {
  materialType: string;
}

export const PropertyRelationshipManager: React.FC<PropertyRelationshipManagerProps> = ({ 
  materialType 
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<RelationshipType>(RelationshipType.CORRELATION);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    const fetchRelationships = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/property-relationships/material/${materialType}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch relationships');
        }
        
        const data = await response.json();
        
        // Filter relationships by the active tab
        const filteredRelationships = data.relationships.filter(
          (rel: any) => rel.relationshipType === activeTab
        );
        
        setRelationships(filteredRelationships);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRelationships();
  }, [materialType, token, activeTab, refreshTrigger]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: RelationshipType) => {
    setActiveTab(newValue);
  };

  const handleAddRelationship = () => {
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleFormSubmit = async (relationshipData: any) => {
    try {
      await propertyRelationshipService.createRelationship({
        ...relationshipData,
        materialType,
        relationshipType: activeTab
      });
      
      setSnackbar({
        open: true,
        message: 'Relationship created successfully',
        severity: 'success'
      });
      
      setShowForm(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to create relationship',
        severity: 'error'
      });
    }
  };

  const handleDeleteRelationship = async (id: string) => {
    try {
      await propertyRelationshipService.deleteRelationship(id);
      
      setSnackbar({
        open: true,
        message: 'Relationship deleted successfully',
        severity: 'success'
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to delete relationship',
        severity: 'error'
      });
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Property Relationships for {materialType}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleAddRelationship}
        >
          Add Relationship
        </Button>
      </Box>
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Correlation" value={RelationshipType.CORRELATION} />
          <Tab label="Dependency" value={RelationshipType.DEPENDENCY} />
          <Tab label="Compatibility" value={RelationshipType.COMPATIBILITY} />
          <Tab label="Exclusion" value={RelationshipType.EXCLUSION} />
          <Tab label="Causation" value={RelationshipType.CAUSATION} />
          <Tab label="Derivation" value={RelationshipType.DERIVATION} />
          <Tab label="Association" value={RelationshipType.ASSOCIATION} />
        </Tabs>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <PropertyRelationshipList 
          relationships={relationships} 
          relationshipType={activeTab}
          onDelete={handleDeleteRelationship}
        />
      )}
      
      {showForm && (
        <PropertyRelationshipForm
          open={showForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          relationshipType={activeTab}
          materialType={materialType}
        />
      )}
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
