/**
 * Dataset List Component
 * 
 * Displays a list of datasets with actions for viewing, editing, and deleting
 */

import React from 'react';
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
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Warning as WarningIcon,
  Storage as StorageIcon
} from '@mui/icons-material';

// Interface for component props
interface DatasetListProps {
  datasets: Array<{
    id: string;
    name: string;
    description?: string;
    status: 'processing' | 'ready' | 'error';
    classCount: number;
    imageCount: number;
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
  const theme = useTheme();

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
            <TableCell>Dataset</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Classes</TableCell>
            <TableCell>Images</TableCell>
            <TableCell>Last Updated</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {datasets.map((dataset) => (
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