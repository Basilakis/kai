/**
 * Validation utilities for the application
 */

import * as z from 'zod';

/**
 * Base schema for all materials
 */
export const baseMaterialSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  manufacturer: z.string().optional(),
  collection: z.string().optional(),
  series: z.string().optional(),
  
  // Physical properties - common to all materials
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive().optional(),
    unit: z.enum(['mm', 'cm', 'inch', 'm', 'ft'])
  }),
  
  color: z.object({
    name: z.string().min(1),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    rgb: z.object({
      r: z.number().min(0).max(255),
      g: z.number().min(0).max(255),
      b: z.number().min(0).max(255)
    }).optional(),
    primary: z.boolean(),
    secondary: z.array(z.string()).optional()
  }),
  
  // Material type - extensible for future material types
  materialType: z.enum([
    'tile',
    'stone',
    'wood',
    'laminate',
    'vinyl',
    'carpet',
    'metal',
    'glass',
    'concrete',
    'ceramic',
    'porcelain',
    'other'
  ]),
  
  // Surface properties - common to most materials
  finish: z.string(),
  pattern: z.string().optional(),
  texture: z.string().optional(),
  
  // Technical specifications - can vary by material type
  technicalSpecs: z.record(z.string(), z.any()).optional(),
  
  // Images
  images: z.array(z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    type: z.enum(['primary', 'secondary', 'detail', 'room-scene']),
    width: z.number().positive(),
    height: z.number().positive(),
    fileSize: z.number().optional(),
    extractedFrom: z.object({
      catalogId: z.string().uuid(),
      page: z.number().positive(),
      coordinates: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive()
      }).optional()
    }).optional()
  })),
  
  // Metadata
  tags: z.array(z.string()),
  catalogId: z.string().uuid(),
  catalogPage: z.number().positive().optional(),
  extractedAt: z.date(),
  updatedAt: z.date(),
  
  // Vector representation for similarity search
  vectorRepresentation: z.array(z.number()).optional()
});

/**
 * Tile-specific schema that extends the base material schema
 */
export const tileSchema = baseMaterialSchema.extend({
  materialType: z.literal('tile'),
  
  // Tile-specific properties
  technicalSpecs: z.object({
    waterAbsorption: z.number().optional(),
    slipResistance: z.string().optional(),
    frostResistance: z.boolean().optional(),
    chemicalResistance: z.string().optional(),
    scratchResistance: z.string().optional(),
    peiRating: z.number().min(1).max(5).optional(),
    mohs: z.number().optional()
  }).optional()
});

/**
 * Stone-specific schema that extends the base material schema
 */
export const stoneSchema = baseMaterialSchema.extend({
  materialType: z.literal('stone'),
  
  // Stone-specific properties
  technicalSpecs: z.object({
    density: z.number().optional(),
    waterAbsorption: z.number().optional(),
    compressiveStrength: z.number().optional(),
    flexuralStrength: z.number().optional(),
    abrasionResistance: z.number().optional(),
    porosity: z.number().optional()
  }).optional()
});

/**
 * Wood-specific schema that extends the base material schema
 */
export const woodSchema = baseMaterialSchema.extend({
  materialType: z.literal('wood'),
  
  // Wood-specific properties
  technicalSpecs: z.object({
    hardness: z.number().optional(), // Janka hardness rating
    species: z.string().optional(),
    grainPattern: z.string().optional(),
    moisture: z.number().optional(),
    treatment: z.string().optional()
  }).optional()
});

/**
 * User validation schema
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'user', 'guest']),
  permissions: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    resource: z.string(),
    action: z.enum(['create', 'read', 'update', 'delete', 'manage'])
  })),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    type: z.string().optional(),
    website: z.string().url().optional(),
    logo: z.string().optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string()
    }).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    members: z.array(z.string().uuid()),
    createdAt: z.date(),
    updatedAt: z.date(),
    status: z.enum(['active', 'inactive']),
    subscription: z.object({
      id: z.string().uuid(),
      plan: z.enum(['free', 'basic', 'premium', 'enterprise']),
      startDate: z.date(),
      endDate: z.date().optional(),
      status: z.enum(['active', 'inactive', 'trial', 'expired']),
      paymentMethod: z.string().optional(),
      autoRenew: z.boolean(),
      price: z.number().optional(),
      currency: z.string().optional(),
      features: z.array(z.string()).optional()
    }).optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }).optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    language: z.string(),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      inApp: z.boolean()
    }),
    displayDensity: z.enum(['compact', 'comfortable', 'spacious']).optional(),
    defaultView: z.string().optional(),
    savedSearches: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      query: z.record(z.string(), z.any()),
      createdAt: z.date(),
      lastUsedAt: z.date().optional()
    })).optional(),
    favoriteItems: z.array(z.string().uuid()).optional()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Crawler configuration validation schema
 */
export const crawlerConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  provider: z.enum(['firecrawl', 'jina', 'internal', 'custom']),
  status: z.enum(['active', 'paused', 'completed', 'failed', 'scheduled']),
  
  startUrls: z.array(z.string().url()),
  allowedDomains: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  maxDepth: z.number().nonnegative().optional(),
  maxPages: z.number().positive().optional(),
  
  schedule: z.object({
    frequency: z.enum(['once', 'hourly', 'daily', 'weekly', 'monthly', 'custom']),
    cronExpression: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    timeZone: z.string().optional()
  }).optional(),
  lastRunAt: z.date().optional(),
  nextRunAt: z.date().optional(),
  
  extractionRules: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    type: z.enum(['material', 'tile', 'product', 'specification', 'image', 'custom']),
    selector: z.object({
      type: z.enum(['css', 'xpath', 'regex', 'jsonpath']),
      value: z.string()
    }),
    attribute: z.string().optional(),
    multiple: z.boolean(),
    required: z.boolean(),
    validation: z.object({
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      allowEmpty: z.boolean().optional()
    }).optional(),
    transformation: z.object({
      trim: z.boolean().optional(),
      lowercase: z.boolean().optional(),
      uppercase: z.boolean().optional(),
      replace: z.array(z.object({
        pattern: z.string(),
        replacement: z.string()
      })).optional()
    }).optional(),
    mapping: z.record(z.string(), z.string()).optional()
  })),
  
  processingOptions: z.object({
    extractImages: z.boolean(),
    extractText: z.boolean(),
    extractLinks: z.boolean(),
    followLinks: z.boolean(),
    respectRobotsTxt: z.boolean(),
    delay: z.number().optional(),
    concurrency: z.number().optional(),
    timeout: z.number().optional(),
    retries: z.number().optional()
  }).optional(),
  
  authentication: z.object({
    type: z.enum(['basic', 'form', 'oauth', 'cookie', 'header']),
    username: z.string().optional(),
    password: z.string().optional(),
    formSelector: z.string().optional(),
    usernameField: z.string().optional(),
    passwordField: z.string().optional(),
    submitButton: z.string().optional(),
    loginUrl: z.string().optional(),
    cookies: z.record(z.string(), z.string()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    token: z.string().optional()
  }).optional(),
  
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string())
});

/**
 * Validation functions
 */

/**
 * Validates a material object
 * @param material The material object to validate
 * @returns The validated material or throws an error
 */
export function validateMaterial(material: any) {
  // Determine the material type and use the appropriate schema
  switch (material.materialType) {
    case 'tile':
      return tileSchema.parse(material);
    case 'stone':
      return stoneSchema.parse(material);
    case 'wood':
      return woodSchema.parse(material);
    default:
      return baseMaterialSchema.parse(material);
  }
}

/**
 * Validates a user object
 * @param user The user object to validate
 * @returns The validated user or throws an error
 */
export function validateUser(user: any) {
  return userSchema.parse(user);
}

/**
 * Validates a crawler configuration object
 * @param config The crawler configuration object to validate
 * @returns The validated configuration or throws an error
 */
export function validateCrawlerConfig(config: any) {
  return crawlerConfigSchema.parse(config);
}