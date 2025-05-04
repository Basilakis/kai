import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography
} from '@mui/material';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';
import { relationshipAwareTrainingService, RelationshipAwareTrainingOptions } from '../../services/relationshipAwareTrainingService';

interface RelationshipAwareTrainingFormProps {
  onTrainingComplete?: (result: any) => void;
}

const RelationshipAwareTrainingForm: React.FC<RelationshipAwareTrainingFormProps> = ({
  onTrainingComplete
}) => {
  // Form state
  const [materialType, setMaterialType] = useState<string>('');
  const [targetProperty, setTargetProperty] = useState<string>('');
  const [includeRelationships, setIncludeRelationships] = useState<boolean>(true);
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([
    RelationshipType.CORRELATION,
    RelationshipType.DEPENDENCY,
    RelationshipType.COMPATIBILITY
  ]);
  const [relationshipStrengthThreshold, setRelationshipStrengthThreshold] = useState<number>(0.3);
  const [maxRelationshipDepth, setMaxRelationshipDepth] = useState<number>(2);
  const [useTransferLearning, setUseTransferLearning] = useState<boolean>(true);
  const [epochs, setEpochs] = useState<number>(50);
  const [batchSize, setBatchSize] = useState<number>(32);
  const [learningRate, setLearningRate] = useState<number>(0.001);
  const [validationSplit, setValidationSplit] = useState<number>(0.2);
  
  // UI state
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  
  // Material types
  const materialTypes = [
    { value: 'tile', label: 'Tile' },
    { value: 'stone', label: 'Stone' },
    { value: 'wood', label: 'Wood' },
    { value: 'laminate', label: 'Laminate' },
    { value: 'vinyl', label: 'Vinyl' },
    { value: 'carpet', label: 'Carpet' },
    { value: 'metal', label: 'Metal' },
    { value: 'glass', label: 'Glass' },
    { value: 'concrete', label: 'Concrete' },
    { value: 'ceramic', label: 'Ceramic' },
    { value: 'porcelain', label: 'Porcelain' }
  ];
  
  // Target properties
  const getTargetProperties = (materialType: string) => {
    const commonProperties = [
      { value: 'dimensions.width', label: 'Width' },
      { value: 'dimensions.height', label: 'Height' },
      { value: 'dimensions.depth', label: 'Depth' },
      { value: 'color.name', label: 'Color' },
      { value: 'finish', label: 'Finish' },
      { value: 'pattern', label: 'Pattern' },
      { value: 'texture', label: 'Texture' }
    ];
    
    const materialSpecificProperties: Record<string, Array<{ value: string; label: string }>> = {
      'tile': [
        { value: 'technicalSpecs.waterAbsorption', label: 'Water Absorption' },
        { value: 'technicalSpecs.slipResistance', label: 'Slip Resistance' },
        { value: 'technicalSpecs.frostResistance', label: 'Frost Resistance' }
      ],
      'stone': [
        { value: 'technicalSpecs.density', label: 'Density' },
        { value: 'technicalSpecs.porosity', label: 'Porosity' },
        { value: 'technicalSpecs.acidResistance', label: 'Acid Resistance' }
      ],
      'wood': [
        { value: 'technicalSpecs.hardness', label: 'Hardness' },
        { value: 'technicalSpecs.stability', label: 'Stability' },
        { value: 'technicalSpecs.grainPattern', label: 'Grain Pattern' }
      ]
    };
    
    return [
      ...commonProperties,
      ...(materialSpecificProperties[materialType] || [])
    ];
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!materialType || !targetProperty) {
      setError('Material type and target property are required');
      return;
    }
    
    setIsTraining(true);
    setError(null);
    setResult(null);
    
    try {
      // Prepare training options
      const options: RelationshipAwareTrainingOptions = {
        includeRelationships,
        relationshipTypes,
        relationshipStrengthThreshold,
        maxRelationshipDepth,
        useTransferLearning,
        epochs,
        batchSize,
        learningRate,
        validationSplit
      };
      
      // Train model
      const result = await relationshipAwareTrainingService.trainModel(
        materialType,
        targetProperty,
        options
      );
      
      setResult(result);
      
      // Call onTrainingComplete callback
      if (onTrainingComplete) {
        onTrainingComplete(result);
      }
    } catch (error) {
      console.error('Error training model:', error);
      setError('Error training model. Please try again.');
    } finally {
      setIsTraining(false);
    }
  };
  
  // Handle relationship type change
  const handleRelationshipTypeChange = (type: RelationshipType) => {
    if (relationshipTypes.includes(type)) {
      setRelationshipTypes(relationshipTypes.filter(t => t !== type));
    } else {
      setRelationshipTypes([...relationshipTypes, type]);
    }
  };
  
  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Relationship-Aware Model Training
          </Typography>
          
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Material Type */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="material-type-label">Material Type</InputLabel>
                  <Select
                    labelId="material-type-label"
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as string)}
                    label="Material Type"
                    disabled={isTraining}
                  >
                    {materialTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Target Property */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={!materialType || isTraining}>
                  <InputLabel id="target-property-label">Target Property</InputLabel>
                  <Select
                    labelId="target-property-label"
                    value={targetProperty}
                    onChange={(e) => setTargetProperty(e.target.value as string)}
                    label="Target Property"
                  >
                    {getTargetProperties(materialType).map((property) => (
                      <MenuItem key={property.value} value={property.value}>
                        {property.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Relationship Settings
                </Typography>
              </Grid>
              
              {/* Include Relationships */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeRelationships}
                      onChange={(e) => setIncludeRelationships(e.target.checked)}
                      disabled={isTraining}
                    />
                  }
                  label="Include Relationship Features"
                />
                <FormHelperText>
                  Enable to use property relationships as features for model training
                </FormHelperText>
              </Grid>
              
              {/* Relationship Types */}
              <Grid item xs={12}>
                <FormControl component="fieldset" disabled={!includeRelationships || isTraining}>
                  <Typography variant="subtitle2" gutterBottom>
                    Relationship Types
                  </Typography>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={relationshipTypes.includes(RelationshipType.CORRELATION)}
                          onChange={() => handleRelationshipTypeChange(RelationshipType.CORRELATION)}
                        />
                      }
                      label="Correlation"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={relationshipTypes.includes(RelationshipType.DEPENDENCY)}
                          onChange={() => handleRelationshipTypeChange(RelationshipType.DEPENDENCY)}
                        />
                      }
                      label="Dependency"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={relationshipTypes.includes(RelationshipType.COMPATIBILITY)}
                          onChange={() => handleRelationshipTypeChange(RelationshipType.COMPATIBILITY)}
                        />
                      }
                      label="Compatibility"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={relationshipTypes.includes(RelationshipType.EXCLUSION)}
                          onChange={() => handleRelationshipTypeChange(RelationshipType.EXCLUSION)}
                        />
                      }
                      label="Exclusion"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={relationshipTypes.includes(RelationshipType.CAUSATION)}
                          onChange={() => handleRelationshipTypeChange(RelationshipType.CAUSATION)}
                        />
                      }
                      label="Causation"
                    />
                  </FormGroup>
                </FormControl>
              </Grid>
              
              {/* Relationship Strength Threshold */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Relationship Strength Threshold: {relationshipStrengthThreshold.toFixed(2)}
                </Typography>
                <Slider
                  value={relationshipStrengthThreshold}
                  onChange={(_, value) => setRelationshipStrengthThreshold(value as number)}
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.5, label: '0.5' },
                    { value: 1, label: '1' }
                  ]}
                  disabled={!includeRelationships || isTraining}
                />
                <FormHelperText>
                  Minimum strength threshold for including relationships
                </FormHelperText>
              </Grid>
              
              {/* Max Relationship Depth */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Max Relationship Depth: {maxRelationshipDepth}
                </Typography>
                <Slider
                  value={maxRelationshipDepth}
                  onChange={(_, value) => setMaxRelationshipDepth(value as number)}
                  min={1}
                  max={5}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 3, label: '3' },
                    { value: 5, label: '5' }
                  ]}
                  disabled={!includeRelationships || isTraining}
                />
                <FormHelperText>
                  Maximum depth for indirect relationships
                </FormHelperText>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Training Settings
                </Typography>
              </Grid>
              
              {/* Use Transfer Learning */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useTransferLearning}
                      onChange={(e) => setUseTransferLearning(e.target.checked)}
                      disabled={isTraining}
                    />
                  }
                  label="Use Transfer Learning"
                />
                <FormHelperText>
                  Enable to use pre-trained models as a starting point
                </FormHelperText>
              </Grid>
              
              {/* Epochs */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Epochs"
                  type="number"
                  value={epochs}
                  onChange={(e) => setEpochs(parseInt(e.target.value))}
                  fullWidth
                  inputProps={{ min: 1, max: 1000 }}
                  disabled={isTraining}
                />
                <FormHelperText>
                  Number of training epochs
                </FormHelperText>
              </Grid>
              
              {/* Batch Size */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Batch Size"
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  fullWidth
                  inputProps={{ min: 1, max: 1000 }}
                  disabled={isTraining}
                />
                <FormHelperText>
                  Training batch size
                </FormHelperText>
              </Grid>
              
              {/* Learning Rate */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Learning Rate"
                  type="number"
                  value={learningRate}
                  onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  fullWidth
                  inputProps={{ step: 0.0001, min: 0.0001, max: 0.1 }}
                  disabled={isTraining}
                />
                <FormHelperText>
                  Learning rate for training
                </FormHelperText>
              </Grid>
              
              {/* Validation Split */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Validation Split: {validationSplit.toFixed(2)}
                </Typography>
                <Slider
                  value={validationSplit}
                  onChange={(_, value) => setValidationSplit(value as number)}
                  min={0.1}
                  max={0.5}
                  step={0.05}
                  marks={[
                    { value: 0.1, label: '0.1' },
                    { value: 0.3, label: '0.3' },
                    { value: 0.5, label: '0.5' }
                  ]}
                  disabled={isTraining}
                />
                <FormHelperText>
                  Fraction of data to use for validation
                </FormHelperText>
              </Grid>
              
              {/* Submit Button */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isTraining || !materialType || !targetProperty}
                  startIcon={isTraining ? <CircularProgress size={20} /> : null}
                >
                  {isTraining ? 'Training...' : 'Train Model'}
                </Button>
              </Grid>
              
              {/* Error Message */}
              {error && (
                <Grid item xs={12}>
                  <Typography color="error">{error}</Typography>
                </Grid>
              )}
              
              {/* Result */}
              {result && (
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ mt: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Training Result
                      </Typography>
                      <Typography variant="body2">
                        Model ID: {result.modelId}
                      </Typography>
                      <Typography variant="body2">
                        Accuracy: {(result.accuracy * 100).toFixed(2)}%
                      </Typography>
                      <Typography variant="body2">
                        Validation Accuracy: {(result.validationAccuracy * 100).toFixed(2)}%
                      </Typography>
                      {result.baselineAccuracy && (
                        <Typography variant="body2">
                          Baseline Accuracy: {(result.baselineAccuracy * 100).toFixed(2)}%
                        </Typography>
                      )}
                      {result.improvementPercentage && (
                        <Typography variant="body2">
                          Improvement: {result.improvementPercentage.toFixed(2)}%
                        </Typography>
                      )}
                      {result.relationshipMetrics && (
                        <>
                          <Typography variant="body2">
                            Relationships Used: {result.relationshipMetrics.relationshipsUsed}
                          </Typography>
                          <Typography variant="body2">
                            Relationship Contribution: {(result.relationshipMetrics.relationshipContribution * 100).toFixed(2)}%
                          </Typography>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RelationshipAwareTrainingForm;
