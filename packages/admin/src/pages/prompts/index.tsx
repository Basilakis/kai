import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  RestoreFromTrash as RestoreIcon,
  Assessment as AssessmentIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import Layout from '../../components/Layout';
import { useApi } from '../../hooks/useApi';

// Prompt types
enum PromptType {
  MATERIAL_SPECIFIC = 'material_specific',
  AGENT = 'agent',
  RAG = 'rag',
  GENERATIVE_ENHANCER = 'generative_enhancer',
  HYBRID_RETRIEVER = 'hybrid_retriever',
  OTHER = 'other'
}

// Prompt data interface
interface PromptData {
  id: string;
  name: string;
  description?: string;
  promptType: PromptType;
  content: string;
  variables?: string[];
  isActive: boolean;
  location: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  currentVersion?: number;
  successRate?: number;
}

// Prompt version interface
interface PromptVersionData {
  id: string;
  promptId: string;
  versionNumber: number;
  content: string;
  variables?: string[];
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  successRate?: number;
}

// Tab panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab panel component
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`prompt-tabpanel-${index}`}
      aria-labelledby={`prompt-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Prompt Management Page
export default function PromptsPage() {
  // State
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [filteredPrompts, setFilteredPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [currentPrompt, setCurrentPrompt] = useState<Partial<PromptData>>({
    name: '',
    description: '',
    promptType: PromptType.MATERIAL_SPECIFIC,
    content: '',
    variables: [],
    isActive: true,
    location: ''
  });
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Version state
  const [versions, setVersions] = useState<PromptVersionData[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [openVersionsDialog, setOpenVersionsDialog] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  // Success tracking state
  const [successRate, setSuccessRate] = useState<number | null>(null);
  const [successRateLoading, setSuccessRateLoading] = useState(false);
  const [openSuccessRateDialog, setOpenSuccessRateDialog] = useState(false);

  // API hook
  const api = useApi();

  // Load prompts on mount
  useEffect(() => {
    fetchPrompts();
  }, []);

  // Filter prompts when search term changes
  useEffect(() => {
    if (searchTerm) {
      const filtered = prompts.filter(prompt =>
        prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prompt.description && prompt.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        prompt.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPrompts(filtered);
    } else {
      setFilteredPrompts(prompts);
    }
  }, [searchTerm, prompts]);

  // Fetch prompts from API
  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/prompts');
      if (response.success) {
        setPrompts(response.data);
        setFilteredPrompts(response.data);
      } else {
        setError(response.message || 'Failed to fetch prompts');
      }
    } catch (err) {
      setError('Error fetching prompts: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Fetch versions for a prompt
  const fetchVersions = async (promptId: string) => {
    setVersionsLoading(true);
    try {
      const response = await api.get(`/api/admin/prompts/${promptId}/versions`);
      if (response.success) {
        setVersions(response.data);
      } else {
        setError(response.message || 'Failed to fetch versions');
      }
    } catch (err) {
      setError('Error fetching versions: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setVersionsLoading(false);
    }
  };

  // Fetch success rate for a prompt
  const fetchSuccessRate = async (promptId: string) => {
    setSuccessRateLoading(true);
    try {
      const response = await api.get(`/api/admin/prompts/${promptId}/success-rate`);
      if (response.success) {
        setSuccessRate(response.data.successRate);
      } else {
        setError(response.message || 'Failed to fetch success rate');
      }
    } catch (err) {
      setError('Error fetching success rate: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSuccessRateLoading(false);
    }
  };

  // Revert to a previous version
  const revertToVersion = async (promptId: string, versionNumber: number) => {
    try {
      const response = await api.post(`/api/admin/prompts/${promptId}/versions/${versionNumber}/revert`);
      if (response.success) {
        setSuccess(`Successfully reverted to version ${versionNumber}`);
        fetchPrompts();
        fetchVersions(promptId);
      } else {
        setError(response.message || 'Failed to revert to version');
      }
    } catch (err) {
      setError('Error reverting to version: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Handle dialog open for create
  const handleCreatePrompt = () => {
    setCurrentPrompt({
      name: '',
      description: '',
      promptType: PromptType.MATERIAL_SPECIFIC,
      content: '',
      variables: [],
      isActive: true,
      location: ''
    });
    setDialogMode('create');
    setOpenDialog(true);
  };

  // Handle dialog open for edit
  const handleEditPrompt = (prompt: PromptData) => {
    setCurrentPrompt({...prompt});
    setDialogMode('edit');
    setOpenDialog(true);
  };

  // Handle dialog close
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      if (!currentPrompt.name || !currentPrompt.promptType || !currentPrompt.content || !currentPrompt.location) {
        setError('Please fill in all required fields');
        return;
      }

      if (dialogMode === 'create') {
        const response = await api.post('/api/admin/prompts', currentPrompt);
        if (response.success) {
          setSuccess('Prompt created successfully');
          fetchPrompts();
        } else {
          setError(response.message || 'Failed to create prompt');
        }
      } else {
        const response = await api.put(`/api/admin/prompts/${currentPrompt.id}`, currentPrompt);
        if (response.success) {
          setSuccess('Prompt updated successfully');
          fetchPrompts();
        } else {
          setError(response.message || 'Failed to update prompt');
        }
      }

      setOpenDialog(false);
    } catch (err) {
      setError('Error saving prompt: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Handle delete prompt
  const handleDeletePrompt = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      try {
        const response = await api.delete(`/api/admin/prompts/${id}`);
        if (response.success) {
          setSuccess('Prompt deleted successfully');
          fetchPrompts();
        } else {
          setError(response.message || 'Failed to delete prompt');
        }
      } catch (err) {
        setError('Error deleting prompt: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  // Handle duplicate prompt
  const handleDuplicatePrompt = (prompt: PromptData) => {
    setCurrentPrompt({
      ...prompt,
      id: undefined,
      name: `${prompt.name} (Copy)`,
    });
    setDialogMode('create');
    setOpenDialog(true);
  };

  // Handle opening versions dialog
  const handleOpenVersionsDialog = (promptId: string) => {
    setSelectedPromptId(promptId);
    fetchVersions(promptId);
    setOpenVersionsDialog(true);
  };

  // Handle closing versions dialog
  const handleCloseVersionsDialog = () => {
    setOpenVersionsDialog(false);
    setVersions([]);
    setSelectedPromptId(null);
  };

  // Handle opening success rate dialog
  const handleOpenSuccessRateDialog = (promptId: string) => {
    setSelectedPromptId(promptId);
    fetchSuccessRate(promptId);
    setOpenSuccessRateDialog(true);
  };

  // Handle closing success rate dialog
  const handleCloseSuccessRateDialog = () => {
    setOpenSuccessRateDialog(false);
    setSuccessRate(null);
    setSelectedPromptId(null);
  };

  // Handle reverting to a version
  const handleRevertToVersion = (versionNumber: number) => {
    if (selectedPromptId && window.confirm(`Are you sure you want to revert to version ${versionNumber}?`)) {
      revertToVersion(selectedPromptId, versionNumber);
    }
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Handle form field change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setCurrentPrompt({
      ...currentPrompt,
      [name as string]: value
    });
  };

  // Handle variables change (comma-separated string to array)
  const handleVariablesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const variablesString = e.target.value;
    const variablesArray = variablesString.split(',').map(v => v.trim()).filter(v => v);
    setCurrentPrompt({
      ...currentPrompt,
      variables: variablesArray
    });
  };

  // Get prompt type label
  const getPromptTypeLabel = (type: PromptType) => {
    switch (type) {
      case PromptType.MATERIAL_SPECIFIC:
        return 'Material Specific';
      case PromptType.AGENT:
        return 'Agent';
      case PromptType.RAG:
        return 'RAG';
      case PromptType.GENERATIVE_ENHANCER:
        return 'Generative Enhancer';
      case PromptType.HYBRID_RETRIEVER:
        return 'Hybrid Retriever';
      case PromptType.OTHER:
        return 'Other';
      default:
        return type;
    }
  };

  // Get prompt type color
  const getPromptTypeColor = (type: PromptType) => {
    switch (type) {
      case PromptType.MATERIAL_SPECIFIC:
        return 'primary';
      case PromptType.AGENT:
        return 'secondary';
      case PromptType.RAG:
        return 'success';
      case PromptType.GENERATIVE_ENHANCER:
        return 'info';
      case PromptType.HYBRID_RETRIEVER:
        return 'warning';
      case PromptType.OTHER:
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Layout title="System Prompts">
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          System Prompts
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage AI system prompts used throughout the application
        </Typography>
      </Box>

      {/* Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreatePrompt}
          >
            Create Prompt
          </Button>
          <Button
            variant="outlined"
            startIcon={<ImportIcon />}
            onClick={importPrompts}
            disabled={importLoading}
          >
            {importLoading ? <CircularProgress size={24} /> : 'Import from Files'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchPrompts}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
        <TextField
          label="Search"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Box>

      {/* Error and success messages */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      {/* Tabs */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="prompt tabs">
          <Tab label="All Prompts" />
          <Tab label="Material Specific" />
          <Tab label="Agent" />
          <Tab label="RAG" />
        </Tabs>

        {/* All Prompts Tab */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPrompts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No prompts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPrompts.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell>{prompt.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={getPromptTypeLabel(prompt.promptType)}
                            color={getPromptTypeColor(prompt.promptType) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{prompt.description || '-'}</TableCell>
                        <TableCell>{prompt.location}</TableCell>
                        <TableCell>
                          <Chip
                            label={prompt.isActive ? 'Active' : 'Inactive'}
                            color={prompt.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleEditPrompt(prompt)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDuplicatePrompt(prompt)}>
                            <DuplicateIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeletePrompt(prompt.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleOpenVersionsDialog(prompt.id)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleOpenSuccessRateDialog(prompt.id)}>
                            <AssessmentIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Material Specific Tab */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPrompts
                  .filter(p => p.promptType === PromptType.MATERIAL_SPECIFIC)
                  .map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell>{prompt.name}</TableCell>
                      <TableCell>{prompt.description || '-'}</TableCell>
                      <TableCell>{prompt.location}</TableCell>
                      <TableCell>
                        <Chip
                          label={prompt.isActive ? 'Active' : 'Inactive'}
                          color={prompt.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditPrompt(prompt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDuplicatePrompt(prompt)}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeletePrompt(prompt.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenVersionsDialog(prompt.id)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenSuccessRateDialog(prompt.id)}>
                          <AssessmentIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Agent Tab */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPrompts
                  .filter(p => p.promptType === PromptType.AGENT)
                  .map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell>{prompt.name}</TableCell>
                      <TableCell>{prompt.description || '-'}</TableCell>
                      <TableCell>{prompt.location}</TableCell>
                      <TableCell>
                        <Chip
                          label={prompt.isActive ? 'Active' : 'Inactive'}
                          color={prompt.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditPrompt(prompt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDuplicatePrompt(prompt)}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeletePrompt(prompt.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenVersionsDialog(prompt.id)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenSuccessRateDialog(prompt.id)}>
                          <AssessmentIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* RAG Tab */}
        <TabPanel value={tabValue} index={3}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPrompts
                  .filter(p => p.promptType === PromptType.RAG)
                  .map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell>{prompt.name}</TableCell>
                      <TableCell>{prompt.description || '-'}</TableCell>
                      <TableCell>{prompt.location}</TableCell>
                      <TableCell>
                        <Chip
                          label={prompt.isActive ? 'Active' : 'Inactive'}
                          color={prompt.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditPrompt(prompt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDuplicatePrompt(prompt)}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeletePrompt(prompt.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenVersionsDialog(prompt.id)}>
                          <HistoryIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenSuccessRateDialog(prompt.id)}>
                          <AssessmentIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Create New Prompt' : 'Edit Prompt'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Prompt Name"
              name="name"
              value={currentPrompt.name || ''}
              onChange={handleChange}
            />

            <TextField
              margin="normal"
              fullWidth
              id="description"
              label="Description"
              name="description"
              value={currentPrompt.description || ''}
              onChange={handleChange}
            />

            <FormControl fullWidth margin="normal" required>
              <InputLabel id="prompt-type-label">Prompt Type</InputLabel>
              <Select
                labelId="prompt-type-label"
                id="promptType"
                name="promptType"
                value={currentPrompt.promptType || PromptType.MATERIAL_SPECIFIC}
                label="Prompt Type"
                onChange={handleChange}
              >
                <MenuItem value={PromptType.MATERIAL_SPECIFIC}>Material Specific</MenuItem>
                <MenuItem value={PromptType.AGENT}>Agent</MenuItem>
                <MenuItem value={PromptType.RAG}>RAG</MenuItem>
                <MenuItem value={PromptType.GENERATIVE_ENHANCER}>Generative Enhancer</MenuItem>
                <MenuItem value={PromptType.HYBRID_RETRIEVER}>Hybrid Retriever</MenuItem>
                <MenuItem value={PromptType.OTHER}>Other</MenuItem>
              </Select>
            </FormControl>

            <TextField
              margin="normal"
              required
              fullWidth
              id="location"
              label="File Location"
              name="location"
              value={currentPrompt.location || ''}
              onChange={handleChange}
              helperText="Path to the file where this prompt is used"
            />

            <TextField
              margin="normal"
              fullWidth
              id="variables"
              label="Variables (comma-separated)"
              name="variables"
              value={currentPrompt.variables?.join(', ') || ''}
              onChange={handleVariablesChange}
              helperText="Variables that can be used in the prompt, e.g., {material_type}, {query}"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel id="is-active-label">Status</InputLabel>
              <Select
                labelId="is-active-label"
                id="isActive"
                name="isActive"
                value={currentPrompt.isActive === undefined ? true : currentPrompt.isActive}
                label="Status"
                onChange={handleChange}
              >
                <MenuItem value={true}>Active</MenuItem>
                <MenuItem value={false}>Inactive</MenuItem>
              </Select>
            </FormControl>

            <TextField
              margin="normal"
              required
              fullWidth
              id="content"
              label="Prompt Content"
              name="content"
              value={currentPrompt.content || ''}
              onChange={handleChange}
              multiline
              rows={10}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {dialogMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Versions Dialog */}
      <Dialog open={openVersionsDialog} onClose={handleCloseVersionsDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Prompt Versions
        </DialogTitle>
        <DialogContent>
          {versionsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Version</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Success Rate</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No versions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    versions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell>{version.versionNumber}</TableCell>
                        <TableCell>{new Date(version.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip
                            label={version.isActive ? 'Active' : 'Inactive'}
                            color={version.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {version.successRate !== undefined ? `${version.successRate}%` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleRevertToVersion(version.versionNumber)}
                            startIcon={<RestoreIcon />}
                            disabled={version.isActive}
                          >
                            Revert
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseVersionsDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Success Rate Dialog */}
      <Dialog open={openSuccessRateDialog} onClose={handleCloseSuccessRateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Prompt Success Rate
        </DialogTitle>
        <DialogContent>
          {successRateLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h2" component="div" gutterBottom>
                {successRate !== null ? `${successRate}%` : 'N/A'}
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Success rate based on user feedback
              </Typography>
              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<ThumbUpIcon />}
                  disabled={!selectedPromptId}
                >
                  Mark as Successful
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<ThumbDownIcon />}
                  disabled={!selectedPromptId}
                >
                  Mark as Failed
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSuccessRateDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
