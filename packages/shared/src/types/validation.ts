import { z } from 'zod';

/**
 * Validation Rule Type Enum
 * 
 * Defines the different types of validation rules.
 */
export enum ValidationRuleType {
  RANGE = 'range',
  PATTERN = 'pattern',
  ENUM = 'enum',
  DEPENDENCY = 'dependency',
  CUSTOM = 'custom',
  COMPOSITE = 'composite'
}

/**
 * Validation Severity Enum
 * 
 * Defines the severity levels for validation results.
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Validation Operator Enum
 * 
 * Defines the operators for dependency validation rules.
 */
export enum ValidationOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUALS = 'greater_than_or_equals',
  LESS_THAN_OR_EQUALS = 'less_than_or_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  MATCHES = 'matches',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists'
}

/**
 * Validation Logical Operator Enum
 * 
 * Defines the logical operators for composite validation rules.
 */
export enum ValidationLogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not'
}

/**
 * Base Validation Rule Interface
 * 
 * Base interface for all validation rules.
 */
export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  type: ValidationRuleType;
  propertyName: string;
  materialType: string;
  severity: ValidationSeverity;
  message: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Range Validation Rule Interface
 * 
 * Validation rule for numeric ranges.
 */
export interface RangeValidationRule extends ValidationRule {
  type: ValidationRuleType.RANGE;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

/**
 * Pattern Validation Rule Interface
 * 
 * Validation rule for string patterns.
 */
export interface PatternValidationRule extends ValidationRule {
  type: ValidationRuleType.PATTERN;
  pattern: string;
  flags?: string;
}

/**
 * Enum Validation Rule Interface
 * 
 * Validation rule for enumerated values.
 */
export interface EnumValidationRule extends ValidationRule {
  type: ValidationRuleType.ENUM;
  allowedValues: string[];
}

/**
 * Dependency Condition Interface
 * 
 * Defines a condition for dependency validation rules.
 */
export interface DependencyCondition {
  propertyName: string;
  operator: ValidationOperator;
  value?: any;
}

/**
 * Dependency Validation Rule Interface
 * 
 * Validation rule for property dependencies.
 */
export interface DependencyValidationRule extends ValidationRule {
  type: ValidationRuleType.DEPENDENCY;
  condition: DependencyCondition;
  requiredValue?: any;
  requiredPattern?: string;
  requiredRange?: { min?: number; max?: number };
}

/**
 * Custom Validation Rule Interface
 * 
 * Validation rule for custom validation functions.
 */
export interface CustomValidationRule extends ValidationRule {
  type: ValidationRuleType.CUSTOM;
  functionName: string;
  parameters?: Record<string, any>;
}

/**
 * Composite Validation Rule Interface
 * 
 * Validation rule that combines multiple rules with logical operators.
 */
export interface CompositeValidationRule extends ValidationRule {
  type: ValidationRuleType.COMPOSITE;
  operator: ValidationLogicalOperator;
  rules: string[]; // IDs of other validation rules
}

/**
 * Validation Result Interface
 * 
 * Result of a validation operation.
 */
export interface ValidationResult {
  isValid: boolean;
  propertyName: string;
  value: any;
  ruleId?: string;
  ruleName?: string;
  severity: ValidationSeverity;
  message?: string;
}

/**
 * Batch Validation Result Interface
 * 
 * Result of a batch validation operation.
 */
export interface BatchValidationResult {
  isValid: boolean;
  results: ValidationResult[];
}

/**
 * Validation Rule Create Input Schema
 */
export const ValidationRuleCreateInputSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(ValidationRuleType),
  propertyName: z.string().min(1),
  materialType: z.string().min(1),
  severity: z.nativeEnum(ValidationSeverity).default(ValidationSeverity.ERROR),
  message: z.string().min(1),
  isActive: z.boolean().default(true),
  
  // Range validation fields
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  
  // Pattern validation fields
  pattern: z.string().optional(),
  flags: z.string().optional(),
  
  // Enum validation fields
  allowedValues: z.array(z.string()).optional(),
  
  // Dependency validation fields
  condition: z.object({
    propertyName: z.string(),
    operator: z.nativeEnum(ValidationOperator),
    value: z.any().optional()
  }).optional(),
  requiredValue: z.any().optional(),
  requiredPattern: z.string().optional(),
  requiredRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  
  // Custom validation fields
  functionName: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  
  // Composite validation fields
  operator: z.nativeEnum(ValidationLogicalOperator).optional(),
  rules: z.array(z.string()).optional()
}).refine(data => {
  // Ensure required fields based on validation type
  switch (data.type) {
    case ValidationRuleType.RANGE:
      return data.min !== undefined || data.max !== undefined;
    case ValidationRuleType.PATTERN:
      return !!data.pattern;
    case ValidationRuleType.ENUM:
      return !!data.allowedValues && data.allowedValues.length > 0;
    case ValidationRuleType.DEPENDENCY:
      return !!data.condition && (
        data.requiredValue !== undefined || 
        !!data.requiredPattern || 
        (data.requiredRange && (data.requiredRange.min !== undefined || data.requiredRange.max !== undefined))
      );
    case ValidationRuleType.CUSTOM:
      return !!data.functionName;
    case ValidationRuleType.COMPOSITE:
      return !!data.operator && !!data.rules && data.rules.length > 0;
    default:
      return false;
  }
}, {
  message: "Missing required fields for the selected validation type"
});

/**
 * Validation Rule Update Input Schema
 */
export const ValidationRuleUpdateInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  severity: z.nativeEnum(ValidationSeverity).optional(),
  message: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  
  // Range validation fields
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  
  // Pattern validation fields
  pattern: z.string().optional(),
  flags: z.string().optional(),
  
  // Enum validation fields
  allowedValues: z.array(z.string()).optional(),
  
  // Dependency validation fields
  condition: z.object({
    propertyName: z.string(),
    operator: z.nativeEnum(ValidationOperator),
    value: z.any().optional()
  }).optional(),
  requiredValue: z.any().optional(),
  requiredPattern: z.string().optional(),
  requiredRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  
  // Custom validation fields
  functionName: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  
  // Composite validation fields
  operator: z.nativeEnum(ValidationLogicalOperator).optional(),
  rules: z.array(z.string()).optional()
});

/**
 * Validate Property Input Schema
 */
export const ValidatePropertyInputSchema = z.object({
  propertyName: z.string().min(1),
  value: z.any(),
  materialType: z.string().min(1),
  otherProperties: z.record(z.any()).optional()
});

/**
 * Batch Validate Properties Input Schema
 */
export const BatchValidatePropertiesInputSchema = z.object({
  materialType: z.string().min(1),
  properties: z.record(z.any())
});

// Type definitions derived from schemas
export type ValidationRuleCreateInput = z.infer<typeof ValidationRuleCreateInputSchema>;
export type ValidationRuleUpdateInput = z.infer<typeof ValidationRuleUpdateInputSchema>;
export type ValidatePropertyInput = z.infer<typeof ValidatePropertyInputSchema>;
export type BatchValidatePropertiesInput = z.infer<typeof BatchValidatePropertiesInputSchema>;
