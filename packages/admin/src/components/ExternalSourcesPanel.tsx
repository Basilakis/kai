import * as React from 'react';
import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { ExternalSourceType, ExternalSource, ExternalSourceConfig, PREDEFINED_SOURCE_TYPES } from '../types/externalSources';
import type { SelectChangeEvent } from '@mui/material';
import '@mui/material/styles';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface SourceDialogData extends Omit<ExternalSourceConfig, 'id'> {
  name: string;
  type: ExternalSourceType;
  baseUrl: string;
  enabled: boolean;
  syncInterval: number;
  apiKey?: string;
  authentication?: {
    type: 'basic' | 'oauth' | 'api_key' | 'bearer';
    credentials?: Record<string, string>;
  };
}

const ExternalSourcesPanel: React.FC = () => {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'add' | 'edit' | 'delete' | 'schedule'>('add');
  const [selectedSource, setSelectedSource] = useState<ExternalSource | null>(null);
  const [dialogData, setDialogData] = useState<SourceDialogData>({
    name: '',
    type: PREDEFINED_SOURCE_TYPES.MATERIALS_PROJECT,
    baseUrl: '',
    enabled: true,
    syncInterval: 1440 // Default to 24 hours
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/external-sources');
      const data = await response.json();
      setSources(data.sources);
    } catch (error) {
      console.error('Error fetching external sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (sourceId: string) => {
    try {
      await fetch(`/api/admin/external-sources/${sourceId}/sync`, {
        method: 'POST'
      });
      fetchSources(); // Refresh the list
    } catch (error) {
      console.error('Error syncing source:', error);
    }
  };

  const handleAdd = () => {
    setDialogType('add');
    setSelectedSource(null);
    setDialogData({
      name: '',
      type: PREDEFINED_SOURCE_TYPES.MATERIALS_PROJECT,
      baseUrl: '',
      enabled: true,
      syncInterval: 1440
    });
    setShowDialog(true);
  };

  const handleEdit = (source: ExternalSource) => {
    setDialogType('edit');
    setSelectedSource(source);
    setDialogData({
      name: source.name,
      type: source.type,
      baseUrl: source.baseUrl,
      enabled: source.enabled,
      syncInterval: source.syncInterval
    });
    setShowDialog(true);
  };

  const handleDelete = (source: ExternalSource) => {
    setDialogType('delete');
    setSelectedSource(source);
    setShowDialog(true);
  };

  const handleSchedule = (source: ExternalSource) => {
    setDialogType('schedule');
    setSelectedSource(source);
    setDialogData({
      ...dialogData,
      syncInterval: source.syncInterval
    });
    setShowDialog(true);
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setSelectedSource(null);
    setDialogData({
      name: '',
      type: PREDEFINED_SOURCE_TYPES.MATERIALS_PROJECT,
      baseUrl: '',
      enabled: true,
      syncInterval: 1440
    });
  };

  const handleSubmit = async () => {
    if (dialogType === 'delete' && selectedSource) {
      try {
        await fetch(`/api/admin/external-sources/${selectedSource.id}`, {
          method: 'DELETE'
        });
        fetchSources();
        handleDialogClose();
      } catch (error) {
        console.error('Error deleting source:', error);
      }
      return;
    }

    if (dialogType === 'schedule' && selectedSource) {
      try {
        await fetch(`/api/admin/external-sources/${selectedSource.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            syncInterval: dialogData.syncInterval
          })
        });
        fetchSources();
        handleDialogClose();
      } catch (error) {
        console.error('Error updating sync schedule:', error);
      }
      return;
    }

    try {
      const method = dialogType === 'add' ? 'POST' : 'PUT';
      const url = dialogType === 'add' 
        ? '/api/admin/external-sources'
        : `/api/admin/external-sources/${selectedSource?.id}`;

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dialogData)
      });

      fetchSources();
      handleDialogClose();
    } catch (error) {
      console.error('Error saving source:', error);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">External Sources</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSources}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add Source
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Sync</TableCell>
              <TableCell>Next Sync</TableCell>
              <TableCell>Materials</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sources.map((source: ExternalSource) => (
              <TableRow key={source.id}>
                <TableCell>{source.name}</TableCell>
                <TableCell>{source.type}</TableCell>
                <TableCell>
                  <Chip
                    label={source.enabled ? 'Active' : 'Inactive'}
                    color={source.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {source.lastSyncTimestamp 
                    ? new Date(source.lastSyncTimestamp).toLocaleString()
                    : 'Never'}
                </TableCell>
                <TableCell>
                  {source.nextSyncTimestamp
                    ? new Date(source.nextSyncTimestamp).toLocaleString()
                    : 'Not Scheduled'}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    <Box>Total: {source.stats.totalMaterials}</Box>
                    <Box>Created: {source.stats.materialsCreated}</Box>
                    <Box>Updated: {source.stats.materialsUpdated}</Box>
                  </Typography>
                </TableCell>
                <TableCell>
                  <IconButton 
                    onClick={() => handleSync(source.id)}
                    title="Sync Now"
                    size="small"
                  >
                    <SyncIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleSchedule(source)}
                    title="Schedule Sync"
                    size="small"
                  >
                    <ScheduleIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleEdit(source)}
                    title="Edit"
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(source)}
                    title="Delete"
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={showDialog} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogType === 'add' && 'Add External Source'}
          {dialogType === 'edit' && 'Edit External Source'}
          {dialogType === 'delete' && 'Delete External Source'}
          {dialogType === 'schedule' && 'Schedule Sync'}
        </DialogTitle>
        <DialogContent>
          {dialogType === 'delete' ? (
            <Typography>
              Are you sure you want to delete {selectedSource?.name}? This action cannot be undone.
            </Typography>
          ) : dialogType === 'schedule' ? (
            <Box sx={{ mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Sync Interval (minutes)</InputLabel>
                <Select
                  value={dialogData.syncInterval}
                  onChange={(e: SelectChangeEvent) => setDialogData({
                    ...dialogData,
                    syncInterval: Number(e.target.value)
                  })}
                >
                  <MenuItem value={60}>Every Hour</MenuItem>
                  <MenuItem value={360}>Every 6 Hours</MenuItem>
                  <MenuItem value={720}>Every 12 Hours</MenuItem>
                  <MenuItem value={1440}>Every 24 Hours</MenuItem>
                  <MenuItem value={10080}>Every Week</MenuItem>
                </Select>
              </FormControl>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={dialogData.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDialogData({
                      ...dialogData,
                      name: e.target.value
                    })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={dialogData.type}
                      onChange={(e: SelectChangeEvent) => setDialogData({
                        ...dialogData,
                        type: e.target.value as ExternalSourceType
                      })}
                    >
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATERIALS_PROJECT}>Materials Project</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATERIAL_DISTRICT}>Material District</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATERNITY_DB}>Maternity DB</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATWEB}>MatWeb</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.OPEN_MATERIAL_DB}>Open Material DB</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.ASTM_CONNECT}>ASTM Connect</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.UL_PROSPECTOR}>UL Prospector</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.GRANTA_DESIGN}>Granta Design</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATERIAL_CONNEXION}>Material ConneXion</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATERIAL_DATABANK}>Material Databank</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.MATERIAL_EXCHANGE}>Material Exchange</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.RESEARCHGATE_MATERIALS}>ResearchGate Materials</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.M_BASE}>M-Base Engineering</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.ASM_MATERIALS}>ASM Materials</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.IDEMAT}>IDEMAT</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.CES_SELECTOR}>CES Selector</MenuItem>
                      <MenuItem value={PREDEFINED_SOURCE_TYPES.CUSTOM_API}>Custom API</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Base URL"
                    value={dialogData.baseUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDialogData({
                      ...dialogData,
                      baseUrl: e.target.value
                    })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={dialogData.enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setDialogData({
                          ...dialogData,
                          enabled: e.target.checked
                        })}
                      />
                    }
                    label="Enabled"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSubmit} color="primary" variant="contained">
            {dialogType === 'delete' ? 'Delete' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExternalSourcesPanel;