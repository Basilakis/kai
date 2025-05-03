/**
 * Multilingual Property Dictionary Types
 * 
 * These types define the structure for multilingual property dictionaries
 * that enable cross-language search, identification, and localized property display.
 */

import { z } from 'zod';

/**
 * Language Code Schema
 */
export const LanguageCodeSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100),
  nativeName: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Language Code type
 */
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

/**
 * Language Code Create Input Schema
 */
export const LanguageCodeCreateInputSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100),
  nativeName: z.string().max(100).optional(),
  isActive: z.boolean().default(true)
});

/**
 * Language Code Create Input type
 */
export type LanguageCodeCreateInput = z.infer<typeof LanguageCodeCreateInputSchema>;

/**
 * Language Code Update Input Schema
 */
export const LanguageCodeUpdateInputSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1).max(100).optional(),
  nativeName: z.string().max(100).optional(),
  isActive: z.boolean().optional()
});

/**
 * Language Code Update Input type
 */
export type LanguageCodeUpdateInput = z.infer<typeof LanguageCodeUpdateInputSchema>;

/**
 * Property Name Translation Schema
 */
export const PropertyNameTranslationSchema = z.object({
  id: z.string().uuid(),
  propertyName: z.string().min(1).max(100),
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1).max(200),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional()
});

/**
 * Property Name Translation type
 */
export type PropertyNameTranslation = z.infer<typeof PropertyNameTranslationSchema>;

/**
 * Property Name Translation Create Input Schema
 */
export const PropertyNameTranslationCreateInputSchema = z.object({
  propertyName: z.string().min(1).max(100),
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1).max(200),
  description: z.string().optional()
});

/**
 * Property Name Translation Create Input type
 */
export type PropertyNameTranslationCreateInput = z.infer<typeof PropertyNameTranslationCreateInputSchema>;

/**
 * Property Name Translation Update Input Schema
 */
export const PropertyNameTranslationUpdateInputSchema = z.object({
  id: z.string().uuid(),
  translation: z.string().min(1).max(200).optional(),
  description: z.string().optional()
});

/**
 * Property Name Translation Update Input type
 */
export type PropertyNameTranslationUpdateInput = z.infer<typeof PropertyNameTranslationUpdateInputSchema>;

/**
 * Property Value Translation Schema
 */
export const PropertyValueTranslationSchema = z.object({
  id: z.string().uuid(),
  propertyName: z.string().min(1).max(100),
  propertyValue: z.string().min(1).max(100),
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1).max(200),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional()
});

/**
 * Property Value Translation type
 */
export type PropertyValueTranslation = z.infer<typeof PropertyValueTranslationSchema>;

/**
 * Property Value Translation Create Input Schema
 */
export const PropertyValueTranslationCreateInputSchema = z.object({
  propertyName: z.string().min(1).max(100),
  propertyValue: z.string().min(1).max(100),
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1).max(200),
  description: z.string().optional()
});

/**
 * Property Value Translation Create Input type
 */
export type PropertyValueTranslationCreateInput = z.infer<typeof PropertyValueTranslationCreateInputSchema>;

/**
 * Property Value Translation Update Input Schema
 */
export const PropertyValueTranslationUpdateInputSchema = z.object({
  id: z.string().uuid(),
  translation: z.string().min(1).max(200).optional(),
  description: z.string().optional()
});

/**
 * Property Value Translation Update Input type
 */
export type PropertyValueTranslationUpdateInput = z.infer<typeof PropertyValueTranslationUpdateInputSchema>;

/**
 * Multilingual Property Schema
 */
export const MultilingualPropertySchema = z.object({
  name: z.string().min(1).max(100),
  translations: z.record(z.string(), z.string())
});

/**
 * Multilingual Property type
 */
export type MultilingualProperty = z.infer<typeof MultilingualPropertySchema>;

/**
 * Multilingual Property Value Schema
 */
export const MultilingualPropertyValueSchema = z.object({
  propertyName: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  translations: z.record(z.string(), z.string())
});

/**
 * Multilingual Property Value type
 */
export type MultilingualPropertyValue = z.infer<typeof MultilingualPropertyValueSchema>;

/**
 * Multilingual Material Properties Schema
 */
export const MultilingualMaterialPropertiesSchema = z.object({
  materialId: z.string().uuid(),
  properties: z.record(z.string(), z.string()),
  translations: z.record(z.string(), z.record(z.string(), z.string()))
});

/**
 * Multilingual Material Properties type
 */
export type MultilingualMaterialProperties = z.infer<typeof MultilingualMaterialPropertiesSchema>;
