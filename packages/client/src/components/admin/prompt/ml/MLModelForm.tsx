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
  Alert,
  Paper
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { CodeEditor } from '../../../common/CodeEditor';

interface MLModelFormProps {
  onSubmit: (model: any) => void;
  initialData?: any;
}

const MODEL_TYPES = [
  { value: 'neural_network', label: 'Neural Network' },
  { value: 'lstm', label: 'LSTM' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'random_forest', label: 'Random Forest' },
  { value: 'gradient_boosting', label: 'Gradient Boosting' }
];

const PROMPT_TYPES = [
  { value: 'material_specific', label: 'Material Specific' },
  { value: 'agent', label: 'Agent' },
  { value: 'rag', label: 'RAG' },
  { value: 'general', label: 'General Purpose' }
];

const ACTIVATION_FUNCTIONS = [
  { value: 'relu', label: 'ReLU' },
  { value: 'sigmoid', label: 'Sigmoid' },
  { value: 'tanh', label: 'Tanh' },
  { value: 'leaky_relu', label: 'Leaky ReLU' },
  { value: 'elu', label: 'ELU' }
];

const OPTIMIZERS = [
  { value: 'adam', label: 'Adam' },
  { value: 'sgd', label: 'SGD' },
  { value: 'rmsprop', label: 'RMSprop' },
  { value: 'adagrad', label: 'Adagrad' }
];

const LOSS_FUNCTIONS = [
  { value: 'meanSquaredError', label: 'Mean Squared Error' },
  { value: 'binaryCrossentropy', label: 'Binary Cross Entropy' },
  { value: 'categoricalCrossentropy', label: 'Categorical Cross Entropy' },
  { value: 'huber', label: 'Huber Loss' }
];

const DEFAULT_QUERY = `-- Example query to fetch training data
SELECT
  p.id as prompt_id,
  p.content,
  p.prompt_type,
  COUNT(*) as total_uses,
  SUM(CASE WHEN a.is_successful THEN 1 ELSE 0 END) as successful_uses,
  (SUM(CASE WHEN a.is_successful THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100 as success_rate,
  json_build_object(
    'length', length(p.content),
    'wordCount', array_length(regexp_split_to_array(p.content, '\\s+'), 1),
    'questionCount', (length(p.content) - length(replace(p.content, '?', '')))
  ) as features
FROM
  system_prompts p
JOIN
  prompt_usage_analytics a ON p.id = a.prompt_id
WHERE
  a.date >= NOW() - INTERVAL '30 days'
GROUP BY
  p.id, p.content, p.prompt_type
HAVING
  COUNT(*) >= 10`;

const MLModelForm: React.FC<MLModelFormProps> = ({ onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    modelType: initialData?.modelType || 'neural_network',
    isActive: initialData?.isActive !== false,
    trainingDataQuery: initialData?.trainingDataQuery || DEFAULT_QUERY,
    modelParameters: initialData?.modelParameters || {}
  });

  // Initialize default parameters based on model type
  useEffect(() => {
    if (Object.keys(formData.modelParameters).length === 0) {
      let defaultParams = {};

      switch (formData.modelType) {
        case 'neural_network':
          defaultParams = {
            promptType: 'material_specific',
            inputDimension: 20,
            hiddenLayers: [64, 32],
            activation: 'relu',
            outputActivation: 'sigmoid',
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            dropoutRate: 0.2,
            useLearningRateScheduler: false,
            earlyStoppingPatience: 10,
            calculateFeatureImportance: true
          };
          break;
        case 'lstm':
          defaultParams = {
            promptType: 'material_specific',
            sequenceLength: 10,
            inputDimension: 20,
            lstmUnits: [64, 32],
            activation: 'tanh',
            recurrentActivation: 'hardSigmoid',
            outputActivation: 'sigmoid',
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            dropoutRate: 0.2,
            recurrentDropoutRate: 0.2
          };
          break;
        case 'transformer':
          defaultParams = {
            promptType: 'material_specific',
            sequenceLength: 10,
            inputDimension: 20,
            headSize: 64,
            numHeads: 4,
            ffDim: 128,
            numTransformerBlocks: 2,
            mlpUnits: [64, 32],
            dropoutRate: 0.1,
            outputActivation: 'sigmoid',
            optimizer: 'adam',
            loss: 'binaryCrossentropy'
          };
          break;
        case 'random_forest':
          defaultParams = {
            promptType: 'material_specific',
            nEstimators: 100,
            maxDepth: 10,
            minSamplesSplit: 2,
            maxFeatures: 'sqrt',
            gainFunction: 'gini',
            replacement: true,
            minNumSamples: 3
          };
          break;
        case 'gradient_boosting':
          defaultParams = {
            promptType: 'material_specific',
            nEstimators: 100,
            maxDepth: 5,
            minSamplesSplit: 2,
            maxFeatures: 'sqrt',
            learningRate: 0.1,
            subsample: 1.0,
            gainFunction: 'gini'
          };
          break;
        default:
          defaultParams = {
            inputDimension: 10,
            hiddenLayers: [64, 32],
            activation: 'relu',
            outputActivation: 'sigmoid',
            optimizer: 'adam',
            loss: 'meanSquaredError',
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2
          };
      }

      setFormData(prev => ({
        ...prev,
        modelParameters: defaultParams
      }));
    }
  }, [formData.modelType]);

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
        modelParameters: {
          ...prev.modelParameters,
          [name]: value
        }
      }));
    }
  };

  const handleHiddenLayersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const layers = JSON.parse(e.target.value);
      if (Array.isArray(layers)) {
        setFormData(prev => ({
          ...prev,
          modelParameters: {
            ...prev.modelParameters,
            hiddenLayers: layers
          }
        }));
      }
    } catch (error) {
      // Invalid JSON, ignore
    }
  };

  const handleParameterSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      modelParameters: {
        ...prev.modelParameters,
        [name]: checked
      }
    }));
  };

  const handleSliderChange = (name: string) => (event: Event, newValue: number | number[]) => {
    setFormData(prev => ({
      ...prev,
      modelParameters: {
        ...prev.modelParameters,
        [name]: newValue
      }
    }));
  };

  const handleArrayChange = (name: string, value: any[]) => {
    setFormData(prev => ({
      ...prev,
      modelParameters: {
        ...prev.modelParameters,
        [name]: value
      }
    }));
  };

  const handleQueryChange = (value: string) => {
    setFormData(prev => ({ ...prev, trainingDataQuery: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Model Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Model Type</InputLabel>
            <Select
              name="modelType"
              value={formData.modelType}
              onChange={handleChange}
              label="Model Type"
              required
            >
              {MODEL_TYPES.map(type => (
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

      <Typography variant="h6" gutterBottom>Model Parameters</Typography>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Model Configuration</Typography>
          <Chip
            label={MODEL_TYPES.find(t => t.value === formData.modelType)?.label || formData.modelType}
            color="primary"
            size="small"
            sx={{ ml: 2 }}
          />
        </AccordionSummary>
        <AccordionDetails>
          {formData.modelType === 'neural_network' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Prompt Type</InputLabel>
                  <Select
                    name="promptType"
                    value={formData.modelParameters.promptType || 'material_specific'}
                    onChange={handleParameterChange}
                    label="Prompt Type"
                  >
                    {PROMPT_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Input Dimension"
                  name="inputDimension"
                  type="number"
                  value={formData.modelParameters.inputDimension}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography gutterBottom>Hidden Layers</Typography>
                <Paper sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    {(formData.modelParameters.hiddenLayers || [64, 32]).map((units: number, index: number) => (
                      <Grid item xs={12} md={4} key={index}>
                        <TextField
                          fullWidth
                          label={`Layer ${index + 1} Units`}
                          type="number"
                          value={units}
                          onChange={(e) => {
                            const newLayers = [...(formData.modelParameters.hiddenLayers || [])];
                            newLayers[index] = Number(e.target.value);
                            handleArrayChange('hiddenLayers', newLayers);
                          }}
                          margin="normal"
                        />
                      </Grid>
                    ))}
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            const newLayers = [...(formData.modelParameters.hiddenLayers || []), 32];
                            handleArrayChange('hiddenLayers', newLayers);
                          }}
                        >
                          Add Layer
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => {
                            const newLayers = [...(formData.modelParameters.hiddenLayers || [])];
                            if (newLayers.length > 1) {
                              newLayers.pop();
                              handleArrayChange('hiddenLayers', newLayers);
                            }
                          }}
                          disabled={(formData.modelParameters.hiddenLayers || []).length <= 1}
                        >
                          Remove Layer
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Activation Function</InputLabel>
                  <Select
                    name="activation"
                    value={formData.modelParameters.activation}
                    onChange={handleParameterChange}
                    label="Activation Function"
                  >
                    {ACTIVATION_FUNCTIONS.map(func => (
                      <MenuItem key={func.value} value={func.value}>{func.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Output Activation</InputLabel>
                  <Select
                    name="outputActivation"
                    value={formData.modelParameters.outputActivation}
                    onChange={handleParameterChange}
                    label="Output Activation"
                  >
                    {ACTIVATION_FUNCTIONS.map(func => (
                      <MenuItem key={func.value} value={func.value}>{func.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Optimizer</InputLabel>
                  <Select
                    name="optimizer"
                    value={formData.modelParameters.optimizer}
                    onChange={handleParameterChange}
                    label="Optimizer"
                  >
                    {OPTIMIZERS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Loss Function</InputLabel>
                  <Select
                    name="loss"
                    value={formData.modelParameters.loss}
                    onChange={handleParameterChange}
                    label="Loss Function"
                  >
                    {LOSS_FUNCTIONS.map(loss => (
                      <MenuItem key={loss.value} value={loss.value}>{loss.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Epochs"
                  name="epochs"
                  type="number"
                  value={formData.modelParameters.epochs}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Batch Size"
                  name="batchSize"
                  type="number"
                  value={formData.modelParameters.batchSize}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Validation Split</Typography>
                <Slider
                  value={formData.modelParameters.validationSplit || 0.2}
                  onChange={handleSliderChange('validationSplit')}
                  valueLabelDisplay="auto"
                  step={0.05}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.2, label: '20%' },
                    { value: 0.5, label: '50%' }
                  ]}
                  min={0}
                  max={0.5}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Dropout Rate</Typography>
                <Slider
                  value={formData.modelParameters.dropoutRate || 0.2}
                  onChange={handleSliderChange('dropoutRate')}
                  valueLabelDisplay="auto"
                  step={0.05}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.2, label: '20%' },
                    { value: 0.5, label: '50%' }
                  ]}
                  min={0}
                  max={0.5}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Early Stopping Patience"
                  name="earlyStoppingPatience"
                  type="number"
                  value={formData.modelParameters.earlyStoppingPatience || 10}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.modelParameters.useLearningRateScheduler || false}
                      onChange={handleParameterSwitchChange}
                      name="useLearningRateScheduler"
                      color="primary"
                    />
                  }
                  label="Use Learning Rate Scheduler"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.modelParameters.calculateFeatureImportance || false}
                      onChange={handleParameterSwitchChange}
                      name="calculateFeatureImportance"
                      color="primary"
                    />
                  }
                  label="Calculate Feature Importance"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.modelParameters.transferLearning || false}
                      onChange={handleParameterSwitchChange}
                      name="transferLearning"
                      color="primary"
                    />
                  }
                  label="Use Transfer Learning"
                />
              </Grid>
              {formData.modelParameters.transferLearning && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Base Model ID"
                    name="baseModelId"
                    value={formData.modelParameters.baseModelId || ''}
                    onChange={handleParameterChange}
                    margin="normal"
                    helperText="ID of the model to use as a base for transfer learning"
                  />
                </Grid>
              )}
            </Grid>
          )}

          {formData.modelType === 'lstm' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Prompt Type</InputLabel>
                  <Select
                    name="promptType"
                    value={formData.modelParameters.promptType || 'material_specific'}
                    onChange={handleParameterChange}
                    label="Prompt Type"
                  >
                    {PROMPT_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Sequence Length"
                  name="sequenceLength"
                  type="number"
                  value={formData.modelParameters.sequenceLength || 10}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Input Dimension"
                  name="inputDimension"
                  type="number"
                  value={formData.modelParameters.inputDimension || 20}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="LSTM Units (JSON array)"
                  name="lstmUnits"
                  value={JSON.stringify(formData.modelParameters.lstmUnits || [64, 32])}
                  onChange={(e) => {
                    try {
                      const units = JSON.parse(e.target.value);
                      if (Array.isArray(units)) {
                        handleArrayChange('lstmUnits', units);
                      }
                    } catch (error) {
                      // Invalid JSON, ignore
                    }
                  }}
                  margin="normal"
                  helperText="Example: [64, 32]"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Dropout Rate</Typography>
                <Slider
                  value={formData.modelParameters.dropoutRate || 0.2}
                  onChange={handleSliderChange('dropoutRate')}
                  valueLabelDisplay="auto"
                  step={0.05}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.2, label: '20%' },
                    { value: 0.5, label: '50%' }
                  ]}
                  min={0}
                  max={0.5}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Recurrent Dropout Rate</Typography>
                <Slider
                  value={formData.modelParameters.recurrentDropoutRate || 0.2}
                  onChange={handleSliderChange('recurrentDropoutRate')}
                  valueLabelDisplay="auto"
                  step={0.05}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.2, label: '20%' },
                    { value: 0.5, label: '50%' }
                  ]}
                  min={0}
                  max={0.5}
                />
              </Grid>
            </Grid>
          )}

          {formData.modelType === 'random_forest' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Prompt Type</InputLabel>
                  <Select
                    name="promptType"
                    value={formData.modelParameters.promptType || 'material_specific'}
                    onChange={handleParameterChange}
                    label="Prompt Type"
                  >
                    {PROMPT_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Number of Estimators"
                  name="nEstimators"
                  type="number"
                  value={formData.modelParameters.nEstimators || 100}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Depth"
                  name="maxDepth"
                  type="number"
                  value={formData.modelParameters.maxDepth || 10}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Min Samples Split"
                  name="minSamplesSplit"
                  type="number"
                  value={formData.modelParameters.minSamplesSplit || 2}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Max Features</InputLabel>
                  <Select
                    name="maxFeatures"
                    value={formData.modelParameters.maxFeatures || 'sqrt'}
                    onChange={handleParameterChange}
                    label="Max Features"
                  >
                    <MenuItem value="sqrt">sqrt</MenuItem>
                    <MenuItem value="log2">log2</MenuItem>
                    <MenuItem value="auto">auto</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.modelParameters.replacement || false}
                      onChange={handleParameterSwitchChange}
                      name="replacement"
                      color="primary"
                    />
                  }
                  label="Bootstrap Sampling with Replacement"
                />
              </Grid>
            </Grid>
          )}

          {formData.modelType === 'gradient_boosting' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Prompt Type</InputLabel>
                  <Select
                    name="promptType"
                    value={formData.modelParameters.promptType || 'material_specific'}
                    onChange={handleParameterChange}
                    label="Prompt Type"
                  >
                    {PROMPT_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Number of Estimators"
                  name="nEstimators"
                  type="number"
                  value={formData.modelParameters.nEstimators || 100}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Depth"
                  name="maxDepth"
                  type="number"
                  value={formData.modelParameters.maxDepth || 5}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Learning Rate"
                  name="learningRate"
                  type="number"
                  inputProps={{ min: 0.001, max: 1, step: 0.001 }}
                  value={formData.modelParameters.learningRate || 0.1}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography gutterBottom>Subsample Ratio</Typography>
                <Slider
                  value={formData.modelParameters.subsample || 1.0}
                  onChange={handleSliderChange('subsample')}
                  valueLabelDisplay="auto"
                  step={0.05}
                  marks={[
                    { value: 0.5, label: '50%' },
                    { value: 0.8, label: '80%' },
                    { value: 1.0, label: '100%' }
                  ]}
                  min={0.5}
                  max={1.0}
                />
              </Grid>
            </Grid>
          )}

          {formData.modelType === 'transformer' && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Prompt Type</InputLabel>
                  <Select
                    name="promptType"
                    value={formData.modelParameters.promptType || 'material_specific'}
                    onChange={handleParameterChange}
                    label="Prompt Type"
                  >
                    {PROMPT_TYPES.map(type => (
                      <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Sequence Length"
                  name="sequenceLength"
                  type="number"
                  value={formData.modelParameters.sequenceLength || 10}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Head Size"
                  name="headSize"
                  type="number"
                  value={formData.modelParameters.headSize || 64}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Number of Heads"
                  name="numHeads"
                  type="number"
                  value={formData.modelParameters.numHeads || 4}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Number of Transformer Blocks"
                  name="numTransformerBlocks"
                  type="number"
                  value={formData.modelParameters.numTransformerBlocks || 2}
                  onChange={handleParameterChange}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>Dropout Rate</Typography>
                <Slider
                  value={formData.modelParameters.dropoutRate || 0.1}
                  onChange={handleSliderChange('dropoutRate')}
                  valueLabelDisplay="auto"
                  step={0.05}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 0.1, label: '10%' },
                    { value: 0.5, label: '50%' }
                  ]}
                  min={0}
                  max={0.5}
                />
              </Grid>
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Training Data Query</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Enter an SQL query to fetch training data. The query should return rows with at least the following columns:
              <br />
              <code>prompt_id</code>, <code>features</code> (JSON object), <code>success_rate</code> (number between 0 and 1)
            </Typography>
          </Alert>
          <Box sx={{ mt: 2, mb: 2 }}>
            <CodeEditor
              value={formData.trainingDataQuery}
              onChange={handleQueryChange}
              language="sql"
              height="300px"
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained" color="primary">
          {initialData ? 'Update Model' : 'Create Model'}
        </Button>
      </Box>
    </Box>
  );
};

export default MLModelForm;
