/**
 * Property Relationship Service
 *
 * Service for managing property relationships, correlations, and compatibility rules.
 */

import { supabase } from '../../config/supabase';
import {
  PropertyRelationship,
  PropertyRelationshipCreateInput,
  PropertyRelationshipUpdateInput,
  PropertyValueCorrelation,
  PropertyValueCorrelationCreateInput,
  PropertyValueCorrelationUpdateInput,
  PropertyCompatibilityRule,
  PropertyCompatibilityRuleCreateInput,
  PropertyCompatibilityRuleUpdateInput,
  PropertyValidationRequest,
  PropertyValidationResult,
  PropertyRecommendationRequest,
  PropertyRecommendationResult,
  PropertyGraphVisualization,
  RelationshipType,
  CompatibilityType
} from '../../types/property-relationships';

/**
 * Property Relationship Service
 */
class PropertyRelationshipService {
  // Singleton instance
  private static instance: PropertyRelationshipService;

  /**
   * Get the singleton instance
   */
  public static getInstance(): PropertyRelationshipService {
    if (!PropertyRelationshipService.instance) {
      PropertyRelationshipService.instance = new PropertyRelationshipService();
    }
    return PropertyRelationshipService.instance;
  }
  /**
   * Create a new property relationship
   *
   * @param input Property relationship data
   * @returns The created property relationship
   */
  public async createRelationship(input: PropertyRelationshipCreateInput): Promise<PropertyRelationship> {
    const { data, error } = await supabase
      .from('property_relationships')
      .insert({
        source_property: input.sourceProperty,
        target_property: input.targetProperty,
        relationship_type: input.relationshipType,
        material_type: input.materialType,
        strength: input.strength,
        bidirectional: input.bidirectional,
        description: input.description
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create property relationship: ${error.message}`);
    }

    return this.mapRelationshipFromDb(data);
  }

  /**
   * Get a property relationship by ID
   *
   * @param id Relationship ID
   * @returns The property relationship
   */
  public async getRelationshipById(id: string): Promise<PropertyRelationship> {
    const { data, error } = await supabase
      .from('property_relationships')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get property relationship: ${error.message}`);
    }

    return this.mapRelationshipFromDb(data);
  }

  /**
   * Get property relationships by material type
   *
   * @param materialType Material type
   * @returns List of property relationships
   */
  public async getRelationshipsByMaterialType(materialType: string): Promise<PropertyRelationship[]> {
    const { data, error } = await supabase
      .from('property_relationships')
      .select('*')
      .eq('material_type', materialType);

    if (error) {
      throw new Error(`Failed to get property relationships: ${error.message}`);
    }

    return data.map(this.mapRelationshipFromDb);
  }

  /**
   * Get property relationships by source property
   *
   * @param sourceProperty Source property name
   * @param materialType Optional material type filter
   * @returns List of property relationships
   */
  public async getRelationshipsBySourceProperty(
    sourceProperty: string,
    materialType?: string
  ): Promise<PropertyRelationship[]> {
    let query = supabase
      .from('property_relationships')
      .select('*')
      .eq('source_property', sourceProperty);

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get property relationships: ${error.message}`);
    }

    return data.map(this.mapRelationshipFromDb);
  }

  /**
   * Get property relationships by target property
   *
   * @param targetProperty Target property name
   * @param materialType Optional material type filter
   * @returns List of property relationships
   */
  public async getRelationshipsByTargetProperty(
    targetProperty: string,
    materialType?: string
  ): Promise<PropertyRelationship[]> {
    let query = supabase
      .from('property_relationships')
      .select('*')
      .eq('target_property', targetProperty);

    if (materialType) {
      query = query.eq('material_type', materialType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get property relationships: ${error.message}`);
    }

    return data.map(this.mapRelationshipFromDb);
  }

  /**
   * Update a property relationship
   *
   * @param input Update data
   * @returns The updated property relationship
   */
  public async updateRelationship(input: PropertyRelationshipUpdateInput): Promise<PropertyRelationship> {
    const updateData: Record<string, any> = {};

    if (input.strength !== undefined) updateData.strength = input.strength;
    if (input.bidirectional !== undefined) updateData.bidirectional = input.bidirectional;
    if (input.description !== undefined) updateData.description = input.description;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('property_relationships')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update property relationship: ${error.message}`);
    }

    return this.mapRelationshipFromDb(data);
  }

  /**
   * Delete a property relationship
   *
   * @param id Relationship ID
   * @returns True if successful
   */
  public async deleteRelationship(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('property_relationships')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete property relationship: ${error.message}`);
    }

    return true;
  }

  /**
   * Map a database property relationship to the TypeScript type
   *
   * @param data Database property relationship
   * @returns Mapped property relationship
   */
  private mapRelationshipFromDb(data: any): PropertyRelationship {
    return {
      id: data.id,
      sourceProperty: data.source_property,
      targetProperty: data.target_property,
      relationshipType: data.relationship_type as RelationshipType,
      materialType: data.material_type,
      strength: data.strength,
      bidirectional: data.bidirectional,
      description: data.description,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Create a new property value correlation
   *
   * @param input Property value correlation data
   * @returns The created property value correlation
   */
  public async createValueCorrelation(input: PropertyValueCorrelationCreateInput): Promise<PropertyValueCorrelation> {
    const { data, error } = await supabase
      .from('property_value_correlations')
      .insert({
        relationship_id: input.relationshipId,
        source_value: input.sourceValue,
        target_value: input.targetValue,
        correlation_strength: input.correlationStrength,
        sample_size: input.sampleSize,
        confidence_interval: input.confidenceInterval,
        is_statistical: input.isStatistical,
        is_manual: input.isManual
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create property value correlation: ${error.message}`);
    }

    return this.mapValueCorrelationFromDb(data);
  }

  /**
   * Get property value correlations by relationship ID
   *
   * @param relationshipId Relationship ID
   * @returns List of property value correlations
   */
  public async getValueCorrelationsByRelationshipId(relationshipId: string): Promise<PropertyValueCorrelation[]> {
    const { data, error } = await supabase
      .from('property_value_correlations')
      .select('*')
      .eq('relationship_id', relationshipId);

    if (error) {
      throw new Error(`Failed to get property value correlations: ${error.message}`);
    }

    return data.map(this.mapValueCorrelationFromDb);
  }

  /**
   * Get property value correlations by source value
   *
   * @param relationshipId Relationship ID
   * @param sourceValue Source value
   * @returns List of property value correlations
   */
  public async getValueCorrelationsBySourceValue(
    relationshipId: string,
    sourceValue: string
  ): Promise<PropertyValueCorrelation[]> {
    const { data, error } = await supabase
      .from('property_value_correlations')
      .select('*')
      .eq('relationship_id', relationshipId)
      .eq('source_value', sourceValue);

    if (error) {
      throw new Error(`Failed to get property value correlations: ${error.message}`);
    }

    return data.map(this.mapValueCorrelationFromDb);
  }

  /**
   * Update a property value correlation
   *
   * @param input Update data
   * @returns The updated property value correlation
   */
  public async updateValueCorrelation(input: PropertyValueCorrelationUpdateInput): Promise<PropertyValueCorrelation> {
    const updateData: Record<string, any> = {};

    if (input.correlationStrength !== undefined) updateData.correlation_strength = input.correlationStrength;
    if (input.sampleSize !== undefined) updateData.sample_size = input.sampleSize;
    if (input.confidenceInterval !== undefined) updateData.confidence_interval = input.confidenceInterval;
    if (input.isStatistical !== undefined) updateData.is_statistical = input.isStatistical;
    if (input.isManual !== undefined) updateData.is_manual = input.isManual;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('property_value_correlations')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update property value correlation: ${error.message}`);
    }

    return this.mapValueCorrelationFromDb(data);
  }

  /**
   * Delete a property value correlation
   *
   * @param id Correlation ID
   * @returns True if successful
   */
  public async deleteValueCorrelation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('property_value_correlations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete property value correlation: ${error.message}`);
    }

    return true;
  }

  /**
   * Map a database property value correlation to the TypeScript type
   *
   * @param data Database property value correlation
   * @returns Mapped property value correlation
   */
  private mapValueCorrelationFromDb(data: any): PropertyValueCorrelation {
    return {
      id: data.id,
      relationshipId: data.relationship_id,
      sourceValue: data.source_value,
      targetValue: data.target_value,
      correlationStrength: data.correlation_strength,
      sampleSize: data.sample_size,
      confidenceInterval: data.confidence_interval,
      isStatistical: data.is_statistical,
      isManual: data.is_manual,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Create a new property compatibility rule
   *
   * @param input Property compatibility rule data
   * @returns The created property compatibility rule
   */
  public async createCompatibilityRule(input: PropertyCompatibilityRuleCreateInput): Promise<PropertyCompatibilityRule> {
    const { data, error } = await supabase
      .from('property_compatibility_rules')
      .insert({
        relationship_id: input.relationshipId,
        source_value: input.sourceValue,
        target_value: input.targetValue,
        compatibility_type: input.compatibilityType,
        reason: input.reason
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create property compatibility rule: ${error.message}`);
    }

    return this.mapCompatibilityRuleFromDb(data);
  }

  /**
   * Get property compatibility rules by relationship ID
   *
   * @param relationshipId Relationship ID
   * @returns List of property compatibility rules
   */
  public async getCompatibilityRulesByRelationshipId(relationshipId: string): Promise<PropertyCompatibilityRule[]> {
    const { data, error } = await supabase
      .from('property_compatibility_rules')
      .select('*')
      .eq('relationship_id', relationshipId);

    if (error) {
      throw new Error(`Failed to get property compatibility rules: ${error.message}`);
    }

    return data.map(this.mapCompatibilityRuleFromDb);
  }

  /**
   * Get property compatibility rules by source value
   *
   * @param relationshipId Relationship ID
   * @param sourceValue Source value
   * @returns List of property compatibility rules
   */
  public async getCompatibilityRulesBySourceValue(
    relationshipId: string,
    sourceValue: string
  ): Promise<PropertyCompatibilityRule[]> {
    const { data, error } = await supabase
      .from('property_compatibility_rules')
      .select('*')
      .eq('relationship_id', relationshipId)
      .eq('source_value', sourceValue);

    if (error) {
      throw new Error(`Failed to get property compatibility rules: ${error.message}`);
    }

    return data.map(this.mapCompatibilityRuleFromDb);
  }

  /**
   * Update a property compatibility rule
   *
   * @param input Update data
   * @returns The updated property compatibility rule
   */
  public async updateCompatibilityRule(input: PropertyCompatibilityRuleUpdateInput): Promise<PropertyCompatibilityRule> {
    const updateData: Record<string, any> = {};

    if (input.compatibilityType !== undefined) updateData.compatibility_type = input.compatibilityType;
    if (input.reason !== undefined) updateData.reason = input.reason;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('property_compatibility_rules')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update property compatibility rule: ${error.message}`);
    }

    return this.mapCompatibilityRuleFromDb(data);
  }

  /**
   * Delete a property compatibility rule
   *
   * @param id Rule ID
   * @returns True if successful
   */
  public async deleteCompatibilityRule(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('property_compatibility_rules')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete property compatibility rule: ${error.message}`);
    }

    return true;
  }

  /**
   * Validate a set of property values
   *
   * @param request Validation request
   * @returns Validation result
   */
  public async validateProperties(request: PropertyValidationRequest): Promise<PropertyValidationResult> {
    const { materialType, properties } = request;

    // Get all relationships for this material type
    const relationships = await this.getRelationshipsByMaterialType(materialType);

    // Filter for compatibility and exclusion relationships
    const compatibilityRelationships = relationships.filter(r =>
      r.relationshipType === RelationshipType.COMPATIBILITY ||
      r.relationshipType === RelationshipType.EXCLUSION
    );

    const issues: Array<{
      sourceProperty: string;
      sourceValue: string;
      targetProperty: string;
      targetValue: string;
      compatibilityType: CompatibilityType;
      reason?: string;
    }> = [];

    const recommendations: Array<{
      property: string;
      currentValue?: string;
      recommendedValue: string;
      confidence: number;
      reason?: string;
    }> = [];

    // Check each relationship
    for (const relationship of compatibilityRelationships) {
      const { sourceProperty, targetProperty } = relationship;

      // Skip if either property is not in the request
      if (!properties[sourceProperty] || !properties[targetProperty]) {
        continue;
      }

      const sourceValue = properties[sourceProperty];
      const targetValue = properties[targetProperty];

      // Get compatibility rules for this relationship and source value
      const rules = await this.getCompatibilityRulesBySourceValue(
        relationship.id,
        sourceValue
      );

      // Find rule for the target value
      const rule = rules.find(r => r.targetValue === targetValue);

      if (rule) {
        // If incompatible, add to issues
        if (rule.compatibilityType === CompatibilityType.INCOMPATIBLE) {
          issues.push({
            sourceProperty,
            sourceValue,
            targetProperty,
            targetValue,
            compatibilityType: rule.compatibilityType,
            reason: rule.reason
          });
        }

        // If not recommended, add to issues
        if (rule.compatibilityType === CompatibilityType.NOT_RECOMMENDED) {
          issues.push({
            sourceProperty,
            sourceValue,
            targetProperty,
            targetValue,
            compatibilityType: rule.compatibilityType,
            reason: rule.reason
          });
        }
      } else {
        // If no rule exists, check if there are any recommended values
        const recommendedRules = rules.filter(r =>
          r.compatibilityType === CompatibilityType.RECOMMENDED
        );

        if (recommendedRules.length > 0) {
          // Add recommendations
          for (const recRule of recommendedRules) {
            recommendations.push({
              property: targetProperty,
              currentValue: targetValue,
              recommendedValue: recRule.targetValue,
              confidence: relationship.strength,
              reason: recRule.reason
            });
          }
        }
      }
    }

    return {
      isValid: issues.filter(i => i.compatibilityType === CompatibilityType.INCOMPATIBLE).length === 0,
      issues: issues.length > 0 ? issues : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  /**
   * Get property recommendations
   *
   * @param request Recommendation request
   * @returns Recommendation result
   */
  public async getPropertyRecommendations(request: PropertyRecommendationRequest): Promise<PropertyRecommendationResult> {
    const { materialType, properties, targetProperty } = request;

    // Get all relationships where target property is the requested property
    const relationships = await this.getRelationshipsByTargetProperty(targetProperty, materialType);

    const recommendations: Array<{
      value: string;
      confidence: number;
      sources?: Array<{
        sourceProperty: string;
        sourceValue: string;
        relationshipType: RelationshipType;
        strength: number;
      }>;
    }> = [];

    // Track scores for each potential value
    const valueScores: Record<string, {
      score: number;
      sources: Array<{
        sourceProperty: string;
        sourceValue: string;
        relationshipType: RelationshipType;
        strength: number;
      }>;
    }> = {};

    // Process each relationship
    for (const relationship of relationships) {
      const { sourceProperty, relationshipType } = relationship;

      // Skip if source property is not in the request
      if (!properties[sourceProperty]) {
        continue;
      }

      const sourceValue = properties[sourceProperty];

      // Handle different relationship types
      switch (relationshipType) {
        case RelationshipType.COMPATIBILITY: {
          // Get compatibility rules
          const rules = await this.getCompatibilityRulesBySourceValue(
            relationship.id,
            sourceValue
          );

          // Process each rule
          for (const rule of rules) {
            const { targetValue, compatibilityType } = rule;

            // Calculate score based on compatibility type
            let score = 0;
            switch (compatibilityType) {
              case CompatibilityType.RECOMMENDED:
                score = 1.0 * relationship.strength;
                break;
              case CompatibilityType.COMPATIBLE:
                score = 0.5 * relationship.strength;
                break;
              case CompatibilityType.NOT_RECOMMENDED:
                score = -0.5 * relationship.strength;
                break;
              case CompatibilityType.INCOMPATIBLE:
                score = -1.0 * relationship.strength;
                break;
            }

            // Add to value scores
            if (!valueScores[targetValue]) {
              valueScores[targetValue] = {
                score: 0,
                sources: []
              };
            }

            valueScores[targetValue].score += score;
            valueScores[targetValue].sources.push({
              sourceProperty,
              sourceValue,
              relationshipType,
              strength: relationship.strength
            });
          }
          break;
        }

        case RelationshipType.CORRELATION: {
          // Get correlations
          const correlations = await this.getValueCorrelationsBySourceValue(
            relationship.id,
            sourceValue
          );

          // Process each correlation
          for (const correlation of correlations) {
            const { targetValue, correlationStrength } = correlation;

            // Add to value scores
            if (!valueScores[targetValue]) {
              valueScores[targetValue] = {
                score: 0,
                sources: []
              };
            }

            // Use correlation strength directly
            valueScores[targetValue].score += correlationStrength * relationship.strength;
            valueScores[targetValue].sources.push({
              sourceProperty,
              sourceValue,
              relationshipType,
              strength: relationship.strength
            });
          }
          break;
        }

        // Handle other relationship types as needed
        default:
          break;
      }
    }

    // Convert scores to recommendations
    for (const [value, data] of Object.entries(valueScores)) {
      // Only include positive scores
      if (data.score > 0) {
        recommendations.push({
          value,
          confidence: Math.min(data.score, 1.0), // Cap at 1.0
          sources: data.sources
        });
      }
    }

    // Sort by confidence (highest first)
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return {
      property: targetProperty,
      recommendations
    };
  }

  /**
   * Get property graph visualization data
   *
   * @param materialType Material type
   * @returns Graph visualization data
   */
  public async getPropertyGraphVisualization(materialType: string): Promise<PropertyGraphVisualization> {
    // Get all relationships for this material type
    const relationships = await this.getRelationshipsByMaterialType(materialType);

    const nodes: Array<{
      id: string;
      label: string;
      type: 'property' | 'value';
      materialType?: string;
      group?: string;
    }> = [];

    const edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
      type?: RelationshipType;
      strength?: number;
      compatibilityType?: CompatibilityType;
    }> = [];

    // Track properties to avoid duplicates
    const propertyNodes = new Set<string>();

    // Add property nodes
    for (const relationship of relationships) {
      const { sourceProperty, targetProperty } = relationship;

      // Add source property node if not already added
      if (!propertyNodes.has(sourceProperty)) {
        nodes.push({
          id: `property:${sourceProperty}`,
          label: sourceProperty,
          type: 'property',
          materialType,
          group: 'properties'
        });
        propertyNodes.add(sourceProperty);
      }

      // Add target property node if not already added
      if (!propertyNodes.has(targetProperty)) {
        nodes.push({
          id: `property:${targetProperty}`,
          label: targetProperty,
          type: 'property',
          materialType,
          group: 'properties'
        });
        propertyNodes.add(targetProperty);
      }

      // Add relationship edge
      edges.push({
        id: `relationship:${relationship.id}`,
        source: `property:${sourceProperty}`,
        target: `property:${targetProperty}`,
        label: relationship.relationshipType,
        type: relationship.relationshipType,
        strength: relationship.strength
      });

      // If bidirectional, add reverse edge
      if (relationship.bidirectional) {
        edges.push({
          id: `relationship:${relationship.id}:reverse`,
          source: `property:${targetProperty}`,
          target: `property:${sourceProperty}`,
          label: relationship.relationshipType,
          type: relationship.relationshipType,
          strength: relationship.strength
        });
      }

      // Add value correlations
      if (relationship.relationshipType === RelationshipType.CORRELATION) {
        const correlations = await this.getValueCorrelationsByRelationshipId(relationship.id);

        // Track value nodes to avoid duplicates
        const valueNodes = new Set<string>();

        for (const correlation of correlations) {
          const { sourceValue, targetValue } = correlation;

          // Add source value node if not already added
          const sourceValueId = `value:${sourceProperty}:${sourceValue}`;
          if (!valueNodes.has(sourceValueId)) {
            nodes.push({
              id: sourceValueId,
              label: sourceValue,
              type: 'value',
              group: sourceProperty
            });
            valueNodes.add(sourceValueId);
          }

          // Add target value node if not already added
          const targetValueId = `value:${targetProperty}:${targetValue}`;
          if (!valueNodes.has(targetValueId)) {
            nodes.push({
              id: targetValueId,
              label: targetValue,
              type: 'value',
              group: targetProperty
            });
            valueNodes.add(targetValueId);
          }

          // Add correlation edge
          edges.push({
            id: `correlation:${correlation.id}`,
            source: sourceValueId,
            target: targetValueId,
            label: `${correlation.correlationStrength.toFixed(2)}`,
            strength: Math.abs(correlation.correlationStrength)
          });
        }
      }

      // Add compatibility rules
      if (relationship.relationshipType === RelationshipType.COMPATIBILITY) {
        const rules = await this.getCompatibilityRulesByRelationshipId(relationship.id);

        // Track value nodes to avoid duplicates
        const valueNodes = new Set<string>();

        for (const rule of rules) {
          const { sourceValue, targetValue, compatibilityType } = rule;

          // Add source value node if not already added
          const sourceValueId = `value:${sourceProperty}:${sourceValue}`;
          if (!valueNodes.has(sourceValueId)) {
            nodes.push({
              id: sourceValueId,
              label: sourceValue,
              type: 'value',
              group: sourceProperty
            });
            valueNodes.add(sourceValueId);
          }

          // Add target value node if not already added
          const targetValueId = `value:${targetProperty}:${targetValue}`;
          if (!valueNodes.has(targetValueId)) {
            nodes.push({
              id: targetValueId,
              label: targetValue,
              type: 'value',
              group: targetProperty
            });
            valueNodes.add(targetValueId);
          }

          // Add compatibility edge
          edges.push({
            id: `compatibility:${rule.id}`,
            source: sourceValueId,
            target: targetValueId,
            label: compatibilityType,
            compatibilityType
          });
        }
      }
    }

    return {
      nodes,
      edges
    };
  }

  /**
   * Map a database property compatibility rule to the TypeScript type
   *
   * @param data Database property compatibility rule
   * @returns Mapped property compatibility rule
   */
  private mapCompatibilityRuleFromDb(data: any): PropertyCompatibilityRule {
    return {
      id: data.id,
      relationshipId: data.relationship_id,
      sourceValue: data.source_value,
      targetValue: data.target_value,
      compatibilityType: data.compatibility_type as CompatibilityType,
      reason: data.reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }
}

// Export the singleton instance
export const propertyRelationshipService = PropertyRelationshipService.getInstance();
