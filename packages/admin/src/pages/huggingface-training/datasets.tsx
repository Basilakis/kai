// packages/admin/src/pages/huggingface-training/datasets.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { HfDataset } from '../../../../shared/src/types/huggingface';
import { hfDatasetService } from '../../services/hfDatasetService';

const DatasetsPage: React.FC = () => {
  const [datasets, setDatasets] = useState<HfDataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hfDatasetService.getDatasets();
      setDatasets(data);
    } catch (err) {
      setError('Failed to fetch datasets.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Hugging Face Datasets</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mr: 1 }}
            // onClick={() => /* Open new dataset dialog */}
          >
            New Dataset
          </Button>
          <IconButton onClick={fetchDatasets} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      
      {!loading && !error && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Hugging Face Identifier</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {datasets.map((dataset: HfDataset) => (
                <TableRow key={dataset.id}>
                  <TableCell>{dataset.name}</TableCell>
                  <TableCell>{dataset.dataset_identifier}</TableCell>
                  <TableCell>{new Date(dataset.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {/* Action buttons go here */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default DatasetsPage;