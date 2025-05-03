/**
 * Property Template Routes
 * 
 * This file defines the API routes for property templates.
 */

import { Router } from 'express';
import { 
  createPropertyTemplateHandler,
  getPropertyTemplateHandler,
  updatePropertyTemplateHandler,
  deletePropertyTemplateHandler,
  getPropertyTemplatesHandler,
  applyPropertyTemplateHandler
} from '../controllers/propertyTemplate.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPropertyTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    materialType: z.string().optional(),
    categoryId: z.string().optional(),
    parentTemplateId: z.string().optional(),
    isActive: z.boolean().optional(),
    priority: z.number().optional(),
    properties: z.record(z.string(), z.any()),
    overrideRules: z.array(z.object({
      field: z.string(),
      condition: z.string().optional(),
      value: z.any().optional()
    })).optional()
  })
});

const updatePropertyTemplateSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    materialType: z.string().optional(),
    categoryId: z.string().optional(),
    parentTemplateId: z.string().optional(),
    isActive: z.boolean().optional(),
    priority: z.number().optional(),
    properties: z.record(z.string(), z.any()).optional(),
    overrideRules: z.array(z.object({
      field: z.string(),
      condition: z.string().optional(),
      value: z.any().optional()
    })).optional()
  })
});

const applyPropertyTemplateSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    material: z.record(z.string(), z.any()),
    options: z.object({
      applyDefaults: z.boolean().optional(),
      overrideExisting: z.boolean().optional()
    }).optional()
  })
});

// Routes
router.post(
  '/',
  authenticate,
  validateRequest(createPropertyTemplateSchema),
  createPropertyTemplateHandler
);

router.get(
  '/:id',
  authenticate,
  getPropertyTemplateHandler
);

router.put(
  '/:id',
  authenticate,
  validateRequest(updatePropertyTemplateSchema),
  updatePropertyTemplateHandler
);

router.delete(
  '/:id',
  authenticate,
  deletePropertyTemplateHandler
);

router.get(
  '/',
  authenticate,
  getPropertyTemplatesHandler
);

router.post(
  '/:id/apply',
  authenticate,
  validateRequest(applyPropertyTemplateSchema),
  applyPropertyTemplateHandler
);

export default router;
