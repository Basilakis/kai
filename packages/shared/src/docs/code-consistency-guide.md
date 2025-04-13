# Code Consistency Guidelines

This document outlines the best practices for maintaining code consistency across the KAI platform packages.

## Common Issues and Solutions

### Formatting Utilities

**Problem:** Duplicate implementations of formatting functions across packages.

**Solution:**
- All formatting functions should be defined in `packages/shared/src/utils/formatting.ts`
- Other packages should import from the shared package without renaming
- If specific formatting behavior is needed, create wrappers that use the shared functions

```typescript
// INCORRECT: Creating duplicate implementation
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

// CORRECT: Importing from shared package
import { formatDate } from '@shared/utils/formatting';

// CORRECT: Creating wrapper with specific defaults if needed
export function formatCustomDate(date: Date): string {
  return formatDate(date, 'en-US');
}
```

### Model Definitions

**Problem:** Fragmented model definitions duplicated across packages.

**Solution:**
- Core model definitions belong in `packages/shared/src/types/`
- Use Zod schemas for runtime validation
- Provide extension mechanisms for package-specific fields
- Create extension interfaces in each package that extend the shared base

```typescript
// In shared/src/types/user.ts
export interface User {
  id: string;
  email: string;
  name: string;
  // Common fields shared across all packages
}

export type ExtendUser<T> = User & T;

// In client/src/types/user.ts
import { ExtendUser } from '@shared/types/user';

export interface ClientUser extends ExtendUser<{
  displayName?: string;
  avatar?: string;
  preferences?: UserPreferences;
  // Client-specific fields
}> {}

// In server/src/types/user.ts
import { ExtendUser } from '@shared/types/user';

export interface ServerUser extends ExtendUser<{
  hashedPassword?: string;
  roles?: string[];
  lastLogin?: Date;
  // Server-specific fields
}> {}
```

### Import Consistency

**Problem:** Inconsistent import patterns leading to maintenance issues.

**Solution:**
- Use consistent import patterns for external libraries
- For MUI components, prefer direct imports from '@mui/material'
- For icons, use direct imports from '@mui/icons-material'
- Group imports in a consistent order: React, external libraries, internal modules
- Avoid alias imports unless necessary for readability

```typescript
// React imports first
import React, { useState, useEffect } from 'react';

// External libraries next
import { 
  Button, 
  TextField,
  Typography 
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

// Internal modules last, grouped by package
import { formatDate } from '@shared/utils/formatting';
import { UserService } from '../../services/user.service';
```

## Package-Specific Guidelines

### Shared Package

- Contains core model definitions, utility functions, and shared services
- Provides extension mechanisms for all models
- Should have minimal dependencies on other packages
- Exports type definitions, interfaces, and utility functions

### Client Package

- Extends shared models for UI-specific needs
- Contains UI components, client-side services, and state management
- Imports formatting and utility functions from shared package
- Defines client-specific types that extend shared base types

### Server Package

- Extends shared models for database and API-specific needs
- Contains API endpoints, database models, and server-side services
- Imports validation schemas from shared package
- Defines server-specific types that extend shared base types

### Admin Package

- Similar to client package but with admin-specific components
- Extends shared models for admin UI needs
- Imports shared utilities and models

## Service Factory Pattern

**Problem:** Inconsistent service initialization and configuration.

**Solution:**
- Define service interfaces in shared package
- Use factory pattern for service creation
- Configure services through dependency injection
- Provide consistent error handling

```typescript
// In shared/src/services/user.service.interface.ts
export interface UserServiceInterface {
  getUser(id: string): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  // Common operations
}

// In client/src/services/user.service.ts
import { UserServiceInterface } from '@shared/services/user.service.interface';

export class UserService implements UserServiceInterface {
  constructor(private config: ServiceConfig) {}
  
  async getUser(id: string): Promise<User> {
    // Client-specific implementation
  }
  
  // ...
}

// Factory function
export function createUserService(config: ServiceConfig): UserServiceInterface {
  return new UserService(config);
}
```

## Testing and Validation

- Write tests that verify model compatibility across packages
- Validate models against shared schemas
- Test formatting functions with multiple locales and edge cases
- Ensure service implementations conform to shared interfaces

## Documentation Best Practices

- Document extension points in shared models
- Explain package-specific customizations
- Provide examples of correct usage patterns
- Update documentation when shared utilities or models change

By following these guidelines, we can maintain consistency across packages, reduce duplication, and ensure type safety throughout the application.