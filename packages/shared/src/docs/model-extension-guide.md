# Model Extension Guide

This guide explains the recommended patterns for extending and using shared model definitions across the KAI platform packages.

## Core Principles

1. **Single Source of Truth**: Core model definitions should exist in the `shared` package only
2. **Extension over Duplication**: Extend shared models instead of duplicating them
3. **Package-Specific Extensions**: Add package-specific fields through extension mechanisms
4. **Validation**: Use Zod schemas for validation across all packages

## Shared Package Models

The shared package (`packages/shared/src/types/`) contains core model definitions using:

- TypeScript interfaces for type checking
- Zod schemas for runtime validation
- Extension points for package-specific customizations

### Extension Mechanisms

The shared package provides extension mechanisms for each core model:

```typescript
// Extension type for creating package-specific Material extensions
export type ExtendMaterial<T extends Record<string, unknown>> = Material & T;

// Base types for package extensions
export interface ServerMaterialBase extends Material {
  // MongoDB-specific fields
  _id?: string;
  __v?: number;
  
  // Database-specific tracking
  indexedAt?: Date;
  lastRetrievedAt?: Date;
  
  // Database statuses
  indexStatus?: 'pending' | 'indexed' | 'failed';
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Database metadata
  storageSize?: number;
  lastModifiedBy?: string;
}

export interface ClientMaterialBase extends Material {
  // UI display properties
  thumbnailUrl?: string;
  displayName?: string;
  displayImage?: string;
  
  // UI state
  isFavorite?: boolean;
  isSelected?: boolean;
  isCompared?: boolean;
  
  // Client-side caching
  lastViewedAt?: Date;
  cachedAt?: Date;
  
  // UI presentation properties
  renderingSettings?: {
    quality: 'low' | 'medium' | 'high';
    textureResolution?: number;
  };
}
```

## Client Package Extensions

The client package should extend shared models as follows:

```typescript
import { Material, ExtendMaterial, MaterialWithRelations } from '@shared/types/material';

// Extend using the ExtendMaterial type or ClientMaterialBase
export interface ClientMaterial extends ExtendMaterial<{
  // Client-specific fields...
}> {}

// OR 

export interface ClientMaterial extends ClientMaterialBase {
  // Additional client-specific fields...
}
```

## Server Package Extensions

The server package should extend shared models as follows:

```typescript
import { Material, ExtendMaterial, ServerMaterialBase } from '@shared/types/material';

// Extend using the ExtendMaterial type or ServerMaterialBase
export interface ServerMaterial extends ExtendMaterial<{
  // Server-specific fields...
}> {}

// OR 

export interface ServerMaterial extends ServerMaterialBase {
  // Additional server-specific fields...
}
```

## Database Models

When creating database models (e.g., Mongoose schemas), ensure they follow these best practices:

1. Import and extend the shared types
2. Maintain field name/structure consistency with shared types
3. Add database-specific validation that aligns with Zod schemas
4. Provide conversion methods to/from shared types

Example:

```typescript
import { Material, validateMaterial } from '@shared/types/material';

// Define Mongoose schema that mirrors shared types
const MaterialSchema = new Schema({
  // Fields that match the shared Material interface
});

// Add conversion methods
MaterialSchema.methods.toSharedMaterial = function(): Material {
  // Convert Mongoose document to shared Material type
};

MaterialSchema.statics.fromSharedMaterial = function(material: Material) {
  // Convert shared Material to Mongoose document
};

// Add validation against shared schema
MaterialSchema.methods.validateAgainstSharedSchema = function() {
  return validateMaterial(this.toObject());
};
```

## Common Mistakes to Avoid

1. **Duplication**: Never duplicate model definitions across packages
2. **Inconsistent Fields**: Don't redefine fields with different types or structures
3. **Ignoring Extension Mechanisms**: Always use the provided extension mechanisms
4. **Skipping Validation**: Always validate against shared schemas
5. **Missing Imports**: Always import types from shared package instead of redefining them

## Formatting Utilities

In addition to models, formatting utilities should be consistent across packages:

1. Import all formatting functions from the shared package
2. Don't duplicate formatting logic in package-specific code
3. If needed, create package-specific wrappers around shared formatting functions

```typescript
// DON'T: Duplicate formatting functions
export function formatDate(date: Date): string {
  // Custom implementation
}

// DO: Import from shared
import { formatDate } from '@shared/utils/formatting';

// DO: Create wrapper with specific defaults if needed
export function formatCustomDate(date: Date): string {
  return formatDate(date, 'custom-format');
}
```

## Best Practices Summary

1. **Shared Package**: Define core models and validation schemas
2. **Client Package**: Extend with UI-specific fields and behaviors
3. **Server Package**: Extend with database and API-specific fields
4. **Admin Package**: Extend with admin-specific fields and behaviors
5. **All Packages**: Use shared validation and formatting utilities

By following these patterns, we maintain consistency, reduce duplication, and ensure type safety across the platform.

## When to Update Shared Models

1. Add new fields to shared models only when they're truly cross-package
2. Add package-specific fields through extension mechanisms
3. Update shared validation schemas when adding fields to shared models
4. Maintain backwards compatibility when possible