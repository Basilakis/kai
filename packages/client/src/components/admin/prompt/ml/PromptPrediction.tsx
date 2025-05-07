import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  AlertTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Lightbulb as LightbulbIcon,
  Psychology as PsychologyIcon,
  BarChart as BarChartIcon,
  BugReport as BugReportIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { CodeEditor } from '../../../common/CodeEditor';

interface PromptPredictionProps {
  promptId?: string;
}

interface PredictionResult {
  id: string;
  promptId: string;
  modelId: string;
  modelVersionId: string;
  predictedSuccessRate: number;
  predictionFeatures: Record<string, any>;
  confidence: number;
  createdAt: string;
}

interface SuggestionResult {
  id: string;
  promptId: string;
  modelId: string;
  suggestionType: string;
  suggestion: string;
  predictedImprovement?: number;
  confidence?: number;
  isApplied: boolean;
  appliedAt?: string;
  createdAt: string;
}

const PROMPT_TYPES = [
  { value: 'material_specific', label: 'Material Specific' },
  { value: 'agent', label: 'Agent' },
  { value: 'rag', label: 'RAG' },
  { value: 'general', label: 'General' }
];

const PromptPrediction: React.FC<PromptPredictionProps> = ({ promptId: initialPromptId }) => {
  const [promptId, setPromptId] = useState<string>(initialPromptId || '');
  const [promptContent, setPromptContent] = useState<string>('');
  const [promptType, setPromptType] = useState<string>('general');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [loadingPrediction, setLoadingPrediction] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null);
  const [featureImportance, setFeatureImportance] = useState<{ name: string; importance: number }[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  const handlePromptIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPromptId(e.target.value);
  };

  const handlePromptContentChange = (value: string) => {
    setPromptContent(value);
  };

  const handlePromptTypeChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setPromptType(e.target.value as string);
  };

  const fetchPrompt = async () => {
    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    try {
      const response = await axios.get(`/api/admin/prompts/${promptId}`);
      if (response.data.success) {
        const prompt = response.data.data;
        setPromptContent(prompt.content);
        setPromptType(prompt.promptType || 'general');
      } else {
        enqueueSnackbar(`Failed to fetch prompt: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching prompt: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    }
  };

  const predictSuccess = async () => {
    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    setLoadingPrediction(true);
    try {
      const response = await axios.get(`/api/admin/prompt-ml/prompts/${promptId}/predict`);
      if (response.data.success) {
        setPrediction(response.data.data);

        // Generate feature importance
        if (response.data.data.predictionFeatures) {
          const features = response.data.data.predictionFeatures;
          const importance = Object.entries(features)
            .filter(([key, value]) => typeof value === 'number')
            .map(([name, value]) => ({
              name,
              importance: Math.abs(value as number)
            }))
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 10);

          setFeatureImportance(importance);
        }
      } else {
        enqueueSnackbar(`Failed to predict success: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error predicting success: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoadingPrediction(false);
    }
  };

  const generateSuggestions = async () => {
    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await axios.get(`/api/admin/prompt-ml/prompts/${promptId}/suggestions`);
      if (response.data.success) {
        setSuggestions(response.data.data);
      } else {
        enqueueSnackbar(`Failed to generate suggestions: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error generating suggestions: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const applySuggestion = async (suggestionId: string) => {
    setApplyingSuggestion(suggestionId);
    try {
      const response = await axios.post(`/api/admin/prompt-ml/suggestions/${suggestionId}/apply`);
      if (response.data.success) {
        enqueueSnackbar('Suggestion applied successfully', { variant: 'success' });
        setPromptContent(response.data.data.updatedContent);

        // Update suggestion status
        setSuggestions(prev =>
          prev.map(s =>
            s.id === suggestionId
              ? { ...s, isApplied: true, appliedAt: new Date().toISOString() }
              : s
          )
        );
      } else {
        enqueueSnackbar(`Failed to apply suggestion: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error applying suggestion: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setApplyingSuggestion(null);
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'info';
    if (rate >= 40) return 'warning';
    return 'error';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'info';
    if (confidence >= 40) return 'warning';
    return 'error';
  };

  const formatFeatureName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Prompt Success Prediction
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Prompt ID"
              value={promptId}
              onChange={handlePromptIdChange}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Prompt Type</InputLabel>
              <Select
                value={promptType}
                onChange={handlePromptTypeChange}
                label="Prompt Type"
              >
                {PROMPT_TYPES.map(type => (
                  <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                onClick={fetchPrompt}
                sx={{ mr: 1 }}
              >
                Fetch Prompt
              </Button>
            </Box>
            <Typography variant="subtitle1" gutterBottom>Prompt Content</Typography>
            <CodeEditor
              value={promptContent}
              onChange={handlePromptContentChange}
              language="markdown"
              height="200px"
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={predictSuccess}
                disabled={loadingPrediction}
                startIcon={loadingPrediction ? <CircularProgress size={20} /> : <PsychologyIcon />}
                sx={{ mr: 1 }}
              >
                Predict Success
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={generateSuggestions}
                disabled={loadingSuggestions}
                startIcon={loadingSuggestions ? <CircularProgress size={20} /> : <LightbulbIcon />}
              >
                Generate Suggestions
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {prediction && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Prediction Result</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'inline-flex',
                      mb: 2
                    }}
                  >
                    <CircularProgress
                      variant="determinate"
                      value={prediction.predictedSuccessRate}
                      size={120}
                      thickness={5}
                      color={getSuccessRateColor(prediction.predictedSuccessRate)}
                    />
                    <Box
                      sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="h4" component="div" color="text.secondary">
                        {Math.round(prediction.predictedSuccessRate)}%
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body1" align="center">
                    Predicted Success Rate
                  </Typography>
                  <Chip
                    icon={prediction.predictedSuccessRate >= 70 ? <CheckIcon /> : <CloseIcon />}
                    label={prediction.predictedSuccessRate >= 70 ? 'Likely to Succeed' : 'May Need Improvement'}
                    color={prediction.predictedSuccessRate >= 70 ? 'success' : 'warning'}
                    sx={{ mt: 2 }}
                  />
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                  <strong>Confidence:</strong>{' '}
                  <Chip
                    label={`${Math.round(prediction.confidence)}%`}
                    color={getConfidenceColor(prediction.confidence)}
                    size="small"
                  />
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Model:</strong> {prediction.modelName || 'Unknown'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>Model Type:</strong> {prediction.modelType || 'Unknown'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Feature Importance</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={featureImportance}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 12 }}
                        tickFormatter={formatFeatureName}
                      />
                      <RechartsTooltip
                        formatter={(value) => [`Importance: ${Number(value).toFixed(2)}`, 'Feature Importance']}
                        labelFormatter={formatFeatureName}
                      />
                      <Bar dataKey="importance" fill="#8884d8">
                        {featureImportance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8884d8' : '#82ca9d'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Detailed Feature Analysis</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {Object.entries(prediction.predictionFeatures)
                    .filter(([key, value]) => typeof value === 'number')
                    .sort(([, a], [, b]) => Math.abs(Number(b)) - Math.abs(Number(a)))
                    .map(([feature, value]) => (
                      <Grid item xs={12} sm={6} md={4} key={feature}>
                        <Typography variant="body2">
                          <strong>{formatFeatureName(feature)}:</strong> {Number(value).toFixed(2)}
                          {Number(value) > 0.5 ?
                            <TrendingUpIcon color="success" fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} /> :
                            <TrendingDownIcon color="error" fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} />
                          }
                        </Typography>
                      </Grid>
                    ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Improvement Suggestions
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>AI-Generated Suggestions</AlertTitle>
              <Typography variant="body2">
                These suggestions are generated based on ML analysis of successful prompts.
                Applying them may improve the prompt's success rate.
              </Typography>
            </Alert>
            <List>
              {suggestions.map((suggestion) => (
                <React.Fragment key={suggestion.id}>
                  <ListItem
                    alignItems="flex-start"
                    secondaryAction={
                      suggestion.isApplied ? (
                        <Chip
                          label="Applied"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          onClick={() => applySuggestion(suggestion.id)}
                          disabled={applyingSuggestion === suggestion.id}
                          startIcon={applyingSuggestion === suggestion.id ? <CircularProgress size={16} /> : null}
                        >
                          Apply
                        </Button>
                      )
                    }
                  >
                    <ListItemIcon>
                      <LightbulbIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="subtitle1" sx={{ mr: 1 }}>
                            {suggestion.suggestionType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} Suggestion
                          </Typography>
                          {suggestion.predictedImprovement && (
                            <Chip
                              label={`+${suggestion.predictedImprovement.toFixed(0)}%`}
                              color="success"
                              size="small"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                            {suggestion.suggestion}
                          </Typography>
                          {suggestion.confidence && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              Confidence: {suggestion.confidence.toFixed(0)}%
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PromptPrediction;
