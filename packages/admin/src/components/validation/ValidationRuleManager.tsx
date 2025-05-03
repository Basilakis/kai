import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useAuth } from '../../../client/src/hooks/useAuth';
import ValidationRuleForm from './ValidationRuleForm';
import ValidationTester from './ValidationTester';
import {
  ValidationRuleType,
  ValidationSeverity
} from '@kai/shared/src/types/validation';

interface ValidationRuleManagerProps {
  materialType?: string;
}

/**
 * Validation Rule Manager Component
 * 
 * Admin component for managing validation rules.
 */
const ValidationRuleManager: React.FC<ValidationRuleManagerProps> = ({
  materialType
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [propertyFilter, setPropertyFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [properties, setProperties] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [ruleToDelete, setRuleToDelete] = useState<any | null>(null);
  const [testerOpen, setTesterOpen] = useState<boolean>(false);

  // Fetch validation rules
  useEffect(() => {
    const fetchValidationRules = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = '/api/validation/rules';
        const queryParams = [];
        
        if (materialType) {
          queryParams.push(`materialType=${encodeURIComponent(materialType)}`);
        }
        
        if (propertyFilter) {
          queryParams.push(`propertyName=${encodeURIComponent(propertyFilter)}`);
        }
        
        if (typeFilter) {
          queryParams.push(`type=${encodeURIComponent(typeFilter)}`);
        }
        
        if (queryParams.length > 0) {
          url += `?${queryParams.join('&')}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch validation rules');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setRules(data.rules);
          
          // Extract unique properties
          const uniqueProperties = [...new Set(data.rules.map((rule: any) => rule.propertyName))];
          setProperties(uniqueProperties);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchValidationRules();
  }, [token, materialType, propertyFilter, typeFilter, refreshKey]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle rule selection
  const handleSelectRule = async (rule: any) => {
    setSelectedRule(rule);
  };

  // Handle form submission
  const handleFormSubmit = async (formData: any) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = isEditing 
        ? `/api/validation/rules/${selectedRule?.id}` 
        : '/api/validation/rules';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} validation rule`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Validation rule ${isEditing ? 'updated' : 'created'} successfully`);
        setFormOpen(false);
        setRefreshKey(prev => prev + 1);
        
        if (isEditing) {
          setSelectedRule(data.rule);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle rule deletion dialog open
  const handleOpenDeleteDialog = (rule: any) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  // Handle rule deletion
  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/validation/rules/${ruleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete validation rule');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Validation rule deleted successfully');
        setRefreshKey(prev => prev + 1);
        
        if (selectedRule?.id === ruleToDelete.id) {
          setSelectedRule(null);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  // Handle search
  const handleSearch = () => {
    // Filter rules based on search query
    if (!searchQuery.trim()) {
      setRefreshKey(prev => prev + 1);
      return;
    }
    
    const filteredRules = rules.filter(rule => 
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.message.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setRules(filteredRules);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Get severity icon
  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case ValidationSeverity.ERROR:
        return <ErrorIcon color="error" />;
      case ValidationSeverity.WARNING:
        return <WarningIcon color="warning" />;
      case ValidationSeverity.INFO:
        return <InfoIcon color="info" />;
      default:
        return null;
    }
  };

  // Get severity color
  const getSeverityColor = (severity: ValidationSeverity) => {
    switch (severity) {
      case ValidationSeverity.ERROR:
        return 'error';
      case ValidationSeverity.WARNING:
        return 'warning';
      case ValidationSeverity.INFO:
        return 'info';
      default:
        return 'default';
    }
  };

  // Get rule type display name
  const getRuleTypeDisplayName = (type: ValidationRuleType) => {
    switch (type) {
      case ValidationRuleType.RANGE:
        return 'Range';
      case ValidationRuleType.PATTERN:
        return 'Pattern';
      case ValidationRuleType.ENUM:
        return 'Enumeration';
      case ValidationRuleType.DEPENDENCY:
        return 'Dependency';
      case ValidationRuleType.CUSTOM:
        return 'Custom';
      case ValidationRuleType.COMPOSITE:
        return 'Composite';
      default:
        return type;
    }
  };

  // Render rule list
  const renderRuleList = () => {
    if (loading && rules.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (rules.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          No validation rules found. Create a new one to get started.
        </Alert>
      );
    }
    
    return (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Property</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Material Type</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map(rule => (
              <TableRow
                key={rule.id}
                hover
                selected={selectedRule?.id === rule.id}
                onClick={() => handleSelectRule(rule)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>{rule.name}</TableCell>
                <TableCell>{rule.propertyName}</TableCell>
                <TableCell>
                  <Chip
                    label={getRuleTypeDisplayName(rule.type)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={rule.severity}
                    size="small"
                    color={getSeverityColor(rule.severity) as any}
                    icon={getSeverityIcon(rule.severity)}
                  />
                </TableCell>
                <TableCell>{rule.materialType}</TableCell>
                <TableCell>
                  <Tooltip title="Test Rule">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectRule(rule);
                        setTesterOpen(true);
                      }}
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit Rule">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                        setSelectedRule(rule);
                        setFormOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Rule">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDeleteDialog(rule);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render rule details
  const renderRuleDetails = () => {
    if (!selectedRule) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Select a validation rule to view details.
        </Alert>
      );
    }
    
    return (
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {selectedRule.name}
            </Typography>
            <Chip
              label={selectedRule.isActive ? 'Active' : 'Inactive'}
              color={selectedRule.isActive ? 'success' : 'default'}
              size="small"
            />
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Property
              </Typography>
              <Typography variant="body1">
                {selectedRule.propertyName}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Material Type
              </Typography>
              <Typography variant="body1">
                {selectedRule.materialType}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type
              </Typography>
              <Typography variant="body1">
                {getRuleTypeDisplayName(selectedRule.type)}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Severity
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getSeverityIcon(selectedRule.severity)}
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {selectedRule.severity}
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Error Message
              </Typography>
              <Typography variant="body1">
                {selectedRule.message}
              </Typography>
            </Grid>
            
            {selectedRule.description && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {selectedRule.description}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
        
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Rule Configuration
          </Typography>
          
          <Divider sx={{ mb: 2 }} />
          
          {selectedRule.type === ValidationRuleType.RANGE && (
            <Grid container spacing={2}>
              {selectedRule.min !== undefined && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Minimum Value
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.min}
                  </Typography>
                </Grid>
              )}
              
              {selectedRule.max !== undefined && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Maximum Value
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.max}
                  </Typography>
                </Grid>
              )}
              
              {selectedRule.step !== undefined && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Step
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.step}
                  </Typography>
                </Grid>
              )}
              
              {selectedRule.unit && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Unit
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.unit}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
          
          {selectedRule.type === ValidationRuleType.PATTERN && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Pattern
                </Typography>
                <Typography variant="body1" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
                  {selectedRule.pattern}
                </Typography>
              </Grid>
              
              {selectedRule.flags && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Flags
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.flags}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
          
          {selectedRule.type === ValidationRuleType.ENUM && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Allowed Values
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {selectedRule.allowedValues.map((value: string) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              </Grid>
            </Grid>
          )}
          
          {selectedRule.type === ValidationRuleType.DEPENDENCY && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Condition
                </Typography>
                <Box sx={{ bgcolor: 'background.default', p: 1, borderRadius: 1, mt: 1 }}>
                  <Typography variant="body2">
                    When <strong>{selectedRule.condition.propertyName}</strong> {selectedRule.condition.operator} {selectedRule.condition.value !== undefined ? <strong>{JSON.stringify(selectedRule.condition.value)}</strong> : ''}
                  </Typography>
                </Box>
              </Grid>
              
              {selectedRule.requiredValue !== undefined && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Required Value
                  </Typography>
                  <Typography variant="body1">
                    {JSON.stringify(selectedRule.requiredValue)}
                  </Typography>
                </Grid>
              )}
              
              {selectedRule.requiredPattern && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Required Pattern
                  </Typography>
                  <Typography variant="body1" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
                    {selectedRule.requiredPattern}
                  </Typography>
                </Grid>
              )}
              
              {selectedRule.requiredRange && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Required Range
                  </Typography>
                  <Typography variant="body1">
                    {selectedRule.requiredRange.min !== undefined ? `Min: ${selectedRule.requiredRange.min}` : ''}
                    {selectedRule.requiredRange.min !== undefined && selectedRule.requiredRange.max !== undefined ? ', ' : ''}
                    {selectedRule.requiredRange.max !== undefined ? `Max: ${selectedRule.requiredRange.max}` : ''}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
          
          {selectedRule.type === ValidationRuleType.CUSTOM && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Function Name
                </Typography>
                <Typography variant="body1">
                  {selectedRule.functionName}
                </Typography>
              </Grid>
              
              {selectedRule.parameters && Object.keys(selectedRule.parameters).length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Parameters
                  </Typography>
                  <Typography variant="body1" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
                    {JSON.stringify(selectedRule.parameters, null, 2)}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
          
          {selectedRule.type === ValidationRuleType.COMPOSITE && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Operator
                </Typography>
                <Typography variant="body1">
                  {selectedRule.operator}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Referenced Rules
                </Typography>
                <List dense>
                  {selectedRule.rules.map((ruleId: string) => {
                    const referencedRule = rules.find(r => r.id === ruleId);
                    return (
                      <ListItem key={ruleId}>
                        <ListItemText
                          primary={referencedRule ? referencedRule.name : ruleId}
                          secondary={referencedRule ? `${referencedRule.propertyName} - ${getRuleTypeDisplayName(referencedRule.type)}` : 'Rule not found'}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Grid>
            </Grid>
          )}
        </Paper>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() => setTesterOpen(true)}
          >
            Test Rule
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              setIsEditing(true);
              setFormOpen(true);
            }}
          >
            Edit Rule
          </Button>
          
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleOpenDeleteDialog(selectedRule)}
          >
            Delete Rule
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Advanced Property Validation
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Validation Rules" />
          <Tab label="Rule Details" disabled={!selectedRule} />
        </Tabs>
      </Paper>
      
      {activeTab === 0 && (
        <Box>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  label="Search"
                  fullWidth
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleSearch} edge="end">
                        <SearchIcon />
                      </IconButton>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Property</InputLabel>
                  <Select
                    value={propertyFilter}
                    onChange={(e) => setPropertyFilter(e.target.value)}
                    label="Property"
                  >
                    <MenuItem value="">All Properties</MenuItem>
                    {properties.map(property => (
                      <MenuItem key={property} value={property}>
                        {property}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Rule Type</InputLabel>
                  <Select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    label="Rule Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    {Object.values(ValidationRuleType).map(type => (
                      <MenuItem key={type} value={type}>
                        {getRuleTypeDisplayName(type)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedRule(null);
                      setFormOpen(true);
                    }}
                    fullWidth
                  >
                    New Rule
                  </Button>
                  
                  <IconButton onClick={handleRefresh} title="Refresh">
                    <RefreshIcon />
                  </IconButton>
                </Box>
              </Grid>
            </Grid>
          </Paper>
          
          {renderRuleList()}
        </Box>
      )}
      
      {activeTab === 1 && renderRuleDetails()}
      
      {/* Rule Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditing ? 'Edit Validation Rule' : 'Create Validation Rule'}
        </DialogTitle>
        <DialogContent>
          <ValidationRuleForm
            initialData={isEditing ? selectedRule : undefined}
            materialType={materialType}
            onSubmit={handleFormSubmit}
            isSubmitting={loading}
            existingRules={rules}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Validation Rule</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete the validation rule "{ruleToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteRule} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
      
      {/* Validation Tester Dialog */}
      <Dialog
        open={testerOpen}
        onClose={() => setTesterOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Test Validation Rule</DialogTitle>
        <DialogContent>
          {selectedRule && (
            <ValidationTester
              rule={selectedRule}
              materialType={selectedRule.materialType}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTesterOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ValidationRuleManager;
