/**
 * Types for property reference images
 * 
 * These types define the structure for the visual reference library
 * that provides examples of different property values.
 */

import { z } from 'zod';

/**
 * Property Reference Image Schema
 */
export const PropertyReferenceImageSchema = z.object({
  id: z.string().uuid(),
  propertyName: z.string(),
  propertyValue: z.string(),
  materialType: z.string(),
  storagePath: z.string(),
  filename: z.string(),
  fileSize: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  description: z.string().optional(),
  isPrimary: z.boolean().default(false),
  url: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional()
});

/**
 * Property Reference Image type
 */
export type PropertyReferenceImage = z.infer<typeof PropertyReferenceImageSchema>;

/**
 * Property Reference Image Create Input Schema
 */
export const PropertyReferenceImageCreateInputSchema = z.object({
  propertyName: z.string(),
  propertyValue: z.string(),
  materialType: z.string(),
  file: z.any(), // File object
  description: z.string().optional(),
  isPrimary: z.boolean().default(false)
});

/**
 * Property Reference Image Create Input type
 */
export type PropertyReferenceImageCreateInput = z.infer<typeof PropertyReferenceImageCreateInputSchema>;

/**
 * Property Reference Image Update Input Schema
 */
export const PropertyReferenceImageUpdateInputSchema = z.object({
  id: z.string().uuid(),
  description: z.string().optional(),
  isPrimary: z.boolean().optional()
});

/**
 * Property Reference Image Update Input type
 */
export type PropertyReferenceImageUpdateInput = z.infer<typeof PropertyReferenceImageUpdateInputSchema>;

/**
 * Property Reference Image Query Params Schema
 */
export const PropertyReferenceImageQueryParamsSchema = z.object({
  propertyName: z.string().optional(),
  propertyValue: z.string().optional(),
  materialType: z.string().optional(),
  isPrimary: z.boolean().optional()
});

/**
 * Property Reference Image Query Params type
 */
export type PropertyReferenceImageQueryParams = z.infer<typeof PropertyReferenceImageQueryParamsSchema>;
