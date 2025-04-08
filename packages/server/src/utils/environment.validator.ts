/**
 * Environment Variable Validator
 * 
 * This utility validates required environment variables at startup
 * to prevent runtime errors due to missing or invalid configuration.
 */

import { logger } from './logger';

/**
 * Environment variable requirement level
 */
export enum RequirementLevel {
  REQUIRED = 'required',
  OPTIONAL = 'optional',
  DEVELOPMENT = 'development', // Only required in development
  PRODUCTION = 'production',   // Only required in production
}

/**
 * Environment variable validation rule
 */
export interface EnvRule {
  name: string;               // Environment variable name
  level: RequirementLevel;    // Requirement level
  description: string;        // What this variable is used for
  validator?: (value: string) => boolean; // Optional validation function
  errorMessage?: string;      // Custom error message if validation fails
}

// Define all environment variables and their requirements
const ENV_RULES: EnvRule[] = [
  {
    name: 'PORT',
    level: RequirementLevel.OPTIONAL,
    description: 'Port the server will listen on (defaults to 3000)',
    validator: (value) => !isNaN(Number(value)),
    errorMessage: 'PORT must be a valid number',
  },
  {
    name: 'NODE_ENV',
    level: RequirementLevel.OPTIONAL,
    description: 'Node environment (development, production, test)',
    validator: (value) => ['development', 'production', 'test'].includes(value),
    errorMessage: 'NODE_ENV must be one of: development, production, test',
  },
  {
    name: 'JWT_SECRET',
    level: RequirementLevel.REQUIRED,
    description: 'Secret for signing JWT tokens',
    validator: (value) => value.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long for security',
  },
  {
    name: 'SUPABASE_URL',
    level: RequirementLevel.REQUIRED,
    description: 'Supabase project URL',
    validator: (value) => /^https?:\/\/.+/.test(value),
    errorMessage: 'SUPABASE_URL must be a valid URL',
  },
  {
    name: 'SUPABASE_KEY',
    level: RequirementLevel.REQUIRED,
    description: 'Supabase API key',
    validator: (value) => value.length > 10,
    errorMessage: 'SUPABASE_KEY appears to be invalid (too short)',
  },
  // Add all other environment variables your application uses
];

/**
 * Validates environment variables against defined rules
 * @throws Error if required environment variables are missing or invalid
 */
export function validateEnvironment(): void {
  logger.info('Validating environment variables');
  
  const errors: string[] = [];
  const warnings: string[] = [];
  const currentEnv = process.env.NODE_ENV || 'development';
  
  ENV_RULES.forEach((rule) => {
    const value = process.env[rule.name];
    
    // Check if variable is required for current environment
    const isRequired = 
      rule.level === RequirementLevel.REQUIRED ||
      (rule.level === RequirementLevel.DEVELOPMENT && currentEnv === 'development') ||
      (rule.level === RequirementLevel.PRODUCTION && currentEnv === 'production');
    
    // Check if variable is missing
    if (isRequired && (value === undefined || value === '')) {
      errors.push(`Missing required environment variable: ${rule.name} - ${rule.description}`);
      return;
    }
    
    // If optional and missing, skip validation
    if (!isRequired && (value === undefined || value === '')) {
      return;
    }
    
    // Validate variable if present and has a validator
    if (value && rule.validator && !rule.validator(value)) {
      const message = rule.errorMessage || `Invalid value for ${rule.name}`;
      if (isRequired) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  });
  
  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings:', { warnings });
  }
  
  // Throw error if any required variables are missing or invalid
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  logger.info('Environment validation successful');
}

/**
 * Gets the healthcheck status of environment variables
 * @returns Object with environment health status
 */
export function getEnvironmentHealth(): Record<string, any> {
  const health: Record<string, any> = {
    status: 'ok',
    variables: {}
  };
  
  const currentEnv = process.env.NODE_ENV || 'development';
  
  ENV_RULES.forEach((rule) => {
    const value = process.env[rule.name];
    const isRequired = 
      rule.level === RequirementLevel.REQUIRED ||
      (rule.level === RequirementLevel.DEVELOPMENT && currentEnv === 'development') ||
      (rule.level === RequirementLevel.PRODUCTION && currentEnv === 'production');
    
    const isPresent = value !== undefined && value !== '';
    const isValid = !rule.validator || !value || rule.validator(value);
    
    health.variables[rule.name] = {
      present: isPresent,
      valid: isValid,
      required: isRequired
    };
    
    // Don't include actual values for security
    
    if (isRequired && (!isPresent || !isValid)) {
      health.status = 'error';
    }
  });
  
  return health;
}