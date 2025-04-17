import React, { useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '../../components/mui';
import { 
  PersonOutline, 
  TrendingUp, 
  Category, 
  Schedule, 
  BarChart,
  Recommend
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import axios from 'axios';

/**
 * User Behavior Prediction Component
 * 
 * This component allows admins to predict user behavior patterns
 * and get insights about user activity.
 */
const UserBehaviorPrediction: React.FC = () => {
  // State for form inputs
  const [userId, setUserId] = useState<string>('');
  const [predictionType, setPredictionType] = useState<string>('next_action');
  const [lookbackDays, setLookbackDays] = useState<number>(30);
  const [includeUserProfile, setIncludeUserProfile] = useState<boolean>(true);
  
  // State for API response
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionData, setPredictionData] = useState<any | null>(null);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      setError('User ID is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/analytics/predictive/user-behavior', {
        userId,
        predictionType,
        lookbackDays,
        includeUserProfile
      });
      
      setPredictionData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to predict user behavior');
    } finally {
      setLoading(false);
    }
  };
  
  // Get activity level color
  const getActivityLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return '#4caf50';
      case 'medium':
        return '#ff9800';
      case 'low':
        return '#f44336';
      default:
        return '#757575';
    }
  };
  
  // Prepare data for interests pie chart
  const prepareInterestsData = () => {
    if (!predictionData || !predictionData.userInsights.interests) return [];
    
    return predictionData.userInsights.interests.map((interest: any) => ({
      name: interest.category,
      value: interest.score
    }));
  };
  
  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          User Behavior Prediction
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="prediction-type-label">Prediction Type</InputLabel>
                <Select
                  labelId="prediction-type-label"
                  value={predictionType}
                  label="Prediction Type"
                  onChange={(e) => setPredictionType(e.target.value)}
                >
                  <MenuItem value="next_action">Next Action</MenuItem>
                  <MenuItem value="churn_risk">Churn Risk</MenuItem>
                  <MenuItem value="engagement">Engagement</MenuItem>
                  <MenuItem value="content_preference">Content Preference</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Lookback Days"
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value))}
                inputProps={{ min: 1, max: 90 }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ mt: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeUserProfile}
                      onChange={(e) => setIncludeUserProfile(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Include User Profile Data"
                />
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Predict Behavior'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
        
        {predictionData && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Prediction Results
            </Typography>
            
            <Box sx={{ mt: 2, mb: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Model: {predictionData.modelInfo.name} v{predictionData.modelInfo.version}
                {predictionData.modelInfo.accuracy && ` • Accuracy: ${(predictionData.modelInfo.accuracy * 100).toFixed(1)}%`}
                {predictionData.modelInfo.confidence && ` • Confidence: ${(predictionData.modelInfo.confidence * 100).toFixed(1)}%`}
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              {/* User Insights */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    User Insights
                  </Typography>
                  
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <PersonOutline />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Activity Level" 
                        secondary={
                          <Chip 
                            label={predictionData.userInsights.activityLevel.toUpperCase()} 
                            size="small"
                            sx={{ 
                              backgroundColor: getActivityLevelColor(predictionData.userInsights.activityLevel),
                              color: 'white',
                              mt: 0.5
                            }}
                          />
                        }
                      />
                    </ListItem>
                    
                    <Divider component="li" />
                    
                    <ListItem>
                      <ListItemIcon>
                        <Category />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Top Interests" 
                        secondary={
                          predictionData.userInsights.interests.length > 0 ? (
                            <Box sx={{ mt: 1 }}>
                              {predictionData.userInsights.interests.slice(0, 3).map((interest: any, index: number) => (
                                <Chip 
                                  key={index}
                                  label={interest.category}
                                  size="small"
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                />
                              ))}
                            </Box>
                          ) : 'No interests detected'
                        }
                      />
                    </ListItem>
                    
                    <Divider component="li" />
                    
                    <ListItem>
                      <ListItemIcon>
                        <Schedule />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Usage Patterns" 
                        secondary={
                          predictionData.userInsights.patterns.length > 0 ? (
                            <List dense disablePadding>
                              {predictionData.userInsights.patterns.map((pattern: any, index: number) => (
                                <ListItem key={index} sx={{ pl: 0 }}>
                                  <ListItemText 
                                    primary={pattern.description}
                                    secondary={`Strength: ${(pattern.strength * 100).toFixed(0)}%`}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          ) : 'No patterns detected'
                        }
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              
              {/* Interests Chart */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" gutterBottom>
                    Interest Distribution
                  </Typography>
                  
                  {predictionData.userInsights.interests.length > 0 ? (
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={prepareInterestsData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {prepareInterestsData().map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No interest data available
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
              
              {/* Predictions */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    {predictionType === 'next_action' && 'Predicted Next Actions'}
                    {predictionType === 'churn_risk' && 'Churn Risk Assessment'}
                    {predictionType === 'engagement' && 'Engagement Prediction'}
                    {predictionType === 'content_preference' && 'Content Preferences'}
                  </Typography>
                  
                  {predictionData.predictions.length > 0 ? (
                    <List>
                      {predictionData.predictions.map((prediction: any, index: number) => (
                        <React.Fragment key={index}>
                          <ListItem alignItems="flex-start">
                            <ListItemIcon>
                              {predictionType === 'next_action' && <TrendingUp />}
                              {predictionType === 'churn_risk' && <BarChart />}
                              {predictionType === 'engagement' && <BarChart />}
                              {predictionType === 'content_preference' && <Recommend />}
                            </ListItemIcon>
                            <ListItemText 
                              primary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="body1">
                                    {predictionType === 'next_action' && prediction.action}
                                    {predictionType === 'churn_risk' && 'Churn Probability'}
                                    {predictionType === 'engagement' && 'Engagement Score'}
                                    {predictionType === 'content_preference' && prediction.action.replace('prefer_', '')}
                                  </Typography>
                                  <Chip 
                                    label={`${(prediction.probability * 100).toFixed(0)}%`}
                                    size="small"
                                    color={
                                      prediction.probability > 0.7 ? 'success' :
                                      prediction.probability > 0.4 ? 'warning' : 'error'
                                    }
                                  />
                                </Box>
                              }
                              secondary={`Confidence: ${(prediction.confidence * 100).toFixed(0)}%`}
                            />
                          </ListItem>
                          
                          {prediction.recommendedContent && (
                            <Box sx={{ pl: 7, pr: 2, pb: 1 }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Recommended Content:
                              </Typography>
                              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Type</TableCell>
                                      <TableCell align="right">Score</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {prediction.recommendedContent.map((content: any, idx: number) => (
                                      <TableRow key={idx}>
                                        <TableCell>{content.name}</TableCell>
                                        <TableCell>{content.type}</TableCell>
                                        <TableCell align="right">{(content.score * 100).toFixed(0)}%</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          )}
                          
                          {index < predictionData.predictions.length - 1 && (
                            <Divider component="li" />
                          )}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">
                        No predictions available
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default UserBehaviorPrediction;
