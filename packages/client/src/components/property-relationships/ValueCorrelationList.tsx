import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { ValueCorrelationForm } from './ValueCorrelationForm';
import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';

interface ValueCorrelationListProps {
  relationshipId: string;
  sourceProperty: string;
  targetProperty: string;
}

export const ValueCorrelationList: React.FC<ValueCorrelationListProps> = ({
  relationshipId,
  sourceProperty,
  targetProperty
}) => {
  const { token } = useAuth();
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCorrelation, setEditingCorrelation] = useState<any | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchCorrelations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/property-relationships/${relationshipId}/correlations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch correlations');
        }
        
        const data = await response.json();
        setCorrelations(data.correlations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCorrelations();
  }, [relationshipId, token, refreshTrigger]);

  const handleAddCorrelation = () => {
    setEditingCorrelation(null);
    setShowForm(true);
  };

  const handleEditCorrelation = (correlation: any) => {
    setEditingCorrelation(correlation);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCorrelation(null);
  };

  const handleFormSubmit = async (correlationData: any) => {
    try {
      if (editingCorrelation) {
        await propertyRelationshipService.updateValueCorrelation({
          id: editingCorrelation.id,
          ...correlationData
        });
      } else {
        await propertyRelationshipService.createValueCorrelation({
          relationshipId,
          ...correlationData
        });
      }
      
      setShowForm(false);
      setEditingCorrelation(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save correlation');
    }
  };

  const handleDeleteCorrelation = async (id: string) => {
    try {
      await propertyRelationshipService.deleteValueCorrelation(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete correlation');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Value Correlations
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddCorrelation}
        >
          Add Correlation
        </Button>
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : correlations.length === 0 ? (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            No correlations defined yet. Add correlations to define how values of {sourceProperty} relate to values of {targetProperty}.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>{sourceProperty} Value</TableCell>
                <TableCell>{targetProperty} Value</TableCell>
                <TableCell>Correlation Strength</TableCell>
                <TableCell>Sample Size</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {correlations.map((correlation) => (
                <TableRow key={correlation.id} hover>
                  <TableCell>{correlation.sourceValue}</TableCell>
                  <TableCell>{correlation.targetValue}</TableCell>
                  <TableCell>{correlation.correlationStrength.toFixed(2)}</TableCell>
                  <TableCell>{correlation.sampleSize}</TableCell>
                  <TableCell>{correlation.isStatistical ? 'Statistical' : 'Manual'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditCorrelation(correlation)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small"
                        onClick={() => handleDeleteCorrelation(correlation.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {showForm && (
        <ValueCorrelationForm
          open={showForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          sourceProperty={sourceProperty}
          targetProperty={targetProperty}
          initialData={editingCorrelation}
        />
      )}
    </Box>
  );
};
