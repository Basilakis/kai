/**
 * React JSX Runtime Type Declarations
 * 
 * This provides TypeScript declarations for React JSX runtime to ensure proper
 * type checking for JSX elements in shared components.
 */

import React from 'react';

declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface IntrinsicElements extends JSX.IntrinsicElements {}
  }
  
  export function jsx(
    type: React.ElementType,
    props: any,
    key?: string | number | null
  ): JSX.Element;
  
  export function jsxs(
    type: React.ElementType,
    props: any,
    key?: string | number | null
  ): JSX.Element;
}

declare module 'react' {
  // Ensure React namespace is available
  export = React;
  export as namespace React;
}