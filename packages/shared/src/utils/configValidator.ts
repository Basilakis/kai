/**
 * Configuration Validator
 * 
 * This utility validates configuration values and environment variables
 * to ensure all required values are present and properly formatted.
 */

import { logger } from './logger';

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  missingVars: string[];
  invalidVars: Array<{ name: string; reason: string }>;
  message: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  throwOnError?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'none';
}

/**
 * Validate required environment variables
 * 
 * @param requiredVars Array of required environment variable names
 * @param options Validation options
 * @returns Validation result
 */
export function validateEnvVars(
  requiredVars: string[],
  options: ValidationOptions = { throwOnError: false, logLevel: 'error' }
): ValidationResult {
  const missingVars: string[] = [];
  const invalidVars: Array<{ name: string; reason: string }> = [];
  
  // Check for missing variables
  for (const varName of requiredVars) {
    const value = process.env[varName];
    
    if (value === undefined || value === '') {
      missingVars.push(varName);
    }
  }
  
  // Build result
  const isValid = missingVars.length === 0 && invalidVars.length === 0;
  let message = isValid 
    ? 'All required environment variables are present'
    : `Missing required environment variables: ${missingVars.join(', ')}`;
    
  if (invalidVars.length > 0) {
    message += `\nInvalid environment variables: ${invalidVars.map(v => `${v.name} (${v.reason})`).join(', ')}`;
  }
  
  // Log result if needed
  if (options.logLevel !== 'none') {
    if (!isValid) {
      if (options.logLevel === 'error') {
        logger.error(message);
      } else if (options.logLevel === 'warn') {
        logger.warn(message);
      } else {
        logger.info(message);
      }
    } else {
      logger.debug('Environment validation successful');
    }
  }
  
  // Throw error if configured to do so
  if (!isValid && options.throwOnError) {
    throw new Error(message);
  }
  
  return {
    isValid,
    missingVars,
    invalidVars,
    message
  };
}

/**
 * Validate Supabase configuration
 * 
 * @param options Validation options
 * @returns Validation result
 */
export function validateSupabaseConfig(
  options: ValidationOptions = { throwOnError: false, logLevel: 'error' }
): ValidationResult {
  // Define required variables for Supabase
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY'
  ];
  
  // Check for alternative environment variable patterns
  const alternativePatterns = {
    'SUPABASE_URL': ['GATSBY_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    'SUPABASE_KEY': ['GATSBY_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']
  };
  
  // First check for the standard variables
  const result = validateEnvVars(requiredVars, { ...options, logLevel: 'none' });
  
  // If any are missing, check for alternatives
  if (result.missingVars.length > 0) {
    const stillMissing: string[] = [];
    
    for (const missingVar of result.missingVars) {
      const alternatives = alternativePatterns[missingVar as keyof typeof alternativePatterns] || [];
      const hasAlternative = alternatives.some(alt => process.env[alt] !== undefined && process.env[alt] !== '');
      
      if (!hasAlternative) {
        stillMissing.push(`${missingVar} (or alternatives: ${alternatives.join(', ')})`);
      }
    }
    
    result.missingVars = stillMissing;
    result.isValid = stillMissing.length === 0 && result.invalidVars.length === 0;
    
    if (stillMissing.length > 0) {
      result.message = `Missing required Supabase configuration: ${stillMissing.join(', ')}`;
    } else {
      result.message = 'Supabase configuration is valid (using alternative environment variables)';
    }
  }
  
  // Log result if needed
  if (options.logLevel !== 'none') {
    if (!result.isValid) {
      if (options.logLevel === 'error') {
        logger.error(result.message);
      } else if (options.logLevel === 'warn') {
        logger.warn(result.message);
      } else {
        logger.info(result.message);
      }
    } else {
      logger.debug('Supabase configuration validation successful');
    }
  }
  
  // Throw error if configured to do so
  if (!result.isValid && options.throwOnError) {
    throw new Error(result.message);
  }
  
  return result;
}

/**
 * Validate all required configuration for the application
 * 
 * @param options Validation options
 * @returns Validation result
 */
export function validateAllConfig(
  options: ValidationOptions = { throwOnError: false, logLevel: 'error' }
): ValidationResult {
  // Validate Supabase configuration
  const supabaseResult = validateSupabaseConfig({ ...options, logLevel: 'none' });
  
  // Add more validation for other services as needed
  // const otherResult = validateOtherConfig({ ...options, logLevel: 'none' });
  
  // Combine results
  const isValid = supabaseResult.isValid; // && otherResult.isValid;
  const missingVars = [...supabaseResult.missingVars]; // ...otherResult.missingVars
  const invalidVars = [...supabaseResult.invalidVars]; // ...otherResult.invalidVars
  
  // Build message
  let message = isValid 
    ? 'All configuration is valid'
    : 'Configuration validation failed';
    
  if (missingVars.length > 0) {
    message += `\nMissing variables: ${missingVars.join(', ')}`;
  }
  
  if (invalidVars.length > 0) {
    message += `\nInvalid variables: ${invalidVars.map(v => `${v.name} (${v.reason})`).join(', ')}`;
  }
  
  // Log result if needed
  if (options.logLevel !== 'none') {
    if (!isValid) {
      if (options.logLevel === 'error') {
        logger.error(message);
      } else if (options.logLevel === 'warn') {
        logger.warn(message);
      } else {
        logger.info(message);
      }
    } else {
      logger.info('Configuration validation successful');
    }
  }
  
  // Throw error if configured to do so
  if (!isValid && options.throwOnError) {
    throw new Error(message);
  }
  
  return {
    isValid,
    missingVars,
    invalidVars,
    message
  };
}

export default {
  validateEnvVars,
  validateSupabaseConfig,
  validateAllConfig
};
