import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Divider, 
  CircularProgress,
  Alert
} from '@mui/material';
import { useLanguage } from '../../hooks/useLanguage';
import MultilingualPropertyDisplay from './MultilingualPropertyDisplay';
import { MultilingualMaterialProperties as MultilingualMaterialPropertiesType } from '@kai/shared/src/types/multilingual-dictionaries';

interface MultilingualMaterialPropertiesProps {
  materialId: string;
  properties: Record<string, string>;
  showOriginal?: boolean;
}

/**
 * Multilingual Material Properties Component
 * 
 * Displays all properties of a material in the user's selected language.
 */
const MultilingualMaterialProperties: React.FC<MultilingualMaterialPropertiesProps> = ({
  materialId,
  properties,
  showOriginal = false
}) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [multilingualProperties, setMultilingualProperties] = useState<MultilingualMaterialPropertiesType | null>(null);

  useEffect(() => {
    const fetchMultilingualProperties = async () => {
      // Skip if language is English
      if (language === 'en') {
        setMultilingualProperties(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/multilingual/material-properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            materialId,
            properties,
            languages: [language]
          })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch multilingual properties');
        }

        const data = await response.json();

        if (data.success && data.multilingualProperties) {
          setMultilingualProperties(data.multilingualProperties);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setMultilingualProperties(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMultilingualProperties();
  }, [materialId, properties, language]);

  // If language is English or no translations available, render properties directly
  if (language === 'en' || (!loading && !multilingualProperties)) {
    return (
      <Box>
        <Grid container spacing={2}>
          {Object.entries(properties).map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <MultilingualPropertyDisplay
                propertyName={key}
                propertyValue={value}
                variant="label"
                showOriginal={false}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading translations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {error} - Showing original properties.
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {Object.entries(properties).map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <MultilingualPropertyDisplay
                propertyName={key}
                propertyValue={value}
                variant="label"
                showOriginal={false}
              />
            </Grid>
          ))}
        </Grid>
      </Alert>
    );
  }

  // Render translated properties
  return (
    <Box>
      <Grid container spacing={2}>
        {Object.entries(properties).map(([key, value]) => {
          // Get translated property name and value
          const translatedName = multilingualProperties?.translations[language]?.[`${key}_name`] || key;
          const translatedValue = multilingualProperties?.translations[language]?.[key] || value;
          
          return (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Box>
                <Typography variant="body2" color="text.secondary" component="span">
                  {translatedName}:
                </Typography>{' '}
                <Typography variant="body1" component="span" fontWeight="medium">
                  {translatedValue}
                </Typography>
                
                {showOriginal && (translatedName !== key || translatedValue !== value) && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Original: {key}: {value}
                  </Typography>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default MultilingualMaterialProperties;
