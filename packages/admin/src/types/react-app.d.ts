/// <reference types="react" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      span: any;
      p: any;
      br: any;
      a: any;
      button: any;
      input: any;
      label: any;
      select: any;
      option: any;
      table: any;
      thead: any;
      tbody: any;
      tr: any;
      td: any;
      th: any;
      [elemName: string]: any;
    }
  }
}

declare module 'react' {

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void;
  export type ChangeEvent<T = Element> = {
    target: T;
    currentTarget: T;
  };
  export type MouseEvent<T = Element> = {
    target: T;
    currentTarget: T;
  };
}

declare module '@mui/material' {
  export interface SelectChangeEvent {
    target: {
      value: any;
      name?: string;
    };
  }

  export const Box: React.FC<any>;
  export const Button: React.FC<any>;
  export const Card: React.FC<any>;
  export const CardContent: React.FC<any>;
  export const Chip: React.FC<any>;
  export const Dialog: React.FC<any>;
  export const DialogActions: React.FC<any>;
  export const DialogContent: React.FC<any>;
  export const DialogTitle: React.FC<any>;
  export const Grid: React.FC<any>;
  export const IconButton: React.FC<any>;
  export const Paper: React.FC<any>;
  export const TextField: React.FC<any>;
  export const Typography: React.FC<any>;
  export const FormControl: React.FC<any>;
  export const InputLabel: React.FC<any>;
  export const Select: React.FC<any>;
  export const MenuItem: React.FC<any>;
  export const Switch: React.FC<any>;
  export const FormControlLabel: React.FC<any>;
  export const Table: React.FC<any>;
  export const TableBody: React.FC<any>;
  export const TableCell: React.FC<any>;
  export const TableContainer: React.FC<any>;
  export const TableHead: React.FC<any>;
  export const TableRow: React.FC<any>;
}

declare module '@mui/icons-material' {
  export const Add: React.FC<any>;
  export const Edit: React.FC<any>;
  export const Delete: React.FC<any>;
  export const Refresh: React.FC<any>;
  export const Sync: React.FC<any>;
  export const Schedule: React.FC<any>;
}