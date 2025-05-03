import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Typography,
  Collapse,
  Button
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';
import { ValueCorrelationList } from './ValueCorrelationList';
import { CompatibilityRuleList } from './CompatibilityRuleList';

interface PropertyRelationshipListProps {
  relationships: any[];
  relationshipType: RelationshipType;
  onDelete: (id: string) => void;
}

export const PropertyRelationshipList: React.FC<PropertyRelationshipListProps> = ({
  relationships,
  relationshipType,
  onDelete
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const handleExpandRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getRelationshipTypeLabel = (type: RelationshipType) => {
    switch (type) {
      case RelationshipType.CORRELATION:
        return 'Correlation';
      case RelationshipType.DEPENDENCY:
        return 'Dependency';
      case RelationshipType.COMPATIBILITY:
        return 'Compatibility';
      case RelationshipType.EXCLUSION:
        return 'Exclusion';
      case RelationshipType.CAUSATION:
        return 'Causation';
      case RelationshipType.DERIVATION:
        return 'Derivation';
      case RelationshipType.ASSOCIATION:
        return 'Association';
      default:
        return type;
    }
  };

  const renderExpandedContent = (relationship: any) => {
    switch (relationship.relationshipType) {
      case RelationshipType.CORRELATION:
        return (
          <ValueCorrelationList
            relationshipId={relationship.id}
            sourceProperty={relationship.sourceProperty}
            targetProperty={relationship.targetProperty}
          />
        );
      case RelationshipType.COMPATIBILITY:
      case RelationshipType.EXCLUSION:
        return (
          <CompatibilityRuleList
            relationshipId={relationship.id}
            sourceProperty={relationship.sourceProperty}
            targetProperty={relationship.targetProperty}
          />
        );
      default:
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="textSecondary">
              No additional details available for this relationship type.
            </Typography>
          </Box>
        );
    }
  };

  if (relationships.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="textSecondary" gutterBottom>
          No {getRelationshipTypeLabel(relationshipType)} relationships found.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{ mt: 1 }}
        >
          Add {getRelationshipTypeLabel(relationshipType)} Relationship
        </Button>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Source Property</TableCell>
            <TableCell>Target Property</TableCell>
            <TableCell>Strength</TableCell>
            <TableCell>Bidirectional</TableCell>
            <TableCell>Description</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {relationships.map((relationship) => (
            <React.Fragment key={relationship.id}>
              <TableRow hover>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleExpandRow(relationship.id)}
                  >
                    {expandedRows[relationship.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </TableCell>
                <TableCell>{relationship.sourceProperty}</TableCell>
                <TableCell>{relationship.targetProperty}</TableCell>
                <TableCell>{relationship.strength.toFixed(2)}</TableCell>
                <TableCell>{relationship.bidirectional ? 'Yes' : 'No'}</TableCell>
                <TableCell>{relationship.description || '-'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      onClick={() => onDelete(relationship.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                  <Collapse in={expandedRows[relationship.id]} timeout="auto" unmountOnExit>
                    {renderExpandedContent(relationship)}
                  </Collapse>
                </TableCell>
              </TableRow>
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
