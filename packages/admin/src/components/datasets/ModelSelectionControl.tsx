/**
 * ModelSelectionControl Component
 *
 * Allows selection of model architecture and configuration of training parameters
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  TextField,
  FormHelperText,
  Chip,
  Paper,
  Divider,
  Tooltip
} from '@mui/material';

// Model architecture information
const MODEL_ARCHITECTURES = [
  { 
    value: 'efficientnet', 
    label: 'EfficientNet', 
    description: 'Scalable architecture optimized for accuracy and efficiency',
    variants: ['B0', 'B1', 'B2', 'B3', 'B4', 'B5']
  },
  { 
    value: 'resnet', 
    label: 'ResNet', 
    description: 'Residual networks with skip connections',
    variants: ['18', '34', '50', '101', '152']
  },
  { 
    value: 'mobilenet', 
    label: 'MobileNet', 
    description: 'Lightweight architecture optimized for mobile and edge devices',
    variants: ['V2', 'V3Small', 'V3Large']
  },
  { 
    value: 'vit', 
    label: 'Vision Transformer', 
    description: 'Transformer-based architecture for image recognition',
    variants: ['Base', 'Small', 'Large']
  }
];

// Types for model selection
interface ModelConfig {
  architecture: string;
  variant: string;
  pretrained: boolean;
  hyperparameters: {
    batchSize: number;
    learningRate: number;
    epochs: number;
  };
}

interface ModelSelectionProps {
  initialConfig?: ModelConfig;
  onChange?: (config: ModelConfig) => void;
}

const ModelSelectionControl: React.FC<ModelSelectionProps> = ({ 
  initialConfig,
  onChange 
}) => {
  const defaultConfig: ModelConfig = {
    architecture: 'efficientnet',
    variant: 'B0',
    pretrained: true,
    hyperparameters: {
      batchSize: 32,
      learningRate: 0.001,
      epochs: 20
    }
  };

  const [modelConfig, setModelConfig] = useState<ModelConfig>(initialConfig || defaultConfig);
  
  // Get available variants for selected architecture
  const getVariants = () => {
    const arch = MODEL_ARCHITECTURES.find(a => a.value === modelConfig.architecture);
    return arch ? arch.variants : [];
  };
  
  // Handle model architecture change
  const handleArchitectureChange = (architecture: string) => {
    const arch = MODEL_ARCHITECTURES.find(a => a.value === architecture);
    if (arch) {
      setModelConfig({
        ...modelConfig,
        architecture,
        variant: arch.variants[0] // Default to first variant
      });
    }
  };
  
  // Handle variant change
  const handleVariantChange = (variant: string) => {
    setModelConfig({
      ...modelConfig,
      variant
    });
  };
  
  // Handle pretrained option change
  const handlePretrainedChange = (pretrained: boolean) => {
    setModelConfig({
      ...modelConfig,
      pretrained
    });
  };
  
  // Handle hyperparameter change
  const handleHyperparameterChange = (param: string, value: number) => {
    setModelConfig({
      ...modelConfig,
      hyperparameters: {
        ...modelConfig.hyperparameters,
        [param]: value
      }
    });
  };
  
  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(modelConfig);
    }
  }, [modelConfig, onChange]);
  
  // Get description of selected architecture
  const getArchitectureDescription = () => {
    const arch = MODEL_ARCHITECTURES.find(a => a.value === modelConfig.architecture);
    return arch ? arch.description : '';
  };
  
  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Model Architecture & Training Configuration
      </Typography>
      
      <Paper sx={{ p: 2, mt: 2 }}>
        <Grid container spacing={3}>
          {/* Model Architecture Selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="architecture-select-label">Model Architecture</InputLabel>
              <Select
                labelId="architecture-select-label"
                id="architecture-select"
                value={modelConfig.architecture}
                label="Model Architecture"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleArchitectureChange(e.target.value)}
              >
                {MODEL_ARCHITECTURES.map((arch) => (
                  <MenuItem key={arch.value} value={arch.value}>
                    {arch.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{getArchitectureDescription()}</FormHelperText>
            </FormControl>
          </Grid>
          
          {/* Model Variant Selection */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="variant-select-label">Model Variant</InputLabel>
              <Select
                labelId="variant-select-label"
                id="variant-select"
                value={modelConfig.variant}
                label="Model Variant"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleVariantChange(e.target.value)}
              >
                {getVariants().map((variant) => (
                  <MenuItem key={variant} value={variant}>
                    {modelConfig.architecture === 'resnet' ? `ResNet-${variant}` : 
                     modelConfig.architecture === 'efficientnet' ? `EfficientNet-${variant}` :
                     modelConfig.architecture === 'mobilenet' ? `MobileNet-${variant}` :
                     `ViT-${variant}`}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Select the specific variant of the model architecture</FormHelperText>
            </FormControl>
          </Grid>
          
          {/* Pretrained Options */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Pretrained Options
            </Typography>
            <Grid container spacing={2}>
              <Grid item>
                <Chip
                  label="Use Pretrained Weights"
                  color={modelConfig.pretrained ? "primary" : "default"}
                  onClick={() => handlePretrainedChange(true)}
                  variant={modelConfig.pretrained ? "filled" : "outlined"}
                />
              </Grid>
              <Grid item>
                <Chip
                  label="Train From Scratch"
                  color={!modelConfig.pretrained ? "primary" : "default"}
                  onClick={() => handlePretrainedChange(false)}
                  variant={!modelConfig.pretrained ? "filled" : "outlined"}
                />
              </Grid>
            </Grid>
            <FormHelperText>
              {modelConfig.pretrained 
                ? "Using pretrained weights allows the model to leverage knowledge from prior training on larger datasets."
                : "Training from scratch requires more data but gives more flexibility for custom tasks."}
            </FormHelperText>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          
          {/* Hyperparameters */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Hyperparameters
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Tooltip title="Number of samples processed in one forward/backward pass">
                  <TextField
                    fullWidth
                    label="Batch Size"
                    type="number"
                    value={modelConfig.hyperparameters.batchSize}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleHyperparameterChange('batchSize', parseInt(e.target.value))}
                    InputProps={{ inputProps: { min: 1, max: 512 } }}
                    helperText="Recommended: 16-128"
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Tooltip title="Step size for gradient updates during training">
                  <TextField
                    fullWidth
                    label="Learning Rate"
                    type="number"
                    value={modelConfig.hyperparameters.learningRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleHyperparameterChange('learningRate', parseFloat(e.target.value))}
                    InputProps={{ inputProps: { min: 0.0001, max: 0.1, step: 0.0001 } }}
                    helperText="Recommended: 0.001-0.01"
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Tooltip title="Number of complete passes through the training dataset">
                  <TextField
                    fullWidth
                    label="Epochs"
                    type="number"
                    value={modelConfig.hyperparameters.epochs}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleHyperparameterChange('epochs', parseInt(e.target.value))}
                    InputProps={{ inputProps: { min: 1, max: 200 } }}
                    helperText="Recommended: 10-50"
                  />
                </Tooltip>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ModelSelectionControl;