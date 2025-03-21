/**
 * HeroUI Theme Configuration
 * 
 * This file configures the HeroUI theme for the application.
 * It can be extended with custom colors, typography, and more as needed.
 */

// Default theme object for HeroUI
// In a real integration, this would use the actual HeroUI API
const heroUITheme = {
  // Base color palette
  colors: {
    primary: {
      main: '#5c6bc0', // Match existing theme color from gatsby-plugin-manifest
      light: '#8e99f3',
      dark: '#26418f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#26a69a',
      light: '#64d8cb',
      dark: '#00766c',
      contrastText: '#ffffff',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: '#ffffff',
    },
    info: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
      contrastText: '#ffffff',
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#ffffff',
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#9e9e9e',
    },
  },
  
  // Typography configuration
  typography: {
    fontFamily: '"Roboto", "Open Sans", sans-serif',
    fontSize: 16,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
    button: {
      textTransform: 'none',
    },
  },
  
  // Shape configuration
  shape: {
    borderRadius: 8,
  },
  
  // Spacing configuration
  spacing: 8,
  
  // Transitions
  transitions: {
    duration: {
      short: 200,
      standard: 300,
      complex: 500,
    },
  },
};

export default heroUITheme;