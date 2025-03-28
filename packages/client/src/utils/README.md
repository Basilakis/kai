# Utility Modules

This directory contains utility modules that provide standardized solutions for common patterns and challenges across the application. These utilities help ensure consistency, type safety, and proper error handling.

## Table of Contents

- [Error Handling](#error-handling)
- [Logging](#logging)
- [Context Management](#context-management)
- [Testing Utilities](#testing-utilities)

## Error Handling

`errorHandling.ts` provides a standardized approach to error handling across the application.

### Key Features

- **Error Categories**: Classify errors into categories like `NETWORK`, `AUTHENTICATION`, etc.
- **Enhanced Error Objects**: Extend standard Error with additional context, timestamps, and categories
- **Error Creation Helpers**: Specialized functions for creating common error types
- **Error Reporting**: Centralized reporting with context

### Usage Examples

```typescript
// Create a network error
const error = createNetworkError(
  'Failed to fetch user data',
  404,
  { userId: '123' }
);

// Enhance any error
const enhancedError = enhanceError(originalError);

// Safe try/catch wrapper
const result = await tryCatchAsync(
  () => fetchData(),
  (error) => showErrorToast(error.message)
);
```

## Logging

`logger.ts` provides structured logging with multiple log levels and context support.

### Key Features

- **Log Levels**: debug, info, warn, error with appropriate filtering
- **Structured Format**: Consistent log format with timestamps and metadata
- **Context Support**: Add contextual information to logs
- **Integration with Error Handling**: Seamless use with error objects

### Usage Examples

```typescript
// Basic logging
logger.info('User logged in', { userId: '123' });

// Error logging
logger.error(
  'Authentication failed',
  error, // Enhanced error from errorHandling.ts
  { attempts: 3 }
);

// With grouped context
logger.withContext({ component: 'LoginForm' }).warn('Invalid credentials');
```

## Context Management

`contextFactory.tsx` provides a type-safe alternative to React's context API with better error handling.

### Key Features

- **Type Safety**: Full TypeScript support with proper typing
- **Error Handling**: Clear errors when using context outside providers
- **Simple API**: Easy-to-use hooks and providers
- **Flexible Options**: Support for default values and custom providers

### Usage Examples

```typescript
// Create a context store
const userStore = createContextStore<UserContextType>({
  displayName: 'User',
  defaultValue: { user: null, isLoading: false }
});

// Use the context in components
function UserProfile() {
  const { user } = userStore.useContext();
  return <div>{user ? user.name : 'Not logged in'}</div>;
}

// Provide values
function App() {
  return (
    <userStore.Provider value={{ user: currentUser, isLoading: false }}>
      <UserProfile />
    </userStore.Provider>
  );
}
```

## Testing Utilities

`testingUtils.ts` provides helpers for writing robust tests that catch common issues.

### Key Features

- **Memory Leak Detection**: Utilities to detect memory leaks in components
- **Component Lifecycle Testing**: Simulate mount and unmount cycles
- **WebSocket Testing**: Mock WebSocket for agent component testing
- **Performance Measurement**: Measure function execution time

### Usage Examples

```typescript
// Test for memory leaks
const { leaked } = checkForMemoryLeaks(() => {
  renderHook(() => useMyHook()).result.current.performOperation();
});

// Test component cleanup
await simulateComponentLifecycle(
  () => {
    const { unmount } = render(<MyComponent />);
    return unmount;
  },
  { remountCount: 5 }
);

// Test WebSocket components
const mockAgent = createMockAgentService();
render(<AgentChat agentService={mockAgent} />);
mockAgent._triggerMessage({ content: 'Test message' });
```

## Best Practices

1. **Use error handling consistently**: Always use the error handling utilities for better debugging.
2. **Add context to logs**: Include relevant context in logs to make debugging easier.
3. **Test for memory leaks**: Use the testing utilities to check for memory leaks in components.
4. **Type everything**: Leverage TypeScript's type system and the enhanced configuration.
5. **Centralize state management**: Use the context factory for type-safe state management.

By following these practices and using the provided utilities, you can avoid common issues like memory leaks, type inconsistencies, and poor error handling that were identified in the code review.