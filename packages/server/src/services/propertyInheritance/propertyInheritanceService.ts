/**
 * Property Inheritance Service
 * 
 * This service manages property inheritance for materials based on templates.
 * It handles template resolution, property merging, and inheritance logic.
 */

import { logger } from '../../utils/logger';
import PropertyTemplate, { 
  PropertyTemplateDocument, 
  getPropertyTemplatesForMaterial 
} from '../../models/propertyTemplate.model';
import { getCategory } from '../../models/category.model';
import { Material } from '../../../../shared/src/types/material';

/**
 * Property Inheritance Service
 */
export class PropertyInheritanceService {
  /**
   * Apply property inheritance to a material
   * 
   * @param material Material to apply inheritance to
   * @param options Options for inheritance
   * @returns Material with inherited properties
   */
  public async applyInheritance(
    material: Partial<Material>,
    options: {
      applyDefaults?: boolean;
      overrideExisting?: boolean;
    } = {}
  ): Promise<Partial<Material>> {
    try {
      const { applyDefaults = true, overrideExisting = false } = options;
      
      // Skip inheritance if material type is not defined
      if (!material.materialType) {
        logger.warn('Cannot apply inheritance: material type is not defined');
        return material;
      }
      
      // Get applicable templates
      const templates = await this.getApplicableTemplates(
        material.materialType,
        material.categoryId
      );
      
      if (templates.length === 0) {
        logger.debug('No applicable templates found for material');
        return material;
      }
      
      // Apply templates in order (lowest priority first, so higher priority can override)
      let result = { ...material };
      
      for (const template of templates) {
        result = this.applyTemplate(result, template, {
          applyDefaults,
          overrideExisting
        });
      }
      
      return result;
    } catch (err) {
      logger.error(`Failed to apply property inheritance: ${err}`);
      // Return original material if inheritance fails
      return material;
    }
  }
  
  /**
   * Get applicable templates for a material
   * 
   * @param materialType Material type
   * @param categoryId Category ID
   * @returns Array of applicable templates
   */
  private async getApplicableTemplates(
    materialType: string,
    categoryId?: string
  ): Promise<PropertyTemplateDocument[]> {
    try {
      // Get templates for material type
      const templates = await getPropertyTemplatesForMaterial(materialType, categoryId);
      
      // Sort templates by priority (lowest first, so higher priority can override)
      return templates.sort((a, b) => a.priority - b.priority);
    } catch (err) {
      logger.error(`Failed to get applicable templates: ${err}`);
      return [];
    }
  }
  
  /**
   * Apply a template to a material
   * 
   * @param material Material to apply template to
   * @param template Template to apply
   * @param options Options for template application
   * @returns Material with template applied
   */
  private applyTemplate(
    material: Partial<Material>,
    template: PropertyTemplateDocument,
    options: {
      applyDefaults?: boolean;
      overrideExisting?: boolean;
    }
  ): Partial<Material> {
    const { applyDefaults, overrideExisting } = options;
    
    // Create a copy of the material
    const result = { ...material };
    
    // Apply template properties
    for (const [key, value] of Object.entries(template.properties)) {
      // Skip if property already exists and we're not overriding
      if (result[key] !== undefined && !overrideExisting) {
        continue;
      }
      
      // Skip if not applying defaults and this is a default value
      if (!applyDefaults && this.isDefaultValue(key, value)) {
        continue;
      }
      
      // Check override rules
      if (this.shouldApplyOverride(key, result, template)) {
        result[key] = value;
      }
    }
    
    // Handle special case for technicalSpecs
    if (template.properties.technicalSpecs && typeof template.properties.technicalSpecs === 'object') {
      // Initialize technicalSpecs if it doesn't exist
      if (!result.technicalSpecs) {
        result.technicalSpecs = {};
      }
      
      // Merge technicalSpecs
      for (const [key, value] of Object.entries(template.properties.technicalSpecs)) {
        // Skip if property already exists and we're not overriding
        if (result.technicalSpecs[key] !== undefined && !overrideExisting) {
          continue;
        }
        
        // Skip if not applying defaults and this is a default value
        if (!applyDefaults && this.isDefaultValue(`technicalSpecs.${key}`, value)) {
          continue;
        }
        
        result.technicalSpecs[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Check if a value is a default value
   * 
   * @param key Property key
   * @param value Property value
   * @returns True if value is a default value
   */
  private isDefaultValue(key: string, value: any): boolean {
    // Consider empty strings, null, undefined, and 0 as default values
    if (value === '' || value === null || value === undefined || value === 0) {
      return true;
    }
    
    // Consider empty arrays and objects as default values
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if an override rule should be applied
   * 
   * @param key Property key
   * @param material Material to check
   * @param template Template with override rules
   * @returns True if override should be applied
   */
  private shouldApplyOverride(
    key: string,
    material: Partial<Material>,
    template: PropertyTemplateDocument
  ): boolean {
    // If no override rules for this field, apply the value
    const overrideRule = template.overrideRules.find(rule => rule.field === key);
    if (!overrideRule) {
      return true;
    }
    
    // If no condition, apply the value
    if (!overrideRule.condition) {
      return true;
    }
    
    // Parse and evaluate the condition
    try {
      // Simple condition format: "field=value" or "field!=value"
      const [field, operator, value] = this.parseCondition(overrideRule.condition);
      
      // Get the field value from the material
      const fieldValue = this.getNestedValue(material, field);
      
      // Evaluate the condition
      switch (operator) {
        case '=':
          return fieldValue === value;
        case '!=':
          return fieldValue !== value;
        case '>':
          return fieldValue > value;
        case '<':
          return fieldValue < value;
        case '>=':
          return fieldValue >= value;
        case '<=':
          return fieldValue <= value;
        default:
          logger.warn(`Unknown operator in condition: ${operator}`);
          return false;
      }
    } catch (err) {
      logger.warn(`Failed to evaluate condition: ${overrideRule.condition}`);
      return false;
    }
  }
  
  /**
   * Parse a condition string
   * 
   * @param condition Condition string
   * @returns Parsed condition [field, operator, value]
   */
  private parseCondition(condition: string): [string, string, any] {
    // Match operators
    const operatorMatch = condition.match(/([=!<>]+)/);
    if (!operatorMatch) {
      throw new Error(`Invalid condition: ${condition}`);
    }
    
    const operator = operatorMatch[1];
    const [field, valueStr] = condition.split(operator);
    
    // Parse value
    let value: any = valueStr.trim();
    
    // Try to parse as number
    if (!isNaN(Number(value))) {
      value = Number(value);
    }
    // Try to parse as boolean
    else if (value === 'true') {
      value = true;
    }
    else if (value === 'false') {
      value = false;
    }
    
    return [field.trim(), operator, value];
  }
  
  /**
   * Get a nested value from an object
   * 
   * @param obj Object to get value from
   * @param path Path to value
   * @returns Value at path
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      if (value === undefined || value === null) {
        return undefined;
      }
      
      value = value[key];
    }
    
    return value;
  }
  
  /**
   * Create a property template
   * 
   * @param template Template data
   * @returns Created template
   */
  public async createTemplate(template: Partial<PropertyTemplateDocument>): Promise<PropertyTemplateDocument> {
    try {
      const newTemplate = new PropertyTemplate(template);
      await newTemplate.save();
      return newTemplate;
    } catch (err) {
      logger.error(`Failed to create property template: ${err}`);
      throw new Error(`Failed to create property template: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Update a property template
   * 
   * @param id Template ID
   * @param template Template data
   * @returns Updated template
   */
  public async updateTemplate(id: string, template: Partial<PropertyTemplateDocument>): Promise<PropertyTemplateDocument | null> {
    try {
      return await PropertyTemplate.findOneAndUpdate(
        { id },
        { $set: template },
        { new: true }
      );
    } catch (err) {
      logger.error(`Failed to update property template: ${err}`);
      throw new Error(`Failed to update property template: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Delete a property template
   * 
   * @param id Template ID
   * @returns Deleted template
   */
  public async deleteTemplate(id: string): Promise<PropertyTemplateDocument | null> {
    try {
      return await PropertyTemplate.findOneAndDelete({ id });
    } catch (err) {
      logger.error(`Failed to delete property template: ${err}`);
      throw new Error(`Failed to delete property template: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Get a property template by ID
   * 
   * @param id Template ID
   * @returns Template
   */
  public async getTemplateById(id: string): Promise<PropertyTemplateDocument | null> {
    try {
      return await PropertyTemplate.findOne({ id });
    } catch (err) {
      logger.error(`Failed to get property template: ${err}`);
      throw new Error(`Failed to get property template: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Get property templates
   * 
   * @param options Query options
   * @returns Templates
   */
  public async getTemplates(options: {
    materialType?: string;
    categoryId?: string;
    isActive?: boolean;
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
  } = {}): Promise<{
    templates: PropertyTemplateDocument[];
    total: number;
  }> {
    try {
      const { 
        materialType,
        categoryId,
        isActive,
        limit = 100, 
        skip = 0, 
        sort = { priority: -1, name: 1 } 
      } = options;
      
      // Build filter
      const filter: Record<string, any> = {};
      if (materialType !== undefined) {
        filter.materialType = materialType;
      }
      if (categoryId !== undefined) {
        filter.categoryId = categoryId;
      }
      if (isActive !== undefined) {
        filter.isActive = isActive;
      }
      
      const templates = await PropertyTemplate.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      const total = await PropertyTemplate.countDocuments(filter);
      
      return {
        templates,
        total
      };
    } catch (err) {
      logger.error(`Failed to get property templates: ${err}`);
      throw new Error(`Failed to get property templates: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Export singleton instance
export const propertyInheritanceService = new PropertyInheritanceService();
