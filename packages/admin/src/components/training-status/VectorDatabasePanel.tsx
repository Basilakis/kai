import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert
} from '@mui/material';
import { 
  Storage as StorageIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  BarChart as BarChartIcon,
  Speed as SpeedIcon,
  Tune as TuneIcon,
  History as HistoryIcon
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
  Cell
} from 'recharts';

// Mock data for vector database
const mockCollections = [
  { 
    id: 'collection-001', 
    name: 'materials', 
    vectorCount: 12450, 
    dimensions: 384,
    indexType: 'HNSW',
    lastUpdated: new Date(Date.now() - 2 * 24 * 3600 * 1000), // 2 days ago
    status: 'healthy',
    avgQueryTime: 24, // ms
    storageSize: 48.2, // MB
    model: 'all-MiniLM-L6-v2'
  },
  { 
    id: 'collection-002', 
    name: 'products', 
    vectorCount: 8320, 
    dimensions: 1536,
    indexType: 'HNSW',
    lastUpdated: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
    status: 'healthy',
    avgQueryTime: 42, // ms
    storageSize: 102.6, // MB
    model: 'text-embedding-ada-002'
  },
  { 
    id: 'collection-003', 
    name: 'documents', 
    vectorCount: 3150, 
    dimensions: 768,
    indexType: 'HNSW',
    lastUpdated: new Date(Date.now() - 10 * 24 * 3600 * 1000), // 10 days ago
    status: 'needs_reindexing',
    avgQueryTime: 56, // ms
    storageSize: 24.8, // MB
    model: 'mpnet-base-v2'
  }
];

const mockQueryPerformance = [
  { timestamp: '08:00', queryTime: 22, queryCount: 120 },
  { timestamp: '09:00', queryTime: 24, queryCount: 145 },
  { timestamp: '10:00', queryTime: 28, queryCount: 210 },
  { timestamp: '11:00', queryTime: 32, queryCount: 250 },
  { timestamp: '12:00', queryTime: 35, queryCount: 230 },
  { timestamp: '13:00', queryTime: 30, queryCount: 180 },
  { timestamp: '14:00', queryTime: 26, queryCount: 190 },
  { timestamp: '15:00', queryTime: 24, queryCount: 210 }
];

const mockIndexStats = [
  { name: 'HNSW Index', value: 85 },
  { name: 'IVF Index', value: 10 },
  { name: 'Flat Index', value: 5 }
];

const mockRecentQueries = [
  { 
    id: 'query-001', 
    text: 'sustainable wood materials', 
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    collection: 'materials',
    latency: 22, // ms
    results: 8,
    user: 'user123'
  },
  { 
    id: 'query-002', 
    text: 'heat resistant polymers', 
    timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    collection: 'materials',
    latency: 26, // ms
    results: 5,
    user: 'user456'
  },
  { 
    id: 'query-003', 
    text: 'recycled plastic products', 
    timestamp: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
    collection: 'products',
    latency: 38, // ms
    results: 12,
    user: 'user789'
  }
];

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString();
};

// Format time for display
const formatTime = (date: Date) => {
  return date.toLocaleTimeString();
};

// Vector Database Panel Component
const VectorDatabasePanel: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };
  
  // Handle search query change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };
  
  // Handle search submit
  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Searching for:', searchQuery);
    // In a real implementation, this would search the vector database
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Vector Database
        </Typography>
        <Button variant="contained" color="primary" startIcon={<RefreshIcon />}>
          Refresh Stats
        </Button>
      </Box>
      
      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Vectors
              </Typography>
              <Typography variant="h4" component="div">
                {mockCollections.reduce((sum, collection) => sum + collection.vectorCount, 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across {mockCollections.length} collections
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Avg Query Time
              </Typography>
              <Typography variant="h4" component="div">
                {Math.round(mockCollections.reduce((sum, collection) => sum + collection.avgQueryTime, 0) / mockCollections.length)} ms
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last 24 hours
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Storage Used
              </Typography>
              <Typography variant="h4" component="div">
                {mockCollections.reduce((sum, collection) => sum + collection.storageSize, 0).toFixed(1)} MB
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total vector storage
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Health Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip 
                  label={mockCollections.every(c => c.status === 'healthy') ? 'All Healthy' : 'Needs Attention'} 
                  color={mockCollections.every(c => c.status === 'healthy') ? 'success' : 'warning'} 
                  size="small" 
                  sx={{ mr: 1 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {mockCollections.filter(c => c.status !== 'healthy').length} collection(s) need attention
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Tabs for different sections */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={handleTabChange} aria-label="vector database tabs">
          <Tab icon={<StorageIcon />} label="Collections" id="vector-tab-0" aria-controls="vector-tabpanel-0" />
          <Tab icon={<SpeedIcon />} label="Performance" id="vector-tab-1" aria-controls="vector-tabpanel-1" />
          <Tab icon={<SearchIcon />} label="Query Testing" id="vector-tab-2" aria-controls="vector-tabpanel-2" />
        </Tabs>
      </Box>
      
      {/* Collections Tab */}
      {selectedTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="outlined" startIcon={<AddIcon />}>
              New Collection
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table aria-label="vector collections table">
              <TableHead>
                <TableRow>
                  <TableCell>Collection Name</TableCell>
                  <TableCell align="right">Vectors</TableCell>
                  <TableCell align="right">Dimensions</TableCell>
                  <TableCell>Index Type</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockCollections.map((collection) => (
                  <TableRow
                    key={collection.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {collection.name}
                    </TableCell>
                    <TableCell align="right">{collection.vectorCount.toLocaleString()}</TableCell>
                    <TableCell align="right">{collection.dimensions}</TableCell>
                    <TableCell>{collection.indexType}</TableCell>
                    <TableCell>{collection.model}</TableCell>
                    <TableCell>{formatDate(collection.lastUpdated)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={collection.status} 
                        color={collection.status === 'healthy' ? 'success' : 'warning'} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small">
                          <BarChartIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reindex">
                        <IconButton size="small">
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Collection that needs attention */}
          {mockCollections.some(c => c.status !== 'healthy') && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              Some collections need attention. Consider reindexing to improve query performance.
            </Alert>
          )}
        </Box>
      )}
      
      {/* Performance Tab */}
      {selectedTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Query Performance Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={mockQueryPerformance}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <RechartsTooltip />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="queryTime" 
                    name="Avg Query Time (ms)" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="queryCount" 
                    name="Query Count" 
                    stroke="#82ca9d" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Index Type Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={mockIndexStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {mockIndexStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28'][index % 3]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Recent Queries
              </Typography>
              <TableContainer>
                <Table aria-label="recent queries table" size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Query</TableCell>
                      <TableCell>Collection</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell align="right">Latency</TableCell>
                      <TableCell align="right">Results</TableCell>
                      <TableCell>User</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockRecentQueries.map((query) => (
                      <TableRow key={query.id}>
                        <TableCell>{query.text}</TableCell>
                        <TableCell>{query.collection}</TableCell>
                        <TableCell>{formatTime(query.timestamp)}</TableCell>
                        <TableCell align="right">{query.latency} ms</TableCell>
                        <TableCell align="right">{query.results}</TableCell>
                        <TableCell>{query.user}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button startIcon={<HistoryIcon />} variant="outlined">
                  View Full Query History
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
      
      {/* Query Testing Tab */}
      {selectedTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Vector Search Testing
              </Typography>
              <form onSubmit={handleSearchSubmit}>
                <Box sx={{ display: 'flex', mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Search Query"
                    variant="outlined"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    sx={{ mr: 2 }}
                  />
                  <Button 
                    type="submit" 
                    variant="contained" 
                    startIcon={<SearchIcon />}
                  >
                    Search
                  </Button>
                </Box>
              </form>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Search Parameters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Collection"
                      select
                      defaultValue="materials"
                      variant="outlined"
                      size="small"
                      SelectProps={{
                        native: true,
                      }}
                    >
                      {mockCollections.map((collection) => (
                        <option key={collection.id} value={collection.name}>
                          {collection.name}
                        </option>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Top K Results"
                      type="number"
                      defaultValue="10"
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Similarity Threshold"
                      type="number"
                      defaultValue="0.7"
                      variant="outlined"
                      size="small"
                      inputProps={{ step: 0.1, min: 0, max: 1 }}
                    />
                  </Grid>
                </Grid>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button startIcon={<TuneIcon />} variant="outlined" sx={{ mr: 1 }}>
                  Advanced Options
                </Button>
                <Button startIcon={<HistoryIcon />} variant="outlined">
                  Load Recent Query
                </Button>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  Enter a search query and click "Search" to test vector search.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Results will appear here.
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default VectorDatabasePanel;
