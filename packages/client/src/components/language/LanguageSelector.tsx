import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import { useLanguage } from '../../hooks/useLanguage';
import { LanguageCode } from '@kai/shared/src/types/multilingual-dictionaries';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'icon';
  size?: 'small' | 'medium';
  color?: 'primary' | 'secondary' | 'default';
}

/**
 * Language Selector Component
 * 
 * Allows users to select their preferred language.
 */
const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  size = 'small',
  color = 'primary'
}) => {
  const { language, setLanguage, availableLanguages, loading } = useLanguage();
  const [languages, setLanguages] = useState<LanguageCode[]>([]);

  useEffect(() => {
    if (availableLanguages.length > 0) {
      setLanguages(availableLanguages);
    }
  }, [availableLanguages]);

  const handleLanguageChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setLanguage(event.target.value as string);
  };

  const handleIconClick = () => {
    // Cycle through available languages
    if (languages.length > 0) {
      const currentIndex = languages.findIndex(lang => lang.code === language);
      const nextIndex = (currentIndex + 1) % languages.length;
      setLanguage(languages[nextIndex].code);
    }
  };

  if (loading || languages.length === 0) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <Tooltip title="Change language">
        <IconButton
          color={color}
          size={size}
          onClick={handleIconClick}
          aria-label="Change language"
        >
          <LanguageIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ minWidth: 120 }}>
      <FormControl fullWidth size={size}>
        <InputLabel id="language-select-label">Language</InputLabel>
        <Select
          labelId="language-select-label"
          id="language-select"
          value={language}
          label="Language"
          onChange={handleLanguageChange as any}
        >
          {languages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2">
                  {lang.nativeName || lang.name}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default LanguageSelector;
