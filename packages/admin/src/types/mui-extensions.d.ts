/**
 * Type declarations for MUI component libraries that are missing TypeScript definitions
 */

// MUI Material Component Types
declare module '@mui/material' {
  export const Tabs: any;
  export const Tab: any;
  export const Alert: any;
  export const CircularProgress: any;
  export const TablePagination: any;
  export const Tooltip: any;
  export const Snackbar: any;
}

// MUI Icon Types
declare module '@mui/icons-material/AddCircle' {
  const AddCircleIcon: React.ComponentType<any>;
  export default AddCircleIcon;
}

declare module '@mui/icons-material/Delete' {
  const DeleteIcon: React.ComponentType<any>;
  export default DeleteIcon;
}

declare module '@mui/icons-material/Edit' {
  const EditIcon: React.ComponentType<any>;
  export default EditIcon;
}

declare module '@mui/icons-material/PlayArrow' {
  const PlayArrowIcon: React.ComponentType<any>;
  export default PlayArrowIcon;
}

declare module '@mui/icons-material/Storage' {
  const StorageIcon: React.ComponentType<any>;
  export default StorageIcon;
}

declare module '@mui/icons-material/Memory' {
  const MemoryIcon: React.ComponentType<any>;
  export default MemoryIcon;
}

declare module '@mui/icons-material/School' {
  const SchoolIcon: React.ComponentType<any>;
  export default SchoolIcon;
}

// JSX Intrinsic Elements
declare namespace JSX {
  interface IntrinsicElements {
    // Explicitly define HTML elements used in our components
    strong: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    // Generic fallback for other elements
    [elemName: string]: any;
  }
}

// React SyntheticEvent
declare namespace React {
  interface SyntheticEvent<T = Element, E = Event> extends BaseSyntheticEvent<E, EventTarget & T, EventTarget> {}
  interface BaseSyntheticEvent<E = object, C = any, T = any> {
    nativeEvent: E;
    currentTarget: C;
    target: T;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    preventDefault(): void;
    isDefaultPrevented(): boolean;
    stopPropagation(): void;
    isPropagationStopped(): boolean;
    persist(): void;
    timeStamp: number;
    type: string;
  }
}
// Type declarations for @mui/x-date-pickers
declare module '@mui/x-date-pickers/DatePicker' {
  import { ComponentType, ReactNode } from 'react';
  
  export interface DatePickerProps {
    label?: string;
    value: Date | null;
    onChange: (date: Date | null) => void;
    minDate?: Date;
    maxDate?: Date;
    slotProps?: {
      textField?: {
        fullWidth?: boolean;
        [key: string]: any;
      };
      [key: string]: any;
    };
    [key: string]: any;
  }
  
  export const DatePicker: ComponentType<DatePickerProps>;
}

declare module '@mui/x-date-pickers/AdapterDateFns' {
  import { ComponentType } from 'react';
  
  export interface AdapterDateFnsProps {
    [key: string]: any;
  }
  
  export const AdapterDateFns: ComponentType<AdapterDateFnsProps>;
}

declare module '@mui/x-date-pickers/LocalizationProvider' {
  import { ComponentType, ReactNode } from 'react';
  
  export interface LocalizationProviderProps {
    dateAdapter: any;
    children: ReactNode;
  }
  
  export const LocalizationProvider: ComponentType<LocalizationProviderProps>;
}

// Type declarations for recharts
declare module 'recharts' {
  import { ComponentType, ReactNode } from 'react';
  
  export interface ChartProps {
    data?: any[];
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    children?: ReactNode;
    [key: string]: any;
  }
  
  export interface PieProps {
    data?: any[];
    dataKey?: string;
    cx?: string | number;
    cy?: string | number;
    outerRadius?: number;
    fill?: string;
    labelLine?: boolean;
    label?: ((props: any) => string) | boolean;
    children?: ReactNode;
    [key: string]: any;
  }
  
  export interface TooltipProps {
    formatter?: (value: any, name?: string, props?: any) => any;
    [key: string]: any;
  }
  
  export const BarChart: ComponentType<ChartProps>;
  export const Bar: ComponentType<any>;
  export const LineChart: ComponentType<ChartProps>;
  export const Line: ComponentType<any>;
  export const XAxis: ComponentType<any>;
  export const YAxis: ComponentType<any>;
  export const CartesianGrid: ComponentType<any>;
  export const Tooltip: ComponentType<TooltipProps>;
  export const Legend: ComponentType<any>;
  export const ResponsiveContainer: ComponentType<any>;
  export const PieChart: ComponentType<ChartProps>;
  export const Pie: ComponentType<PieProps>;
  export const Cell: ComponentType<any>;
}

// Type declarations for @mui/icons-material
declare module '@mui/icons-material/Search' {
  import { ComponentType } from 'react';
  const SearchIcon: ComponentType<any>;
  export default SearchIcon;
}

declare module '@mui/icons-material/TrendingUp' {
  import { ComponentType } from 'react';
  const TrendingUpIcon: ComponentType<any>;
  export default TrendingUpIcon;
}

declare module '@mui/icons-material/PieChart' {
  import { ComponentType } from 'react';
  const PieChartIcon: ComponentType<any>;
  export default PieChartIcon;
}

declare module '@mui/icons-material/History' {
  import { ComponentType } from 'react';
  const HistoryIcon: ComponentType<any>;
  export default HistoryIcon;
}

declare module '@mui/icons-material/Forum' {
  import { ComponentType } from 'react';
  const ForumIcon: ComponentType<any>;
  export default ForumIcon;
}

declare module '@mui/icons-material/Insights' {
  import { ComponentType } from 'react';
  const InsightsIcon: ComponentType<any>;
  export default InsightsIcon;
}