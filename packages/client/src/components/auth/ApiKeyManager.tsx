import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Add as AddIcon, ContentCopy as CopyIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { api } from '../../services/api';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

interface ApiKeyManagerProps {
  onKeyCreated?: (key: ApiKeyWithSecret) => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onKeyCreated }) => {
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyExpiration, setNewKeyExpiration] = useState<number>(0);
  const [newKey, setNewKey] = useState<ApiKeyWithSecret | null>(null);
  const [error, setError] = useState('');

  // Fetch API keys and available scopes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [keysResponse, scopesResponse] = await Promise.all([
          api.get('/auth/api-keys'),
          api.get('/auth/api-keys/scopes')
        ]);
        
        setKeys(keysResponse.data.data);
        setAvailableScopes(scopesResponse.data.data);
      } catch (error) {
        console.error('Error fetching API keys:', error);
        toast.error('Failed to fetch API keys');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Create API key
  const handleCreateKey = async () => {
    if (!newKeyName) {
      setError('Name is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/api-keys', {
        name: newKeyName,
        scopes: newKeyScopes,
        expiresInDays: newKeyExpiration
      });
      
      const createdKey = response.data.data;
      setKeys(prevKeys => [...prevKeys, createdKey]);
      setNewKey(createdKey);
      
      // Reset form
      setNewKeyName('');
      setNewKeyScopes(['read']);
      setNewKeyExpiration(0);
      
      toast.success('API key created successfully');
      
      if (onKeyCreated) {
        onKeyCreated(createdKey);
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      setError('Failed to create API key');
      toast.error('Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  // Revoke API key
  const handleRevokeKey = async () => {
    if (!selectedKey) return;
    
    setLoading(true);
    
    try {
      await api.delete(`/auth/api-keys/${selectedKey.id}`);
      
      setKeys(prevKeys => 
        prevKeys.map(key => 
          key.id === selectedKey.id 
            ? { ...key, isActive: false } 
            : key
        )
      );
      
      setOpenDeleteDialog(false);
      setSelectedKey(null);
      
      toast.success('API key revoked successfully');
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    } finally {
      setLoading(false);
    }
  };

  // Copy API key to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">API Keys</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Create API Key
        </Button>
      </Box>

      {loading && !keys.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Prefix</TableCell>
                <TableCell>Scopes</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body1" sx={{ py: 2 }}>
                      No API keys found. Create your first API key to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>{key.name}</TableCell>
                    <TableCell>
                      <code>{key.prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {key.scopes.map((scope) => (
                          <Chip key={scope} label={scope} size="small" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>
                      {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={key.isActive ? 'Active' : 'Revoked'}
                        color={key.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {key.isActive && (
                        <Tooltip title="Revoke API Key">
                          <IconButton
                            color="error"
                            onClick={() => {
                              setSelectedKey(key);
                              setOpenDeleteDialog(true);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create API Key Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New API Key</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            API keys allow external applications to authenticate with our API. Keep your API keys secure and never share them in public repositories or client-side code.
          </DialogContentText>
          
          <TextField
            fullWidth
            margin="normal"
            label="API Key Name"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="My Application"
            helperText="A descriptive name to identify this API key"
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Scopes</InputLabel>
            <Select
              multiple
              value={newKeyScopes}
              onChange={(e) => setNewKeyScopes(e.target.value as string[])}
              label="Scopes"
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as string[]).map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableScopes.map((scope) => (
                <MenuItem key={scope} value={scope}>
                  {scope}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Select the permissions for this API key
            </FormHelperText>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Expiration</InputLabel>
            <Select
              value={newKeyExpiration}
              onChange={(e) => setNewKeyExpiration(Number(e.target.value))}
              label="Expiration"
            >
              <MenuItem value={0}>Never expires</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
              <MenuItem value={180}>180 days</MenuItem>
              <MenuItem value={365}>1 year</MenuItem>
            </Select>
            <FormHelperText>
              When this API key should expire
            </FormHelperText>
          </FormControl>
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateKey}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create API Key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New API Key Dialog */}
      <Dialog open={!!newKey} onClose={() => setNewKey(null)} maxWidth="sm" fullWidth>
        <DialogTitle>API Key Created</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Your new API key has been created. Please copy it now as you won't be able to see it again.
          </DialogContentText>
          
          <Box sx={{ 
            backgroundColor: 'grey.100', 
            p: 2, 
            borderRadius: 1,
            mb: 3,
            position: 'relative'
          }}>
            <Typography variant="mono" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
              {newKey?.key}
            </Typography>
            <IconButton 
              sx={{ position: 'absolute', top: 8, right: 8 }}
              onClick={() => copyToClipboard(newKey?.key || '')}
            >
              <CopyIcon />
            </IconButton>
          </Box>
          
          <Typography variant="body2" color="error" sx={{ mb: 3 }}>
            Make sure to copy this key now. For security reasons, you won't be able to see it again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => setNewKey(null)}
          >
            I've Copied My API Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke API Key Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Revoke API Key</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to revoke the API key "{selectedKey?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevokeKey}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApiKeyManager;
