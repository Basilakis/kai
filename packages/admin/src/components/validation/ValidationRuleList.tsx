import React from 'react';
import {
  Box,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  ValidationRuleType,
  ValidationSeverity
} from '@kai/shared/src/types/validation';

interface ValidationRuleListProps {
  rules: any[];
  loading: boolean;
  selectedRule: any | null;
  onSelectRule: (rule: any) => void;
  onEditRule: (rule: any) => void;
  onDeleteRule: (rule: any) => void;
  onTestRule: (rule: any) => void;
}

/**
 * Validation Rule List Component
 * 
 * Displays a list of validation rules in a table.
 */
const ValidationRuleList: React.FC<ValidationRuleListProps> = ({
  rules,
  loading,
  selectedRule,
  onSelectRule,
  onEditRule,
  onDeleteRule,
  onTestRule
}) => {
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
              onClick={() => onSelectRule(rule)}
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
                      onTestRule(rule);
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
                      onEditRule(rule);
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
                      onDeleteRule(rule);
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

export default ValidationRuleList;
