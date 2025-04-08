/**
 * Dataset List Component
 * 
 * Displays a list of datasets with actions for viewing, editing, and deleting
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StorageIcon from '@mui/icons-material/Storage';
import { Tooltip } from '@mui/material';

// Interface for component props
interface DatasetListProps {
  datasets: Array<{
    id: string;
    name: string;
    description?: string;
    status: 'processing' | 'ready' | 'error';
    classCount: number;
    imageCount: number;
    source?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  onView: (dataset: any) => void;
  onDelete: (dataset: any) => void;
}

// Format date to local string
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Dataset List component
const DatasetList: React.FC<DatasetListProps> = ({ datasets, onView, onDelete }) => {
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sourcesList, setSourcesList] = useState<string[]>([]);
  const [filteredDatasets, setFilteredDatasets] = useState(datasets);
  const [enableSourceFiltering, setEnableSourceFiltering] = useState(false);

  // Extract unique sources and update filtered datasets when datasets change
  useEffect(() => {
    // Extract unique sources using filter/reduce instead of Set for TypeScript compatibility
    const uniqueSources = datasets
      .map(dataset => dataset.source || '')
      .filter(source => source !== '')
      .reduce((acc: string[], curr) => {
        if (!acc.includes(curr)) {
          acc.push(curr);
        }
        return acc;
      }, []);
    setSourcesList(uniqueSources);
    
    // Apply current filter
    applyFilters(datasets, sourceFilter);
  }, [datasets]);

  // Apply filters when source filter changes
  useEffect(() => {
    applyFilters(datasets, sourceFilter);
  }, [sourceFilter, enableSourceFiltering]);

  // Filter datasets based on source
  const applyFilters = (data: typeof datasets, source: string) => {
    let filtered = [...data];
    
    // Only apply source filter if it's enabled and a source is selected
    if (enableSourceFiltering && source) {
      filtered = filtered.filter(dataset => dataset.source === source);
    }
    
    setFilteredDatasets(filtered);
  };

  // Handle source filter change
  const handleSourceFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSourceFilter(event.target.value as string);
  };

  // Render status chip with appropriate color
  const renderStatusChip = (status: string) => {
    let color:
      | 'default'
      | 'primary'
      | 'secondary'
      | 'error'
      | 'info'
      | 'success'
      | 'warning';
    let label: string;

    switch (status) {
      case 'ready':
        color = 'success';
        label = 'Ready';
        break;
      case 'processing':
        color = 'info';
        label = 'Processing';
        break;
      case 'error':
        color = 'error';
        label = 'Error';
        break;
      default:
        color = 'default';
        label = status;
    }

    return <Chip size="small" color={color} label={label} />;
  };

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell colSpan={7}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Datasets</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enableSourceFiltering}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableSourceFiltering(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Enable source filtering"
                  />
                  <FormControl 
                    sx={{ minWidth: 200 }} 
                    size="small" 
                    disabled={!enableSourceFiltering || sourcesList.length === 0}
                  >
                    <InputLabel>Filter by source</InputLabel>
                    <Select
                      value={sourceFilter}
                      onChange={handleSourceFilterChange}
                      label="Filter by source"
                      displayEmpty
                    >
                      <MenuItem value="">All sources</MenuItem>
                      {sourcesList.map((source) => (
                        <MenuItem key={source} value={source}>
                          {source}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Dataset</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Source / Company</TableCell>
            <TableCell>Classes</TableCell>
            <TableCell>Images</TableCell>
            <TableCell>Last Updated</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredDatasets.map((dataset) => (
            <TableRow key={dataset.id} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {dataset.name}
                    </Typography>
                    {dataset.description && (
                      <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 300 }}>
                        {dataset.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </TableCell>
              <TableCell>{renderStatusChip(dataset.status)}</TableCell>
              <TableCell>{dataset.source || 'Not specified'}</TableCell>
              <TableCell>{dataset.classCount}</TableCell>
              <TableCell>{dataset.imageCount}</TableCell>
              <TableCell>{formatDate(dataset.updatedAt)}</TableCell>
              <TableCell>
                <Tooltip title="View Dataset">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onView(dataset)}
                    aria-label="View dataset"
                  >
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>
                {dataset.status === 'ready' && (
                  <Tooltip title="Train Model">
                    <IconButton
                      size="small"
                      color="success"
                      aria-label="Train model"
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete Dataset">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => onDelete(dataset)}
                    aria-label="Delete dataset"
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

export default DatasetList;