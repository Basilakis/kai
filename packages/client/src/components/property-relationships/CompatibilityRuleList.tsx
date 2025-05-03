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
  Paper,
  Chip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { CompatibilityRuleForm } from './CompatibilityRuleForm';
import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';
import { CompatibilityType } from '@kai/shared/src/types/property-relationships';

interface CompatibilityRuleListProps {
  relationshipId: string;
  sourceProperty: string;
  targetProperty: string;
}

export const CompatibilityRuleList: React.FC<CompatibilityRuleListProps> = ({
  relationshipId,
  sourceProperty,
  targetProperty
}) => {
  const { token } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchRules = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/property-relationships/${relationshipId}/compatibility`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch compatibility rules');
        }
        
        const data = await response.json();
        setRules(data.rules || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRules();
  }, [relationshipId, token, refreshTrigger]);

  const handleAddRule = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  const handleFormSubmit = async (ruleData: any) => {
    try {
      if (editingRule) {
        await propertyRelationshipService.updateCompatibilityRule({
          id: editingRule.id,
          ...ruleData
        });
      } else {
        await propertyRelationshipService.createCompatibilityRule({
          relationshipId,
          ...ruleData
        });
      }
      
      setShowForm(false);
      setEditingRule(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save compatibility rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await propertyRelationshipService.deleteCompatibilityRule(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete compatibility rule');
    }
  };

  const getCompatibilityChip = (compatibilityType: CompatibilityType) => {
    switch (compatibilityType) {
      case CompatibilityType.COMPATIBLE:
        return <Chip label="Compatible" color="primary" size="small" />;
      case CompatibilityType.RECOMMENDED:
        return <Chip label="Recommended" color="success" size="small" />;
      case CompatibilityType.NOT_RECOMMENDED:
        return <Chip label="Not Recommended" color="warning" size="small" />;
      case CompatibilityType.INCOMPATIBLE:
        return <Chip label="Incompatible" color="error" size="small" />;
      default:
        return <Chip label={compatibilityType} size="small" />;
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Compatibility Rules
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddRule}
        >
          Add Rule
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
      ) : rules.length === 0 ? (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            No compatibility rules defined yet. Add rules to define how values of {sourceProperty} are compatible with values of {targetProperty}.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>{sourceProperty} Value</TableCell>
                <TableCell>{targetProperty} Value</TableCell>
                <TableCell>Compatibility</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>{rule.sourceValue}</TableCell>
                  <TableCell>{rule.targetValue}</TableCell>
                  <TableCell>{getCompatibilityChip(rule.compatibilityType)}</TableCell>
                  <TableCell>{rule.reason || '-'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton 
                        size="small"
                        onClick={() => handleEditRule(rule)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small"
                        onClick={() => handleDeleteRule(rule.id)}
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
        <CompatibilityRuleForm
          open={showForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          sourceProperty={sourceProperty}
          targetProperty={targetProperty}
          initialData={editingRule}
        />
      )}
    </Box>
  );
};
