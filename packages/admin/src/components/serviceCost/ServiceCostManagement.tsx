import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { 
  getAllServiceCosts, 
  createServiceCost, 
  updateServiceCost, 
  deleteServiceCost,
  ServiceCost
} from '../../services/serviceCostService';
import ServiceCostForm from './ServiceCostForm';

const ServiceCostManagement: React.FC = () => {
  const [serviceCosts, setServiceCosts] = useState<ServiceCost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [formDialogOpen, setFormDialogOpen] = useState<boolean>(false);
  const [editingServiceCost, setEditingServiceCost] = useState<ServiceCost | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deletingServiceCost, setDeletingServiceCost] = useState<ServiceCost | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(false);

  // Load service costs on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Load service costs from API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getAllServiceCosts();
      setServiceCosts(response.data);
    } catch (err: any) {
      console.error('Error loading service costs:', err);
      setError(err.message || 'Failed to load service costs');
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Open form dialog for creating a new service cost
  const handleOpenCreateDialog = () => {
    setEditingServiceCost(null);
    setFormDialogOpen(true);
  };

  // Open form dialog for editing a service cost
  const handleOpenEditDialog = (serviceCost: ServiceCost) => {
    setEditingServiceCost(serviceCost);
    setFormDialogOpen(true);
  };

  // Close form dialog
  const handleCloseFormDialog = () => {
    setFormDialogOpen(false);
  };

  // Open delete confirmation dialog
  const handleOpenDeleteDialog = (serviceCost: ServiceCost) => {
    setDeletingServiceCost(serviceCost);
    setDeleteDialogOpen(true);
  };

  // Close delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletingServiceCost(null);
  };

  // Save service cost (create or update)
  const handleSaveServiceCost = async (
    serviceCost: Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      setLoading(true);
      
      if (editingServiceCost) {
        // Update existing service cost
        await updateServiceCost(editingServiceCost.id, serviceCost);
      } else {
        // Create new service cost
        await createServiceCost(serviceCost);
      }
      
      // Reload data
      await loadData();
      
      // Close dialog
      setFormDialogOpen(false);
    } catch (err: any) {
      console.error('Error saving service cost:', err);
      setError(err.message || 'Failed to save service cost');
    } finally {
      setLoading(false);
    }
  };

  // Delete service cost
  const handleDeleteServiceCost = async () => {
    if (!deletingServiceCost) return;
    
    try {
      setLoading(true);
      
      // Delete service cost
      await deleteServiceCost(deletingServiceCost.id);
      
      // Reload data
      await loadData();
      
      // Close dialog
      setDeleteDialogOpen(false);
      setDeletingServiceCost(null);
    } catch (err: any) {
      console.error('Error deleting service cost:', err);
      setError(err.message || 'Failed to delete service cost');
    } finally {
      setLoading(false);
    }
  };

  // Toggle service cost active status
  const handleToggleActive = async (serviceCost: ServiceCost) => {
    try {
      setLoading(true);
      
      // Update service cost
      await updateServiceCost(serviceCost.id, {
        isActive: !serviceCost.isActive
      });
      
      // Reload data
      await loadData();
    } catch (err: any) {
      console.error('Error toggling service cost active status:', err);
      setError(err.message || 'Failed to update service cost');
    } finally {
      setLoading(false);
    }
  };

  // Filter service costs based on search term and active status
  const filteredServiceCosts = serviceCosts.filter(cost => {
    const matchesSearch = 
      cost.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cost.serviceKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cost.description && cost.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesActiveFilter = showInactive || cost.isActive;
    
    return matchesSearch && matchesActiveFilter;
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Service Cost Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ mb: 4, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center">
            <TextField
              placeholder="Search services..."
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              sx={{ mr: 2, width: 250 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  color="primary"
                />
              }
              label="Show Inactive"
            />
          </Box>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateDialog}
            >
              Add Service
            </Button>
          </Box>
        </Box>
        
        {loading ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Service Name</TableCell>
                    <TableCell>Service Key</TableCell>
                    <TableCell>Cost Per Unit</TableCell>
                    <TableCell>Unit Type</TableCell>
                    <TableCell>Multiplier</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredServiceCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No service costs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServiceCosts
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((serviceCost) => (
                        <TableRow key={serviceCost.id}>
                          <TableCell>{serviceCost.serviceName}</TableCell>
                          <TableCell>{serviceCost.serviceKey}</TableCell>
                          <TableCell>{serviceCost.costPerUnit.toFixed(6)}</TableCell>
                          <TableCell>{serviceCost.unitType}</TableCell>
                          <TableCell>{serviceCost.multiplier.toFixed(2)}x</TableCell>
                          <TableCell>
                            <Chip
                              label={serviceCost.isActive ? 'Active' : 'Inactive'}
                              color={serviceCost.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{formatDate(serviceCost.updatedAt)}</TableCell>
                          <TableCell>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditDialog(serviceCost)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleOpenDeleteDialog(serviceCost)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={serviceCost.isActive ? 'Deactivate' : 'Activate'}>
                              <IconButton
                                size="small"
                                color={serviceCost.isActive ? 'default' : 'primary'}
                                onClick={() => handleToggleActive(serviceCost)}
                              >
                                <Switch
                                  checked={serviceCost.isActive}
                                  size="small"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <TablePagination
              component="div"
              count={filteredServiceCosts.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Paper>
      
      {/* Service Cost Form Dialog */}
      <ServiceCostForm
        serviceCost={editingServiceCost || undefined}
        open={formDialogOpen}
        onClose={handleCloseFormDialog}
        onSave={handleSaveServiceCost}
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the service cost for{' '}
            <strong>{deletingServiceCost?.serviceName}</strong>?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteServiceCost} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServiceCostManagement;
