// Type declarations for Material UI icons
import React from 'react';

// This file provides type declarations for the @mui/icons-material package
// It allows TypeScript to recognize the icons when imported from the main module
// For example: import { Refresh } from '@mui/icons-material';

declare module '@mui/icons-material' {
  export const Refresh: React.ComponentType<any>;
  export const Cancel: React.ComponentType<any>;
  export const Replay: React.ComponentType<any>;
  export const GetApp: React.ComponentType<any>;
  export const ExpandMore: React.ComponentType<any>;
  export const ExpandLess: React.ComponentType<any>;
  export const Code: React.ComponentType<any>;
  export const Visibility: React.ComponentType<any>;
}

// Type declarations for individual icon modules
declare module '@mui/icons-material/Refresh' {
  const RefreshIcon: React.ComponentType<any>;
  export default RefreshIcon;
}

declare module '@mui/icons-material/Cancel' {
  const CancelIcon: React.ComponentType<any>;
  export default CancelIcon;
}

declare module '@mui/icons-material/Replay' {
  const ReplayIcon: React.ComponentType<any>;
  export default ReplayIcon;
}

declare module '@mui/icons-material/GetApp' {
  const DownloadIcon: React.ComponentType<any>;
  export default DownloadIcon;
}

declare module '@mui/icons-material/ExpandMore' {
  const ExpandMoreIcon: React.ComponentType<any>;
  export default ExpandMoreIcon;
}

declare module '@mui/icons-material/ExpandLess' {
  const ExpandLessIcon: React.ComponentType<any>;
  export default ExpandLessIcon;
}

declare module '@mui/icons-material/Code' {
  const CodeIcon: React.ComponentType<any>;
  export default CodeIcon;
}

declare module '@mui/icons-material/Visibility' {
  const VisibilityIcon: React.ComponentType<any>;
  export default VisibilityIcon;
}
