/**
 * Custom TypeScript Declarations
 * 
 * This file now references the consolidated React type declarations file
 * to avoid duplication across multiple declaration files.
 */

// Reference the consolidated React declarations
/// <reference path="./types/react-declarations.d.ts" />

// Any project-specific declarations that aren't related to React
// should be placed here

// For backward compatibility
import { ServiceResponse } from './types/react-declarations';
export { ServiceResponse };