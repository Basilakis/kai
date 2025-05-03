import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Language as LanguageIcon
} from '@mui/icons-material';
import { LanguageCode, PropertyNameTranslation, PropertyValueTranslation } from '@kai/shared/src/types/multilingual-dictionaries';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`multilingual-tabpanel-${index}`}
      aria-labelledby={`multilingual-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Main component
const MultilingualDictionaryManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [languages, setLanguages] = useState<LanguageCode[]>([]);
  const [propertyNameTranslations, setPropertyNameTranslations] = useState<PropertyNameTranslation[]>([]);
  const [propertyValueTranslations, setPropertyValueTranslations] = useState<PropertyValueTranslation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [propertyNameFilter, setPropertyNameFilter] = useState<string>('');
  const [propertyValueFilter, setPropertyValueFilter] = useState<string>('');

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Fetch languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/multilingual/languages');

        if (!response.ok) {
          throw new Error('Failed to fetch languages');
        }

        const data = await response.json();

        if (data.success && data.languages) {
          setLanguages(data.languages);
          if (data.languages.length > 0 && !selectedLanguage) {
            setSelectedLanguage(data.languages[0].code);
          }
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  // Fetch property name translations
  const fetchPropertyNameTranslations = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/multilingual/property-names';
      const params = new URLSearchParams();

      if (selectedLanguage) {
        params.append('languageCode', selectedLanguage);
      }

      if (propertyNameFilter) {
        params.append('propertyName', propertyNameFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch property name translations');
      }

      const data = await response.json();

      if (data.success && data.translations) {
        setPropertyNameTranslations(data.translations);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch property value translations
  const fetchPropertyValueTranslations = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/multilingual/property-values';
      const params = new URLSearchParams();

      if (selectedLanguage) {
        params.append('languageCode', selectedLanguage);
      }

      if (propertyNameFilter) {
        params.append('propertyName', propertyNameFilter);
      }

      if (propertyValueFilter) {
        params.append('propertyValue', propertyValueFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch property value translations');
      }

      const data = await response.json();

      if (data.success && data.translations) {
        setPropertyValueTranslations(data.translations);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch translations when tab or filters change
  useEffect(() => {
    if (activeTab === 0 && selectedLanguage) {
      fetchPropertyNameTranslations();
    } else if (activeTab === 1 && selectedLanguage) {
      fetchPropertyValueTranslations();
    }
  }, [activeTab, selectedLanguage, propertyNameFilter, propertyValueFilter]);

  // Create property name translation
  const createPropertyNameTranslation = async (data: {
    propertyName: string;
    translation: string;
    description?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/multilingual/property-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyName: data.propertyName,
          languageCode: selectedLanguage,
          translation: data.translation,
          description: data.description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create property name translation');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Refresh the list
        fetchPropertyNameTranslations();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Update property name translation
  const updatePropertyNameTranslation = async (id: string, data: {
    translation: string;
    description?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/multilingual/property-names/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to update property name translation');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Refresh the list
        fetchPropertyNameTranslations();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Delete property name translation
  const deletePropertyNameTranslation = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/multilingual/property-names/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete property name translation');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Refresh the list
        fetchPropertyNameTranslations();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Create property value translation
  const createPropertyValueTranslation = async (data: {
    propertyName: string;
    propertyValue: string;
    translation: string;
    description?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/multilingual/property-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyName: data.propertyName,
          propertyValue: data.propertyValue,
          languageCode: selectedLanguage,
          translation: data.translation,
          description: data.description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create property value translation');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Refresh the list
        fetchPropertyValueTranslations();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Update property value translation
  const updatePropertyValueTranslation = async (id: string, data: {
    translation: string;
    description?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/multilingual/property-values/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to update property value translation');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Refresh the list
        fetchPropertyValueTranslations();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Delete property value translation
  const deletePropertyValueTranslation = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/multilingual/property-values/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete property value translation');
      }

      const responseData = await response.json();

      if (responseData.success) {
        // Refresh the list
        fetchPropertyValueTranslations();
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Multilingual Property Dictionaries
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Property Names" />
          <Tab label="Property Values" />
        </Tabs>

        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                fullWidth
                size="small"
              >
                {languages.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.nativeName || lang.name} ({lang.code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                label="Property Name"
                value={propertyNameFilter}
                onChange={(e) => setPropertyNameFilter(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>

            {activeTab === 1 && (
              <Grid item xs={12} md={3}>
                <TextField
                  label="Property Value"
                  value={propertyValueFilter}
                  onChange={(e) => setPropertyValueFilter(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
            )}

            <Grid item>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={activeTab === 0 ? fetchPropertyNameTranslations : fetchPropertyValueTranslations}
              >
                Refresh
              </Button>
            </Grid>

            <Grid item>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                color="primary"
              >
                Add Translation
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TabPanel value={activeTab} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : propertyNameTranslations.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No property name translations found.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {propertyNameTranslations.map((translation) => (
              <Grid item xs={12} md={6} lg={4} key={translation.id}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {translation.propertyName}
                    </Typography>
                    <Box>
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Typography variant="body1">
                    {translation.translation}
                  </Typography>

                  {translation.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {translation.description}
                    </Typography>
                  )}

                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <LanguageIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">
                      {languages.find(lang => lang.code === translation.languageCode)?.name || translation.languageCode}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : propertyValueTranslations.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No property value translations found.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {propertyValueTranslations.map((translation) => (
              <Grid item xs={12} md={6} lg={4} key={translation.id}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {translation.propertyName}: {translation.propertyValue}
                    </Typography>
                    <Box>
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Typography variant="body1">
                    {translation.translation}
                  </Typography>

                  {translation.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {translation.description}
                    </Typography>
                  )}

                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <LanguageIcon fontSize="small" sx={{ mr: 0.5 }} />
                    <Typography variant="caption" color="text.secondary">
                      {languages.find(lang => lang.code === translation.languageCode)?.name || translation.languageCode}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>
    </Box>
  );
};