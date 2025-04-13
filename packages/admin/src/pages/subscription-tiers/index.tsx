// @ts-nocheck
// Import global TypeScript JSX declarations
import '../types/global-jsx';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  Tooltip,
  Grid,
  Checkbox,
  Divider,
  InputAdornment,
  Container
} from '../../components/mui';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

// TypeScript interfaces for our data structures
interface ModuleAccess {
  name: string;
  enabled: boolean;
}

interface ApiLimits {
  requestsPerDay: number;
  requestsPerMonth: number;
  concurrentRequests: number;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  isPublic: boolean;
  description: string;
  moduleAccess: ModuleAccess[];
  apiLimits: ApiLimits;
}

interface AvailableModule {
  id: string;
  name: string;
  description: string;
}

/**
 * Subscription Tier Management Page
 * 
 * Allows administrators to create, edit, and manage subscription tiers.
 * Controls what features and API limits are available for each tier.
 */
export default function SubscriptionTiersPage() {
  // State for subscription tiers with proper typing
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for the create/edit dialog
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(true);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  
  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [tierToDelete, setTierToDelete] = useState<SubscriptionTier | null>(null);
  
  // Available modules that can be enabled/disabled for each tier
  const availableModules: AvailableModule[] = [
    { id: 'materialRecognition', name: 'Material Recognition', description: 'Identify materials from images' },
    { id: 'knowledgeBase', name: 'Knowledge Base', description: 'Search and access material information' },
    { id: 'agents', name: 'Basic Agents', description: 'Access to Material Expert agent' },
    { id: 'advancedAgents', name: 'Advanced Agents', description: 'Access to all specialized agents' },
    { id: '3dDesigner', name: '3D Designer', description: 'Access to 3D visualization tools' },
    { id: 'api', name: 'API Access', description: 'External API access for integration' },
    { id: 'pdf', name: 'PDF Processing', description: 'Advanced PDF extraction and processing' },
    { id: 'crawler', name: 'Web Crawler', description: 'Web crawling for material data' },
    { id: 'mlTraining', name: 'ML Training', description: 'Custom ML model training' }
  ];
  
  useEffect(() => {
    // Fetch subscription tiers data
    const fetchSubscriptionTiers = async () => {
      try {
        // In a production app, this would fetch from the API
        // const response = await fetch('/api/subscription-tiers');
        // const data = await response.json();
        
        // Mock data for development
        const mockTiers: SubscriptionTier[] = [
          {
            id: 'tier_free',
            name: 'Free',
            price: 0,
            isPublic: true,
            description: 'Basic access with limited features',
            moduleAccess: [
              { name: 'materialRecognition', enabled: true },
              { name: 'knowledgeBase', enabled: true },
              { name: 'agents', enabled: false },
              { name: 'advancedAgents', enabled: false },
              { name: '3dDesigner', enabled: false },
              { name: 'api', enabled: false },
              { name: 'pdf', enabled: false },
              { name: 'crawler', enabled: false },
              { name: 'mlTraining', enabled: false }
            ],
            apiLimits: {
              requestsPerDay: 10,
              requestsPerMonth: 100,
              concurrentRequests: 1
            }
          },
          {
            id: 'tier_basic',
            name: 'Basic',
            price: 9.99,
            isPublic: true,
            description: 'Standard access for individual users',
            moduleAccess: [
              { name: 'materialRecognition', enabled: true },
              { name: 'knowledgeBase', enabled: true },
              { name: 'agents', enabled: true },
              { name: 'advancedAgents', enabled: false },
              { name: '3dDesigner', enabled: false },
              { name: 'api', enabled: false },
              { name: 'pdf', enabled: true },
              { name: 'crawler', enabled: false },
              { name: 'mlTraining', enabled: false }
            ],
            apiLimits: {
              requestsPerDay: 50,
              requestsPerMonth: 500,
              concurrentRequests: 2
            }
          },
          {
            id: 'tier_pro',
            name: 'Professional',
            price: 19.99,
            isPublic: true,
            description: 'Advanced access for professionals',
            moduleAccess: [
              { name: 'materialRecognition', enabled: true },
              { name: 'knowledgeBase', enabled: true },
              { name: 'agents', enabled: true },
              { name: 'advancedAgents', enabled: true },
              { name: '3dDesigner', enabled: true },
              { name: 'api', enabled: false },
              { name: 'pdf', enabled: true },
              { name: 'crawler', enabled: true },
              { name: 'mlTraining', enabled: false }
            ],
            apiLimits: {
              requestsPerDay: 200,
              requestsPerMonth: 2000,
              concurrentRequests: 5
            }
          },
          {
            id: 'tier_enterprise',
            name: 'Enterprise',
            price: 49.99,
            isPublic: true,
            description: 'Full access for enterprise customers',
            moduleAccess: [
              { name: 'materialRecognition', enabled: true },
              { name: 'knowledgeBase', enabled: true },
              { name: 'agents', enabled: true },
              { name: 'advancedAgents', enabled: true },
              { name: '3dDesigner', enabled: true },
              { name: 'api', enabled: true },
              { name: 'pdf', enabled: true },
              { name: 'crawler', enabled: true },
              { name: 'mlTraining', enabled: true }
            ],
            apiLimits: {
              requestsPerDay: 1000,
              requestsPerMonth: 10000,
              concurrentRequests: 20
            }
          },
          {
            id: 'tier_custom',
            name: 'Custom Plan',
            price: 99.99,
            isPublic: false,
            description: 'Customized plan for specific client needs',
            moduleAccess: [
              { name: 'materialRecognition', enabled: true },
              { name: 'knowledgeBase', enabled: true },
              { name: 'agents', enabled: true },
              { name: 'advancedAgents', enabled: true },
              { name: '3dDesigner', enabled: true },
              { name: 'api', enabled: true },
              { name: 'pdf', enabled: true },
              { name: 'crawler', enabled: true },
              { name: 'mlTraining', enabled: true }
            ],
            apiLimits: {
              requestsPerDay: 5000,
              requestsPerMonth: 50000,
              concurrentRequests: 50
            }
          }
        ];
        
        setTiers(mockTiers);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching subscription tiers:', error);
        setIsLoading(false);
      }
    };
    
    fetchSubscriptionTiers();
  }, []);
  
  // Function to handle opening the create/edit dialog
  const handleOpenDialog = (tier: SubscriptionTier | null = null) => {
    if (tier) {
      setCurrentTier(tier);
      setIsCreating(false);
    } else {
      // Default values for a new tier
      const newTier: SubscriptionTier = {
        id: '',
        name: '',
        price: 0,
        isPublic: true,
        description: '',
        moduleAccess: availableModules.map(module => ({
          name: module.id,
          enabled: false
        })),
        apiLimits: {
          requestsPerDay: 10,
          requestsPerMonth: 100,
          concurrentRequests: 1
        }
      };
      setCurrentTier(newTier);
      setIsCreating(true);
    }
    setDialogOpen(true);
  };
  
  // Function to handle closing the dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentTier(null);
  };
  
  // Function to handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (!currentTier) return;
    
    if (type === 'checkbox') {
      setCurrentTier({
        ...currentTier,
        [name]: checked
      });
    } else if (name.startsWith('apiLimits.')) {
      const limitName = name.split('.')[1];
      setCurrentTier({
        ...currentTier,
        apiLimits: {
          ...currentTier.apiLimits,
          [limitName]: type === 'number' ? parseInt(value, 10) : value
        }
      });
    } else {
      setCurrentTier({
        ...currentTier,
        [name]: type === 'number' ? parseFloat(value) : value
      });
    }
  };
  
  // Function to handle module access changes
  const handleModuleAccessChange = (moduleId: string, enabled: boolean) => {
    if (!currentTier) return;
    
    setCurrentTier({
      ...currentTier,
      moduleAccess: currentTier.moduleAccess.map(module => 
        module.name === moduleId ? { ...module, enabled } : module
      )
    });
  };
  
  // Function to handle saving tier changes
  const handleSaveTier = async () => {
    try {
      // In a production app, this would call the API
      if (isCreating && currentTier) {
        // Create new tier
        // const response = await fetch('/api/subscription-tiers', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify(currentTier),
        // });
        // const newTier = await response.json();
        
        // Mock create for development
        const newTier: SubscriptionTier = {
          ...currentTier,
          id: `tier_${currentTier.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
        };
        
        setTiers([...tiers, newTier]);
      } else if (currentTier) {
        // Update existing tier
        // const response = await fetch(`/api/subscription-tiers/${currentTier.id}`, {
        //   method: 'PUT',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify(currentTier),
        // });
        // const updatedTier = await response.json();
        
        // Mock update for development
        const updatedTiers = tiers.map(tier => 
          tier.id === currentTier.id ? currentTier : tier
        );
        
        setTiers(updatedTiers);
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving subscription tier:', error);
      alert('Failed to save subscription tier. Please try again.');
    }
  };
  
  // Function to open delete confirmation dialog
  const handleOpenDeleteDialog = (tier: SubscriptionTier) => {
    setTierToDelete(tier);
    setDeleteDialogOpen(true);
  };
  
  // Function to close delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setTierToDelete(null);
  };
  
  // Function to delete a tier
  const handleDeleteTier = async () => {
    try {
      if (!tierToDelete) return;
      
      // In a production app, this would call the API
      // await fetch(`/api/subscription-tiers/${tierToDelete.id}`, {
      //   method: 'DELETE',
      // });
      
      // Mock delete for development
      const updatedTiers = tiers.filter(tier => tier.id !== tierToDelete.id);
      setTiers(updatedTiers);
      
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting subscription tier:', error);
      alert('Failed to delete subscription tier. Please try again.');
    }
  };
  
  return (
    <Layout title="Subscription Tiers">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Subscription Tier Management</h1>
          <p className="text-gray-600">Configure and manage subscription plans and their access levels.</p>
        </div>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add New Tier
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p>Loading subscription tiers...</p>
        </div>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Public</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Module Access</TableCell>
                <TableCell>API Limits</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>{tier.name}</TableCell>
                  <TableCell>${tier.price.toFixed(2)}/month</TableCell>
                  <TableCell>
                    {tier.isPublic ? (
                      <CheckCircleIcon />
                    ) : (
                      <CancelIcon />
                    )}
                  </TableCell>
                  <TableCell>{tier.description}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {tier.moduleAccess
                        .filter(module => module.enabled)
                        .map(module => {
                          const moduleInfo = availableModules.find(m => m.id === module.name);
                          return (
                            <Tooltip key={module.name} title={moduleInfo?.description || module.name}>
                              <Box
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: 'white',
                                  borderRadius: 1,
                                  px: 1,
                                  py: 0.5,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {moduleInfo?.name || module.name}
                              </Box>
                            </Tooltip>
                          );
                        })}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      Day: {tier.apiLimits.requestsPerDay} requests
                    </Typography>
                    <Typography variant="body2">
                      Month: {tier.apiLimits.requestsPerMonth} requests
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      color="primary" 
                      onClick={() => handleOpenDialog(tier)}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      color="error" 
                      onClick={() => handleOpenDeleteDialog(tier)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Create/Edit Tier Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isCreating ? 'Create New Subscription Tier' : 'Edit Subscription Tier'}
        </DialogTitle>
        <DialogContent dividers>
          {currentTier && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Name"
                  name="name"
                  value={currentTier.name}
                  onChange={handleInputChange}
                  margin="normal"
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Price"
                  name="price"
                  type="number"
                  value={currentTier.price}
                  onChange={handleInputChange}
                  margin="normal"
                  variant="outlined"
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/month</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={currentTier.description}
                  onChange={handleInputChange}
                  margin="normal"
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentTier.isPublic}
                      onChange={handleInputChange}
                      name="isPublic"
                      color="primary"
                    />
                  }
                  label="Publicly Available"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  API Limits
                </Typography>
                <Divider />
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Requests Per Day"
                      name="apiLimits.requestsPerDay"
                      type="number"
                      value={currentTier.apiLimits.requestsPerDay}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Requests Per Month"
                      name="apiLimits.requestsPerMonth"
                      type="number"
                      value={currentTier.apiLimits.requestsPerMonth}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Concurrent Requests"
                      name="apiLimits.concurrentRequests"
                      type="number"
                      value={currentTier.apiLimits.concurrentRequests}
                      onChange={handleInputChange}
                      margin="normal"
                      variant="outlined"
                    />
                  </Grid>
                </Grid>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Module Access
                </Typography>
                <Divider />
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {availableModules.map((module) => {
                    const currentAccess = currentTier.moduleAccess.find(
                      m => m.name === module.id
                    );
                    const isEnabled = currentAccess ? currentAccess.enabled : false;
                    
                    return (
                      <Grid item xs={12} sm={6} md={4} key={module.id}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={isEnabled}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                                handleModuleAccessChange(module.id, e.target.checked)
                              }
                              color="primary"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body1">{module.name}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {module.description}
                              </Typography>
                            </Box>
                          }
                        />
                      </Grid>
                    );
                  })}
                </Grid>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSaveTier} color="primary" variant="contained">
            {isCreating ? 'Create' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the "{tierToDelete?.name}" subscription tier? 
            This action cannot be undone.
          </Typography>
          <Typography color="error" sx={{ mt: 2 }}>
            Note: Deleting a tier will affect any users currently subscribed to it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteTier} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}