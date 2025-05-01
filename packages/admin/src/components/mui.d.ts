// Type declarations for the mui.ts barrel file
import React from 'react';

/**
 * This file provides type declarations for the mui.ts barrel file
 * It ensures TypeScript recognizes the components when imported from the barrel file
 * For example: import { Box, Button } from './mui';
 */

declare module './mui' {
  // Re-export all components from @mui/material
  export * from '@mui/material';
  
  // Re-export useTheme and alpha from @mui/material/styles
  export { useTheme, alpha } from '@mui/material/styles';
  
  // Components that are individually imported and re-exported
  export const Container: React.ComponentType<any>;
  export const FormHelperText: React.ComponentType<any>;
  export const Radio: React.ComponentType<any>;
  export const RadioGroup: React.ComponentType<any>;
  export const Step: React.ComponentType<any>;
  export const StepLabel: React.ComponentType<any>;
  export const Stepper: React.ComponentType<any>;
  export const FormGroup: React.ComponentType<any>;
  export const Menu: React.ComponentType<any>;
  export const ListItemIcon: React.ComponentType<any>;
  export const ListItemText: React.ComponentType<any>;
  export const Breadcrumbs: React.ComponentType<any>;
  export const Link: React.ComponentType<any>;
  export const List: React.ComponentType<any>;
  export const ListItem: React.ComponentType<any>;
  export const ListItemButton: React.ComponentType<any>;
  
  // Re-export types
  export type { Theme } from '@mui/material/styles';
  export type { SxProps } from '@mui/system';
  
  // Components used in KnowledgeBaseDashboard.tsx
  export const Box: React.ComponentType<any>;
  export const Button: React.ComponentType<any>;
  export const Card: React.ComponentType<any>;
  export const CardContent: React.ComponentType<any>;
  export const CircularProgress: React.ComponentType<any>;
  export const Dialog: React.ComponentType<any>;
  export const DialogActions: React.ComponentType<any>;
  export const DialogContent: React.ComponentType<any>;
  export const DialogContentText: React.ComponentType<any>;
  export const DialogTitle: React.ComponentType<any>;
  export const Divider: React.ComponentType<any>;
  export const Grid: React.ComponentType<any>;
  export const IconButton: React.ComponentType<any>;
  export const LinearProgress: React.ComponentType<any>;
  export const Paper: React.ComponentType<any>;
  export const Tab: React.ComponentType<any>;
  export const Tabs: React.ComponentType<any>;
  export const TextField: React.ComponentType<any>;
  export const Typography: React.ComponentType<any>;
  export const FormControl: React.ComponentType<any>;
  export const FormControlLabel: React.ComponentType<any>;
  export const Switch: React.ComponentType<any>;
  export const Chip: React.ComponentType<any>;
  export const MenuItem: React.ComponentType<any>;
  export const Select: React.ComponentType<any>;
  export const InputLabel: React.ComponentType<any>;
  export const Tooltip: React.ComponentType<any>;
  export const Alert: React.ComponentType<any>;
  export const AlertTitle: React.ComponentType<any>;
}
