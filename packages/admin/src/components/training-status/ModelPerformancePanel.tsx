import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
  Tab,
  Tabs,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { 
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  History as HistoryIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  BarChart as BarChartIcon,
  BugReport as BugReportIcon
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

// Mock data for model performance
const mockModelTypes = [
  'Material Classifier',
  'Text Embedding',
  '3D Generator',
  'Scene Understanding'
];

const mockModels = [
  {
    id: 'model-001',
    name: 'Material Classifier v2.1',
    type: 'Material Classifier',
    version: '2.1.0',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000), // 30 days ago
    lastEvaluated: new Date(Date.now() - 2 * 24 * 3600 * 1000), // 2 days ago
    status: 'production',
    favorite: true,
    metrics: {
      accuracy: 0.937,
      precision: 0.932,
      recall: 0.928,
      f1Score: 0.930,
      inferenceTime: 98, // ms
      confidenceDistribution: [
        { name: 'High (>0.9)', value: 76 },
        { name: 'Medium (0.7-0.9)', value: 18 },
        { name: 'Low (<0.7)', value: 6 }
      ]
    },
    classPerformance: [
      { class: 'Wood', precision: 0.95, recall: 0.93, f1Score: 0.94, support: 120 },
      { class: 'Metal', precision: 0.92, recall: 0.94, f1Score: 0.93, support: 150 },
      { class: 'Plastic', precision: 0.91, recall: 0.89, f1Score: 0.90, support: 130 },
      { class: 'Ceramic', precision: 0.96, recall: 0.95, f1Score: 0.95, support: 110 },
      { class: 'Glass', precision: 0.94, recall: 0.92, f1Score: 0.93, support: 100 },
      { class: 'Stone', precision: 0.93, recall: 0.91, f1Score: 0.92, support: 90 },
      { class: 'Fabric', precision: 0.89, recall: 0.87, f1Score: 0.88, support: 80 }
    ],
    confusionMatrix: [
      { actual: 'Wood', predicted: 'Wood', count: 112 },
      { actual: 'Wood', predicted: 'Metal', count: 5 },
      { actual: 'Wood', predicted: 'Plastic', count: 3 },
      { actual: 'Metal', predicted: 'Metal', count: 141 },
      { actual: 'Metal', predicted: 'Wood', count: 4 },
      { actual: 'Metal', predicted: 'Plastic', count: 5 },
      { actual: 'Plastic', predicted: 'Plastic', count: 116 },
      { actual: 'Plastic', predicted: 'Metal', count: 8 },
      { actual: 'Plastic', predicted: 'Wood', count: 6 }
    ],
    errorAnalysis: {
      mostConfusedPairs: [
        { class1: 'Metal', class2: 'Plastic', count: 13 },
        { class1: 'Wood', class2: 'Plastic', count: 9 },
        { class1: 'Glass', class2: 'Ceramic', count: 7 }
      ],
      hardestExamples: [
        { id: 'img-001', actualClass: 'Metal', predictedClass: 'Plastic', confidence: 0.51, imageUrl: 'https://via.placeholder.com/100' },
        { id: 'img-002', actualClass: 'Wood', predictedClass: 'Plastic', confidence: 0.53, imageUrl: 'https://via.placeholder.com/100' },
        { id: 'img-003', actualClass: 'Glass', predictedClass: 'Ceramic', confidence: 0.55, imageUrl: 'https://via.placeholder.com/100' }
      ]
    }
  },
  {
    id: 'model-002',
    name: 'Text Embedding Model v1.5',
    type: 'Text Embedding',
    version: '1.5.0',
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000), // 60 days ago
    lastEvaluated: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
    status: 'production',
    favorite: false,
    metrics: {
      retrievalAccuracy: 0.872,
      meanReciprocalRank: 0.791,
      ndcg: 0.834,
      inferenceTime: 46, // ms
      dimensions: 384
    },
    retrievalPerformance: [
      { k: 1, accuracy: 0.78 },
      { k: 3, accuracy: 0.85 },
      { k: 5, accuracy: 0.89 },
      { k: 10, accuracy: 0.93 }
    ],
    queryTypes: [
      { type: 'Exact Match', accuracy: 0.95 },
      { type: 'Synonyms', accuracy: 0.87 },
      { type: 'Related Concepts', accuracy: 0.82 },
      { type: 'Cross-category', accuracy: 0.76 }
    ],
    errorAnalysis: {
      hardestQueries: [
        { query: 'sustainable materials', retrievalRank: 8, relevantDocId: 'doc-123' },
        { query: 'heat resistant polymers', retrievalRank: 6, relevantDocId: 'doc-456' },
        { query: 'flexible conductive materials', retrievalRank: 5, relevantDocId: 'doc-789' }
      ]
    }
  },
  {
    id: 'model-003',
    name: '3D Generator v1.0',
    type: '3D Generator',
    version: '1.0.0',
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000), // 15 days ago
    lastEvaluated: new Date(Date.now() - 3 * 24 * 3600 * 1000), // 3 days ago
    status: 'staging',
    favorite: false,
    metrics: {
      fid: 0.82, // Fréchet Inception Distance
      clipScore: 0.76,
      userRating: 4.2,
      inferenceTime: 3200, // ms
      geometryAccuracy: 0.78
    }
  }
];

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString();
};

// Model Performance Panel Component
const ModelPerformancePanel: React.FC = () => {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [selectedModelType, setSelectedModelType] = useState<string>('All');
  const [selectedMetricTab, setSelectedMetricTab] = useState(0);

  // Toggle model expansion
  const toggleModelExpansion = (modelId: string) => {
    setExpandedModel(expandedModel === modelId ? null : modelId);
  };

  // Handle model type filter change
  const handleModelTypeChange = (event: SelectChangeEvent) => {
    setSelectedModelType(event.target.value);
  };

  // Filter models by type
  const filteredModels = selectedModelType === 'All' 
    ? mockModels 
    : mockModels.filter(model => model.type === selectedModelType);

  // Handle metric tab change
  const handleMetricTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedMetricTab(newValue);
  };

  // Toggle favorite status
  const toggleFavorite = (modelId: string) => {
    // In a real implementation, this would update the model's favorite status
    console.log(`Toggle favorite for model ${modelId}`);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Model Performance
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="model-type-select-label">Model Type</InputLabel>
          <Select
            labelId="model-type-select-label"
            id="model-type-select"
            value={selectedModelType}
            label="Model Type"
            onChange={handleModelTypeChange}
          >
            <MenuItem value="All">All Types</MenuItem>
            {mockModelTypes.map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Models List */}
      {filteredModels.map((model) => (
        <Card key={model.id} sx={{ mb: 3 }}>
          <CardContent sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton 
                  size="small" 
                  onClick={() => toggleFavorite(model.id)}
                  sx={{ mr: 1 }}
                >
                  {model.favorite ? (
                    <StarIcon color="warning" />
                  ) : (
                    <StarBorderIcon />
                  )}
                </IconButton>
                <Box>
                  <Typography variant="h6" component="div">
                    {model.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {model.type} • v{model.version} • Created: {formatDate(model.createdAt)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip 
                  label={model.status} 
                  color={model.status === 'production' ? 'success' : 'warning'} 
                  size="small" 
                />
                <IconButton
                  aria-label="expand model"
                  size="small"
                  onClick={() => toggleModelExpansion(model.id)}
                >
                  {expandedModel === model.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
            </Box>

            {/* Key metrics summary */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(model.metrics).map(([key, value]) => {
                // Skip complex metrics like arrays
                if (typeof value !== 'object') {
                  return (
                    <Chip 
                      key={key}
                      label={`${key}: ${typeof value === 'number' && key.toLowerCase().includes('time') ? `${value}ms` : value}`}
                      variant="outlined"
                      size="small"
                    />
                  );
                }
                return null;
              })}
            </Box>

            {/* Expanded details */}
            <Collapse in={expandedModel === model.id} timeout="auto" unmountOnExit>
              <Box sx={{ mt: 3 }}>
                <Tabs value={selectedMetricTab} onChange={handleMetricTabChange} aria-label="model metrics tabs">
                  <Tab label="Performance Metrics" id="metrics-tab-0" aria-controls="metrics-tabpanel-0" />
                  <Tab label="Class Performance" id="metrics-tab-1" aria-controls="metrics-tabpanel-1" />
                  <Tab label="Error Analysis" id="metrics-tab-2" aria-controls="metrics-tabpanel-2" />
                </Tabs>
                
                {/* Performance Metrics Tab */}
                {selectedMetricTab === 0 && (
                  <Box sx={{ p: 2 }}>
                    <Grid container spacing={3}>
                      {/* Main metrics visualization */}
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>
                          Key Performance Indicators
                        </Typography>
                        
                        {model.type === 'Material Classifier' && (
                          <ResponsiveContainer width="100%" height={300}>
                            <RadarChart outerRadius={90} data={[
                              { 
                                metric: 'Accuracy', 
                                value: model.metrics.accuracy,
                                fullMark: 1 
                              },
                              { 
                                metric: 'Precision', 
                                value: model.metrics.precision,
                                fullMark: 1 
                              },
                              { 
                                metric: 'Recall', 
                                value: model.metrics.recall,
                                fullMark: 1 
                              },
                              { 
                                metric: 'F1 Score', 
                                value: model.metrics.f1Score,
                                fullMark: 1 
                              },
                              { 
                                metric: 'Speed', 
                                value: 1 - (model.metrics.inferenceTime / 200), // Normalize
                                fullMark: 1 
                              }
                            ]}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="metric" />
                              <PolarRadiusAxis angle={30} domain={[0, 1]} />
                              <Radar name="Performance" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                            </RadarChart>
                          </ResponsiveContainer>
                        )}
                        
                        {model.type === 'Text Embedding' && (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={[
                                { name: 'Retrieval Acc.', value: model.metrics.retrievalAccuracy },
                                { name: 'MRR', value: model.metrics.meanReciprocalRank },
                                { name: 'NDCG', value: model.metrics.ndcg }
                              ]}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis domain={[0, 1]} />
                              <RechartsTooltip />
                              <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                        
                        {model.type === '3D Generator' && (
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={[
                                { name: 'FID', value: model.metrics.fid },
                                { name: 'CLIP Score', value: model.metrics.clipScore },
                                { name: 'Geometry', value: model.metrics.geometryAccuracy },
                                { name: 'User Rating', value: model.metrics.userRating / 5 } // Normalize to 0-1
                              ]}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis domain={[0, 1]} />
                              <RechartsTooltip />
                              <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </Grid>
                      
                      {/* Secondary metrics */}
                      <Grid item xs={12} md={6}>
                        {model.type === 'Material Classifier' && model.metrics.confidenceDistribution && (
                          <Box>
                            <Typography variant="subtitle1" gutterBottom>
                              Confidence Distribution
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={model.metrics.confidenceDistribution}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {model.metrics.confidenceDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#4caf50', '#ff9800', '#f44336'][index % 3]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </Box>
                        )}
                        
                        {model.type === 'Text Embedding' && model.retrievalPerformance && (
                          <Box>
                            <Typography variant="subtitle1" gutterBottom>
                              Retrieval Performance by k
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart
                                data={model.retrievalPerformance}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="k" />
                                <YAxis domain={[0, 1]} />
                                <RechartsTooltip />
                                <Line type="monotone" dataKey="accuracy" stroke="#8884d8" activeDot={{ r: 8 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </Box>
                        )}
                        
                        {model.type === 'Text Embedding' && model.queryTypes && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" gutterBottom>
                              Performance by Query Type
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart
                                data={model.queryTypes}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="type" />
                                <YAxis domain={[0, 1]} />
                                <RechartsTooltip />
                                <Bar dataKey="accuracy" fill="#82ca9d" />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                )}
                
                {/* Class Performance Tab */}
                {selectedMetricTab === 1 && model.classPerformance && (
                  <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Performance by Class
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Class</TableCell>
                            <TableCell>Precision</TableCell>
                            <TableCell>Recall</TableCell>
                            <TableCell>F1 Score</TableCell>
                            <TableCell>Support</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {model.classPerformance.map((classData) => (
                            <TableRow key={classData.class}>
                              <TableCell>{classData.class}</TableCell>
                              <TableCell>{classData.precision.toFixed(3)}</TableCell>
                              <TableCell>{classData.recall.toFixed(3)}</TableCell>
                              <TableCell>{classData.f1Score.toFixed(3)}</TableCell>
                              <TableCell>{classData.support}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    {model.confusionMatrix && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Confusion Matrix (Partial)
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Actual</TableCell>
                                <TableCell>Predicted</TableCell>
                                <TableCell>Count</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {model.confusionMatrix.map((cell, index) => (
                                <TableRow 
                                  key={index}
                                  sx={{ 
                                    backgroundColor: cell.actual === cell.predicted ? 'rgba(76, 175, 80, 0.1)' : 'inherit'
                                  }}
                                >
                                  <TableCell>{cell.actual}</TableCell>
                                  <TableCell>{cell.predicted}</TableCell>
                                  <TableCell>{cell.count}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                  </Box>
                )}
                
                {/* Error Analysis Tab */}
                {selectedMetricTab === 2 && model.errorAnalysis && (
                  <Box sx={{ p: 2 }}>
                    <Grid container spacing={3}>
                      {/* Most confused pairs */}
                      {model.errorAnalysis.mostConfusedPairs && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle1" gutterBottom>
                            Most Confused Class Pairs
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Class 1</TableCell>
                                  <TableCell>Class 2</TableCell>
                                  <TableCell>Count</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {model.errorAnalysis.mostConfusedPairs.map((pair, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{pair.class1}</TableCell>
                                    <TableCell>{pair.class2}</TableCell>
                                    <TableCell>{pair.count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      )}
                      
                      {/* Hardest examples */}
                      {model.errorAnalysis.hardestExamples && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle1" gutterBottom>
                            Hardest Examples
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Image</TableCell>
                                  <TableCell>Actual</TableCell>
                                  <TableCell>Predicted</TableCell>
                                  <TableCell>Confidence</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {model.errorAnalysis.hardestExamples.map((example) => (
                                  <TableRow key={example.id}>
                                    <TableCell>
                                      <Box
                                        component="img"
                                        src={example.imageUrl}
                                        alt={`Example ${example.id}`}
                                        sx={{ width: 50, height: 50, objectFit: 'cover' }}
                                      />
                                    </TableCell>
                                    <TableCell>{example.actualClass}</TableCell>
                                    <TableCell>{example.predictedClass}</TableCell>
                                    <TableCell>{example.confidence.toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      )}
                      
                      {/* Hardest queries for embedding models */}
                      {model.errorAnalysis.hardestQueries && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" gutterBottom>
                            Hardest Queries
                          </Typography>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Query</TableCell>
                                  <TableCell>Relevant Document Found at Rank</TableCell>
                                  <TableCell>Document ID</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {model.errorAnalysis.hardestQueries.map((query, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{query.query}</TableCell>
                                    <TableCell>{query.retrievalRank}</TableCell>
                                    <TableCell>{query.relevantDocId}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      )}
                    </Grid>
                    
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="outlined" 
                        color="primary" 
                        startIcon={<BugReportIcon />}
                      >
                        Debug Model
                      </Button>
                    </Box>
                  </Box>
                )}
                
                {/* Actions */}
                <Box sx={{ mt: 2, p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button 
                    variant="outlined" 
                    startIcon={<HistoryIcon />}
                  >
                    Version History
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<ViewIcon />}
                  >
                    View Details
                  </Button>
                  {model.status !== 'production' && (
                    <Button 
                      variant="outlined" 
                      color="error" 
                      startIcon={<DeleteIcon />}
                    >
                      Delete
                    </Button>
                  )}
                </Box>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default ModelPerformancePanel;
