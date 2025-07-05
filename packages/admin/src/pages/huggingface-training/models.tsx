// packages/admin/src/pages/huggingface-training/models.tsx

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
import { HfTrainableModel } from '../../../../shared/src/types/huggingface';
import { hfTrainableModelService } from '../../services/hfTrainableModelService';

const ModelsPage: React.FC = () => {
  const [models, setModels] = useState<HfTrainableModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hfTrainableModelService.getModels();
      setModels(data);
    } catch (err) {
      setError('Failed to fetch trainable models.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Trainable Models</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mr: 1 }}
            // onClick={() => /* Open new model dialog */}
          >
            New Model
          </Button>
          <IconButton onClick={fetchModels} color="primary">
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
                <TableCell>Base Model</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.map((model: HfTrainableModel) => (
                <TableRow key={model.id}>
                  <TableCell>{model.name}</TableCell>
                  <TableCell>{model.base_model_identifier}</TableCell>
                  <TableCell>{model.model_type}</TableCell>
                  <TableCell>{model.version}</TableCell>
                  <TableCell>{new Date(model.created_at).toLocaleString()}</TableCell>
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

export default ModelsPage;