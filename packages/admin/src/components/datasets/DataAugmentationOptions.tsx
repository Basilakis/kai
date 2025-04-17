/**
 * DataAugmentationOptions Component
 *
 * Provides controls for configuring data augmentation during training
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Slider,
  Grid,
  Paper,
  Tooltip,
  Divider
} from '@mui/material';

// Augmentation options interface
export interface AugmentationOptions {
  enabled: boolean;
  techniques: {
    rotation: boolean;
    horizontalFlip: boolean;
    verticalFlip: boolean;
    randomCrop: boolean;
    colorJitter: boolean;
    randomErasing: boolean;
    randomNoise: boolean;
  };
  intensities: {
    rotationDegrees: number;
    cropScale: number;
    brightnessVariation: number;
    erasePercent: number;
  };
}

interface DataAugmentationProps {
  initialOptions?: AugmentationOptions;
  onChange?: (options: AugmentationOptions) => void;
}

const DataAugmentationOptions: React.FC<DataAugmentationProps> = ({ 
  initialOptions,
  onChange 
}) => {
  // Default augmentation options
  const defaultOptions: AugmentationOptions = {
    enabled: true,
    techniques: {
      rotation: true,
      horizontalFlip: true,
      verticalFlip: false,
      randomCrop: true,
      colorJitter: true,
      randomErasing: false,
      randomNoise: false
    },
    intensities: {
      rotationDegrees: 30,
      cropScale: 80,
      brightnessVariation: 25,
      erasePercent: 5
    }
  };

  const [options, setOptions] = useState<AugmentationOptions>(
    initialOptions || defaultOptions
  );

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(options);
    }
  }, [options, onChange]);

  // Toggle main augmentation switch
  const handleEnableChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptions({
      ...options,
      enabled: event.target.checked
    });
  };

  // Toggle individual technique
  const handleTechniqueChange = (technique: keyof AugmentationOptions['techniques']) => 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setOptions({
        ...options,
        techniques: {
          ...options.techniques,
          [technique]: event.target.checked
        }
      });
    };

  // Update intensity value
  const handleIntensityChange = (intensity: keyof AugmentationOptions['intensities']) => 
    (_event: Event, value: number | number[]) => {
      setOptions({
        ...options,
        intensities: {
          ...options.intensities,
          [intensity]: value as number
        }
      });
    };

  // Descriptions for augmentation techniques
  const techniqueDescriptions = {
    rotation: "Randomly rotate images by a specified angle range",
    horizontalFlip: "Randomly flip images horizontally (mirror effect)",
    verticalFlip: "Randomly flip images vertically (upside down)",
    randomCrop: "Randomly crop and resize parts of the image",
    colorJitter: "Randomly adjust brightness, contrast and saturation",
    randomErasing: "Randomly erase rectangular regions from images",
    randomNoise: "Add random noise to images for robustness"
  };

  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Data Augmentation
        <Typography component="span" color="text.secondary" variant="body2" sx={{ ml: 1 }}>
          (increases dataset variety and model robustness)
        </Typography>
      </Typography>
      
      <Paper sx={{ p: 2, mt: 2 }}>
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={options.enabled}
                onChange={handleEnableChange}
                color="primary"
              />
            }
            label={
              <Typography variant="subtitle2">
                Enable Data Augmentation
              </Typography>
            }
          />
        </Box>
        
        {options.enabled && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Transformation Techniques
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormGroup>
                  <Tooltip title={techniqueDescriptions.rotation}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.rotation}
                          onChange={handleTechniqueChange('rotation')}
                        />
                      }
                      label="Rotation"
                    />
                  </Tooltip>
                  
                  <Tooltip title={techniqueDescriptions.horizontalFlip}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.horizontalFlip}
                          onChange={handleTechniqueChange('horizontalFlip')}
                        />
                      }
                      label="Horizontal Flip"
                    />
                  </Tooltip>
                  
                  <Tooltip title={techniqueDescriptions.verticalFlip}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.verticalFlip}
                          onChange={handleTechniqueChange('verticalFlip')}
                        />
                      }
                      label="Vertical Flip"
                    />
                  </Tooltip>
                  
                  <Tooltip title={techniqueDescriptions.randomCrop}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.randomCrop}
                          onChange={handleTechniqueChange('randomCrop')}
                        />
                      }
                      label="Random Crop"
                    />
                  </Tooltip>
                </FormGroup>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormGroup>
                  <Tooltip title={techniqueDescriptions.colorJitter}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.colorJitter}
                          onChange={handleTechniqueChange('colorJitter')}
                        />
                      }
                      label="Color Jitter"
                    />
                  </Tooltip>
                  
                  <Tooltip title={techniqueDescriptions.randomErasing}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.randomErasing}
                          onChange={handleTechniqueChange('randomErasing')}
                        />
                      }
                      label="Random Erasing"
                    />
                  </Tooltip>
                  
                  <Tooltip title={techniqueDescriptions.randomNoise}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.techniques.randomNoise}
                          onChange={handleTechniqueChange('randomNoise')}
                        />
                      }
                      label="Random Noise"
                    />
                  </Tooltip>
                </FormGroup>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Transformation Intensity
            </Typography>
            
            <Grid container spacing={3}>
              {options.techniques.rotation && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" id="rotation-slider-label" gutterBottom>
                    Max Rotation (±{options.intensities.rotationDegrees}°)
                  </Typography>
                  <Slider
                    value={options.intensities.rotationDegrees}
                    onChange={handleIntensityChange('rotationDegrees')}
                    aria-labelledby="rotation-slider-label"
                    min={5}
                    max={180}
                    step={5}
                    marks={[
                      { value: 5, label: '5°' },
                      { value: 90, label: '90°' },
                      { value: 180, label: '180°' }
                    ]}
                  />
                </Grid>
              )}
              
              {options.techniques.randomCrop && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" id="crop-slider-label" gutterBottom>
                    Crop Scale ({options.intensities.cropScale}%)
                  </Typography>
                  <Slider
                    value={options.intensities.cropScale}
                    onChange={handleIntensityChange('cropScale')}
                    aria-labelledby="crop-slider-label"
                    min={50}
                    max={95}
                    step={5}
                    marks={[
                      { value: 50, label: '50%' },
                      { value: 75, label: '75%' },
                      { value: 95, label: '95%' }
                    ]}
                  />
                </Grid>
              )}
              
              {options.techniques.colorJitter && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" id="brightness-slider-label" gutterBottom>
                    Brightness Variation (±{options.intensities.brightnessVariation}%)
                  </Typography>
                  <Slider
                    value={options.intensities.brightnessVariation}
                    onChange={handleIntensityChange('brightnessVariation')}
                    aria-labelledby="brightness-slider-label"
                    min={5}
                    max={50}
                    step={5}
                    marks={[
                      { value: 5, label: '5%' },
                      { value: 25, label: '25%' },
                      { value: 50, label: '50%' }
                    ]}
                  />
                </Grid>
              )}
              
              {options.techniques.randomErasing && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" id="erase-slider-label" gutterBottom>
                    Erase Area ({options.intensities.erasePercent}% of image)
                  </Typography>
                  <Slider
                    value={options.intensities.erasePercent}
                    onChange={handleIntensityChange('erasePercent')}
                    aria-labelledby="erase-slider-label"
                    min={1}
                    max={25}
                    step={1}
                    marks={[
                      { value: 1, label: '1%' },
                      { value: 10, label: '10%' },
                      { value: 25, label: '25%' }
                    ]}
                  />
                </Grid>
              )}
            </Grid>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default DataAugmentationOptions;