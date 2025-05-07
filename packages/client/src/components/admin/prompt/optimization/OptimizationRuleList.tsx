import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as ExecuteIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import OptimizationRuleForm from './OptimizationRuleForm';
import OptimizationRuleDetails from './OptimizationRuleDetails';

interface OptimizationRule {
  id: string;
  name: string;
  description?: string;
  ruleType: string;
  ruleParameters: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const OptimizationRuleList: React.FC = () => {
  const [rules, setRules] = useState<OptimizationRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [openCreateDialog, setOpenCreateDialog] = useState<boolean>(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState<boolean>(false);
  const [selectedRule, setSelectedRule] = useState<OptimizationRule | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/prompt-optimization/rules');
      if (response.data.success) {
        setRules(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch rules: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching rules: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreateRule = async (rule: Omit<OptimizationRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await axios.post('/api/admin/prompt-optimization/rules', rule);
      if (response.data.success) {
        enqueueSnackbar('Rule created successfully', { variant: 'success' });
        setOpenCreateDialog(false);
        fetchRules();
      } else {
        enqueueSnackbar(`Failed to create rule: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error creating rule: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    }
  };

  const handleExecuteRules = async () => {
    setExecuting(true);
    try {
      const response = await axios.post('/api/admin/prompt-optimization/rules/execute');
      if (response.data.success) {
        enqueueSnackbar(`Successfully executed rules. ${response.data.data.actionsCreated} actions created.`, { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to execute rules: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error executing rules: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  const handleViewDetails = (rule: OptimizationRule) => {
    setSelectedRule(rule);
    setOpenDetailsDialog(true);
  };

  const getRuleTypeLabel = (ruleType: string) => {
    switch (ruleType) {
      case 'low_success_rate':
        return 'Low Success Rate';
      case 'champion_challenger':
        return 'Champion/Challenger';
      case 'segment_specific':
        return 'Segment Specific';
      case 'ml_suggestion':
        return 'ML Suggestion';
      case 'scheduled_experiment':
        return 'Scheduled Experiment';
      case 'time_based':
        return 'Time Based';
      case 'user_feedback':
        return 'User Feedback';
      case 'context_aware':
        return 'Context Aware';
      case 'multi_variant':
        return 'Multi-Variant';
      default:
        return ruleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'low_success_rate':
        return 'error';
      case 'champion_challenger':
        return 'success';
      case 'segment_specific':
        return 'info';
      case 'ml_suggestion':
        return 'secondary';
      case 'scheduled_experiment':
        return 'warning';
      case 'time_based':
        return 'primary';
      case 'user_feedback':
        return 'default';
      case 'context_aware':
        return 'info';
      case 'multi_variant':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">Optimization Rules</Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={fetchRules}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={executing ? <CircularProgress size={20} /> : <ExecuteIcon />}
            onClick={handleExecuteRules}
            disabled={executing}
            sx={{ mr: 1 }}
          >
            Execute Rules
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
          >
            Create Rule
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Parameters</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No rules found
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Typography variant="body1">{rule.name}</Typography>
                    {rule.description && (
                      <Typography variant="body2" color="textSecondary">
                        {rule.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getRuleTypeLabel(rule.ruleType)} 
                      color={getRuleTypeColor(rule.ruleType) as any} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {Object.entries(rule.ruleParameters).slice(0, 2).map(([key, value]) => (
                      <Typography key={key} variant="body2">
                        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </Typography>
                    ))}
                    {Object.keys(rule.ruleParameters).length > 2 && (
                      <Typography variant="body2" color="textSecondary">
                        ...and {Object.keys(rule.ruleParameters).length - 2} more
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={rule.isActive ? 'Active' : 'Inactive'} 
                      color={rule.isActive ? 'success' : 'default'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(rule.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton onClick={() => handleViewDetails(rule)}>
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Rule">
                      <IconButton>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Rule">
                      <IconButton>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Rule Dialog */}
      <Dialog 
        open={openCreateDialog} 
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Optimization Rule</DialogTitle>
        <DialogContent>
          <OptimizationRuleForm onSubmit={handleCreateRule} />
        </DialogContent>
      </Dialog>

      {/* Rule Details Dialog */}
      <Dialog 
        open={openDetailsDialog} 
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Rule Details</DialogTitle>
        <DialogContent>
          {selectedRule && <OptimizationRuleDetails rule={selectedRule} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OptimizationRuleList;
