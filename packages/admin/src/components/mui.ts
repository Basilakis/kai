// Barrel file for Material UI components
// This file re-exports components from Material UI to provide a consistent import pattern

// Export all components from the main package
export * from '@mui/material';

// Re-export useTheme from the styles package
export { useTheme } from '@mui/material/styles';

// Export the alpha function for color manipulation
export { alpha } from '@mui/material/styles';

// Note: When adding new components that aren't directly exported from '@mui/material',
// add them as individual imports here

// Import and re-export components that may not be properly exported from the main package
// These components are causing TypeScript errors in various files
import Container from '@mui/material/Container';
import FormHelperText from '@mui/material/FormHelperText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import FormGroup from '@mui/material/FormGroup';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';

// Re-export the individually imported components
export {
  Container,
  FormHelperText,
  Radio,
  RadioGroup,
  Step,
  StepLabel,
  Stepper,
  FormGroup,
  Menu,
  ListItemIcon,
  ListItemText,
  Breadcrumbs,
  Link
};

// Re-export Theme type from @mui/material/styles
export type { Theme } from '@mui/material/styles';

// Re-export SxProps from @mui/system
export type { SxProps } from '@mui/system';