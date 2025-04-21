import React, { useEffect, useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Button, 
  CircularProgress, 
  Box, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Tabs,
  Tab,
  Chip
} from '@mui/material';
import { apiClient } from '../../utils/apiClient';

interface Model {
  id: string;
  type: string;
  path: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface ABTest {
  id: string;
  model_type: string;
  model_ids: string[];
  duration_days: number;
  metadata: any;
  start_date: string;
  end_date: string;
  status: string;
  results: any;
  winning_model_id?: string;
}

const ModelRegistry: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/rag/admin/models');
      setModels(response.data.models || []);
    } catch (err) {
      setError('Failed to fetch models');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchABTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/rag/admin/ab-tests');
      setABTests(response.data.abTests || []);
    } catch (err) {
      setError('Failed to fetch A/B tests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabValue === 0) {
      fetchModels();
    } else {
      fetchABTests();
    }
  }, [tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Model Registry
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Models" />
          <Tab label="A/B Tests" />
        </Tabs>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {tabValue === 0 && (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell>Metadata</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {models.length > 0 ? (
                  models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>{model.id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={model.type} 
                          color={model.type === 'embedding' ? 'primary' : 'secondary'} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{formatDate(model.created_at)}</TableCell>
                      <TableCell>{formatDate(model.updated_at)}</TableCell>
                      <TableCell>
                        {model.metadata?.fine_tuned && (
                          <Chip label="Fine-tuned" color="success" size="small" sx={{ mr: 1 }} />
                        )}
                        {model.metadata?.base_model && (
                          <Typography variant="body2">
                            Base: {model.metadata.base_model}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No models found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button variant="contained" color="primary" onClick={fetchModels}>
              Refresh Models
            </Button>
          </Box>
        </>
      )}

      {tabValue === 1 && (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Model Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Winner</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {abTests.length > 0 ? (
                  abTests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>{test.id}</TableCell>
                      <TableCell>{test.model_type}</TableCell>
                      <TableCell>
                        <Chip 
                          label={test.status} 
                          color={
                            test.status === 'running' ? 'primary' : 
                            test.status === 'completed' ? 'success' : 'default'
                          } 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{formatDate(test.start_date)}</TableCell>
                      <TableCell>{formatDate(test.end_date)}</TableCell>
                      <TableCell>
                        {test.winning_model_id ? (
                          <Chip label={test.winning_model_id} color="success" size="small" />
                        ) : (
                          'Not determined'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No A/B tests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button variant="contained" color="primary" onClick={fetchABTests}>
              Refresh A/B Tests
            </Button>
          </Box>
        </>
      )}
    </div>
  );
};

export default ModelRegistry;
