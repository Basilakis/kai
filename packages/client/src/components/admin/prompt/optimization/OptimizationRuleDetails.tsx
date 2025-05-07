import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Divider, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { 
  History as HistoryIcon,
  Code as CodeIcon,
  Assessment as AssessmentIcon,
  PlayArrow as PlayArrowIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { format } from 'date-fns';
import { CodeEditor } from '../../../common/CodeEditor';

interface OptimizationRuleDetailsProps {
  rule: {
    id: string;
    name: string;
    description?: string;
    ruleType: string;
    ruleParameters: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface OptimizationAction {
  id: string;
  ruleId: string;
  actionType: string;
  promptId?: string;
  experimentId?: string;
  segmentId?: string;
  actionParameters: Record<string, any>;
  status: string;
  result?: Record<string, any>;
  createdAt: string;
  executedAt?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`rule-tabpanel-${index}`}
      aria-labelledby={`rule-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const OptimizationRuleDetails: React.FC<OptimizationRuleDetailsProps> = ({ rule }) => {
  const [actions, setActions] = useState<OptimizationAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabValue, setTabValue] = useState(0);
  const { enqueueSnackbar } = useSnackbar();

  const fetchActions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/admin/prompt-optimization/actions?ruleId=${rule.id}`);
      if (response.data.success) {
        setActions(response.data.data);
      } else {
        enqueueSnackbar(`Failed to fetch actions: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error fetching actions: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [rule.id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getRuleTypeLabel = (ruleType: string) => {
    switch (ruleType) {
      case 'low_success_rate':
        return 'Low Success Rate';
      case 'champion_challenger':
        return 'Champion/Challenger';
      case 'segment_specific':
        return 'Segment Specific';
      case 'ml_suggestion':
        return 'ML Suggestion';
      case 'scheduled_experiment':
        return 'Scheduled Experiment';
      case 'time_based':
        return 'Time Based';
      case 'user_feedback':
        return 'User Feedback';
      case 'context_aware':
        return 'Context Aware';
      case 'multi_variant':
        return 'Multi-Variant';
      default:
        return ruleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getActionTypeLabel = (actionType: string) => {
    switch (actionType) {
      case 'create_experiment':
        return 'Create Experiment';
      case 'end_experiment':
        return 'End Experiment';
      case 'promote_variant':
        return 'Promote Variant';
      case 'apply_suggestion':
        return 'Apply Suggestion';
      case 'create_variant':
        return 'Create Variant';
      default:
        return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'executing':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="h6">{rule.name}</Typography>
          {rule.description && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {rule.description}
            </Typography>
          )}
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Chip 
            label={rule.isActive ? 'Active' : 'Inactive'} 
            color={rule.isActive ? 'success' : 'default'} 
            sx={{ mr: 1 }}
          />
          <Chip 
            label={getRuleTypeLabel(rule.ruleType)} 
            color="primary" 
            variant="outlined"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="rule details tabs">
          <Tab icon={<AssessmentIcon />} label="Overview" />
          <Tab icon={<SettingsIcon />} label="Parameters" />
          <Tab icon={<HistoryIcon />} label="Actions" />
          <Tab icon={<CodeIcon />} label="JSON" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Rule Information</Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {format(new Date(rule.createdAt), 'PPP')}
                </Typography>
                <Typography variant="body2">
                  <strong>Last Updated:</strong> {format(new Date(rule.updatedAt), 'PPP')}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {getRuleTypeLabel(rule.ruleType)}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> {rule.isActive ? 'Active' : 'Inactive'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Actions Summary</Typography>
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  <>
                    <Typography variant="body2">
                      <strong>Total Actions:</strong> {actions.length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Completed:</strong> {actions.filter(a => a.status === 'completed').length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Pending:</strong> {actions.filter(a => a.status === 'pending').length}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Failed:</strong> {actions.filter(a => a.status === 'failed').length}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Rule Description</Typography>
                <Typography variant="body1">
                  {getRuleDescription(rule.ruleType, rule.ruleParameters)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>Rule Parameters</Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Parameter</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(rule.ruleParameters).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</TableCell>
                  <TableCell>
                    {typeof value === 'boolean' ? (
                      value ? <CheckIcon color="success" /> : <CloseIcon color="error" />
                    ) : Array.isArray(value) ? (
                      JSON.stringify(value)
                    ) : typeof value === 'object' ? (
                      JSON.stringify(value)
                    ) : (
                      String(value)
                    )}
                  </TableCell>
                  <TableCell>{getParameterDescription(rule.ruleType, key)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>Rule Actions</Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : actions.length === 0 ? (
          <Typography>No actions found for this rule</Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Action Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Executed</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>{getActionTypeLabel(action.actionType)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={action.status.charAt(0).toUpperCase() + action.status.slice(1)} 
                        color={getStatusColor(action.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{format(new Date(action.createdAt), 'PPp')}</TableCell>
                    <TableCell>
                      {action.executedAt ? format(new Date(action.executedAt), 'PPp') : 'Not executed'}
                    </TableCell>
                    <TableCell>
                      {action.promptId && <Typography variant="body2">Prompt ID: {action.promptId}</Typography>}
                      {action.experimentId && <Typography variant="body2">Experiment ID: {action.experimentId}</Typography>}
                      {action.segmentId && <Typography variant="body2">Segment ID: {action.segmentId}</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>Rule JSON</Typography>
        <Paper sx={{ p: 2 }}>
          <CodeEditor
            value={JSON.stringify(rule, null, 2)}
            language="json"
            height="300px"
            readOnly
          />
        </Paper>
      </TabPanel>
    </Box>
  );
};

// Helper function to get rule description
const getRuleDescription = (ruleType: string, parameters: Record<string, any>) => {
  switch (ruleType) {
    case 'low_success_rate':
      return `This rule automatically creates experiments for prompts with success rates below ${parameters.threshold}%. It looks back ${parameters.lookbackDays} days and requires a minimum sample size of ${parameters.minSampleSize} uses.`;
    case 'champion_challenger':
      return `This rule automatically promotes winning variants and ends experiments. It requires experiments to run for at least ${parameters.minDays} days with a minimum sample size of ${parameters.minSampleSize} and uses a significance level of ${parameters.significanceLevel}.`;
    case 'segment_specific':
      return `This rule creates segment-specific prompts based on performance differences. It targets segments ${Array.isArray(parameters.segmentIds) ? parameters.segmentIds.join(', ') : parameters.segmentIds} and requires a minimum success rate difference of ${parameters.minSuccessRateDifference}% with a minimum sample size of ${parameters.minSampleSize}.`;
    case 'ml_suggestion':
      return `This rule applies ML suggestions to improve prompts. It requires a confidence threshold of ${parameters.confidenceThreshold}% and allows up to ${parameters.maxSuggestionsPerPrompt} suggestions per prompt. Automatic application is ${parameters.applyAutomatically ? 'enabled' : 'disabled'}.`;
    case 'scheduled_experiment':
      return `This rule creates experiments on a ${parameters.schedule} schedule${parameters.schedule === 'weekly' ? ` on day ${parameters.dayOfWeek}` : ''}. It allocates ${parameters.trafficAllocation}% of traffic to experiments and runs them for ${parameters.experimentDuration} days.`;
    default:
      return `This is a ${ruleType.replace(/_/g, ' ')} rule. See the parameters tab for details.`;
  }
};

// Helper function to get parameter description
const getParameterDescription = (ruleType: string, parameterName: string) => {
  const descriptions: Record<string, Record<string, string>> = {
    low_success_rate: {
      threshold: 'Success rate threshold below which to create experiments',
      lookbackDays: 'Number of days to look back for prompt usage data',
      minSampleSize: 'Minimum number of prompt uses required'
    },
    champion_challenger: {
      minDays: 'Minimum number of days an experiment should run',
      minSampleSize: 'Minimum sample size required for statistical significance',
      significanceLevel: 'P-value threshold for statistical significance'
    },
    segment_specific: {
      segmentIds: 'Target segment IDs for this rule',
      minSuccessRateDifference: 'Minimum success rate difference required between segments',
      minSampleSize: 'Minimum sample size required per segment'
    },
    ml_suggestion: {
      confidenceThreshold: 'Minimum confidence level required for suggestions',
      maxSuggestionsPerPrompt: 'Maximum number of suggestions to apply per prompt',
      applyAutomatically: 'Whether to apply suggestions automatically'
    },
    scheduled_experiment: {
      schedule: 'Frequency of experiment creation',
      dayOfWeek: 'Day of the week to create experiments (for weekly schedule)',
      trafficAllocation: 'Percentage of traffic to allocate to experiments',
      experimentDuration: 'Duration of experiments in days'
    }
  };

  return descriptions[ruleType]?.[parameterName] || 'No description available';
};

export default OptimizationRuleDetails;
