import React from 'react';
import { Typography, Box, Tooltip, Chip } from '@mui/material';
import { useLanguage } from '../../hooks/useLanguage';

interface MultilingualPropertyDisplayProps {
  propertyName: string;
  propertyValue: string;
  variant?: 'text' | 'chip' | 'label';
  showOriginal?: boolean;
  size?: 'small' | 'medium';
}

/**
 * Multilingual Property Display Component
 * 
 * Displays a property name and value in the user's selected language.
 */
const MultilingualPropertyDisplay: React.FC<MultilingualPropertyDisplayProps> = ({
  propertyName,
  propertyValue,
  variant = 'text',
  showOriginal = false,
  size = 'medium'
}) => {
  const { language, translatePropertyName, translatePropertyValue } = useLanguage();

  const translatedName = translatePropertyName(propertyName);
  const translatedValue = translatePropertyValue(propertyName, propertyValue);

  // If no translation is available or language is English, just show the original
  const nameChanged = translatedName !== propertyName;
  const valueChanged = translatedValue !== propertyValue;
  const isTranslated = nameChanged || valueChanged;

  if (variant === 'chip') {
    return (
      <Tooltip 
        title={showOriginal && isTranslated ? `${propertyName}: ${propertyValue}` : ''}
        arrow
      >
        <Chip
          label={`${translatedName}: ${translatedValue}`}
          size={size}
          color={isTranslated ? 'primary' : 'default'}
        />
      </Tooltip>
    );
  }

  if (variant === 'label') {
    return (
      <Box>
        <Typography 
          variant={size === 'small' ? 'caption' : 'body2'} 
          color="text.secondary"
          component="span"
        >
          {translatedName}:
        </Typography>{' '}
        <Typography 
          variant={size === 'small' ? 'body2' : 'body1'} 
          component="span"
          fontWeight="medium"
        >
          {translatedValue}
        </Typography>
        
        {showOriginal && isTranslated && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Original: {propertyName}: {propertyValue}
          </Typography>
        )}
      </Box>
    );
  }

  // Default text variant
  return (
    <Box>
      <Typography variant={size === 'small' ? 'body2' : 'body1'}>
        {translatedName}: {translatedValue}
      </Typography>
      
      {showOriginal && isTranslated && (
        <Typography variant="caption" color="text.secondary">
          Original: {propertyName}: {propertyValue}
        </Typography>
      )}
    </Box>
  );
};

export default MultilingualPropertyDisplay;
