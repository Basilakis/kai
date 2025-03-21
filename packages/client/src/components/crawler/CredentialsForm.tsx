import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Collapse,
  SelectChangeEvent
} from '@mui/material';
import { Check as CheckIcon, Error as ErrorIcon } from '@mui/icons-material';

// Available crawler providers
const PROVIDERS = ['jina', 'firecrawl'] as const;
type Provider = typeof PROVIDERS[number];

// Field definition type
interface ProviderField {
  name: string;
  label: string;
  required: boolean;
  type: string;
}

// Provider information
type ProviderInfoType = {
  [key in Provider]: {
    name: string;
    description: string;
    website: string;
    fields: ProviderField[];
  }
};

const PROVIDER_INFO: ProviderInfoType = {
  jina: {
    name: 'JinaAI',
    description: 'Advanced ML-powered web crawler with intelligent content extraction',
    website: 'https://jina.ai',
    fields: [
      { name: 'apiKey', label: 'API Key', required: true, type: 'password' },
      { name: 'organization', label: 'Organization ID', required: false, type: 'text' }
    ]
  },
  firecrawl: {
    name: 'Firecrawl',
    description: 'High-performance web crawler optimized for scale and speed',
    website: 'https://firecrawl.io',
    fields: [
      { name: 'apiKey', label: 'API Key', required: true, type: 'password' },
      { name: 'region', label: 'API Region', required: false, type: 'text' }
    ]
  }
};

// Credential status type
interface CredentialStatus {
  hasCredentials: boolean;
  isValid?: boolean;
  lastTested?: number;
}

// Props for the credentials form
interface CredentialsFormProps {
  onSave?: (provider: Provider, credentials: Record<string, string>) => Promise<boolean>;
  onTest?: (provider: Provider) => Promise<boolean>;
  onGetStatus?: () => Promise<Record<Provider, CredentialStatus>>;
}

/**
 * Crawler API Credentials Management Form
 */
export const CrawlerCredentialsForm: React.FC<CredentialsFormProps> = ({
  onSave,
  onTest,
  onGetStatus
}) => {
  // Selected provider
  const [provider, setProvider] = useState<Provider>('jina');
  
  // Form values
  const [values, setValues] = useState<Record<string, string>>({});
  
  // Form state
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Provider status
  const [status, setStatus] = useState<Record<Provider, CredentialStatus>>({
    jina: { hasCredentials: false },
    firecrawl: { hasCredentials: false }
  });
  
  // Load initial status
  useEffect(() => {
    const loadStatus = async () => {
      if (onGetStatus) {
        try {
          const currentStatus = await onGetStatus();
          setStatus(currentStatus);
        } catch (err) {
          console.error('Failed to load credential status', err);
        }
      }
    };
    
    loadStatus();
  }, [onGetStatus]);
  
  // Handle provider change
  const handleProviderChange = (event: SelectChangeEvent) => {
    setProvider(event.target.value as Provider);
    setValues({});
    setError(null);
    setSuccess(null);
  };
  
  // Handle input change
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((prev: Record<string, string>) => ({ ...prev, [name]: value }));
  };
  
  // Handle save
  const handleSave = async () => {
    if (!onSave) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Ensure all required fields are provided
      const missingFields = PROVIDER_INFO[provider].fields
        .filter((field: ProviderField) => field.required && !values[field.name])
        .map((field: ProviderField) => field.label);
      
      if (missingFields.length > 0) {
        setError(`Missing required fields: ${missingFields.join(', ')}`);
        return;
      }
      
      // Save credentials
      const saved = await onSave(provider, values);
      
      if (saved) {
        setSuccess(`${PROVIDER_INFO[provider].name} credentials saved successfully`);
        
        // Update status
        if (onGetStatus) {
          const currentStatus = await onGetStatus();
          setStatus(currentStatus);
        }
      } else {
        setError('Failed to save credentials');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle test
  const handleTest = async () => {
    if (!onTest) return;
    
    setTesting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Test credentials
      const valid = await onTest(provider);
      
      if (valid) {
        setSuccess(`${PROVIDER_INFO[provider].name} credentials are valid`);
        
        // Update status
        if (onGetStatus) {
          const currentStatus = await onGetStatus();
          setStatus(currentStatus);
        }
      } else {
        setError(`${PROVIDER_INFO[provider].name} credentials are invalid`);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader 
        title="Crawler API Credentials" 
        subheader="Configure API keys for web crawling services"
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          {/* Error/Success Messages */}
          <Grid item xs={12}>
            <Collapse in={!!error}>
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </Collapse>
            <Collapse in={!!success}>
              <Alert severity="success" onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            </Collapse>
          </Grid>
          
          {/* Provider Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                value={provider}
                onChange={handleProviderChange}
                label="Provider"
              >
                {PROVIDERS.map(p => (
                  <MenuItem key={p} value={p}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span>{PROVIDER_INFO[p].name}</span>
                      {status[p].hasCredentials && (
                        <Box 
                          component="span" 
                          sx={{ 
                            ml: 2, 
                            display: 'flex', 
                            alignItems: 'center',
                            color: status[p].isValid ? 'success.main' : (
                              status[p].isValid === false ? 'error.main' : 'text.secondary'
                            )
                          }}
                        >
                          {status[p].isValid === true && <CheckIcon fontSize="small" sx={{ mr: 0.5 }} />}
                          {status[p].isValid === false && <ErrorIcon fontSize="small" sx={{ mr: 0.5 }} />}
                          {status[p].isValid === true && 'Valid'}
                          {status[p].isValid === false && 'Invalid'}
                          {status[p].isValid === undefined && 'Configured'}
                        </Box>
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {PROVIDER_INFO[provider].description}
              </FormHelperText>
            </FormControl>
          </Grid>
          
          {/* Provider Fields */}
          {PROVIDER_INFO[provider].fields.map((field: ProviderField) => (
            <Grid item xs={12} key={field.name}>
              <TextField
                fullWidth
                name={field.name}
                label={field.label}
                type={field.type}
                value={values[field.name] || ''}
                onChange={handleInputChange}
                required={field.required}
                autoComplete="off"
              />
            </Grid>
          ))}
          
          {/* Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : undefined}
              >
                {loading ? 'Saving...' : 'Save Credentials'}
              </Button>
              
              {status[provider].hasCredentials && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleTest}
                  disabled={testing}
                  startIcon={testing ? <CircularProgress size={20} /> : undefined}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
              )}
            </Box>
          </Grid>
          
          {/* Status Information */}
          {status[provider].hasCredentials && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                {status[provider].lastTested ? (
                  <>
                    Last tested: {new Date(status[provider].lastTested).toLocaleString()}
                    {status[provider].isValid !== undefined && (
                      <Box component="span" sx={{ ml: 1, color: status[provider].isValid ? 'success.main' : 'error.main' }}>
                        ({status[provider].isValid ? 'Valid' : 'Invalid'})
                      </Box>
                    )}
                  </>
                ) : 'Credentials have not been tested yet'}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default CrawlerCredentialsForm;