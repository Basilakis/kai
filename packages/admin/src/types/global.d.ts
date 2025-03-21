// Import React and ReactDOM types for extending JSX namespace
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

// Declare global types
declare global {
  // Extend existing namespaces
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
      li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
      // Add other HTML elements as needed
    }
  }

  // Utility types for props with event handlers
  interface ChangeEvent<T = Element> extends React.ChangeEvent<T> {}
  interface KeyboardEvent<T = Element> extends React.KeyboardEvent<T> {}
  interface MouseEvent<T = Element> extends React.MouseEvent<T> {}
  
  // Extend Material UI components with common props
  interface MaterialUIProps {
    sx?: SxProps<Theme>;
    className?: string;
    style?: React.CSSProperties;
  }

  // Common prop types for reuse
  interface CommonItemProps {
    key?: React.Key;
    id?: string;
  }
}

// Module declarations for any missing modules
declare module 'react' {
  interface CSSProperties {
    [key: string]: any;
  }
}

// Make sure TypeScript doesn't complain about importing this file
export {};