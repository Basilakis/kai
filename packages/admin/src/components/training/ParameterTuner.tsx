import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  // Paper, // Unused import
  Card,
  CardContent,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  // IconButton, // Unused import
  Tooltip,
  Slider,
  // Divider, // Unused import
  InputAdornment
} from '../../components/mui';
import type { SelectChangeEvent } from '@mui/material';

/**
 * Parameter definition interface
 */
interface ParameterDefinition {
  name: string;
  displayName: string;
  type: 'number' | 'integer' | 'select';
  defaultValue: number | string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;
  description?: string;
  options?: Array<{ value: string | number; label: string }>;
}

/**
 * Common parameter definitions for different model types
 */
const PARAMETER_DEFINITIONS: Record<string, ParameterDefinition[]> = {
  // Neural network model parameters
  'neural-network': [
    {
      name: 'learning_rate',
      displayName: 'Learning Rate',
      type: 'number',
      defaultValue: 0.001,
      minValue: 0.0001,
      maxValue: 0.1,
      step: 0.0001,
      description: 'Controls how much the model weights are updated during training'
    },
    {
      name: 'batch_size',
      displayName: 'Batch Size',
      type: 'integer',
      defaultValue: 32,
      minValue: 1,
      maxValue: 512,
      step: 1,
      description: 'Number of samples processed before model weights are updated'
    },
    {
      name: 'epochs',
      displayName: 'Total Epochs',
      type: 'integer',
      defaultValue: 50,
      minValue: 1,
      maxValue: 1000,
      step: 1,
      description: 'Number of complete passes through the training dataset'
    },
    {
      name: 'optimizer',
      displayName: 'Optimizer',
      type: 'select',
      defaultValue: 'adam',
      options: [
        { value: 'adam', label: 'Adam' },
        { value: 'sgd', label: 'SGD' },
        { value: 'rmsprop', label: 'RMSprop' },
        { value: 'adagrad', label: 'Adagrad' }
      ],
      description: 'Optimization algorithm used for training'
    }
  ],

  // Feature-based model parameters
  'feature-based': [
    {
      name: 'max_depth',
      displayName: 'Max Depth',
      type: 'integer',
      defaultValue: 6,
      minValue: 1,
      maxValue: 50,
      step: 1,
      description: 'Maximum depth of the trees'
    },
    {
      name: 'min_samples_split',
      displayName: 'Min Samples Split',
      type: 'integer',
      defaultValue: 2,
      minValue: 2,
      maxValue: 20,
      step: 1,
      description: 'Minimum samples required to split an internal node'
    },
    {
      name: 'n_estimators',
      displayName: 'Number of Estimators',
      type: 'integer',
      defaultValue: 100,
      minValue: 10,
      maxValue: 1000,
      step: 10,
      description: 'Number of trees in the forest'
    }
  ],

  // Hybrid model parameters (includes both neural and feature-based)
  'hybrid': [
    {
      name: 'learning_rate',
      displayName: 'Learning Rate',
      type: 'number',
      defaultValue: 0.001,
      minValue: 0.0001,
      maxValue: 0.1,
      step: 0.0001,
      description: 'Controls how much the model weights are updated during training'
    },
    {
      name: 'batch_size',
      displayName: 'Batch Size',
      type: 'integer',
      defaultValue: 32,
      minValue: 1,
      maxValue: 512,
      step: 1,
      description: 'Number of samples processed before model weights are updated'
    },
    {
      name: 'feature_weight',
      displayName: 'Feature Weight',
      type: 'number',
      defaultValue: 0.5,
      minValue: 0,
      maxValue: 1,
      step: 0.01,
      description: 'Weight given to feature-based model in the hybrid approach'
    }
  ],

  // Default parameters for unknown model types
  'default': [
    {
      name: 'learning_rate',
      displayName: 'Learning Rate',
      type: 'number',
      defaultValue: 0.001,
      minValue: 0.0001,
      maxValue: 0.1,
      step: 0.0001,
      description: 'Controls how much the model weights are updated during training'
    },
    {
      name: 'batch_size',
      displayName: 'Batch Size',
      type: 'integer',
      defaultValue: 32,
      minValue: 1,
      maxValue: 512,
      step: 1,
      description: 'Number of samples processed before model weights are updated'
    }
  ]
};

// Interface for ParameterTuner props
interface ParameterTunerProps {
  jobId: string;
  modelType: string;
  currentParameters?: Record<string, any>;
  onAdjustParameters: (parameters: Record<string, number | string>) => void;
}

/**
 * ParameterTuner Component
 *
 * Allows adjusting training parameters in real-time.
 */
const ParameterTuner: React.FC<ParameterTunerProps> = ({
  // jobId, // Unused prop
  modelType,
  currentParameters = {},
  onAdjustParameters
}) => {
  // Get parameter definitions based on model type
  const parameterDefinitions = PARAMETER_DEFINITIONS[modelType] || PARAMETER_DEFINITIONS['default'];

  // Initialize parameter values with current or default values
  const initialValues: Record<string, number | string> = {};

  parameterDefinitions.forEach(param => {
    initialValues[param.name] = currentParameters[param.name] !== undefined
      ? currentParameters[param.name]
      : param.defaultValue;
  });

  // State for parameter values
  const [paramValues, setParamValues] = useState<Record<string, number | string>>(initialValues);
  const [pendingChanges, setPendingChanges] = useState<Record<string, number | string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update parameter values when currentParameters change
  useEffect(() => {
    if (currentParameters && Object.keys(currentParameters).length > 0) {
      const updatedValues = { ...paramValues };
      let hasChanges = false;

      // Update values for parameters that exist in our definitions
      parameterDefinitions.forEach(param => {
        if (currentParameters[param.name] !== undefined &&
            currentParameters[param.name] !== paramValues[param.name]) {
          updatedValues[param.name] = currentParameters[param.name];
          hasChanges = true;
        }
      });

      // If we found changes, update state
      if (hasChanges) {
        setParamValues(updatedValues);

        // Show success message if we had pending changes that got applied
        const appliedChanges = Object.keys(pendingChanges).filter(
          key => currentParameters[key] === pendingChanges[key]
        );

        if (appliedChanges.length > 0) {
          setSuccessMessage(`Parameters updated: ${appliedChanges.join(', ')}`);
          setPendingChanges({});

          // Clear success message after 5 seconds
          setTimeout(() => {
            setSuccessMessage(null);
          }, 5000);
        }
      }
    }
  }, [currentParameters, parameterDefinitions]);

  // Handle slider change
  const handleSliderChange = (name: string, value: number | number[]) => {
    if (typeof value === 'number') {
      setParamValues(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle input change
  const handleInputChange = (name: string, value: string) => {
    const param = parameterDefinitions.find(p => p.name === name);

    if (!param) return;

    let parsedValue: number | string = value;

    // Convert to appropriate type
    if (param.type === 'number') {
      parsedValue = parseFloat(value) || 0;

      // Enforce min/max
      if (param.minValue !== undefined && parsedValue < param.minValue) {
        parsedValue = param.minValue;
      }
      if (param.maxValue !== undefined && parsedValue > param.maxValue) {
        parsedValue = param.maxValue;
      }
    } else if (param.type === 'integer') {
      parsedValue = parseInt(value) || 0;

      // Enforce min/max
      if (param.minValue !== undefined && parsedValue < param.minValue) {
        parsedValue = param.minValue;
      }
      if (param.maxValue !== undefined && parsedValue > param.maxValue) {
        parsedValue = param.maxValue;
      }
    }

    setParamValues(prev => ({
      ...prev,
      [name]: parsedValue
    }));
  };

  // Handle select change
  const handleSelectChange = (name: string, value: string) => {
    setParamValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Apply parameter changes
  const applyParameterChanges = () => {
    // Get changed parameters
    const changedParams: Record<string, number | string> = {};

    Object.keys(paramValues).forEach(key => {
      // Only include parameters that have changed from current values
      if (currentParameters[key] !== paramValues[key]) {
        changedParams[key] = paramValues[key];
      }
    });

    // If no changes, do nothing
    if (Object.keys(changedParams).length === 0) {
      setErrorMessage('No parameter changes to apply');
      setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
      return;
    }

    // Show submitting state
    setIsSubmitting(true);
    setPendingChanges(changedParams);

    // Call the adjustment handler
    onAdjustParameters(changedParams);

    // Clear submitting state after a delay (in a real app, this would be in response to a success callback)
    setTimeout(() => {
      setIsSubmitting(false);
    }, 1000);
  };

  // Reset parameter changes
  const resetParameterChanges = () => {
    // Reset to current parameters or defaults
    const resetValues: Record<string, number | string> = {};

    parameterDefinitions.forEach(param => {
      resetValues[param.name] = currentParameters[param.name] !== undefined
        ? currentParameters[param.name]
        : param.defaultValue;
    });

    setParamValues(resetValues);
    setPendingChanges({});
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Adjust Training Parameters
      </Typography>

      {/* Status messages */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Parameter adjustment interface */}
      <Grid container spacing={3}>
        {parameterDefinitions.map(param => (
          <Grid item xs={12} md={6} key={param.name}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="subtitle1">
                    {param.displayName}
                    {pendingChanges[param.name] !== undefined && (
                      <Tooltip title="Parameter change pending">
                        <Box component="span" sx={{ ml: 1, color: 'warning.main' }}>
                          •
                        </Box>
                      </Tooltip>
                    )}
                  </Typography>

                  {param.description && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {param.description}
                    </Typography>
                  )}
                </Box>

                {/* Parameter input based on type */}
                {param.type === 'select' ? (
                  // Select for enumerated options
                  <FormControl fullWidth size="small">
                    <InputLabel id={`${param.name}-label`}>{param.displayName}</InputLabel>
                    <Select
                      labelId={`${param.name}-label`}
                      id={param.name}
                      value={paramValues[param.name] || ''}
                      label={param.displayName}
                      onChange={(e: SelectChangeEvent) => handleSelectChange(param.name, e.target.value as string)}
                    >
                      {param.options?.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  // Slider and numeric input for numbers
                  <Box>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs>
                        <Slider
                          value={paramValues[param.name] as number}
                          min={param.minValue}
                          max={param.maxValue}
                          step={param.step}
                          onChange={(_: Event, value: number | number[]) => handleSliderChange(param.name, value)}
                          valueLabelDisplay="auto"
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          id={param.name}
                          variant="outlined"
                          size="small"
                          type="number"
                          value={paramValues[param.name]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(param.name, e.target.value)}
                          InputProps={{
                            endAdornment: param.unit ? (
                              <InputAdornment position="end">{param.unit}</InputAdornment>
                            ) : undefined,
                            inputProps: {
                              min: param.minValue,
                              max: param.maxValue,
                              step: param.step
                            }
                          }}
                        />
                      </Grid>
                    </Grid>

                    {/* Display min/max values */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Min: {param.minValue}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Max: {param.maxValue}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Show current vs new value if changed */}
                {currentParameters[param.name] !== undefined &&
                 currentParameters[param.name] !== paramValues[param.name] && (
                  <Box sx={{ mt: 2, py: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                    <Grid container>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Current: {currentParameters[param.name]}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="primary">
                          New: {paramValues[param.name]}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Action buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={resetParameterChanges}
          sx={{ mr: 2 }}
          disabled={isSubmitting}
        >
          Reset Changes
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={applyParameterChanges}
          disabled={isSubmitting || Object.keys(pendingChanges).length > 0}
        >
          {isSubmitting ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Applying Changes...
            </>
          ) : (
            'Apply Parameter Changes'
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default ParameterTuner;