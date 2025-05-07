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
  Chip
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { CodeEditor } from '../../../common/CodeEditor';

interface IntegrationFormProps {
  onSubmit: (integration: any) => void;
  initialData?: any;
}

const SYSTEM_TYPES = [
  { value: 'grafana', label: 'Grafana' },
  { value: 'prometheus', label: 'Prometheus' },
  { value: 'datadog', label: 'Datadog' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
  { value: 'custom_api', label: 'Custom API' },
  { value: 'google_analytics', label: 'Google Analytics' },
  { value: 'slack', label: 'Slack' },
  { value: 'power_bi', label: 'Power BI' },
  { value: 'webhook', label: 'Webhook' }
];

const IntegrationForm: React.FC<IntegrationFormProps> = ({ onSubmit, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    systemType: initialData?.systemType || 'grafana',
    isActive: initialData?.isActive !== false,
    connectionParameters: initialData?.connectionParameters || {}
  });

  // Initialize default connection parameters based on system type
  useEffect(() => {
    let defaultParams = {};
    
    switch (formData.systemType) {
      case 'grafana':
        defaultParams = {
          url: '',
          apiKey: '',
          dashboardUid: ''
        };
        break;
      case 'prometheus':
        defaultParams = {
          url: '',
          username: '',
          password: ''
        };
        break;
      case 'datadog':
        defaultParams = {
          apiKey: '',
          appKey: ''
        };
        break;
      case 'elasticsearch':
        defaultParams = {
          url: '',
          username: '',
          password: '',
          apiKey: '',
          indexName: ''
        };
        break;
      case 'custom_api':
        defaultParams = {
          url: '',
          method: 'POST',
          headers: {},
          bodyTemplate: '{}'
        };
        break;
      case 'google_analytics':
        defaultParams = {
          measurementId: '',
          apiSecret: '',
          clientId: ''
        };
        break;
      case 'slack':
        defaultParams = {
          webhookUrl: '',
          channel: '',
          username: 'Prompt Monitoring'
        };
        break;
      case 'power_bi':
        defaultParams = {
          datasetId: '',
          tableId: '',
          clientId: '',
          clientSecret: '',
          tenantId: ''
        };
        break;
      case 'webhook':
        defaultParams = {
          url: '',
          method: 'POST',
          headers: {},
          secret: ''
        };
        break;
      default:
        defaultParams = {};
    }
    
    // Only set default parameters if they don't already exist
    if (Object.keys(formData.connectionParameters).length === 0) {
      setFormData(prev => ({
        ...prev,
        connectionParameters: defaultParams
      }));
    }
  }, [formData.systemType]);

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
        connectionParameters: {
          ...prev.connectionParameters,
          [name]: value
        }
      }));
    }
  };

  const handleJsonChange = (field: string) => (value: string) => {
    try {
      const parsedValue = JSON.parse(value);
      setFormData(prev => ({
        ...prev,
        connectionParameters: {
          ...prev.connectionParameters,
          [field]: parsedValue
        }
      }));
    } catch (error) {
      // Invalid JSON, ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderConnectionForm = () => {
    switch (formData.systemType) {
      case 'grafana':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Grafana URL"
                name="url"
                value={formData.connectionParameters.url || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                placeholder="https://grafana.example.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Key"
                name="apiKey"
                value={formData.connectionParameters.apiKey || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                type="password"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Dashboard UID"
                name="dashboardUid"
                value={formData.connectionParameters.dashboardUid || ''}
                onChange={handleParameterChange}
                margin="normal"
                helperText="Optional: Specific dashboard to use for annotations"
              />
            </Grid>
          </Grid>
        );
        
      case 'prometheus':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Prometheus URL"
                name="url"
                value={formData.connectionParameters.url || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                placeholder="https://prometheus.example.com"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.connectionParameters.username || ''}
                onChange={handleParameterChange}
                margin="normal"
                helperText="Optional: Basic auth username"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                name="password"
                value={formData.connectionParameters.password || ''}
                onChange={handleParameterChange}
                margin="normal"
                type="password"
                helperText="Optional: Basic auth password"
              />
            </Grid>
          </Grid>
        );
        
      case 'datadog':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="API Key"
                name="apiKey"
                value={formData.connectionParameters.apiKey || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                type="password"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Application Key"
                name="appKey"
                value={formData.connectionParameters.appKey || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                type="password"
              />
            </Grid>
          </Grid>
        );
        
      case 'elasticsearch':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Elasticsearch URL"
                name="url"
                value={formData.connectionParameters.url || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                placeholder="https://elasticsearch.example.com:9200"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.connectionParameters.username || ''}
                onChange={handleParameterChange}
                margin="normal"
                helperText="Optional: Basic auth username"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                name="password"
                value={formData.connectionParameters.password || ''}
                onChange={handleParameterChange}
                margin="normal"
                type="password"
                helperText="Optional: Basic auth password"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="API Key"
                name="apiKey"
                value={formData.connectionParameters.apiKey || ''}
                onChange={handleParameterChange}
                margin="normal"
                type="password"
                helperText="Optional: API key (alternative to username/password)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Index Name"
                name="indexName"
                value={formData.connectionParameters.indexName || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                placeholder="prompt-monitoring"
              />
            </Grid>
          </Grid>
        );
        
      case 'custom_api':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API URL"
                name="url"
                value={formData.connectionParameters.url || ''}
                onChange={handleParameterChange}
                required
                margin="normal"
                placeholder="https://api.example.com/endpoint"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>HTTP Method</InputLabel>
                <Select
                  name="method"
                  value={formData.connectionParameters.method || 'POST'}
                  onChange={handleParameterChange}
                  label="HTTP Method"
                >
                  <MenuItem value="GET">GET</MenuItem>
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                  <MenuItem value="PATCH">PATCH</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Headers (JSON)</Typography>
              <CodeEditor
                value={JSON.stringify(formData.connectionParameters.headers || {}, null, 2)}
                onChange={handleJsonChange('headers')}
                language="json"
                height="150px"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>Body Template (JSON)</Typography>
              <CodeEditor
                value={formData.connectionParameters.bodyTemplate || '{}'}
                onChange={handleJsonChange('bodyTemplate')}
                language="json"
                height="150px"
              />
            </Grid>
          </Grid>
        );
        
      // Add more system type forms as needed
        
      default:
        return (
          <Typography color="textSecondary">
            No connection parameters available for this system type.
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
            label="Integration Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>System Type</InputLabel>
            <Select
              name="systemType"
              value={formData.systemType}
              onChange={handleChange}
              label="System Type"
              required
            >
              {SYSTEM_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
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
      
      <Typography variant="h6" gutterBottom>Connection Parameters</Typography>
      
      {renderConnectionForm()}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="submit" variant="contained" color="primary">
          {initialData ? 'Update Integration' : 'Create Integration'}
        </Button>
      </Box>
    </Box>
  );
};

export default IntegrationForm;
