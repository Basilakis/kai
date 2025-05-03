import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  IconButton,
  Slider,
  Grid
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { RelationshipType, CompatibilityType } from '@kai/shared/src/types/property-relationships';
import ForceGraph2D from 'react-force-graph-2d';

interface PropertyGraphVisualizationProps {
  materialType: string;
}

export const PropertyGraphVisualization: React.FC<PropertyGraphVisualizationProps> = ({
  materialType
}) => {
  const { token } = useAuth();
  const [graphData, setGraphData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    relationshipTypes: Object.values(RelationshipType),
    showValues: true,
    showProperties: true
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    const fetchGraphData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/property-relationships/graph/${materialType}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        
        const data = await response.json();
        
        // Transform the data for the force graph
        const transformedData = {
          nodes: data.graph.nodes.map((node: any) => ({
            id: node.id,
            name: node.label,
            type: node.type,
            group: node.group,
            val: node.type === 'property' ? 5 : 3
          })),
          links: data.graph.edges.map((edge: any) => ({
            source: edge.source,
            target: edge.target,
            type: edge.type,
            strength: edge.strength,
            compatibilityType: edge.compatibilityType,
            label: edge.label
          }))
        };
        
        setGraphData(transformedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchGraphData();
  }, [materialType, token]);

  const handleFilterChange = (event: any) => {
    const { name, value } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggleNodeType = (type: 'properties' | 'values') => {
    setFilters(prev => ({
      ...prev,
      [type === 'properties' ? 'showProperties' : 'showValues']: !prev[type === 'properties' ? 'showProperties' : 'showValues']
    }));
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      setZoomLevel(prev => Math.min(prev + 0.2, 2));
      graphRef.current.zoom(zoomLevel + 0.2);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
      graphRef.current.zoom(zoomLevel - 0.2);
    }
  };

  const handleRefresh = () => {
    if (graphRef.current) {
      graphRef.current.resetView();
      setZoomLevel(1);
    }
  };

  const getNodeColor = (node: any) => {
    if (node.type === 'property') {
      return '#4caf50'; // Green for properties
    }
    
    // Colors for different property groups
    const groupColors: Record<string, string> = {
      material: '#2196f3', // Blue
      finish: '#ff9800', // Orange
      rRating: '#f44336', // Red
      vRating: '#9c27b0', // Purple
      peiRating: '#e91e63', // Pink
      waterAbsorption: '#00bcd4', // Cyan
      size: '#3f51b5', // Indigo
      thickness: '#009688', // Teal
      color: '#cddc39', // Lime
      pattern: '#ffeb3b', // Yellow
      shape: '#795548', // Brown
      usage: '#607d8b', // Blue Grey
      style: '#ff5722', // Deep Orange
      moh: '#8bc34a', // Light Green
      frostResistance: '#03a9f4', // Light Blue
      chemicalResistance: '#673ab7', // Deep Purple
      stainResistance: '#ffc107' // Amber
    };
    
    return groupColors[node.group] || '#9e9e9e'; // Grey as fallback
  };

  const getLinkColor = (link: any) => {
    if (link.compatibilityType) {
      // Colors for compatibility types
      const compatibilityColors: Record<string, string> = {
        [CompatibilityType.COMPATIBLE]: '#4caf50', // Green
        [CompatibilityType.RECOMMENDED]: '#2196f3', // Blue
        [CompatibilityType.NOT_RECOMMENDED]: '#ff9800', // Orange
        [CompatibilityType.INCOMPATIBLE]: '#f44336' // Red
      };
      
      return compatibilityColors[link.compatibilityType] || '#9e9e9e';
    }
    
    if (link.type) {
      // Colors for relationship types
      const relationshipColors: Record<string, string> = {
        [RelationshipType.CORRELATION]: '#2196f3', // Blue
        [RelationshipType.DEPENDENCY]: '#9c27b0', // Purple
        [RelationshipType.COMPATIBILITY]: '#4caf50', // Green
        [RelationshipType.EXCLUSION]: '#f44336', // Red
        [RelationshipType.CAUSATION]: '#ff9800', // Orange
        [RelationshipType.DERIVATION]: '#00bcd4', // Cyan
        [RelationshipType.ASSOCIATION]: '#9e9e9e' // Grey
      };
      
      return relationshipColors[link.type] || '#9e9e9e';
    }
    
    return '#9e9e9e'; // Grey as fallback
  };

  const getLinkWidth = (link: any) => {
    return link.strength ? 1 + (link.strength * 3) : 1;
  };

  // Filter the graph data based on the selected filters
  const filteredGraphData = {
    nodes: graphData.nodes.filter((node: any) => {
      if (node.type === 'property' && !filters.showProperties) return false;
      if (node.type === 'value' && !filters.showValues) return false;
      return true;
    }),
    links: graphData.links.filter((link: any) => {
      if (link.type && !filters.relationshipTypes.includes(link.type)) return false;
      
      // Check if source and target nodes are visible
      const sourceNode = graphData.nodes.find((n: any) => n.id === link.source);
      const targetNode = graphData.nodes.find((n: any) => n.id === link.target);
      
      if (sourceNode && sourceNode.type === 'property' && !filters.showProperties) return false;
      if (sourceNode && sourceNode.type === 'value' && !filters.showValues) return false;
      if (targetNode && targetNode.type === 'property' && !filters.showProperties) return false;
      if (targetNode && targetNode.type === 'value' && !filters.showValues) return false;
      
      return true;
    })
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Property Relationship Graph for {materialType}
        </Typography>
        <Box>
          <Tooltip title="Zoom In">
            <IconButton onClick={handleZoomIn}>
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={handleZoomOut}>
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset View">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel id="relationship-types-label">Relationship Types</InputLabel>
              <Select
                labelId="relationship-types-label"
                id="relationshipTypes"
                name="relationshipTypes"
                multiple
                value={filters.relationshipTypes}
                onChange={handleFilterChange}
                label="Relationship Types"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {Object.values(RelationshipType).map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label="Properties"
                color={filters.showProperties ? 'primary' : 'default'}
                onClick={() => handleToggleNodeType('properties')}
                icon={<FilterListIcon />}
              />
              <Chip
                label="Values"
                color={filters.showValues ? 'primary' : 'default'}
                onClick={() => handleToggleNodeType('values')}
                icon={<FilterListIcon />}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : filteredGraphData.nodes.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            No property relationships found for {materialType}.
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ height: 600, overflow: 'hidden' }}>
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredGraphData}
            nodeLabel="name"
            nodeColor={getNodeColor}
            nodeRelSize={6}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.25}
            cooldownTicks={100}
            onEngineStop={() => console.log('Graph layout stabilized')}
          />
        </Paper>
      )}
    </Box>
  );
};
