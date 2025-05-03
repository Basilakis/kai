import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  IconButton,
  Tooltip,
  Chip,
  Paper
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Description as DescriptionIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { ClassificationTreeNode } from '@kai/shared/src/types/classification';

interface ClassificationTreeProps {
  nodes: ClassificationTreeNode[];
  title?: string;
  onNodeSelect?: (node: ClassificationTreeNode) => void;
  selectedNodeId?: string;
  expandedByDefault?: boolean;
}

/**
 * Classification Tree Component
 * 
 * Displays a hierarchical tree of classification categories.
 */
const ClassificationTree: React.FC<ClassificationTreeProps> = ({
  nodes,
  title,
  onNodeSelect,
  selectedNodeId,
  expandedByDefault = false
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    nodes.reduce((acc, node) => {
      acc[node.id] = expandedByDefault;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleNodeClick = (node: ClassificationTreeNode) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  const renderTreeNode = (node: ClassificationTreeNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] || false;
    const isSelected = selectedNodeId === node.id;

    return (
      <React.Fragment key={node.id}>
        <ListItem
          sx={{
            pl: level * 2,
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            borderRadius: 1,
            '&:hover': {
              bgcolor: isSelected ? 'action.selected' : 'action.hover'
            }
          }}
          button
          onClick={() => handleNodeClick(node)}
          secondaryAction={
            <Tooltip title="Node Info">
              <IconButton edge="end" size="small">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          {hasChildren && (
            <IconButton
              edge="start"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand(node.id);
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
          <ListItemIcon>
            {hasChildren ? (
              isExpanded ? <FolderOpenIcon /> : <FolderIcon />
            ) : (
              <DescriptionIcon />
            )}
          </ListItemIcon>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" component="span">
                  {node.name}
                </Typography>
                <Chip
                  label={node.code}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              </Box>
            }
            secondary={node.description}
          />
        </ListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {node.children.map(childNode => renderTreeNode(childNode, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Paper sx={{ width: '100%', maxHeight: 600, overflow: 'auto' }}>
      {title && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">{title}</Typography>
        </Box>
      )}
      <List component="nav" dense>
        {nodes.map(node => renderTreeNode(node))}
      </List>
    </Paper>
  );
};

export default ClassificationTree;
