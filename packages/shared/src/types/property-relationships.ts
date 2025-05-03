/**
 * Property Relationship Types
 * 
 * These types define the structure for the property relationship graph
 * that defines how different material properties relate to each other.
 */

import { z } from 'zod';

/**
 * Relationship Types
 */
export enum RelationshipType {
  CORRELATION = 'correlation',
  DEPENDENCY = 'dependency',
  COMPATIBILITY = 'compatibility',
  EXCLUSION = 'exclusion',
  CAUSATION = 'causation',
  DERIVATION = 'derivation',
  ASSOCIATION = 'association'
}

/**
 * Compatibility Types
 */
export enum CompatibilityType {
  COMPATIBLE = 'compatible',
  RECOMMENDED = 'recommended',
  NOT_RECOMMENDED = 'not_recommended',
  INCOMPATIBLE = 'incompatible'
}

/**
 * Property Relationship Schema
 */
export const PropertyRelationshipSchema = z.object({
  id: z.string().uuid(),
  sourceProperty: z.string(),
  targetProperty: z.string(),
  relationshipType: z.nativeEnum(RelationshipType),
  materialType: z.string(),
  strength: z.number().min(0).max(1).default(1.0),
  bidirectional: z.boolean().default(false),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional()
});

/**
 * Property Relationship type
 */
export type PropertyRelationship = z.infer<typeof PropertyRelationshipSchema>;

/**
 * Property Relationship Create Input Schema
 */
export const PropertyRelationshipCreateInputSchema = z.object({
  sourceProperty: z.string(),
  targetProperty: z.string(),
  relationshipType: z.nativeEnum(RelationshipType),
  materialType: z.string(),
  strength: z.number().min(0).max(1).default(1.0),
  bidirectional: z.boolean().default(false),
  description: z.string().optional()
});

/**
 * Property Relationship Create Input type
 */
export type PropertyRelationshipCreateInput = z.infer<typeof PropertyRelationshipCreateInputSchema>;

/**
 * Property Relationship Update Input Schema
 */
export const PropertyRelationshipUpdateInputSchema = z.object({
  id: z.string().uuid(),
  strength: z.number().min(0).max(1).optional(),
  bidirectional: z.boolean().optional(),
  description: z.string().optional()
});

/**
 * Property Relationship Update Input type
 */
export type PropertyRelationshipUpdateInput = z.infer<typeof PropertyRelationshipUpdateInputSchema>;

/**
 * Property Value Correlation Schema
 */
export const PropertyValueCorrelationSchema = z.object({
  id: z.string().uuid(),
  relationshipId: z.string().uuid(),
  sourceValue: z.string(),
  targetValue: z.string(),
  correlationStrength: z.number().min(-1).max(1).default(0),
  sampleSize: z.number().int().min(0).default(0),
  confidenceInterval: z.number().min(0).max(1).default(0),
  isStatistical: z.boolean().default(true),
  isManual: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Property Value Correlation type
 */
export type PropertyValueCorrelation = z.infer<typeof PropertyValueCorrelationSchema>;

/**
 * Property Value Correlation Create Input Schema
 */
export const PropertyValueCorrelationCreateInputSchema = z.object({
  relationshipId: z.string().uuid(),
  sourceValue: z.string(),
  targetValue: z.string(),
  correlationStrength: z.number().min(-1).max(1).default(0),
  sampleSize: z.number().int().min(0).default(0),
  confidenceInterval: z.number().min(0).max(1).default(0),
  isStatistical: z.boolean().default(true),
  isManual: z.boolean().default(false)
});

/**
 * Property Value Correlation Create Input type
 */
export type PropertyValueCorrelationCreateInput = z.infer<typeof PropertyValueCorrelationCreateInputSchema>;

/**
 * Property Value Correlation Update Input Schema
 */
export const PropertyValueCorrelationUpdateInputSchema = z.object({
  id: z.string().uuid(),
  correlationStrength: z.number().min(-1).max(1).optional(),
  sampleSize: z.number().int().min(0).optional(),
  confidenceInterval: z.number().min(0).max(1).optional(),
  isStatistical: z.boolean().optional(),
  isManual: z.boolean().optional()
});

/**
 * Property Value Correlation Update Input type
 */
export type PropertyValueCorrelationUpdateInput = z.infer<typeof PropertyValueCorrelationUpdateInputSchema>;

/**
 * Property Compatibility Rule Schema
 */
export const PropertyCompatibilityRuleSchema = z.object({
  id: z.string().uuid(),
  relationshipId: z.string().uuid(),
  sourceValue: z.string(),
  targetValue: z.string(),
  compatibilityType: z.nativeEnum(CompatibilityType),
  reason: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional()
});

/**
 * Property Compatibility Rule type
 */
export type PropertyCompatibilityRule = z.infer<typeof PropertyCompatibilityRuleSchema>;

/**
 * Property Compatibility Rule Create Input Schema
 */
export const PropertyCompatibilityRuleCreateInputSchema = z.object({
  relationshipId: z.string().uuid(),
  sourceValue: z.string(),
  targetValue: z.string(),
  compatibilityType: z.nativeEnum(CompatibilityType),
  reason: z.string().optional()
});

/**
 * Property Compatibility Rule Create Input type
 */
export type PropertyCompatibilityRuleCreateInput = z.infer<typeof PropertyCompatibilityRuleCreateInputSchema>;

/**
 * Property Compatibility Rule Update Input Schema
 */
export const PropertyCompatibilityRuleUpdateInputSchema = z.object({
  id: z.string().uuid(),
  compatibilityType: z.nativeEnum(CompatibilityType).optional(),
  reason: z.string().optional()
});

/**
 * Property Compatibility Rule Update Input type
 */
export type PropertyCompatibilityRuleUpdateInput = z.infer<typeof PropertyCompatibilityRuleUpdateInputSchema>;

/**
 * Property Validation Request Schema
 */
export const PropertyValidationRequestSchema = z.object({
  materialType: z.string(),
  properties: z.record(z.string())
});

/**
 * Property Validation Request type
 */
export type PropertyValidationRequest = z.infer<typeof PropertyValidationRequestSchema>;

/**
 * Property Validation Result Schema
 */
export const PropertyValidationResultSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.object({
    sourceProperty: z.string(),
    sourceValue: z.string(),
    targetProperty: z.string(),
    targetValue: z.string(),
    compatibilityType: z.nativeEnum(CompatibilityType),
    reason: z.string().optional()
  })).optional(),
  recommendations: z.array(z.object({
    property: z.string(),
    currentValue: z.string().optional(),
    recommendedValue: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string().optional()
  })).optional()
});

/**
 * Property Validation Result type
 */
export type PropertyValidationResult = z.infer<typeof PropertyValidationResultSchema>;

/**
 * Property Recommendation Request Schema
 */
export const PropertyRecommendationRequestSchema = z.object({
  materialType: z.string(),
  properties: z.record(z.string()),
  targetProperty: z.string()
});

/**
 * Property Recommendation Request type
 */
export type PropertyRecommendationRequest = z.infer<typeof PropertyRecommendationRequestSchema>;

/**
 * Property Recommendation Result Schema
 */
export const PropertyRecommendationResultSchema = z.object({
  property: z.string(),
  recommendations: z.array(z.object({
    value: z.string(),
    confidence: z.number().min(0).max(1),
    sources: z.array(z.object({
      sourceProperty: z.string(),
      sourceValue: z.string(),
      relationshipType: z.nativeEnum(RelationshipType),
      strength: z.number().min(0).max(1)
    })).optional()
  }))
});

/**
 * Property Recommendation Result type
 */
export type PropertyRecommendationResult = z.infer<typeof PropertyRecommendationResultSchema>;

/**
 * Property Graph Visualization Node Schema
 */
export const PropertyGraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['property', 'value']),
  materialType: z.string().optional(),
  group: z.string().optional()
});

/**
 * Property Graph Visualization Node type
 */
export type PropertyGraphNode = z.infer<typeof PropertyGraphNodeSchema>;

/**
 * Property Graph Visualization Edge Schema
 */
export const PropertyGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  type: z.nativeEnum(RelationshipType).optional(),
  strength: z.number().min(0).max(1).optional(),
  compatibilityType: z.nativeEnum(CompatibilityType).optional()
});

/**
 * Property Graph Visualization Edge type
 */
export type PropertyGraphEdge = z.infer<typeof PropertyGraphEdgeSchema>;

/**
 * Property Graph Visualization Schema
 */
export const PropertyGraphVisualizationSchema = z.object({
  nodes: z.array(PropertyGraphNodeSchema),
  edges: z.array(PropertyGraphEdgeSchema)
});

/**
 * Property Graph Visualization type
 */
export type PropertyGraphVisualization = z.infer<typeof PropertyGraphVisualizationSchema>;
