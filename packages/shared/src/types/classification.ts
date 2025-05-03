/**
 * Enhanced Material Classification Types
 * 
 * These types define the structure for enhanced material classification
 * with hierarchical classification, multiple classification systems,
 * and mapping between different standards.
 */

import { z } from 'zod';

/**
 * Classification System Schema
 */
export const ClassificationSystemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  version: z.string().max(50).optional(),
  isHierarchical: z.boolean().default(true),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional()
});

/**
 * Classification System type
 */
export type ClassificationSystem = z.infer<typeof ClassificationSystemSchema>;

/**
 * Classification System Create Input Schema
 */
export const ClassificationSystemCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  version: z.string().max(50).optional(),
  isHierarchical: z.boolean().default(true),
  isActive: z.boolean().default(true)
});

/**
 * Classification System Create Input type
 */
export type ClassificationSystemCreateInput = z.infer<typeof ClassificationSystemCreateInputSchema>;

/**
 * Classification System Update Input Schema
 */
export const ClassificationSystemUpdateInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  version: z.string().max(50).optional(),
  isHierarchical: z.boolean().optional(),
  isActive: z.boolean().optional()
});

/**
 * Classification System Update Input type
 */
export type ClassificationSystemUpdateInput = z.infer<typeof ClassificationSystemUpdateInputSchema>;

/**
 * Classification Category Schema
 */
export const ClassificationCategorySchema = z.object({
  id: z.string().uuid(),
  systemId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  level: z.number().int().min(1),
  path: z.string(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  // Virtual fields for hierarchical data
  children: z.array(z.lazy(() => ClassificationCategorySchema)).optional(),
  parent: z.lazy(() => ClassificationCategorySchema).optional()
});

/**
 * Classification Category type
 */
export type ClassificationCategory = z.infer<typeof ClassificationCategorySchema>;

/**
 * Classification Category Create Input Schema
 */
export const ClassificationCategoryCreateInputSchema = z.object({
  systemId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  level: z.number().int().min(1).optional(),
  path: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Classification Category Create Input type
 */
export type ClassificationCategoryCreateInput = z.infer<typeof ClassificationCategoryCreateInputSchema>;

/**
 * Classification Category Update Input Schema
 */
export const ClassificationCategoryUpdateInputSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Classification Category Update Input type
 */
export type ClassificationCategoryUpdateInput = z.infer<typeof ClassificationCategoryUpdateInputSchema>;

/**
 * Material Classification Schema
 */
export const MaterialClassificationSchema = z.object({
  id: z.string().uuid(),
  materialId: z.string().uuid(),
  categoryId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(100).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  // Virtual fields for related data
  category: ClassificationCategorySchema.optional()
});

/**
 * Material Classification type
 */
export type MaterialClassification = z.infer<typeof MaterialClassificationSchema>;

/**
 * Material Classification Create Input Schema
 */
export const MaterialClassificationCreateInputSchema = z.object({
  materialId: z.string().uuid(),
  categoryId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(100).optional()
});

/**
 * Material Classification Create Input type
 */
export type MaterialClassificationCreateInput = z.infer<typeof MaterialClassificationCreateInputSchema>;

/**
 * Material Classification Update Input Schema
 */
export const MaterialClassificationUpdateInputSchema = z.object({
  id: z.string().uuid(),
  isPrimary: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().max(100).optional()
});

/**
 * Material Classification Update Input type
 */
export type MaterialClassificationUpdateInput = z.infer<typeof MaterialClassificationUpdateInputSchema>;

/**
 * Classification Mapping Type Enum
 */
export enum MappingType {
  EXACT = 'exact',
  BROADER = 'broader',
  NARROWER = 'narrower',
  RELATED = 'related'
}

/**
 * Classification Mapping Schema
 */
export const ClassificationMappingSchema = z.object({
  id: z.string().uuid(),
  sourceCategoryId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
  mappingType: z.nativeEnum(MappingType),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  // Virtual fields for related data
  sourceCategory: ClassificationCategorySchema.optional(),
  targetCategory: ClassificationCategorySchema.optional()
});

/**
 * Classification Mapping type
 */
export type ClassificationMapping = z.infer<typeof ClassificationMappingSchema>;

/**
 * Classification Mapping Create Input Schema
 */
export const ClassificationMappingCreateInputSchema = z.object({
  sourceCategoryId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
  mappingType: z.nativeEnum(MappingType),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().optional()
});

/**
 * Classification Mapping Create Input type
 */
export type ClassificationMappingCreateInput = z.infer<typeof ClassificationMappingCreateInputSchema>;

/**
 * Classification Mapping Update Input Schema
 */
export const ClassificationMappingUpdateInputSchema = z.object({
  id: z.string().uuid(),
  mappingType: z.nativeEnum(MappingType).optional(),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().optional()
});

/**
 * Classification Mapping Update Input type
 */
export type ClassificationMappingUpdateInput = z.infer<typeof ClassificationMappingUpdateInputSchema>;

/**
 * Material with Classifications Schema
 */
export const MaterialWithClassificationsSchema = z.object({
  materialId: z.string().uuid(),
  classifications: z.array(MaterialClassificationSchema),
  primaryClassification: MaterialClassificationSchema.optional()
});

/**
 * Material with Classifications type
 */
export type MaterialWithClassifications = z.infer<typeof MaterialWithClassificationsSchema>;

/**
 * Classification Tree Node Schema
 */
export const ClassificationTreeNodeSchema = z.object({
  id: z.string().uuid(),
  systemId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  level: z.number().int().min(1),
  path: z.string(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  children: z.array(z.lazy(() => ClassificationTreeNodeSchema)).default([])
});

/**
 * Classification Tree Node type
 */
export type ClassificationTreeNode = z.infer<typeof ClassificationTreeNodeSchema>;

/**
 * Classification System with Categories Schema
 */
export const ClassificationSystemWithCategoriesSchema = z.object({
  system: ClassificationSystemSchema,
  categories: z.array(ClassificationCategorySchema)
});

/**
 * Classification System with Categories type
 */
export type ClassificationSystemWithCategories = z.infer<typeof ClassificationSystemWithCategoriesSchema>;

/**
 * Classification System with Tree Schema
 */
export const ClassificationSystemWithTreeSchema = z.object({
  system: ClassificationSystemSchema,
  tree: z.array(ClassificationTreeNodeSchema)
});

/**
 * Classification System with Tree type
 */
export type ClassificationSystemWithTree = z.infer<typeof ClassificationSystemWithTreeSchema>;
