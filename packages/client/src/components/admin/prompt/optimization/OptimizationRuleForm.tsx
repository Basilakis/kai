import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormControlLabel, 
  Switch, 
  Button, 
  Typography,
  Grid,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Slider,
  InputAdornment
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { CodeEditor } from '../../../common/CodeEditor';

interface OptimizationRuleFormProps {
  onSubmit: (rule: any) => void;
  initialData?: any;
}

const RULE_TYPES = [
  { value: 'low_success_rate', label: 'Low Success Rate' },
  { value: 'champion_challenger', label: 'Champion/Challenger' },
  { value: 'segment_specific', label: 'Segment Specific' },
  { value: 'ml_suggestion', label: 'ML Suggestion' },
  { value: 'scheduled_experiment', label: 'Scheduled Experiment' },
  { value: 'time_based', label: 'Time Based' },
  { value: 'user_feedback', label: 'User Feedback' },
  { value: 'context_aware', label: 'Context Aware' },
  { value: 'multi_variant', label: 'Multi-Variant' }
];

const OptimizationRuleForm: React.FC<OptimizationRuleFormProps> = ({ onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    ruleType: initialData?.ruleType || 'low_success_rate',
    isActive: initialData?.isActive !== false,
    ruleParameters: initialData?.ruleParameters || {}
  });

  // Initialize default parameters based on rule type
  useEffect(() => {
    let defaultParams = {};
    
    switch (formData.ruleType) {
      case 'low_success_rate':
        defaultParams = {
          threshold: 50,
          lookbackDays: 7,
          minSampleSize: 100
        };
        break;
      case 'champion_challenger':
        defaultParams = {
          minDays: 7,
          minSampleSize: 100,
          significanceLevel: 0.05
        };
        break;
      case 'segment_specific':
        defaultParams = {
          segmentIds: [],
          minSuccessRateDifference: 10,
          minSampleSize: 50
        };
        break;
      case 'ml_suggestion':
        defaultParams = {
          confidenceThreshold: 70,
          maxSuggestionsPerPrompt: 3,
          applyAutomatically: false
        };
        break;
      case 'scheduled_experiment':
        defaultParams = {
          schedule: 'weekly',
          dayOfWeek: 1, // Monday
          trafficAllocation: 50,
          experimentDuration: 14
        };
        break;
      case 'time_based':
        defaultParams = {
          timeOfDay: '09:00',
          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
          promptIds: []
        };
        break;
      case 'user_feedback':
        defaultParams = {
          feedbackThreshold: 3.5,
          minFeedbackCount: 10,
          feedbackTypes: ['rating', 'comment']
        };
        break;
      case 'context_aware':
        defaultParams = {
          contexts: ['mobile', 'desktop'],
          deviceTypes: ['phone', 'tablet', 'desktop'],
          timeRanges: ['morning', 'afternoon', 'evening']
        };
        break;
      case 'multi_variant':
        defaultParams = {
          variantCount: 3,
          trafficAllocation: 75,
          testDuration: 14,
          successMetric: 'success_rate'
        };
        break;
      default:
        defaultParams = {};
    }
    
    // Only set default parameters if they don't already exist
    if (Object.keys(formData.ruleParameters).length === 0) {
      setFormData(prev => ({
        ...prev,
        ruleParameters: defaultParams
      }));
    }
  }, [formData.ruleType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleParameterChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({
        ...prev,
        ruleParameters: {
          ...prev.ruleParameters,
          [name]: value
        }
      }));
    }
  };

  const handleParameterSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name) {
      setFormData(prev => ({
        ...prev,
        ruleParameters: {
          ...prev.ruleParameters,
          [name]: checked
        }
      }));
    }
  };

  const handleSliderChange = (name: string) => (event: Event, newValue: number | number[]) => {
    setFormData(prev => ({
      ...prev,
      ruleParameters: {
        ...prev.ruleParameters,
        [name]: newValue
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderParametersForm = () => {
    switch (formData.ruleType) {
      case 'low_success_rate':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography gutterBottom>Success Rate Threshold (%)</Typography>
              <Slider
                value={formData.ruleParameters.threshold || 50}
                onChange={handleSliderChange('threshold')}
                valueLabelDisplay="auto"
                step={5}
                marks
                min={0}
                max={100}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Lookback Days"
                name="lookbackDays"
                type="number"
                value={formData.ruleParameters.lookbackDays || 7}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Minimum Sample Size"
                name="minSampleSize"
                type="number"
                value={formData.ruleParameters.minSampleSize || 100}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
          </Grid>
        );
        
      case 'champion_challenger':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Minimum Days"
                name="minDays"
                type="number"
                value={formData.ruleParameters.minDays || 7}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Minimum Sample Size"
                name="minSampleSize"
                type="number"
                value={formData.ruleParameters.minSampleSize || 100}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Significance Level"
                name="significanceLevel"
                type="number"
                inputProps={{ step: 0.01, min: 0.01, max: 0.1 }}
                value={formData.ruleParameters.significanceLevel || 0.05}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
          </Grid>
        );
        
      case 'segment_specific':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Segment IDs (comma-separated)"
                name="segmentIds"
                value={Array.isArray(formData.ruleParameters.segmentIds) 
                  ? formData.ruleParameters.segmentIds.join(',') 
                  : formData.ruleParameters.segmentIds || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    ruleParameters: {
                      ...prev.ruleParameters,
                      segmentIds: value ? value.split(',').map(id => id.trim()) : []
                    }
                  }));
                }}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Min Success Rate Difference (%)</Typography>
              <Slider
                value={formData.ruleParameters.minSuccessRateDifference || 10}
                onChange={handleSliderChange('minSuccessRateDifference')}
                valueLabelDisplay="auto"
                step={1}
                marks
                min={1}
                max={30}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Minimum Sample Size"
                name="minSampleSize"
                type="number"
                value={formData.ruleParameters.minSampleSize || 50}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
          </Grid>
        );
        
      case 'ml_suggestion':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Confidence Threshold (%)</Typography>
              <Slider
                value={formData.ruleParameters.confidenceThreshold || 70}
                onChange={handleSliderChange('confidenceThreshold')}
                valueLabelDisplay="auto"
                step={5}
                marks
                min={50}
                max={95}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Suggestions Per Prompt"
                name="maxSuggestionsPerPrompt"
                type="number"
                value={formData.ruleParameters.maxSuggestionsPerPrompt || 3}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.ruleParameters.applyAutomatically || false}
                    onChange={handleParameterSwitchChange}
                    name="applyAutomatically"
                    color="primary"
                  />
                }
                label="Apply Suggestions Automatically"
              />
            </Grid>
          </Grid>
        );
        
      case 'scheduled_experiment':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Schedule</InputLabel>
                <Select
                  name="schedule"
                  value={formData.ruleParameters.schedule || 'weekly'}
                  onChange={handleParameterChange}
                  label="Schedule"
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Day of Week</InputLabel>
                <Select
                  name="dayOfWeek"
                  value={formData.ruleParameters.dayOfWeek || 1}
                  onChange={handleParameterChange}
                  label="Day of Week"
                  disabled={formData.ruleParameters.schedule !== 'weekly'}
                >
                  <MenuItem value={1}>Monday</MenuItem>
                  <MenuItem value={2}>Tuesday</MenuItem>
                  <MenuItem value={3}>Wednesday</MenuItem>
                  <MenuItem value={4}>Thursday</MenuItem>
                  <MenuItem value={5}>Friday</MenuItem>
                  <MenuItem value={6}>Saturday</MenuItem>
                  <MenuItem value={0}>Sunday</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Traffic Allocation (%)</Typography>
              <Slider
                value={formData.ruleParameters.trafficAllocation || 50}
                onChange={handleSliderChange('trafficAllocation')}
                valueLabelDisplay="auto"
                step={5}
                marks
                min={5}
                max={100}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Experiment Duration (days)"
                name="experimentDuration"
                type="number"
                value={formData.ruleParameters.experimentDuration || 14}
                onChange={handleParameterChange}
                margin="normal"
              />
            </Grid>
          </Grid>
        );
        
      // Add more rule type forms as needed
        
      default:
        return (
          <Typography color="textSecondary">
            No parameters available for this rule type.
          </Typography>
        );
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Rule Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Rule Type</InputLabel>
            <Select
              name="ruleType"
              value={formData.ruleType}
              onChange={handleChange}
              label="Rule Type"
              required
            >
              {RULE_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            multiline
            rows={2}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={handleSwitchChange}
                name="isActive"
                color="primary"
              />
            }
            label="Active"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" gutterBottom>Rule Parameters</Typography>
      
      {renderParametersForm()}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained" color="primary">
          {initialData ? 'Update Rule' : 'Create Rule'}
        </Button>
      </Box>
    </Box>
  );
};

export default OptimizationRuleForm;
