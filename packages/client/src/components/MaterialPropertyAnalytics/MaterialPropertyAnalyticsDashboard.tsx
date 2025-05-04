import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Autocomplete,
  TextField,
  Divider
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  ScatterPlot as ScatterPlotIcon,
  ErrorOutline as ErrorOutlineIcon
} from '@mui/icons-material';
import PropertyDistributionChart from './PropertyDistributionChart';
import PropertyTrendsChart from './PropertyTrendsChart';
import PropertyCorrelationChart from './PropertyCorrelationChart';
import PropertyAnomaliesTable from './PropertyAnomaliesTable';
import MaterialTypeSelector, { MaterialType } from '../common/MaterialTypeSelector';

interface MaterialPropertyAnalyticsDashboardProps {
  onMaterialSelect?: (materialId: string) => void;
}

const MaterialPropertyAnalyticsDashboard: React.FC<MaterialPropertyAnalyticsDashboardProps> = ({
  onMaterialSelect
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [materialType, setMaterialType] = useState<string>('');
  const [selectedProperty, setSelectedProperty] = useState<string>('dimensions.width');
  const [selectedProperty1, setSelectedProperty1] = useState<string>('dimensions.width');
  const [selectedProperty2, setSelectedProperty2] = useState<string>('dimensions.height');
  
  // Common properties for different material types
  const commonProperties = [
    { name: 'dimensions.width', displayName: 'Width (mm)' },
    { name: 'dimensions.height', displayName: 'Height (mm)' },
    { name: 'dimensions.depth', displayName: 'Depth (mm)' },
    { name: 'color.name', displayName: 'Color' },
    { name: 'finish', displayName: 'Finish' },
    { name: 'pattern', displayName: 'Pattern' },
    { name: 'texture', displayName: 'Texture' }
  ];
  
  // Material-specific properties
  const materialProperties: Record<string, Array<{ name: string; displayName: string }>> = {
    'tile': [
      { name: 'technicalSpecs.waterAbsorption', displayName: 'Water Absorption (%)' },
      { name: 'technicalSpecs.slipResistance', displayName: 'Slip Resistance' },
      { name: 'technicalSpecs.frostResistance', displayName: 'Frost Resistance' }
    ],
    'wood': [
      { name: 'technicalSpecs.hardness', displayName: 'Hardness (Janka)' },
      { name: 'technicalSpecs.stability', displayName: 'Stability' },
      { name: 'technicalSpecs.grainPattern', displayName: 'Grain Pattern' }
    ],
    'stone': [
      { name: 'technicalSpecs.density', displayName: 'Density (g/cm³)' },
      { name: 'technicalSpecs.porosity', displayName: 'Porosity (%)' },
      { name: 'technicalSpecs.acidResistance', displayName: 'Acid Resistance' }
    ]
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Handle material type change
  const handleMaterialTypeChange = (type: string) => {
    setMaterialType(type);
  };
  
  // Get properties for the selected material type
  const getPropertiesForMaterialType = () => {
    const properties = [...commonProperties];
    
    if (materialType && materialProperties[materialType]) {
      properties.push(...materialProperties[materialType]);
    }
    
    return properties;
  };
  
  // Get property display name
  const getPropertyDisplayName = (propertyName: string) => {
    const properties = getPropertiesForMaterialType();
    const property = properties.find(p => p.name === propertyName);
    
    return property ? property.displayName : propertyName;
  };
  
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Material Property Analytics
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Analyze material properties, trends, and anomalies across the database.
        </Typography>
        
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <MaterialTypeSelector
              value={materialType}
              onChange={handleMaterialTypeChange}
              label="Filter by Material Type"
              fullWidth
              allowEmpty
            />
          </Grid>
        </Grid>
        
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<BarChartIcon />} label="Distribution" />
          <Tab icon={<TimelineIcon />} label="Trends" />
          <Tab icon={<ScatterPlotIcon />} label="Correlation" />
          <Tab icon={<ErrorOutlineIcon />} label="Anomalies" />
        </Tabs>
      </Paper>
      
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="property-label">Select Property</InputLabel>
              <Select
                labelId="property-label"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value as string)}
                label="Select Property"
              >
                {getPropertiesForMaterialType().map((property) => (
                  <MenuItem key={property.name} value={property.name}>
                    {property.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <PropertyDistributionChart
            property={selectedProperty}
            materialType={materialType || undefined}
          />
        </Paper>
      )}
      
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="property-label">Select Property</InputLabel>
              <Select
                labelId="property-label"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value as string)}
                label="Select Property"
              >
                {getPropertiesForMaterialType().map((property) => (
                  <MenuItem key={property.name} value={property.name}>
                    {property.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <PropertyTrendsChart
            property={selectedProperty}
            materialType={materialType || undefined}
          />
        </Paper>
      )}
      
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="property1-label">Property 1</InputLabel>
                <Select
                  labelId="property1-label"
                  value={selectedProperty1}
                  onChange={(e) => setSelectedProperty1(e.target.value as string)}
                  label="Property 1"
                >
                  {getPropertiesForMaterialType().map((property) => (
                    <MenuItem key={property.name} value={property.name}>
                      {property.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="property2-label">Property 2</InputLabel>
                <Select
                  labelId="property2-label"
                  value={selectedProperty2}
                  onChange={(e) => setSelectedProperty2(e.target.value as string)}
                  label="Property 2"
                >
                  {getPropertiesForMaterialType().map((property) => (
                    <MenuItem key={property.name} value={property.name}>
                      {property.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          <Divider sx={{ mb: 3 }} />
          
          <PropertyCorrelationChart
            property1={selectedProperty1}
            property2={selectedProperty2}
            materialType={materialType || undefined}
          />
        </Paper>
      )}
      
      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="property-label">Select Property</InputLabel>
              <Select
                labelId="property-label"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value as string)}
                label="Select Property"
              >
                {getPropertiesForMaterialType()
                  .filter(property => property.name.includes('dimensions') || property.name.includes('technicalSpecs'))
                  .map((property) => (
                    <MenuItem key={property.name} value={property.name}>
                      {property.displayName}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Note: Anomaly detection works best with numeric properties.
            </Typography>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <PropertyAnomaliesTable
            property={selectedProperty}
            materialType={materialType || undefined}
            onMaterialSelect={onMaterialSelect}
          />
        </Paper>
      )}
    </Box>
  );
};

export default MaterialPropertyAnalyticsDashboard;
