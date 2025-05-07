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
  Delete as DeleteIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import IntegrationForm from './IntegrationForm';
import IntegrationDetails from './IntegrationDetails';

interface Integration {
  id: string;
  name: string;
  systemType: string;
  connectionParameters: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const IntegrationList: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);
  const [openCreateDialog, setOpenCreateDialog] = useState<boolean>(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState<boolean>(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/prompt-integration');
      if (response.data.success) {
        setIntegrations(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch integrations: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching integrations: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleCreateIntegration = async (integration: Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await axios.post('/api/admin/prompt-integration', integration);
      if (response.data.success) {
        enqueueSnackbar('Integration created successfully', { variant: 'success' });
        setOpenCreateDialog(false);
        fetchIntegrations();
      } else {
        enqueueSnackbar(`Failed to create integration: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error creating integration: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    setTesting(integrationId);
    try {
      const response = await axios.post(`/api/admin/prompt-integration/${integrationId}/test`);
      if (response.data.success) {
        enqueueSnackbar('Connection test successful', { variant: 'success' });
      } else {
        enqueueSnackbar(`Connection test failed: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error testing connection: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setTesting(null);
    }
  };

  const handleExecuteExports = async () => {
    setExecuting(true);
    try {
      const response = await axios.post('/api/admin/prompt-integration/exports/execute');
      if (response.data.success) {
        enqueueSnackbar(`Successfully executed exports. ${response.data.data.exportsExecuted} exports executed.`, { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to execute exports: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error executing exports: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  const handleViewDetails = (integration: Integration) => {
    setSelectedIntegration(integration);
    setOpenDetailsDialog(true);
  };

  const getSystemTypeLabel = (systemType: string) => {
    switch (systemType) {
      case 'grafana':
        return 'Grafana';
      case 'prometheus':
        return 'Prometheus';
      case 'datadog':
        return 'Datadog';
      case 'elasticsearch':
        return 'Elasticsearch';
      case 'custom_api':
        return 'Custom API';
      case 'google_analytics':
        return 'Google Analytics';
      case 'slack':
        return 'Slack';
      case 'power_bi':
        return 'Power BI';
      case 'webhook':
        return 'Webhook';
      default:
        return systemType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getSystemTypeColor = (systemType: string) => {
    switch (systemType) {
      case 'grafana':
        return 'primary';
      case 'prometheus':
        return 'error';
      case 'datadog':
        return 'warning';
      case 'elasticsearch':
        return 'success';
      case 'custom_api':
        return 'secondary';
      case 'google_analytics':
        return 'info';
      case 'slack':
        return 'success';
      case 'power_bi':
        return 'primary';
      case 'webhook':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">External Integrations</Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={fetchIntegrations}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={executing ? <CircularProgress size={20} /> : <ExecuteIcon />}
            onClick={handleExecuteExports}
            disabled={executing}
            sx={{ mr: 1 }}
          >
            Execute Exports
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
          >
            Create Integration
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>System Type</TableCell>
              <TableCell>Connection Details</TableCell>
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
            ) : integrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No integrations found
                </TableCell>
              </TableRow>
            ) : (
              integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell>
                    <Typography variant="body1">{integration.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getSystemTypeLabel(integration.systemType)} 
                      color={getSystemTypeColor(integration.systemType) as any} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {integration.systemType === 'grafana' && (
                      <Typography variant="body2">
                        <strong>URL:</strong> {integration.connectionParameters.url}
                      </Typography>
                    )}
                    {integration.systemType === 'prometheus' && (
                      <Typography variant="body2">
                        <strong>URL:</strong> {integration.connectionParameters.url}
                      </Typography>
                    )}
                    {integration.systemType === 'datadog' && (
                      <Typography variant="body2">
                        <strong>API Key:</strong> {integration.connectionParameters.apiKey ? '••••••••' : 'Not set'}
                      </Typography>
                    )}
                    {integration.systemType === 'elasticsearch' && (
                      <Typography variant="body2">
                        <strong>URL:</strong> {integration.connectionParameters.url}
                      </Typography>
                    )}
                    {integration.systemType === 'custom_api' && (
                      <Typography variant="body2">
                        <strong>URL:</strong> {integration.connectionParameters.url}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={integration.isActive ? 'Active' : 'Inactive'} 
                      color={integration.isActive ? 'success' : 'default'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(integration.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Test Connection">
                      <IconButton 
                        onClick={() => handleTestConnection(integration.id)}
                        disabled={testing === integration.id}
                      >
                        {testing === integration.id ? (
                          <CircularProgress size={24} />
                        ) : (
                          <LinkIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Details">
                      <IconButton onClick={() => handleViewDetails(integration)}>
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Integration">
                      <IconButton>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Integration Dialog */}
      <Dialog 
        open={openCreateDialog} 
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Integration</DialogTitle>
        <DialogContent>
          <IntegrationForm onSubmit={handleCreateIntegration} />
        </DialogContent>
      </Dialog>

      {/* Integration Details Dialog */}
      <Dialog 
        open={openDetailsDialog} 
        onClose={() => setOpenDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Integration Details</DialogTitle>
        <DialogContent>
          {selectedIntegration && <IntegrationDetails integration={selectedIntegration} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegrationList;
