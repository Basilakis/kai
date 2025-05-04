import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Slider,
  Autocomplete,
  CircularProgress,
  Alert,
  Divider,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  TuneOutlined as TuneIcon,
  HomeOutlined as HomeIcon,
  StyleOutlined as StyleIcon,
  AccountBalanceWalletOutlined as WalletIcon
} from '@mui/icons-material';
import { propertyRecommendationService, PropertyRecommendationOptions, ProjectContext } from '../../services/propertyRecommendationService';
import MaterialTypeSelector, { MaterialType } from '../common/MaterialTypeSelector';

interface PropertyRecommendationFormProps {
  onRecommendationsReceived: (recommendations: any[]) => void;
  projectId?: string;
  initialMaterialType?: string;
}

const PropertyRecommendationForm: React.FC<PropertyRecommendationFormProps> = ({
  onRecommendationsReceived,
  projectId,
  initialMaterialType
}) => {
  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [materialType, setMaterialType] = useState<string>(initialMaterialType || '');
  const [propertyRequirements, setPropertyRequirements] = useState<Record<string, any>>({});
  const [projectContext, setProjectContext] = useState<ProjectContext>({
    projectId,
    projectType: '',
    roomType: '',
    existingMaterials: [],
    style: '',
    budget: 'medium'
  });
  const [existingMaterials, setExistingMaterials] = useState<any[]>([]);
  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [advancedMode, setAdvancedMode] = useState<boolean>(false);
  const [showProjectContext, setShowProjectContext] = useState<boolean>(!!projectId);
  
  // Common properties for different material types
  const commonProperties = [
    { name: 'dimensions.width', displayName: 'Width (mm)', type: 'number' },
    { name: 'dimensions.height', displayName: 'Height (mm)', type: 'number' },
    { name: 'color.name', displayName: 'Color', type: 'string' },
    { name: 'finish', displayName: 'Finish', type: 'string' },
    { name: 'pattern', displayName: 'Pattern', type: 'string' }
  ];
  
  // Material-specific properties
  const materialProperties: Record<string, Array<{ name: string; displayName: string; type: string }>> = {
    'tile': [
      { name: 'technicalSpecs.waterAbsorption', displayName: 'Water Absorption (%)', type: 'number' },
      { name: 'technicalSpecs.slipResistance', displayName: 'Slip Resistance', type: 'number' },
      { name: 'technicalSpecs.frostResistance', displayName: 'Frost Resistance', type: 'boolean' }
    ],
    'wood': [
      { name: 'technicalSpecs.hardness', displayName: 'Hardness (Janka)', type: 'number' },
      { name: 'technicalSpecs.stability', displayName: 'Stability', type: 'string' },
      { name: 'technicalSpecs.grainPattern', displayName: 'Grain Pattern', type: 'string' }
    ],
    'stone': [
      { name: 'technicalSpecs.density', displayName: 'Density (g/cm³)', type: 'number' },
      { name: 'technicalSpecs.porosity', displayName: 'Porosity (%)', type: 'number' },
      { name: 'technicalSpecs.acidResistance', displayName: 'Acid Resistance', type: 'string' }
    ]
  };
  
  // Room types
  const roomTypes = [
    { value: 'living_room', label: 'Living Room' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'dining_room', label: 'Dining Room' },
    { value: 'entryway', label: 'Entryway' },
    { value: 'hallway', label: 'Hallway' },
    { value: 'office', label: 'Office' },
    { value: 'outdoor', label: 'Outdoor' }
  ];
  
  // Project types
  const projectTypes = [
    { value: 'new_construction', label: 'New Construction' },
    { value: 'renovation', label: 'Renovation' },
    { value: 'remodel', label: 'Remodel' },
    { value: 'addition', label: 'Addition' },
    { value: 'repair', label: 'Repair' }
  ];
  
  // Style options
  const styleOptions = [
    { value: 'modern', label: 'Modern' },
    { value: 'traditional', label: 'Traditional' },
    { value: 'contemporary', label: 'Contemporary' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'rustic', label: 'Rustic' },
    { value: 'minimalist', label: 'Minimalist' },
    { value: 'scandinavian', label: 'Scandinavian' },
    { value: 'bohemian', label: 'Bohemian' },
    { value: 'mid_century', label: 'Mid-Century' },
    { value: 'coastal', label: 'Coastal' }
  ];
  
  // Load existing materials
  useEffect(() => {
    loadMaterials();
    
    // Load project context if projectId is provided
    if (projectId) {
      loadProjectContext();
    }
  }, [projectId]);
  
  // Load materials
  const loadMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      const data = await response.json();
      
      if (data.materials) {
        setAllMaterials(data.materials);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };
  
  // Load project context
  const loadProjectContext = async () => {
    if (!projectId) return;
    
    try {
      const context = await propertyRecommendationService.getProjectContext(projectId);
      
      if (context) {
        setProjectContext(context);
        
        // Load existing materials
        if (context.existingMaterials && context.existingMaterials.length > 0) {
          const materials = allMaterials.filter(m => context.existingMaterials?.includes(m.id));
          setExistingMaterials(materials);
        }
      }
    } catch (error) {
      console.error('Error loading project context:', error);
    }
  };
  
  // Handle material type change
  const handleMaterialTypeChange = (type: string) => {
    setMaterialType(type);
    
    // Reset property requirements when material type changes
    setPropertyRequirements({});
  };
  
  // Handle property requirement change
  const handlePropertyRequirementChange = (property: string, value: any) => {
    setPropertyRequirements(prev => ({
      ...prev,
      [property]: value
    }));
  };
  
  // Handle project context change
  const handleProjectContextChange = (field: keyof ProjectContext, value: any) => {
    setProjectContext(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle existing materials change
  const handleExistingMaterialsChange = (event: React.SyntheticEvent, value: any[]) => {
    setExistingMaterials(value);
    
    // Update project context
    setProjectContext(prev => ({
      ...prev,
      existingMaterials: value.map(m => m.id)
    }));
  };
  
  // Get recommendations
  const handleGetRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build options
      const options: PropertyRecommendationOptions = {
        materialType,
        propertyRequirements,
        count: 10,
        includeExplanations: true
      };
      
      // Add project context if available
      if (showProjectContext) {
        options.projectContext = projectContext;
      }
      
      // Get recommendations
      const recommendations = await propertyRecommendationService.getRecommendations(options);
      
      // Pass recommendations to parent component
      onRecommendationsReceived(recommendations);
      
      // Save project context if projectId is provided
      if (projectId && showProjectContext) {
        await propertyRecommendationService.saveProjectContext(projectContext);
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
      setError('Failed to get recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Reset form
  const handleReset = () => {
    setPropertyRequirements({});
    
    if (showProjectContext) {
      setProjectContext({
        projectId,
        projectType: '',
        roomType: '',
        existingMaterials: [],
        style: '',
        budget: 'medium'
      });
      setExistingMaterials([]);
    }
  };
  
  // Get properties to display based on material type
  const getPropertiesForForm = () => {
    const properties = [...commonProperties];
    
    if (materialType && materialProperties[materialType]) {
      properties.push(...materialProperties[materialType]);
    }
    
    return properties;
  };
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          <SearchIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Property-Based Recommendations
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
            />
          }
          label="Advanced Mode"
        />
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" gutterBottom>
            Material Type
          </Typography>
          <MaterialTypeSelector
            value={materialType}
            onChange={handleMaterialTypeChange}
            fullWidth
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" gutterBottom>
            Project Context
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showProjectContext}
                onChange={(e) => setShowProjectContext(e.target.checked)}
              />
            }
            label="Include Project Context"
          />
        </Grid>
      </Grid>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" gutterBottom>
        <TuneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Property Requirements
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {getPropertiesForForm().map((property) => (
          <Grid item xs={12} sm={6} md={4} key={property.name}>
            {property.type === 'number' ? (
              <TextField
                label={property.displayName}
                type="number"
                value={propertyRequirements[property.name] || ''}
                onChange={(e) => handlePropertyRequirementChange(property.name, parseFloat(e.target.value))}
                fullWidth
              />
            ) : property.type === 'boolean' ? (
              <FormControl fullWidth>
                <InputLabel>{property.displayName}</InputLabel>
                <Select
                  value={propertyRequirements[property.name] === undefined ? '' : propertyRequirements[property.name] ? 'true' : 'false'}
                  onChange={(e) => handlePropertyRequirementChange(property.name, e.target.value === 'true')}
                  label={property.displayName}
                >
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <TextField
                label={property.displayName}
                value={propertyRequirements[property.name] || ''}
                onChange={(e) => handlePropertyRequirementChange(property.name, e.target.value)}
                fullWidth
              />
            )}
          </Grid>
        ))}
      </Grid>
      
      {showProjectContext && (
        <>
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            <HomeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Project Context
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Room Type</InputLabel>
                <Select
                  value={projectContext.roomType || ''}
                  onChange={(e) => handleProjectContextChange('roomType', e.target.value)}
                  label="Room Type"
                >
                  <MenuItem value="">Select Room Type</MenuItem>
                  {roomTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Project Type</InputLabel>
                <Select
                  value={projectContext.projectType || ''}
                  onChange={(e) => handleProjectContextChange('projectType', e.target.value)}
                  label="Project Type"
                >
                  <MenuItem value="">Select Project Type</MenuItem>
                  {projectTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Style</InputLabel>
                <Select
                  value={projectContext.style || ''}
                  onChange={(e) => handleProjectContextChange('style', e.target.value)}
                  label="Style"
                >
                  <MenuItem value="">Select Style</MenuItem>
                  {styleOptions.map((style) => (
                    <MenuItem key={style.value} value={style.value}>
                      {style.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Budget</InputLabel>
                <Select
                  value={projectContext.budget || 'medium'}
                  onChange={(e) => handleProjectContextChange('budget', e.target.value as 'low' | 'medium' | 'high')}
                  label="Budget"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Existing Materials
              </Typography>
              <Autocomplete
                multiple
                options={allMaterials}
                getOptionLabel={(option) => `${option.name} (${option.materialType})`}
                value={existingMaterials}
                onChange={handleExistingMaterialsChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Existing Materials"
                    placeholder="Search materials..."
                    variant="outlined"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      {...getTagProps({ index })}
                      color="primary"
                    />
                  ))
                }
                renderOption={(props, option) => (
                  <li {...props}>
                    <Grid container alignItems="center">
                      <Grid item xs>
                        <Typography variant="body1">{option.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {option.materialType}
                        </Typography>
                      </Grid>
                    </Grid>
                  </li>
                )}
                limitTags={5}
              />
            </Grid>
          </Grid>
        </>
      )}
      
      {advancedMode && (
        <>
          <Divider sx={{ my: 3 }} />
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Advanced Options</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Minimum Relevance Score
                  </Typography>
                  <Slider
                    value={0.6}
                    onChange={(e, value) => {}}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 0.5, label: '50%' },
                      { value: 1, label: '100%' }
                    ]}
                    min={0}
                    max={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Number of Recommendations"
                    type="number"
                    value={10}
                    onChange={(e) => {}}
                    fullWidth
                    InputProps={{ inputProps: { min: 1, max: 50 } }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </>
      )}
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleReset}
          sx={{ mr: 1 }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGetRecommendations}
          disabled={loading || !materialType}
          startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
        >
          {loading ? 'Getting Recommendations...' : 'Get Recommendations'}
        </Button>
      </Box>
    </Paper>
  );
};

export default PropertyRecommendationForm;
