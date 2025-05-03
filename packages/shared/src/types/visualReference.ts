import { z } from 'zod';

/**
 * Visual Reference Type
 * 
 * Represents a visual reference for a material property or characteristic.
 */
export interface VisualReference {
  id: string;
  title: string;
  description: string;
  propertyName: string;
  propertyValue: string;
  materialType: string;
  source: 'internal' | 'external';
  sourceUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Visual Reference Image Type
 * 
 * Represents an image associated with a visual reference.
 */
export interface VisualReferenceImage {
  id: string;
  referenceId: string;
  url: string;
  caption: string;
  isPrimary: boolean;
  width: number;
  height: number;
  fileSize: number;
  fileType: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Visual Reference Annotation Type
 * 
 * Represents an annotation on a visual reference image.
 */
export interface VisualReferenceAnnotation {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  type: 'rectangle' | 'circle' | 'arrow' | 'text';
  color: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * Visual Reference Tag Type
 * 
 * Represents a tag for a visual reference.
 */
export interface VisualReferenceTag {
  id: string;
  referenceId: string;
  tag: string;
  createdAt: Date;
  createdBy: string;
}

/**
 * Visual Reference with Images Type
 * 
 * Represents a visual reference with its associated images.
 */
export interface VisualReferenceWithImages extends VisualReference {
  images: VisualReferenceImage[];
}

/**
 * Visual Reference Image with Annotations Type
 * 
 * Represents a visual reference image with its annotations.
 */
export interface VisualReferenceImageWithAnnotations extends VisualReferenceImage {
  annotations: VisualReferenceAnnotation[];
}

/**
 * Visual Reference Create Input Schema
 */
export const VisualReferenceCreateInputSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500),
  propertyName: z.string().min(1),
  propertyValue: z.string().min(1),
  materialType: z.string().min(1),
  source: z.enum(['internal', 'external']),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional()
});

/**
 * Visual Reference Update Input Schema
 */
export const VisualReferenceUpdateInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  propertyName: z.string().min(1).optional(),
  propertyValue: z.string().min(1).optional(),
  materialType: z.string().min(1).optional(),
  source: z.enum(['internal', 'external']).optional(),
  sourceUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional()
});

/**
 * Visual Reference Image Create Input Schema
 */
export const VisualReferenceImageCreateInputSchema = z.object({
  referenceId: z.string().uuid(),
  caption: z.string().max(200),
  isPrimary: z.boolean().optional().default(false)
  // Note: file data will be handled separately through multipart/form-data
});

/**
 * Visual Reference Image Update Input Schema
 */
export const VisualReferenceImageUpdateInputSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().max(200).optional(),
  isPrimary: z.boolean().optional()
});

/**
 * Visual Reference Annotation Create Input Schema
 */
export const VisualReferenceAnnotationCreateInputSchema = z.object({
  imageId: z.string().uuid(),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  text: z.string().max(200),
  type: z.enum(['rectangle', 'circle', 'arrow', 'text']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#FF0000')
});

/**
 * Visual Reference Annotation Update Input Schema
 */
export const VisualReferenceAnnotationUpdateInputSchema = z.object({
  id: z.string().uuid(),
  x: z.number().min(0).optional(),
  y: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  text: z.string().max(200).optional(),
  type: z.enum(['rectangle', 'circle', 'arrow', 'text']).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

/**
 * Visual Reference Tag Create Input Schema
 */
export const VisualReferenceTagCreateInputSchema = z.object({
  referenceId: z.string().uuid(),
  tag: z.string().min(1).max(50)
});

/**
 * Visual Reference Search Input Schema
 */
export const VisualReferenceSearchInputSchema = z.object({
  propertyName: z.string().optional(),
  propertyValue: z.string().optional(),
  materialType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0)
});

// Type definitions derived from schemas
export type VisualReferenceCreateInput = z.infer<typeof VisualReferenceCreateInputSchema>;
export type VisualReferenceUpdateInput = z.infer<typeof VisualReferenceUpdateInputSchema>;
export type VisualReferenceImageCreateInput = z.infer<typeof VisualReferenceImageCreateInputSchema>;
export type VisualReferenceImageUpdateInput = z.infer<typeof VisualReferenceImageUpdateInputSchema>;
export type VisualReferenceAnnotationCreateInput = z.infer<typeof VisualReferenceAnnotationCreateInputSchema>;
export type VisualReferenceAnnotationUpdateInput = z.infer<typeof VisualReferenceAnnotationUpdateInputSchema>;
export type VisualReferenceTagCreateInput = z.infer<typeof VisualReferenceTagCreateInputSchema>;
export type VisualReferenceSearchInput = z.infer<typeof VisualReferenceSearchInputSchema>;
