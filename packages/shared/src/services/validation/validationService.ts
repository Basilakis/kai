import { supabase } from '../../lib/supabase';
import {
  ValidationRule,
  ValidationRuleType,
  ValidationSeverity,
  ValidationOperator,
  ValidationLogicalOperator,
  RangeValidationRule,
  PatternValidationRule,
  EnumValidationRule,
  DependencyValidationRule,
  CustomValidationRule,
  CompositeValidationRule,
  ValidationResult,
  BatchValidationResult,
  ValidationRuleCreateInput,
  ValidationRuleUpdateInput,
  ValidatePropertyInput,
  BatchValidatePropertiesInput
} from '../../types/validation';

/**
 * Validation Service
 * 
 * Service for managing and applying validation rules for material properties.
 */
class ValidationService {
  private static instance: ValidationService;
  private customValidators: Record<string, (value: any, params?: Record<string, any>) => boolean> = {};

  private constructor() {
    // Register built-in custom validators
    this.registerCustomValidator('isEmail', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(String(value));
    });

    this.registerCustomValidator('isUrl', (value) => {
      try {
        new URL(String(value));
        return true;
      } catch {
        return false;
      }
    });

    this.registerCustomValidator('isColor', (value) => {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      const rgbColorRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
      const rgbaColorRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(?:0|1|0?\.\d+)\s*\)$/;
      
      return hexColorRegex.test(String(value)) || 
             rgbColorRegex.test(String(value)) || 
             rgbaColorRegex.test(String(value));
    });

    this.registerCustomValidator('isISO8601Date', (value) => {
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;
      return iso8601Regex.test(String(value));
    });
  }

  /**
   * Get the singleton instance of the ValidationService
   * 
   * @returns The ValidationService instance
   */
  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Register a custom validator function
   * 
   * @param name Name of the custom validator
   * @param validator Validator function
   */
  public registerCustomValidator(
    name: string,
    validator: (value: any, params?: Record<string, any>) => boolean
  ): void {
    this.customValidators[name] = validator;
  }

  /**
   * Get all validation rules with optional filtering
   * 
   * @param propertyName Optional property name filter
   * @param materialType Optional material type filter
   * @param ruleType Optional rule type filter
   * @param activeOnly Only return active validation rules
   * @returns Array of validation rules
   */
  public async getValidationRules(
    propertyName?: string,
    materialType?: string,
    ruleType?: ValidationRuleType,
    activeOnly: boolean = true
  ): Promise<ValidationRule[]> {
    try {
      let query = supabase
        .from('validation_rules')
        .select('*');
      
      if (propertyName) {
        query = query.eq('property_name', propertyName);
      }
      
      if (materialType) {
        query = query.eq('material_type', materialType);
      }
      
      if (ruleType) {
        query = query.eq('type', ruleType);
      }
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data.map(this.mapValidationRuleFromDb);
    } catch (error) {
      throw new Error(`Failed to get validation rules: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a validation rule by ID
   * 
   * @param id Validation rule ID
   * @returns Validation rule
   */
  public async getValidationRuleById(id: string): Promise<ValidationRule> {
    try {
      const { data, error } = await supabase
        .from('validation_rules')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapValidationRuleFromDb(data);
    } catch (error) {
      throw new Error(`Failed to get validation rule: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new validation rule
   * 
   * @param input Validation rule create input
   * @param userId User ID of the creator
   * @returns Created validation rule
   */
  public async createValidationRule(
    input: ValidationRuleCreateInput,
    userId: string
  ): Promise<ValidationRule> {
    try {
      // Prepare base data
      const baseData = {
        name: input.name,
        description: input.description,
        type: input.type,
        property_name: input.propertyName,
        material_type: input.materialType,
        severity: input.severity,
        message: input.message,
        is_active: input.isActive,
        created_by: userId
      };
      
      // Prepare type-specific data
      let typeSpecificData: any = {};
      
      switch (input.type) {
        case ValidationRuleType.RANGE:
          typeSpecificData = {
            min: input.min,
            max: input.max,
            step: input.step,
            unit: input.unit
          };
          break;
        
        case ValidationRuleType.PATTERN:
          typeSpecificData = {
            pattern: input.pattern,
            flags: input.flags
          };
          break;
        
        case ValidationRuleType.ENUM:
          typeSpecificData = {
            allowed_values: input.allowedValues
          };
          break;
        
        case ValidationRuleType.DEPENDENCY:
          typeSpecificData = {
            condition: input.condition,
            required_value: input.requiredValue,
            required_pattern: input.requiredPattern,
            required_range: input.requiredRange
          };
          break;
        
        case ValidationRuleType.CUSTOM:
          typeSpecificData = {
            function_name: input.functionName,
            parameters: input.parameters
          };
          break;
        
        case ValidationRuleType.COMPOSITE:
          typeSpecificData = {
            operator: input.operator,
            rules: input.rules
          };
          break;
      }
      
      // Insert the rule
      const { data, error } = await supabase
        .from('validation_rules')
        .insert({
          ...baseData,
          ...typeSpecificData
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapValidationRuleFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create validation rule: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a validation rule
   * 
   * @param input Validation rule update input
   * @returns Updated validation rule
   */
  public async updateValidationRule(input: ValidationRuleUpdateInput): Promise<ValidationRule> {
    try {
      // Get the current rule to determine its type
      const currentRule = await this.getValidationRuleById(input.id);
      
      // Prepare base data
      const updateData: any = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.severity !== undefined) updateData.severity = input.severity;
      if (input.message !== undefined) updateData.message = input.message;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      
      // Prepare type-specific data
      switch (currentRule.type) {
        case ValidationRuleType.RANGE:
          if (input.min !== undefined) updateData.min = input.min;
          if (input.max !== undefined) updateData.max = input.max;
          if (input.step !== undefined) updateData.step = input.step;
          if (input.unit !== undefined) updateData.unit = input.unit;
          break;
        
        case ValidationRuleType.PATTERN:
          if (input.pattern !== undefined) updateData.pattern = input.pattern;
          if (input.flags !== undefined) updateData.flags = input.flags;
          break;
        
        case ValidationRuleType.ENUM:
          if (input.allowedValues !== undefined) updateData.allowed_values = input.allowedValues;
          break;
        
        case ValidationRuleType.DEPENDENCY:
          if (input.condition !== undefined) updateData.condition = input.condition;
          if (input.requiredValue !== undefined) updateData.required_value = input.requiredValue;
          if (input.requiredPattern !== undefined) updateData.required_pattern = input.requiredPattern;
          if (input.requiredRange !== undefined) updateData.required_range = input.requiredRange;
          break;
        
        case ValidationRuleType.CUSTOM:
          if (input.functionName !== undefined) updateData.function_name = input.functionName;
          if (input.parameters !== undefined) updateData.parameters = input.parameters;
          break;
        
        case ValidationRuleType.COMPOSITE:
          if (input.operator !== undefined) updateData.operator = input.operator;
          if (input.rules !== undefined) updateData.rules = input.rules;
          break;
      }
      
      updateData.updated_at = new Date();
      
      // Update the rule
      const { data, error } = await supabase
        .from('validation_rules')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapValidationRuleFromDb(data);
    } catch (error) {
      throw new Error(`Failed to update validation rule: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a validation rule
   * 
   * @param id Validation rule ID
   * @returns True if successful
   */
  public async deleteValidationRule(id: string): Promise<boolean> {
    try {
      // Check if this rule is used in any composite rules
      const { data: compositeRules, error: compositeError } = await supabase
        .from('validation_rules')
        .select('id, rules')
        .eq('type', ValidationRuleType.COMPOSITE);
      
      if (compositeError) {
        throw compositeError;
      }
      
      // Check if this rule is referenced by any composite rules
      const referencingRules = compositeRules.filter(rule => 
        rule.rules && rule.rules.includes(id)
      );
      
      if (referencingRules.length > 0) {
        throw new Error(`Cannot delete rule because it is referenced by ${referencingRules.length} composite rules`);
      }
      
      // Delete the rule
      const { error } = await supabase
        .from('validation_rules')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete validation rule: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate a property value against applicable rules
   * 
   * @param input Validation input
   * @returns Validation result
   */
  public async validateProperty(input: ValidatePropertyInput): Promise<ValidationResult[]> {
    try {
      // Get applicable validation rules
      const rules = await this.getValidationRules(
        input.propertyName,
        input.materialType,
        undefined,
        true
      );
      
      if (rules.length === 0) {
        // No rules to validate against
        return [{
          isValid: true,
          propertyName: input.propertyName,
          value: input.value,
          severity: ValidationSeverity.INFO,
          message: 'No validation rules defined for this property'
        }];
      }
      
      // Apply each rule
      const results: ValidationResult[] = [];
      
      for (const rule of rules) {
        const result = await this.applyValidationRule(rule, input.value, input.otherProperties);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to validate property: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate multiple properties in batch
   * 
   * @param input Batch validation input
   * @returns Batch validation result
   */
  public async validateProperties(input: BatchValidatePropertiesInput): Promise<BatchValidationResult> {
    try {
      const allResults: ValidationResult[] = [];
      
      // Validate each property
      for (const [propertyName, value] of Object.entries(input.properties)) {
        const results = await this.validateProperty({
          propertyName,
          value,
          materialType: input.materialType,
          otherProperties: input.properties
        });
        
        allResults.push(...results);
      }
      
      // Check if all validations passed
      const isValid = allResults.every(result => result.isValid);
      
      return {
        isValid,
        results: allResults
      };
    } catch (error) {
      throw new Error(`Failed to validate properties: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply a validation rule to a value
   * 
   * @param rule Validation rule to apply
   * @param value Value to validate
   * @param otherProperties Other properties for dependency validation
   * @returns Validation result
   */
  private async applyValidationRule(
    rule: ValidationRule,
    value: any,
    otherProperties?: Record<string, any>
  ): Promise<ValidationResult> {
    try {
      let isValid = true;
      
      switch (rule.type) {
        case ValidationRuleType.RANGE:
          isValid = this.validateRange(value, rule as RangeValidationRule);
          break;
        
        case ValidationRuleType.PATTERN:
          isValid = this.validatePattern(value, rule as PatternValidationRule);
          break;
        
        case ValidationRuleType.ENUM:
          isValid = this.validateEnum(value, rule as EnumValidationRule);
          break;
        
        case ValidationRuleType.DEPENDENCY:
          isValid = this.validateDependency(value, rule as DependencyValidationRule, otherProperties);
          break;
        
        case ValidationRuleType.CUSTOM:
          isValid = this.validateCustom(value, rule as CustomValidationRule);
          break;
        
        case ValidationRuleType.COMPOSITE:
          isValid = await this.validateComposite(value, rule as CompositeValidationRule, otherProperties);
          break;
      }
      
      return {
        isValid,
        propertyName: rule.propertyName,
        value,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: isValid ? undefined : rule.message
      };
    } catch (error) {
      // If validation fails due to an error, return an error result
      return {
        isValid: false,
        propertyName: rule.propertyName,
        value,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: ValidationSeverity.ERROR,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate a value against a range validation rule
   * 
   * @param value Value to validate
   * @param rule Range validation rule
   * @returns True if valid
   */
  private validateRange(value: any, rule: RangeValidationRule): boolean {
    // Convert value to number
    const numValue = Number(value);
    
    // Check if value is a valid number
    if (isNaN(numValue)) {
      return false;
    }
    
    // Check min constraint
    if (rule.min !== undefined && numValue < rule.min) {
      return false;
    }
    
    // Check max constraint
    if (rule.max !== undefined && numValue > rule.max) {
      return false;
    }
    
    // Check step constraint
    if (rule.step !== undefined && rule.step > 0) {
      // Calculate if value is a multiple of step from min (or 0 if min is not defined)
      const base = rule.min !== undefined ? rule.min : 0;
      const diff = numValue - base;
      
      // Allow for floating point imprecision
      const remainder = Math.abs(diff % rule.step);
      const epsilon = 1e-10;
      
      if (remainder > epsilon && rule.step - remainder > epsilon) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate a value against a pattern validation rule
   * 
   * @param value Value to validate
   * @param rule Pattern validation rule
   * @returns True if valid
   */
  private validatePattern(value: any, rule: PatternValidationRule): boolean {
    // Convert value to string
    const strValue = String(value);
    
    // Create RegExp object
    const regex = new RegExp(rule.pattern, rule.flags);
    
    // Test the value against the pattern
    return regex.test(strValue);
  }

  /**
   * Validate a value against an enum validation rule
   * 
   * @param value Value to validate
   * @param rule Enum validation rule
   * @returns True if valid
   */
  private validateEnum(value: any, rule: EnumValidationRule): boolean {
    // Convert value to string for comparison
    const strValue = String(value);
    
    // Check if value is in allowed values
    return rule.allowedValues.includes(strValue);
  }

  /**
   * Validate a value against a dependency validation rule
   * 
   * @param value Value to validate
   * @param rule Dependency validation rule
   * @param otherProperties Other properties for dependency validation
   * @returns True if valid
   */
  private validateDependency(
    value: any,
    rule: DependencyValidationRule,
    otherProperties?: Record<string, any>
  ): boolean {
    // If no other properties provided, validation fails
    if (!otherProperties) {
      return false;
    }
    
    const { condition } = rule;
    const dependentValue = otherProperties[condition.propertyName];
    
    // Check if the condition is met
    let conditionMet = false;
    
    switch (condition.operator) {
      case ValidationOperator.EQUALS:
        conditionMet = dependentValue === condition.value;
        break;
      
      case ValidationOperator.NOT_EQUALS:
        conditionMet = dependentValue !== condition.value;
        break;
      
      case ValidationOperator.GREATER_THAN:
        conditionMet = Number(dependentValue) > Number(condition.value);
        break;
      
      case ValidationOperator.LESS_THAN:
        conditionMet = Number(dependentValue) < Number(condition.value);
        break;
      
      case ValidationOperator.GREATER_THAN_OR_EQUALS:
        conditionMet = Number(dependentValue) >= Number(condition.value);
        break;
      
      case ValidationOperator.LESS_THAN_OR_EQUALS:
        conditionMet = Number(dependentValue) <= Number(condition.value);
        break;
      
      case ValidationOperator.CONTAINS:
        conditionMet = String(dependentValue).includes(String(condition.value));
        break;
      
      case ValidationOperator.NOT_CONTAINS:
        conditionMet = !String(dependentValue).includes(String(condition.value));
        break;
      
      case ValidationOperator.STARTS_WITH:
        conditionMet = String(dependentValue).startsWith(String(condition.value));
        break;
      
      case ValidationOperator.ENDS_WITH:
        conditionMet = String(dependentValue).endsWith(String(condition.value));
        break;
      
      case ValidationOperator.MATCHES:
        conditionMet = new RegExp(String(condition.value)).test(String(dependentValue));
        break;
      
      case ValidationOperator.EXISTS:
        conditionMet = dependentValue !== undefined && dependentValue !== null;
        break;
      
      case ValidationOperator.NOT_EXISTS:
        conditionMet = dependentValue === undefined || dependentValue === null;
        break;
    }
    
    // If condition is not met, validation passes (no constraint)
    if (!conditionMet) {
      return true;
    }
    
    // If condition is met, check the required constraints
    
    // Check required value
    if (rule.requiredValue !== undefined) {
      return value === rule.requiredValue;
    }
    
    // Check required pattern
    if (rule.requiredPattern) {
      return new RegExp(rule.requiredPattern).test(String(value));
    }
    
    // Check required range
    if (rule.requiredRange) {
      const numValue = Number(value);
      
      if (isNaN(numValue)) {
        return false;
      }
      
      if (rule.requiredRange.min !== undefined && numValue < rule.requiredRange.min) {
        return false;
      }
      
      if (rule.requiredRange.max !== undefined && numValue > rule.requiredRange.max) {
        return false;
      }
      
      return true;
    }
    
    // If no specific requirement, just check that the value exists
    return value !== undefined && value !== null;
  }

  /**
   * Validate a value against a custom validation rule
   * 
   * @param value Value to validate
   * @param rule Custom validation rule
   * @returns True if valid
   */
  private validateCustom(value: any, rule: CustomValidationRule): boolean {
    // Get the custom validator function
    const validator = this.customValidators[rule.functionName];
    
    if (!validator) {
      throw new Error(`Custom validator function '${rule.functionName}' not found`);
    }
    
    // Apply the validator
    return validator(value, rule.parameters);
  }

  /**
   * Validate a value against a composite validation rule
   * 
   * @param value Value to validate
   * @param rule Composite validation rule
   * @param otherProperties Other properties for dependency validation
   * @returns True if valid
   */
  private async validateComposite(
    value: any,
    rule: CompositeValidationRule,
    otherProperties?: Record<string, any>
  ): Promise<boolean> {
    // Get all referenced rules
    const referencedRules: ValidationRule[] = [];
    
    for (const ruleId of rule.rules) {
      try {
        const referencedRule = await this.getValidationRuleById(ruleId);
        referencedRules.push(referencedRule);
      } catch (error) {
        console.warn(`Failed to get referenced rule ${ruleId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (referencedRules.length === 0) {
      throw new Error('No valid referenced rules found for composite validation');
    }
    
    // Apply each rule and combine results based on the logical operator
    const results: boolean[] = [];
    
    for (const referencedRule of referencedRules) {
      const result = await this.applyValidationRule(referencedRule, value, otherProperties);
      results.push(result.isValid);
    }
    
    switch (rule.operator) {
      case ValidationLogicalOperator.AND:
        return results.every(result => result);
      
      case ValidationLogicalOperator.OR:
        return results.some(result => result);
      
      case ValidationLogicalOperator.NOT:
        // NOT operator typically applies to a single rule
        return !results[0];
    }
  }

  /**
   * Map a database validation rule to the appropriate TypeScript type
   * 
   * @param data Database validation rule
   * @returns Mapped validation rule
   */
  private mapValidationRuleFromDb(data: any): ValidationRule {
    // Map base fields
    const baseRule: ValidationRule = {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      propertyName: data.property_name,
      materialType: data.material_type,
      severity: data.severity,
      message: data.message,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
    
    // Map type-specific fields
    switch (data.type) {
      case ValidationRuleType.RANGE:
        return {
          ...baseRule,
          type: ValidationRuleType.RANGE,
          min: data.min,
          max: data.max,
          step: data.step,
          unit: data.unit
        } as RangeValidationRule;
      
      case ValidationRuleType.PATTERN:
        return {
          ...baseRule,
          type: ValidationRuleType.PATTERN,
          pattern: data.pattern,
          flags: data.flags
        } as PatternValidationRule;
      
      case ValidationRuleType.ENUM:
        return {
          ...baseRule,
          type: ValidationRuleType.ENUM,
          allowedValues: data.allowed_values || []
        } as EnumValidationRule;
      
      case ValidationRuleType.DEPENDENCY:
        return {
          ...baseRule,
          type: ValidationRuleType.DEPENDENCY,
          condition: data.condition,
          requiredValue: data.required_value,
          requiredPattern: data.required_pattern,
          requiredRange: data.required_range
        } as DependencyValidationRule;
      
      case ValidationRuleType.CUSTOM:
        return {
          ...baseRule,
          type: ValidationRuleType.CUSTOM,
          functionName: data.function_name,
          parameters: data.parameters
        } as CustomValidationRule;
      
      case ValidationRuleType.COMPOSITE:
        return {
          ...baseRule,
          type: ValidationRuleType.COMPOSITE,
          operator: data.operator,
          rules: data.rules || []
        } as CompositeValidationRule;
      
      default:
        return baseRule;
    }
  }
}

// Export the singleton instance
export const validationService = ValidationService.getInstance();
