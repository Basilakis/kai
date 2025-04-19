/**
 * Consolidated React Type Declarations
 *
 * This file provides centralized TypeScript declarations for React,
 * replacing the previously duplicated definitions across multiple files:
 * - custom.d.ts
 * - react.d.ts
 * - @types/react/index.d.ts
 */

import 'react';

// We reference the original React types to ensure compatibility
/// <reference types="react" />

// Only add custom extensions that aren't covered by @types/react
declare module 'react' {
  // Add any custom React extensions here that aren't covered by @types/react
  
  // Example: If we needed to extend ComponentProps
  // interface ComponentProps<T extends React.ElementType> {
  //   customProp?: string;
  // }
}

// Define custom interfaces or types specific to this project
interface ServiceResponse {
  status: 'up' | 'down' | 'degraded';
  lastCheck: string;
  [key: string]: any;
}

// Export types to make them available
export { ServiceResponse };