# Code Organization Patterns

This document outlines the recommended patterns for organizing code across the KAI platform packages, focusing on reducing duplication, improving type safety, and establishing consistent patterns.

## Formatting Utilities

### Current Status
- Primary formatting utilities are defined in `shared/src/utils/formatting.ts`
- Some implementations are duplicated across packages

### Recommended Pattern
1. **Centralized Implementation**: All formatting functions should be defined in `shared/src/utils/formatting.ts`
2. **Standard Import Path**: Use consistent imports:
   ```typescript
   // Recommended import pattern 
   import { formatDate, formatFileSize } from '../../../shared/src/utils/formatting';
   ```
3. **Extension Mechanism**: Package-specific formatting needs should extend the base utilities:
   ```typescript
   // Example: Extending a shared utility
   import { formatDate } from '../../../shared/src/utils/formatting';
   
   export function formatSpecializedDate(date: string): string {
     const baseFormat = formatDate(date);
     // Add specialized formatting logic
     return `${baseFormat} (specialized)`;
   }
   ```

### Implementation Guidelines
- Remove duplicate implementations from:
  - `packages/agents/setup.sh` (done)
  - `packages/client/src/pages/history.tsx` 
  - `packages/admin/src/pages/image-recognition/index.tsx`
  - `packages/admin/src/components/datasets/DatasetUploader.tsx`
- Use consistent names: e.g., `formatDate` not `formatDateTime` for the same function

## Model Definitions

### Current Status
- Core model interfaces are defined in `shared/src/types/material.ts`
- Extended in client and server packages, but with some duplication

### Recommended Pattern
1. **Base Models in Shared**: Define core interfaces and types in `shared/src/types/[model-name].ts`
2. **Extension Mechanism**: Use package-specific extension interfaces:
   ```typescript
   // In shared/src/types/material.ts
   export interface Material {
     id: string;
     name: string;
     // Common properties
   }
   
   // Extension mechanism
   export type ExtendMaterial<T> = Material & T;
   
   // In client/src/types/material.ts
   import { ExtendMaterial } from '../../../shared/src/types/material';
   
   export interface ClientMaterialExtension {
     uiState: 'selected' | 'highlighted' | 'default';
     // Client-specific properties
   }
   
   export type ClientMaterial = ExtendMaterial<ClientMaterialExtension>;
   ```
3. **Validation Schemas**: Include Zod validation schemas with models:
   ```typescript
   // In shared/src/types/material.ts
   import { z } from 'zod';
   
   export const materialSchema = z.object({
     id: z.string(),
     name: z.string(),
     // Schema validation rules
   });
   
   export type Material = z.infer<typeof materialSchema>;
   ```

### Implementation Guidelines
- Server models should use extension mechanism (already fixed in `server/src/types/material.ts`)
- All models should have Zod validation schemas
- Avoid using `any` for relationship types

## Service Factories

### Current Status
- Inconsistent patterns across packages
- Duplicate initialization code

### Recommended Pattern
1. **Base Service Interface**: Define common service behaviors:
   ```typescript
   // In shared/src/services/base.service.ts
   export interface BaseService {
     initialize(): Promise<void>;
     healthCheck(): Promise<boolean>;
     // Common service methods
   }
   ```
2. **Factory Pattern**:
   ```typescript
   // In shared/src/services/service-factory.ts
   export class ServiceFactory {
     static createMaterialService(config: Config): MaterialService {
       return new MaterialServiceImpl(config);
     }
     
     // Factory methods for other services
   }
   ```
3. **Configuration Management**:
   ```typescript
   // In shared/src/utils/config.ts
   export interface Config {
     apiUrl: string;
     timeout: number;
     // Common configuration properties
   }
   
   export function loadConfig(): Config {
     // Load configuration from environment or other sources
   }
   ```

### Implementation Guidelines
- Standardize error handling across services
- Use composition over inheritance for service implementation
- Centralize configuration management

## Best Practices for Shared Code

1. **Import Consistency**:
   - Use relative paths when importing from shared: `../../../../shared/src/utils/formatting`
   - Consider setting up path aliases in tsconfig.json for cleaner imports

2. **Type Safety**:
   - Avoid `any` types
   - Use proper TypeScript type definitions
   - Add appropriate type guards where needed

3. **Documentation**:
   - Add JSDoc comments to all exported functions and types
   - Include examples where appropriate

4. **Testing**:
   - Write tests for shared utilities and models
   - Ensure full coverage of edge cases

## Implementation Roadmap

1. ✅ Consolidate formatting utilities (fixed in agents/setup.sh)
2. ✅ Fix model type extensions (fixed in server/src/types/material.ts)
3. ✅ Add model extension documentation (added model-extension-guide.md)
4. 🔲 Add Zod validation schemas for all models
5. 🔲 Implement service factory pattern 
6. 🔲 Standardize configuration management

By following these patterns consistently, we'll reduce code duplication, improve maintainability, and enhance type safety across the codebase.