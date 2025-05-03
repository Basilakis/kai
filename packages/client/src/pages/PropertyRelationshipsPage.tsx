import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { PropertyRelationshipManager } from '../components/property-relationships/PropertyRelationshipManager';
import { PropertyGraphVisualization } from '../components/property-relationships/PropertyGraphVisualization';

enum TabValue {
  MANAGER = 'manager',
  VISUALIZATION = 'visualization'
}

export const PropertyRelationshipsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabValue>(TabValue.MANAGER);
  const [materialType, setMaterialType] = useState<string>('tile');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

  const handleMaterialTypeChange = (event: any) => {
    setMaterialType(event.target.value);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Property Relationships
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="material-type-label">Material Type</InputLabel>
            <Select
              labelId="material-type-label"
              id="materialType"
              value={materialType}
              onChange={handleMaterialTypeChange}
              label="Material Type"
            >
              <MenuItem value="tile">Tile</MenuItem>
              <MenuItem value="stone">Stone</MenuItem>
              <MenuItem value="wood">Wood</MenuItem>
              <MenuItem value="carpet">Carpet</MenuItem>
              <MenuItem value="vinyl">Vinyl</MenuItem>
              <MenuItem value="laminate">Laminate</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Relationship Manager" value={TabValue.MANAGER} />
            <Tab label="Graph Visualization" value={TabValue.VISUALIZATION} />
          </Tabs>
        </Paper>
        
        {activeTab === TabValue.MANAGER && (
          <PropertyRelationshipManager materialType={materialType} />
        )}
        
        {activeTab === TabValue.VISUALIZATION && (
          <PropertyGraphVisualization materialType={materialType} />
        )}
      </Box>
    </Container>
  );
};
