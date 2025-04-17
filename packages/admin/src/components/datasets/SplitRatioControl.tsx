/**
 * SplitRatioControl Component
 *
 * Provides visual sliders for adjusting dataset split ratios (training/validation/test)
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  Grid,
  Chip,
  Tooltip
} from '@mui/material';

interface SplitRatioProps {
  initialRatio?: {
    train: number;
    validation: number;
    test: number;
  };
  onChange?: (ratios: { train: number; validation: number; test: number }) => void;
}

const SplitRatioControl: React.FC<SplitRatioProps> = ({ 
  initialRatio = { train: 70, validation: 20, test: 10 },
  onChange 
}) => {
  const [splitRatio, setSplitRatio] = useState(initialRatio);
  const [trainSliderValue, setTrainSliderValue] = useState(initialRatio.train);
  
  // Update parent component when split ratio changes
  useEffect(() => {
    if (onChange) {
      onChange(splitRatio);
    }
  }, [splitRatio, onChange]);

  // Adjust validation and test ratios proportionally when train ratio changes
  const handleTrainChange = (_event: Event, newValue: number | number[]) => {
    const trainValue = newValue as number;
    setTrainSliderValue(trainValue);
    
    const remainingPercentage = 100 - trainValue;
    const currentRemainder = splitRatio.validation + splitRatio.test;
    
    // Default to 50/50 split if no previous proportions exist
    let newValidation = 0;
    let newTest = 0;
    
    if (currentRemainder === 0) {
      newValidation = remainingPercentage / 2;
      newTest = remainingPercentage / 2;
    } else {
      // Maintain proportions
      newValidation = (splitRatio.validation / currentRemainder) * remainingPercentage;
      newTest = (splitRatio.test / currentRemainder) * remainingPercentage;
    }
    
    // Round to avoid floating point issues
    newValidation = Math.round(newValidation);
    newTest = Math.round(newTest);
    
    // Ensure they add up to exactly 100%
    const adjustedTest = 100 - trainValue - newValidation;
    
    setSplitRatio({
      train: trainValue,
      validation: newValidation,
      test: adjustedTest
    });
  };

  // Handle validation slider change
  const handleValidationChange = (_event: Event, newValue: number | number[]) => {
    const validationValue = newValue as number;
    const maxValidation = 100 - splitRatio.train - 5; // Ensure at least 5% for test
    
    if (validationValue > maxValidation) {
      return;
    }
    
    const newTest = 100 - splitRatio.train - validationValue;
    
    setSplitRatio({
      train: splitRatio.train,
      validation: validationValue,
      test: newTest
    });
  };

  // Get color based on percentage (higher = more saturated)
  const getColor = (percent: number) => {
    if (percent >= 60) return 'primary';
    if (percent >= 30) return 'info';
    return 'default';
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Dataset Split Ratio
      </Typography>
      
      <Box sx={{ mb: 4, mt: 3 }}>
        {/* Visual representation of split */}
        <Grid container sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <Box sx={{ 
              display: 'flex',
              height: '24px',
              width: '100%',
              borderRadius: 1,
              overflow: 'hidden'
            }}>
              <Box sx={{ 
                width: `${splitRatio.train}%`, 
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {splitRatio.train >= 20 && (
                  <Typography variant="caption" sx={{ color: 'white' }}>
                    {splitRatio.train}%
                  </Typography>
                )}
              </Box>
              <Box sx={{ 
                width: `${splitRatio.validation}%`, 
                bgcolor: 'info.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {splitRatio.validation >= 20 && (
                  <Typography variant="caption" sx={{ color: 'white' }}>
                    {splitRatio.validation}%
                  </Typography>
                )}
              </Box>
              <Box sx={{ 
                width: `${splitRatio.test}%`, 
                bgcolor: 'grey.400',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {splitRatio.test >= 20 && (
                  <Typography variant="caption" sx={{ color: 'white' }}>
                    {splitRatio.test}%
                  </Typography>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
        
        {/* Labels */}
        <Grid container spacing={1} sx={{ mb: 3 }}>
          <Grid item>
            <Chip 
              label={`Training: ${splitRatio.train}%`} 
              size="small" 
              color={getColor(splitRatio.train)}
            />
          </Grid>
          <Grid item>
            <Chip 
              label={`Validation: ${splitRatio.validation}%`} 
              size="small" 
              color={getColor(splitRatio.validation)}
            />
          </Grid>
          <Grid item>
            <Chip 
              label={`Test: ${splitRatio.test}%`} 
              size="small" 
              color={getColor(splitRatio.test)}
            />
          </Grid>
        </Grid>
        
        {/* Sliders */}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Training Set: {splitRatio.train}%
            </Typography>
            <Tooltip title="Adjust the percentage of data used for training">
              <Slider
                value={splitRatio.train}
                onChange={handleTrainChange}
                aria-label="Training data percentage"
                valueLabelDisplay="auto"
                step={5}
                marks
                min={50}
                max={90}
              />
            </Tooltip>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Validation Set: {splitRatio.validation}%
            </Typography>
            <Tooltip title="Adjust the percentage of data used for validation">
              <Slider
                value={splitRatio.validation}
                onChange={handleValidationChange}
                aria-label="Validation data percentage"
                valueLabelDisplay="auto"
                step={5}
                marks
                min={5}
                max={40}
                disabled={splitRatio.train >= 90}
              />
            </Tooltip>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body2" gutterBottom>
              Test Set: {splitRatio.test}% (Automatically calculated)
            </Typography>
            <Slider
              value={splitRatio.test}
              aria-label="Test data percentage"
              valueLabelDisplay="off"
              step={5}
              marks
              min={5}
              max={40}
              disabled
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default SplitRatioControl;