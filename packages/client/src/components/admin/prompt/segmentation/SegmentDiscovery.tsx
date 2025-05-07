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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle
} from '@mui/material';
import { 
  Search as SearchIcon,
  Save as SaveIcon,
  BubbleChart as BubbleChartIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

interface DiscoveredSegment {
  id: string;
  name: string;
  segmentType: string;
  segmentCriteria: Record<string, any>;
  userCount: number;
  successRate: number;
  averageUsage: number;
  topFeatures: { name: string; value: number }[];
}

const DISCOVERY_METHODS = [
  { value: 'clustering', label: 'Clustering' },
  { value: 'decision_tree', label: 'Decision Tree' },
  { value: 'association_rules', label: 'Association Rules' },
  { value: 'behavioral_patterns', label: 'Behavioral Patterns' }
];

const FEATURES = [
  { value: 'usage_frequency', label: 'Usage Frequency' },
  { value: 'success_rate', label: 'Success Rate' },
  { value: 'interaction_count', label: 'Interaction Count' },
  { value: 'session_duration', label: 'Session Duration' },
  { value: 'time_of_day', label: 'Time of Day' },
  { value: 'device_type', label: 'Device Type' },
  { value: 'location', label: 'Location' },
  { value: 'user_role', label: 'User Role' }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const SegmentDiscovery: React.FC = () => {
  const [promptId, setPromptId] = useState<string>('');
  const [discoveryMethod, setDiscoveryMethod] = useState<string>('clustering');
  const [minSegmentSize, setMinSegmentSize] = useState<number>(100);
  const [maxSegments, setMaxSegments] = useState<number>(5);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['usage_frequency', 'success_rate', 'interaction_count']);
  const [discoveredSegments, setDiscoveredSegments] = useState<DiscoveredSegment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savedSegments, setSavedSegments] = useState<string[]>([]);
  const { enqueueSnackbar } = useSnackbar();

  const handlePromptIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPromptId(e.target.value);
  };

  const handleDiscoveryMethodChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setDiscoveryMethod(e.target.value as string);
  };

  const handleMinSegmentSizeChange = (event: Event, newValue: number | number[]) => {
    setMinSegmentSize(newValue as number);
  };

  const handleMaxSegmentsChange = (event: Event, newValue: number | number[]) => {
    setMaxSegments(newValue as number);
  };

  const handleFeatureToggle = (feature: string) => {
    if (selectedFeatures.includes(feature)) {
      setSelectedFeatures(selectedFeatures.filter(f => f !== feature));
    } else {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  };

  const discoverSegments = async () => {
    if (!promptId) {
      enqueueSnackbar('Please enter a prompt ID', { variant: 'warning' });
      return;
    }

    if (selectedFeatures.length === 0) {
      enqueueSnackbar('Please select at least one feature', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/admin/prompt-segmentation/discover', {
        promptId,
        minSegmentSize,
        maxSegments,
        discoveryMethod,
        discoveryParameters: {
          algorithm: discoveryMethod === 'clustering' ? 'kmeans' : 'default',
          features: selectedFeatures
        }
      });
      
      if (response.data.success) {
        setDiscoveredSegments(response.data.data);
        enqueueSnackbar('Segments discovered successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to discover segments: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error discovering segments: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const saveSegment = async (segmentId: string) => {
    try {
      const response = await axios.post(`/api/admin/prompt-segmentation/segments/${segmentId}/save`);
      if (response.data.success) {
        setSavedSegments([...savedSegments, segmentId]);
        enqueueSnackbar('Segment saved successfully', { variant: 'success' });
      } else {
        enqueueSnackbar(`Failed to save segment: ${response.data.message}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`Error saving segment: ${error instanceof Error ? error.message : String(error)}`, { variant: 'error' });
    }
  };

  const getSegmentTypeLabel = (segmentType: string) => {
    switch (segmentType) {
      case 'behavioral':
        return 'Behavioral';
      case 'demographic':
        return 'Demographic';
      case 'contextual':
        return 'Contextual';
      case 'discovered':
        return 'Discovered';
      default:
        return segmentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getSegmentTypeColor = (segmentType: string) => {
    switch (segmentType) {
      case 'behavioral':
        return 'primary';
      case 'demographic':
        return 'secondary';
      case 'contextual':
        return 'info';
      case 'discovered':
        return 'success';
      default:
        return 'default';
    }
  };

  const getFeatureLabel = (feature: string) => {
    const featureObj = FEATURES.find(f => f.value === feature);
    return featureObj ? featureObj.label : feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Prepare chart data
  const prepareChartData = () => {
    return discoveredSegments.map(segment => ({
      name: segment.name,
      value: segment.userCount,
      successRate: segment.successRate
    }));
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Segment Discovery
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Discovery Parameters</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Prompt ID"
              value={promptId}
              onChange={handlePromptIdChange}
              margin="normal"
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Discovery Method</InputLabel>
              <Select
                value={discoveryMethod}
                onChange={handleDiscoveryMethodChange}
                label="Discovery Method"
              >
                {DISCOVERY_METHODS.map(method => (
                  <MenuItem key={method.value} value={method.value}>{method.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>Minimum Segment Size</Typography>
            <Slider
              value={minSegmentSize}
              onChange={handleMinSegmentSizeChange}
              valueLabelDisplay="auto"
              step={10}
              marks={[
                { value: 10, label: '10' },
                { value: 100, label: '100' },
                { value: 500, label: '500' }
              ]}
              min={10}
              max={500}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>Maximum Number of Segments</Typography>
            <Slider
              value={maxSegments}
              onChange={handleMaxSegmentsChange}
              valueLabelDisplay="auto"
              step={1}
              marks={[
                { value: 2, label: '2' },
                { value: 5, label: '5' },
                { value: 10, label: '10' }
              ]}
              min={2}
              max={10}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography gutterBottom>Features</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {FEATURES.map(feature => (
                <Chip
                  key={feature.value}
                  label={feature.label}
                  color={selectedFeatures.includes(feature.value) ? 'primary' : 'default'}
                  onClick={() => handleFeatureToggle(feature.value)}
                  clickable
                />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={discoverSegments}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              >
                Discover Segments
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {discoveredSegments.length > 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Segment Distribution</Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={prepareChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {prepareChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <RechartsTooltip 
                        formatter={(value, name, props) => [
                          `Users: ${value}`, 
                          `${name} (Success Rate: ${(props.payload.successRate).toFixed(1)}%)`
                        ]} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Discovered Segments</Typography>
                <List>
                  {discoveredSegments.map((segment) => (
                    <React.Fragment key={segment.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemIcon>
                          <GroupIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="subtitle1" sx={{ mr: 1 }}>
                                {segment.name}
                              </Typography>
                              <Chip 
                                label={getSegmentTypeLabel(segment.segmentType)} 
                                color={getSegmentTypeColor(segment.segmentType) as any} 
                                size="small" 
                              />
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                                <strong>Users:</strong> {segment.userCount} | <strong>Success Rate:</strong> {segment.successRate.toFixed(1)}% | <strong>Avg. Usage:</strong> {segment.averageUsage.toFixed(1)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                <strong>Top Features:</strong>
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {segment.topFeatures.map((feature, index) => (
                                  <Chip 
                                    key={index}
                                    label={`${getFeatureLabel(feature.name)}: ${feature.value.toFixed(2)}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Save Segment">
                            <IconButton 
                              edge="end" 
                              onClick={() => saveSegment(segment.id)}
                              disabled={savedSegments.includes(segment.id)}
                              color={savedSegments.includes(segment.id) ? 'success' : 'default'}
                            >
                              <SaveIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Alert severity="info">
              <AlertTitle>Segment Discovery Insights</AlertTitle>
              <Typography variant="body2">
                The discovery process identified {discoveredSegments.length} distinct user segments based on {selectedFeatures.length} features.
                The most significant differentiating factors were {selectedFeatures.slice(0, 2).map(f => getFeatureLabel(f).toLowerCase()).join(' and ')}.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Consider creating targeted prompts for segments with lower success rates to improve overall performance.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default SegmentDiscovery;
