/**
 * React TypeScript Declarations
 * 
 * This file now references the consolidated React type declarations file
 * to avoid duplication across multiple declaration files.
 */

// Reference the consolidated React declarations
/// <reference path="./types/react-declarations.d.ts" />

// For backward compatibility, re-export types from the consolidated file
import { ServiceResponse } from './types/react-declarations';
export { ServiceResponse };