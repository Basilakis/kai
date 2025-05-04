import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
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
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * Model Comparison Panel Component
 * 
 * This component allows admins to compare different models for the same property.
 */
const ModelComparisonPanel: React.FC<{
  propertyName: string;
  materialType: MaterialType;
}> = ({ propertyName, materialType }) => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);
  const [reference, setReference] = useState<any | null>(null);
  const [createVersionDialogOpen, setCreateVersionDialogOpen] = useState<boolean>(false);
  const [sourceVersion, setSourceVersion] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [versionToDelete, setVersionToDelete] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Load versions
  useEffect(() => {
    loadVersions();
  }, [propertyName, materialType]);

  // Load model versions
  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/ai/model-comparison/${propertyName}/versions`, {
        params: {
          materialType
        }
      });
      
      setVersions(response.data.versions || []);
      setReference(response.data.reference || null);
      
      // Select up to 2 versions by default
      if (response.data.versions?.length > 0) {
        setSelectedVersions(response.data.versions.slice(0, Math.min(2, response.data.versions.length)));
      }
    } catch (error) {
      console.error('Error loading model versions:', error);
      setError('Error loading model versions');
    } finally {
      setLoading(false);
    }
  };

  // Handle version selection change
  const handleVersionSelectionChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedVersions(event.target.value as string[]);
  };

  // Handle compare button click
  const handleCompare = async () => {
    if (selectedVersions.length < 2) {
      setError('Please select at least 2 versions to compare');
      return;
    }
    
    setComparing(true);
    setError(null);
    
    try {
      const response = await api.post(`/api/ai/model-comparison/${propertyName}/compare`, {
        materialType,
        modelIds: selectedVersions
      });
      
      setComparisonResult(response.data.result);
    } catch (error) {
      console.error('Error comparing models:', error);
      setError('Error comparing models');
    } finally {
      setComparing(false);
    }
  };

  // Handle create version dialog open
  const handleOpenCreateVersionDialog = () => {
    setCreateVersionDialogOpen(true);
    setSourceVersion('');
  };

  // Handle create version dialog close
  const handleCloseCreateVersionDialog = () => {
    setCreateVersionDialogOpen(false);
  };

  // Handle create version
  const handleCreateVersion = async () => {
    try {
      const response = await api.post(`/api/ai/model-comparison/${propertyName}/versions`, {
        materialType,
        sourceModelId: sourceVersion || undefined
      });
      
      handleCloseCreateVersionDialog();
      loadVersions();
    } catch (error) {
      console.error('Error creating model version:', error);
      setError('Error creating model version');
    }
  };

  // Handle delete dialog open
  const handleOpenDeleteDialog = (version: string) => {
    setDeleteDialogOpen(true);
    setVersionToDelete(version);
  };

  // Handle delete dialog close
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setVersionToDelete('');
  };

  // Handle delete version
  const handleDeleteVersion = async () => {
    try {
      await api.delete(`/api/ai/model-comparison/${propertyName}/versions/${versionToDelete}`, {
        params: {
          materialType
        }
      });
      
      handleCloseDeleteDialog();
      loadVersions();
    } catch (error) {
      console.error('Error deleting model version:', error);
      setError('Error deleting model version');
    }
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!comparisonResult) return [];
    
    const metrics = ['accuracy', 'precision', 'recall', 'f1_score'];
    const data = metrics.map(metric => {
      const item: any = { name: metric.charAt(0).toUpperCase() + metric.slice(1) };
      
      for (const modelId of selectedVersions) {
        if (comparisonResult.models) {
          const model = comparisonResult.models.find((m: any) => m.modelId === modelId);
          if (model) {
            item[modelId] = model[metric];
          }
        }
      }
      
      return item;
    });
    
    return data;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        <CompareArrowsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Model Comparison: {propertyName} ({materialType})
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Model Versions
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateVersionDialog}
          >
            Create Version
          </Button>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : versions.length === 0 ? (
          <Alert severity="info">
            No model versions found for this property. Create a version to get started.
          </Alert>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Select Versions to Compare</InputLabel>
              <Select
                multiple
                value={selectedVersions}
                onChange={handleVersionSelectionChange}
                label="Select Versions to Compare"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Box>
                )}
              >
                {versions.map((version) => (
                  <MenuItem key={version} value={version}>
                    {version}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="contained"
                onClick={handleCompare}
                disabled={selectedVersions.length < 2 || comparing}
                startIcon={comparing ? <CircularProgress size={16} /> : <CompareArrowsIcon />}
              >
                {comparing ? 'Comparing...' : 'Compare Selected Versions'}
              </Button>
              
              <Box>
                {versions.map((version) => (
                  <Chip
                    key={version}
                    label={version}
                    onDelete={() => handleOpenDeleteDialog(version)}
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
            </Box>
          </>
        )}
      </Paper>
      
      {comparisonResult && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Comparison Results
          </Typography>
          
          {comparisonResult.recommendation && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Recommendation</Typography>
              {comparisonResult.recommendation}
            </Alert>
          )}
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Performance Metrics
              </Typography>
              
              <Box sx={{ height: 300, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={prepareChartData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
                    <Legend />
                    {selectedVersions.map((version, index) => (
                      <Bar
                        key={version}
                        dataKey={version}
                        name={version}
                        fill={index === 0 ? '#8884d8' : index === 1 ? '#82ca9d' : '#ffc658'}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Model Details
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Model</TableCell>
                      <TableCell>Trained At</TableCell>
                      <TableCell>Data Size</TableCell>
                      <TableCell>Training Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {comparisonResult.models?.map((model: any) => (
                      <TableRow key={model.modelId}>
                        <TableCell>{model.modelId}</TableCell>
                        <TableCell>{new Date(model.trainedAt).toLocaleString()}</TableCell>
                        <TableCell>{model.trainingDataSize} samples</TableCell>
                        <TableCell>{Math.round(model.trainingTime / 60)} minutes</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Disagreement Examples
              </Typography>
              
              {comparisonResult.comparisonMetrics?.disagreementExamples?.length > 0 ? (
                <Grid container spacing={2}>
                  {comparisonResult.comparisonMetrics.disagreementExamples.map((example: any, index: number) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card>
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            Example {index + 1}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Actual: {example.actualValue}
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          {example.predictions.map((pred: any) => (
                            <Box key={pred.modelId} sx={{ mb: 1 }}>
                              <Typography variant="body2">
                                {pred.modelId}: {pred.predictedValue} ({(pred.confidence * 100).toFixed(1)}%)
                              </Typography>
                            </Box>
                          ))}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="success">
                  <CheckCircleIcon sx={{ mr: 1 }} />
                  No disagreements found between the selected models!
                </Alert>
              )}
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Create Version Dialog */}
      <Dialog
        open={createVersionDialogOpen}
        onClose={handleCloseCreateVersionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Model Version</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Create a new model version for {propertyName} ({materialType}).
              You can optionally copy an existing version as a starting point.
            </Typography>
            
            {versions.length > 0 && (
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Copy from Existing Version (Optional)</InputLabel>
                <Select
                  value={sourceVersion}
                  onChange={(e) => setSourceVersion(e.target.value as string)}
                  label="Copy from Existing Version (Optional)"
                >
                  <MenuItem value="">Create Empty Version</MenuItem>
                  {versions.map((version) => (
                    <MenuItem key={version} value={version}>
                      {version}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateVersionDialog}>Cancel</Button>
          <Button
            onClick={handleCreateVersion}
            variant="contained"
            color="primary"
          >
            Create Version
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Version Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Model Version</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1">
              Are you sure you want to delete model version <strong>{versionToDelete}</strong>?
              This action cannot be undone.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleDeleteVersion}
            variant="contained"
            color="error"
          >
            Delete Version
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ModelComparisonPanel;
