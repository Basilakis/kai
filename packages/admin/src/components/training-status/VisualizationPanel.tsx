import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Paper,
  Slider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  ViewInAr as ViewInArIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as FullscreenIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  ZAxis
} from 'recharts';

// Mock data for 3D visualization
const mockModels = [
  { id: 'model-001', name: 'Material Classifier v2.1', type: 'Material Classifier' },
  { id: 'model-002', name: 'Text Embedding Model v1.5', type: 'Text Embedding' },
  { id: 'model-003', name: '3D Generator v1.0', type: '3D Generator' }
];

const mockEmbeddingData = Array.from({ length: 100 }, (_, i) => ({
  id: `point-${i}`,
  x: Math.random() * 100 - 50,
  y: Math.random() * 100 - 50,
  z: Math.random() * 100 - 50,
  label: `Class ${Math.floor(i / 20) + 1}`,
  confidence: 0.5 + Math.random() * 0.5
}));

const mockClasses = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];

const mock3DModels = [
  { id: '3d-001', name: 'Chair Model', thumbnail: 'https://via.placeholder.com/100', type: 'furniture' },
  { id: '3d-002', name: 'Table Model', thumbnail: 'https://via.placeholder.com/100', type: 'furniture' },
  { id: '3d-003', name: 'Lamp Model', thumbnail: 'https://via.placeholder.com/100', type: 'lighting' },
  { id: '3d-004', name: 'Vase Model', thumbnail: 'https://via.placeholder.com/100', type: 'decor' }
];

// Visualization Panel Component
const VisualizationPanel: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedModel, setSelectedModel] = useState('model-001');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(mockClasses);
  const [pointSize, setPointSize] = useState(10);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };
  
  // Handle model change
  const handleModelChange = (event: SelectChangeEvent) => {
    setSelectedModel(event.target.value);
  };
  
  // Toggle class visibility
  const toggleClass = (className: string) => {
    if (selectedClasses.includes(className)) {
      setSelectedClasses(selectedClasses.filter(c => c !== className));
    } else {
      setSelectedClasses([...selectedClasses, className]);
    }
  };
  
  // Filter data by selected classes
  const filteredData = mockEmbeddingData.filter(point => 
    selectedClasses.includes(point.label)
  );
  
  // Handle point size change
  const handlePointSizeChange = (_event: Event, newValue: number | number[]) => {
    setPointSize(newValue as number);
  };
  
  // Simulate 3D rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 1) % 360);
    }, 50);
    
    return () => clearInterval(interval);
  }, []);
  
  // Draw 3D model preview (simplified)
  useEffect(() => {
    if (canvasRef.current && selectedTab === 1) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Draw a simple cube as placeholder
        const centerX = canvasRef.current.width / 2;
        const centerY = canvasRef.current.height / 2;
        const size = 100;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        
        // Front face
        ctx.beginPath();
        ctx.rect(-size/2, -size/2, size, size);
        ctx.fillStyle = 'rgba(0, 123, 255, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#0056b3';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 3D effect lines
        ctx.beginPath();
        ctx.moveTo(-size/2, -size/2);
        ctx.lineTo(-size/2 + 20, -size/2 - 20);
        ctx.moveTo(size/2, -size/2);
        ctx.lineTo(size/2 + 20, -size/2 - 20);
        ctx.moveTo(size/2, size/2);
        ctx.lineTo(size/2 + 20, size/2 - 20);
        ctx.moveTo(-size/2, size/2);
        ctx.lineTo(-size/2 + 20, size/2 - 20);
        ctx.stroke();
        
        // Top face
        ctx.beginPath();
        ctx.moveTo(-size/2 + 20, -size/2 - 20);
        ctx.lineTo(size/2 + 20, -size/2 - 20);
        ctx.lineTo(size/2, -size/2);
        ctx.lineTo(-size/2, -size/2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(13, 110, 253, 0.7)';
        ctx.fill();
        ctx.stroke();
        
        // Side face
        ctx.beginPath();
        ctx.moveTo(size/2, -size/2);
        ctx.lineTo(size/2 + 20, -size/2 - 20);
        ctx.lineTo(size/2 + 20, size/2 - 20);
        ctx.lineTo(size/2, size/2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(25, 135, 84, 0.7)';
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
      }
    }
  }, [rotation, selectedTab]);
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          3D Visualization
        </Typography>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="model-select-label">Model</InputLabel>
          <Select
            labelId="model-select-label"
            id="model-select"
            value={selectedModel}
            label="Model"
            onChange={handleModelChange}
          >
            {mockModels.map((model) => (
              <MenuItem key={model.id} value={model.id}>{model.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      {/* Tabs for different visualizations */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={handleTabChange} aria-label="visualization tabs">
          <Tab icon={<ViewInArIcon />} label="Embedding Space" id="viz-tab-0" aria-controls="viz-tabpanel-0" />
          <Tab icon={<ViewInArIcon />} label="3D Model Viewer" id="viz-tab-1" aria-controls="viz-tabpanel-1" />
        </Tabs>
      </Box>
      
      {/* Embedding Space Visualization */}
      {selectedTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 2, height: 500, position: 'relative' }}>
              <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}>
                <IconButton size="small" sx={{ mr: 1 }}>
                  <ZoomInIcon />
                </IconButton>
                <IconButton size="small" sx={{ mr: 1 }}>
                  <ZoomOutIcon />
                </IconButton>
                <IconButton size="small">
                  <FullscreenIcon />
                </IconButton>
              </Box>
              
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 20,
                  }}
                >
                  <CartesianGrid />
                  <XAxis type="number" dataKey="x" name="X" />
                  <YAxis type="number" dataKey="y" name="Y" />
                  <ZAxis type="number" dataKey="z" range={[0, 1000]} name="Z" />
                  <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ 
                          backgroundColor: '#fff', 
                          padding: '10px', 
                          border: '1px solid #ccc',
                          borderRadius: '4px'
                        }}>
                          <p>{`ID: ${data.id}`}</p>
                          <p>{`Label: ${data.label}`}</p>
                          <p>{`Coordinates: (${data.x.toFixed(2)}, ${data.y.toFixed(2)}, ${data.z.toFixed(2)})`}</p>
                          <p>{`Confidence: ${(data.confidence * 100).toFixed(1)}%`}</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Scatter 
                    name="Embeddings" 
                    data={filteredData} 
                    fill={(entry) => {
                      // Generate color based on class
                      const classIndex = parseInt(entry.label.split(' ')[1]) - 1;
                      const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];
                      return colors[classIndex % colors.length];
                    }}
                    shape="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Visualization Controls
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography id="point-size-slider" gutterBottom>
                  Point Size
                </Typography>
                <Slider
                  aria-labelledby="point-size-slider"
                  value={pointSize}
                  onChange={handlePointSizeChange}
                  min={1}
                  max={20}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' }
                  ]}
                />
              </Box>
              
              <Typography variant="subtitle2" gutterBottom>
                Classes
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {mockClasses.map((className) => (
                  <Chip
                    key={className}
                    label={className}
                    onClick={() => toggleClass(className)}
                    color={selectedClasses.includes(className) ? 'primary' : 'default'}
                    variant={selectedClasses.includes(className) ? 'filled' : 'outlined'}
                    icon={selectedClasses.includes(className) ? <VisibilityIcon /> : <VisibilityOffIcon />}
                  />
                ))}
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<RefreshIcon />}
                  sx={{ mb: 1 }}
                >
                  Refresh Data
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<DownloadIcon />}
                >
                  Export Visualization
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
      
      {/* 3D Model Viewer */}
      {selectedTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 2, height: 500, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <canvas 
                ref={canvasRef} 
                width={500} 
                height={400} 
                style={{ border: '1px solid #ddd' }}
              />
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                3D Model Gallery
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mock3DModels.map((model) => (
                  <Card key={model.id} variant="outlined" sx={{ cursor: 'pointer' }}>
                    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          component="img"
                          src={model.thumbnail}
                          alt={model.name}
                          sx={{ width: 50, height: 50, mr: 1, objectFit: 'cover' }}
                        />
                        <Box>
                          <Typography variant="body2">{model.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {model.type}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  startIcon={<DownloadIcon />}
                >
                  Export 3D Model
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default VisualizationPanel;
