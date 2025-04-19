import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Grid, 
  Divider,
  Box,
  Chip,
  FormHelperText,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import { 
  SaveIcon, 
  DocumentTextIcon, 
  CodeIcon, 
  EyeIcon 
} from '@heroicons/react/outline';

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
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
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

function a11yProps(index: number) {
  return {
    id: `template-tab-${index}`,
    'aria-controls': `template-tabpanel-${index}`,
  };
}

interface NotificationTemplateEditorProps {
  template?: {
    id?: string;
    name: string;
    description: string;
    type: string;
    format: string;
    content: string;
    subject?: string;
    variables?: string[];
  };
  onSave: (template: any) => void;
  loading?: boolean;
}

/**
 * Notification Template Editor Component
 * 
 * This component provides an interface for creating and editing notification templates.
 */
const NotificationTemplateEditor: React.FC<NotificationTemplateEditorProps> = ({
  template = {
    name: '',
    description: '',
    type: 'email',
    format: 'html',
    content: '',
    subject: '',
    variables: []
  },
  onSave,
  loading = false
}) => {
  const [formData, setFormData] = useState(template);
  const [formErrors, setFormErrors] = useState({
    name: '',
    type: '',
    format: '',
    content: '',
    subject: ''
  });
  const [tabValue, setTabValue] = useState(0);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});

  // Template types
  const templateTypes = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'push', label: 'Push Notification' },
    { value: 'in_app', label: 'In-App Notification' }
  ];

  // Template formats
  const templateFormats = [
    { value: 'html', label: 'HTML', types: ['email'] },
    { value: 'text', label: 'Plain Text', types: ['email', 'sms', 'push', 'in_app'] },
    { value: 'markdown', label: 'Markdown', types: ['email', 'in_app'] },
    { value: 'json', label: 'JSON', types: ['email', 'sms', 'push', 'in_app'] }
  ];

  // Generate preview data based on variables
  useEffect(() => {
    if (formData.variables && formData.variables.length > 0) {
      const data: Record<string, string> = {};
      formData.variables.forEach(variable => {
        data[variable] = `Sample ${variable.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
      });
      setPreviewData(data);
    }
  }, [formData.variables]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const validateForm = () => {
    let valid = true;
    const errors = {
      name: '',
      type: '',
      format: '',
      content: '',
      subject: ''
    };

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      valid = false;
    }

    if (!formData.type) {
      errors.type = 'Type is required';
      valid = false;
    }

    if (!formData.format) {
      errors.format = 'Format is required';
      valid = false;
    }

    if (!formData.content.trim()) {
      errors.content = 'Content is required';
      valid = false;
    }

    if (formData.type === 'email' && !formData.subject?.trim()) {
      errors.subject = 'Subject is required for email templates';
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    onSave(formData);
  };

  const handleAddVariable = () => {
    const variable = prompt('Enter variable name (e.g., userName, orderNumber):');
    if (variable && variable.trim()) {
      const newVariables = [...(formData.variables || [])];
      if (!newVariables.includes(variable)) {
        newVariables.push(variable);
        setFormData({ ...formData, variables: newVariables });
      }
    }
  };

  const handleRemoveVariable = (variable: string) => {
    const newVariables = (formData.variables || []).filter(v => v !== variable);
    setFormData({ ...formData, variables: newVariables });
  };

  const getFilteredFormats = () => {
    return templateFormats.filter(format => 
      format.types.includes(formData.type)
    );
  };

  const renderPreview = () => {
    try {
      if (formData.format === 'html') {
        // Replace variables with preview data
        let previewContent = formData.content;
        Object.entries(previewData).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          previewContent = previewContent.replace(regex, value);
        });
        
        return (
          <div>
            {formData.type === 'email' && (
              <div className="mb-4 p-2 bg-gray-100 rounded">
                <strong>Subject:</strong> {formData.subject}
              </div>
            )}
            <div 
              className="p-4 border rounded bg-white" 
              dangerouslySetInnerHTML={{ __html: previewContent }} 
            />
          </div>
        );
      } else if (formData.format === 'text' || formData.format === 'markdown') {
        // Replace variables with preview data
        let previewContent = formData.content;
        Object.entries(previewData).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          previewContent = previewContent.replace(regex, value);
        });
        
        return (
          <div>
            {formData.type === 'email' && (
              <div className="mb-4 p-2 bg-gray-100 rounded">
                <strong>Subject:</strong> {formData.subject}
              </div>
            )}
            <pre className="p-4 border rounded bg-white whitespace-pre-wrap">
              {previewContent}
            </pre>
          </div>
        );
      } else if (formData.format === 'json') {
        try {
          // Try to parse JSON
          const jsonContent = JSON.parse(formData.content);
          
          // Replace variables in JSON
          const replaceVariablesInJson = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) {
              if (typeof obj === 'string') {
                let result = obj;
                Object.entries(previewData).forEach(([key, value]) => {
                  const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                  result = result.replace(regex, value);
                });
                return result;
              }
              return obj;
            }
            
            if (Array.isArray(obj)) {
              return obj.map(item => replaceVariablesInJson(item));
            }
            
            const result: Record<string, any> = {};
            for (const [key, value] of Object.entries(obj)) {
              result[key] = replaceVariablesInJson(value);
            }
            return result;
          };
          
          const previewJson = replaceVariablesInJson(jsonContent);
          
          return (
            <pre className="p-4 border rounded bg-white whitespace-pre-wrap">
              {JSON.stringify(previewJson, null, 2)}
            </pre>
          );
        } catch (e) {
          return (
            <div className="p-4 border rounded bg-red-50 text-red-500">
              Invalid JSON format: {String(e)}
            </div>
          );
        }
      }
      
      return (
        <div className="p-4 border rounded bg-gray-50">
          Preview not available for this format.
        </div>
      );
    } catch (e) {
      return (
        <div className="p-4 border rounded bg-red-50 text-red-500">
          Error rendering preview: {String(e)}
        </div>
      );
    }
  };

  return (
    <Paper className="p-6">
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" className="mb-2">Template Information</Typography>
            <Divider className="mb-4" />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Template Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Description"
              fullWidth
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!formErrors.type} required>
              <InputLabel id="type-label">Template Type</InputLabel>
              <Select
                labelId="type-label"
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value as string;
                  const filteredFormats = templateFormats.filter(format => 
                    format.types.includes(newType)
                  );
                  
                  // If current format is not valid for new type, reset it
                  const newFormat = filteredFormats.some(f => f.value === formData.format)
                    ? formData.format
                    : filteredFormats[0]?.value || '';
                  
                  setFormData({ 
                    ...formData, 
                    type: newType,
                    format: newFormat
                  });
                }}
              >
                {templateTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.type && <FormHelperText>{formErrors.type}</FormHelperText>}
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!formErrors.format} required>
              <InputLabel id="format-label">Template Format</InputLabel>
              <Select
                labelId="format-label"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value as string })}
              >
                {getFilteredFormats().map((format) => (
                  <MenuItem key={format.value} value={format.value}>
                    {format.label}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.format && <FormHelperText>{formErrors.format}</FormHelperText>}
            </FormControl>
          </Grid>
          
          {formData.type === 'email' && (
            <Grid item xs={12}>
              <TextField
                label="Email Subject"
                fullWidth
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                error={!!formErrors.subject}
                helperText={formErrors.subject}
                required
              />
            </Grid>
          )}
          
          {/* Variables */}
          <Grid item xs={12}>
            <div className="flex justify-between items-center mb-2">
              <Typography variant="h6">Template Variables</Typography>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleAddVariable}
              >
                Add Variable
              </Button>
            </div>
            <Divider className="mb-4" />
            
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.variables && formData.variables.length > 0 ? (
                formData.variables.map((variable) => (
                  <Chip 
                    key={variable} 
                    label={variable} 
                    onDelete={() => handleRemoveVariable(variable)} 
                  />
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No variables defined. Click "Add Variable" to add one.
                </Typography>
              )}
            </div>
            
            <Typography variant="body2" color="textSecondary">
              Use variables in your template by surrounding them with double curly braces, e.g., {'{{userName}}'}.
            </Typography>
          </Grid>
          
          {/* Template Content */}
          <Grid item xs={12}>
            <Typography variant="h6" className="mb-2">Template Content</Typography>
            <Divider className="mb-4" />
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange} 
                aria-label="template editor tabs"
              >
                <Tab 
                  icon={<CodeIcon className="h-5 w-5" />} 
                  iconPosition="start" 
                  label="Editor" 
                  {...a11yProps(0)} 
                />
                <Tab 
                  icon={<EyeIcon className="h-5 w-5" />} 
                  iconPosition="start" 
                  label="Preview" 
                  {...a11yProps(1)} 
                />
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              <TextField
                label="Template Content"
                fullWidth
                multiline
                rows={12}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                error={!!formErrors.content}
                helperText={formErrors.content}
                required
                placeholder={
                  formData.format === 'html' 
                    ? '<h1>Hello {{userName}}</h1><p>Welcome to our platform!</p>' 
                    : formData.format === 'json'
                    ? '{\n  "title": "Welcome",\n  "message": "Hello {{userName}}",\n  "actionUrl": "/dashboard"\n}'
                    : 'Hello {{userName}},\n\nWelcome to our platform!'
                }
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              {renderPreview()}
            </TabPanel>
          </Grid>
          
          {/* Submit Button */}
          <Grid item xs={12} className="mt-4">
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon className="h-5 w-5" />}
            >
              {loading ? 'Saving...' : 'Save Template'}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default NotificationTemplateEditor;
