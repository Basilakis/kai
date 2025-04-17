# Testing Approach

This document outlines the comprehensive testing approach used in the Kai platform, including the different types of tests, how to run them, and best practices for implementing tests across the application. Use this guide when adding new tests to ensure consistency and proper test coverage.

## Testing Philosophy

Our testing approach is based on the following principles:

1. **Test Pyramid**: We follow the test pyramid approach, with more unit tests than integration tests, and more integration tests than end-to-end tests.
2. **Test Coverage**: We aim for high test coverage, but prioritize testing critical paths and business logic.
3. **Test Independence**: Tests should be independent of each other and should not rely on the state of other tests.
4. **Test Readability**: Tests should be easy to read and understand, with clear assertions and minimal setup.
5. **Test Maintainability**: Tests should be easy to maintain and should not break when implementation details change.

## Types of Tests

The Kai platform uses a multi-layered testing approach to ensure comprehensive test coverage. Each type of test serves a specific purpose and should be used in appropriate contexts.

### Unit Tests

Unit tests focus on testing individual functions, methods, or classes in isolation. They are fast, reliable, and provide quick feedback during development.

**When to use**:
- Testing business logic in services
- Validating utility functions
- Verifying controller methods
- Testing data transformations
- Validating model methods

**Example**:
```typescript
// Testing a utility function
describe('formatCurrency', () => {
  it('should format currency correctly', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });
});
```

### Integration Tests

Integration tests verify that different parts of the application work together correctly. They test the integration between components, services, and external dependencies.

**When to use**:
- Testing API endpoints with actual database interactions
- Verifying service-to-service communication
- Testing database queries and transactions
- Validating middleware chains
- Testing authentication flows
- Verifying event handling across components

**Example**:
```typescript
// Testing an API endpoint
describe('User API', () => {
  it('should create a new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'John Doe', email: 'john@example.com' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('John Doe');
  });
});
```

### Contract Tests

Contract tests verify that the integration between our application and external services follows the agreed-upon contract. They ensure that our application correctly formats requests and handles responses from external services.

**When to use**:
- Testing integrations with the MCP server
- Verifying Supabase API interactions
- Testing third-party API integrations
- Validating webhook implementations
- Testing payment processor integrations
- Verifying authentication provider integrations

**Example**:
```typescript
// Testing MCP integration
describe('MCP Integration', () => {
  it('should format requests according to MCP contract', async () => {
    await mcpClientService.generateTimeSeriesForecast(
      'user-123',
      {
        eventType: 'search',
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-02T00:00:00Z',
        forecastPeriods: 7,
        interval: 'day'
      }
    );

    expect(axios.post).toHaveBeenCalledWith(
      'http://mcp-server.example.com/api/v1/analytics/forecast',
      {
        event_type: 'search',
        start_date: '2023-01-01T00:00:00Z',
        end_date: '2023-01-02T00:00:00Z',
        forecast_periods: 7,
        interval: 'day'
      },
      expect.any(Object)
    );
  });
});
```

### Component Tests

Component tests verify that React components render correctly and respond to user interactions as expected. They use React Testing Library to simulate user interactions and verify the rendered output.

**When to use**:
- Testing UI components in isolation
- Verifying component rendering logic
- Testing user interactions (clicks, form inputs)
- Validating component state changes
- Testing component lifecycle behavior
- Verifying accessibility compliance

**Example**:
```typescript
// Testing a React component
describe('Button', () => {
  it('should call onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));

    expect(onClick).toHaveBeenCalled();
  });
});
```

### End-to-End Tests

End-to-end (E2E) tests verify that the entire application works correctly from the user's perspective. They simulate real user scenarios by interacting with the application through the UI.

**When to use**:
- Testing critical user flows (registration, login, checkout)
- Verifying multi-step processes
- Testing cross-component interactions
- Validating application behavior in production-like environments
- Testing browser compatibility

**Example**:
```typescript
// Testing a user registration flow with Cypress
describe('User Registration', () => {
  it('should allow a new user to register', () => {
    cy.visit('/register');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('securePassword123');
    cy.get('input[name="confirmPassword"]').type('securePassword123');
    cy.get('button[type="submit"]').click();

    // Verify successful registration
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="welcome-message"]').should('contain', 'Welcome');
  });
});
```

### Visual Regression Tests

Visual regression tests capture screenshots of components and pages and compare them to baseline images to detect visual changes.

**When to use**:
- Testing UI components for visual consistency
- Verifying layout across different screen sizes
- Detecting unintended visual changes
- Testing theme implementations

**Example**:
```typescript
// Using Storybook and Chromatic for visual testing
describe('Button Component', () => {
  it('should match visual snapshot', async () => {
    // Capture screenshot and compare to baseline
    const image = await page.screenshot();
    expect(image).toMatchImageSnapshot();
  });
});
```

## Running Tests

### Server Tests

```bash
# Run all tests
yarn test

# Run unit tests only
yarn test:unit

# Run integration tests only
yarn test:integration

# Run contract tests only
yarn test:contract
```

### Admin Tests

```bash
# Run all tests
yarn test

# Run component tests only
yarn test:components

# Run analytics component tests only
yarn test:analytics
```

### Client Tests

```bash
# Run all tests
yarn workspace @kai/client test

# Run component tests only
yarn workspace @kai/client test:components

# Run with coverage
yarn workspace @kai/client test --coverage
```

### End-to-End Tests

```bash
# Start the E2E testing environment
yarn e2e:setup

# Run E2E tests
yarn e2e

# Run specific E2E test
yarn e2e --spec "cypress/integration/login.spec.js"
```

## Test Structure

### Test File Organization

#### Server Package
- Unit tests: `src/tests/*.test.ts`
- Integration tests: `src/tests/integration/*.test.ts`
- Contract tests: `src/tests/contract/*.test.ts`
- API tests: `src/tests/api/*.test.ts`

#### Admin Package
- Component tests: `src/components/**/__tests__/*.test.tsx`
- Page tests: `src/pages/**/__tests__/*.test.tsx`
- Hook tests: `src/hooks/**/__tests__/*.test.tsx`
- Utility tests: `src/utils/**/__tests__/*.test.ts`

#### Client Package
- Component tests: `src/components/**/__tests__/*.test.tsx`
- Page tests: `src/pages/**/__tests__/*.test.tsx`
- Hook tests: `src/hooks/**/__tests__/*.test.tsx`
- Utility tests: `src/utils/**/__tests__/*.test.ts`

#### Shared Package
- Utility tests: `src/utils/**/__tests__/*.test.ts`
- Type tests: `src/types/**/__tests__/*.test.ts`

#### End-to-End Tests
- E2E tests: `cypress/integration/**/*.spec.js`

### Test File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- Contract tests: `*.contract.test.ts`
- Component tests: `*.test.tsx`
- E2E tests: `*.spec.js`

### Test Directory Structure

Tests should be organized to mirror the structure of the code they're testing:

```
src/
  components/
    Button/
      Button.tsx
      __tests__/
        Button.test.tsx
  services/
    userService.ts
    __tests__/
      userService.test.ts
  utils/
    formatters.ts
    __tests__/
      formatters.test.ts
```

## Best Practices

### General Best Practices

1. **Use descriptive test names**: Test names should describe what the test is testing and what the expected outcome is.
   ```typescript
   // Good
   it('should return 404 when user is not found', () => {...});

   // Bad
   it('test user not found', () => {...});
   ```

2. **Keep tests small and focused**: Each test should test one thing and have a clear purpose.
   ```typescript
   // Good - separate tests for different behaviors
   it('should validate email format', () => {...});
   it('should validate password length', () => {...});

   // Bad - testing multiple behaviors in one test
   it('should validate form inputs', () => {...});
   ```

3. **Use setup and teardown**: Use `beforeEach` and `afterEach` to set up and tear down test state.
   ```typescript
   describe('UserService', () => {
     let userService: UserService;

     beforeEach(() => {
       userService = new UserService();
     });

     afterEach(() => {
       // Clean up resources
     });

     it('should create a user', () => {...});
   });
   ```

4. **Mock external dependencies**: Use Jest's mocking capabilities to mock external dependencies.
   ```typescript
   jest.mock('../../services/databaseService', () => ({
     query: jest.fn().mockResolvedValue([{ id: 1, name: 'Test User' }])
   }));
   ```

5. **Use test data factories**: Create factory functions to generate test data.
   ```typescript
   const createTestUser = (overrides = {}) => ({
     id: 1,
     name: 'Test User',
     email: 'test@example.com',
     ...overrides
   });
   ```

6. **Test edge cases**: Test edge cases and error conditions, not just the happy path.
   ```typescript
   it('should handle empty input', () => {...});
   it('should handle maximum input length', () => {...});
   it('should handle special characters', () => {...});
   ```

7. **Use snapshots sparingly**: Use snapshots only for stable UI components, not for testing business logic.
   ```typescript
   it('should render correctly', () => {
     const { container } = render(<Button>Click me</Button>);
     expect(container).toMatchSnapshot();
   });
   ```

8. **Keep tests independent**: Tests should not depend on the state of other tests.
   ```typescript
   // Good - each test sets up its own state
   it('test A', () => {
     const data = setupTestData();
     // Test using data
   });

   it('test B', () => {
     const data = setupTestData();
     // Test using data
   });
   ```

9. **Test behavior, not implementation**: Test what the code does, not how it does it.
   ```typescript
   // Good - testing behavior
   it('should show error message when login fails', async () => {
     render(<LoginForm />);
     fireEvent.click(screen.getByText('Login'));
     expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
   });
   ```

10. **Write tests first**: Consider writing tests before implementing features (TDD).

### Package-Specific Best Practices

#### Server Package

1. **Test database interactions with real queries**: Use a test database for integration tests.
   ```typescript
   it('should save user to database', async () => {
     const user = createTestUser();
     await userService.createUser(user);

     const savedUser = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
     expect(savedUser).toEqual(user);
   });
   ```

2. **Test API endpoints with supertest**: Use supertest to test API endpoints.
   ```typescript
   it('should return 200 for valid request', async () => {
     const response = await request(app)
       .get('/api/users/1')
       .set('Authorization', `Bearer ${testToken}`);

     expect(response.status).toBe(200);
     expect(response.body).toEqual(expect.objectContaining({
       id: 1,
       name: expect.any(String)
     }));
   });
   ```

3. **Test middleware in isolation**: Test middleware functions separately from routes.
   ```typescript
   it('should call next() for authenticated user', () => {
     const req = { user: { id: 1 } };
     const res = {};
     const next = jest.fn();

     authMiddleware(req, res, next);

     expect(next).toHaveBeenCalled();
   });
   ```

#### Admin/Client Packages

1. **Test component rendering**: Verify that components render correctly.
   ```typescript
   it('should render the component', () => {
     render(<Button>Click me</Button>);
     expect(screen.getByText('Click me')).toBeInTheDocument();
   });
   ```

2. **Test user interactions**: Verify that components respond to user interactions.
   ```typescript
   it('should call onClick when clicked', () => {
     const onClick = jest.fn();
     render(<Button onClick={onClick}>Click me</Button>);

     fireEvent.click(screen.getByText('Click me'));

     expect(onClick).toHaveBeenCalled();
   });
   ```

3. **Test form submissions**: Verify that forms submit correctly.
   ```typescript
   it('should submit the form with correct values', async () => {
     const onSubmit = jest.fn();
     render(<LoginForm onSubmit={onSubmit} />);

     fireEvent.change(screen.getByLabelText('Email'), {
       target: { value: 'test@example.com' }
     });

     fireEvent.change(screen.getByLabelText('Password'), {
       target: { value: 'password123' }
     });

     fireEvent.click(screen.getByText('Login'));

     expect(onSubmit).toHaveBeenCalledWith({
       email: 'test@example.com',
       password: 'password123'
     });
   });
   ```

4. **Test hooks with renderHook**: Use renderHook to test custom hooks.
   ```typescript
   it('should update count when increment is called', () => {
     const { result } = renderHook(() => useCounter());

     act(() => {
       result.current.increment();
     });

     expect(result.current.count).toBe(1);
   });
   ```

## Mocking

### Mocking External Dependencies

```typescript
// Mock axios
jest.mock('axios');

// Mock a service
jest.mock('../../services/userService', () => ({
  getUser: jest.fn().mockResolvedValue({ id: 1, name: 'John Doe' }),
}));
```

### Mocking React Components

```typescript
// Mock a React component
jest.mock('../../components/Button', () => ({
  __esModule: true,
  default: (props) => <button {...props} data-testid="mocked-button" />,
}));
```

### Mocking Supabase

```typescript
// Mock Supabase client
jest.mock('../../services/supabase/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 1, name: 'Test User' },
      error: null
    }),
    insert: jest.fn().mockResolvedValue({
      data: { id: 1 },
      error: null
    }),
    update: jest.fn().mockResolvedValue({
      data: { id: 1 },
      error: null
    }),
    delete: jest.fn().mockResolvedValue({
      data: {},
      error: null
    })
  }
}));
```

### Mocking MCP Client

```typescript
// Mock MCP client
jest.mock('../../services/mcp/mcpClientService', () => ({
  isMCPAvailable: jest.fn().mockResolvedValue(true),
  generateTimeSeriesForecast: jest.fn().mockResolvedValue({
    historical: [],
    forecast: [],
    modelInfo: { name: 'TestModel', version: '1.0' }
  }),
  detectAnalyticsAnomalies: jest.fn().mockResolvedValue({
    timeSeries: [],
    anomalies: [],
    statistics: { mean: 10, stdDev: 2 }
  }),
  predictUserBehavior: jest.fn().mockResolvedValue({
    userId: 'test-user',
    predictions: [],
    userInsights: { activityLevel: 'medium' }
  })
}));
```

### Mocking Environment Variables

```typescript
// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  process.env.API_URL = 'http://test-api.example.com';
  process.env.JWT_SECRET = 'test-jwt-secret';
});

afterEach(() => {
  process.env = originalEnv;
});
```

## Testing Tools

### Jest

Jest is our primary testing framework for both frontend and backend tests. It provides a comprehensive testing solution with built-in assertion library, mocking capabilities, and code coverage reporting.

**Configuration**:
- Server: `packages/server/jest.config.js`
- Admin: `packages/admin/jest.config.js`
- Client: `packages/client/jest.config.js`
- Shared: `packages/shared/jest.config.js`

### React Testing Library

React Testing Library is used for testing React components. It encourages testing components from the user's perspective, focusing on behavior rather than implementation details.

**Example**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Button', () => {
  it('should render correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Supertest

Supertest is used for testing HTTP endpoints in the server package. It provides a high-level abstraction for testing HTTP requests and responses.

**Example**:
```typescript
import request from 'supertest';
import app from '../../app';

describe('User API', () => {
  it('should return user data', async () => {
    const response = await request(app)
      .get('/api/users/1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name');
  });
});
```

### Cypress

Cypress is used for end-to-end testing. It allows testing the application from the user's perspective by automating browser interactions.

**Example**:
```typescript
describe('Login Flow', () => {
  it('should log in successfully', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## Continuous Integration

Tests are run automatically on every pull request and push to the main branch using GitHub Actions. The CI pipeline will fail if any tests fail, ensuring that only code with passing tests is merged.

**CI Workflow**:
- Unit and integration tests run on every PR
- Contract tests run on every PR
- Component tests run on every PR
- E2E tests run on selected PRs (tagged with `e2e-test`)

## Test Coverage

We use Jest's built-in coverage reporting to track test coverage. Coverage reports are generated after running tests and can be viewed in the `coverage` directory.

```bash
# Generate coverage report
yarn test -- --coverage
```

**Coverage Targets**:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Testing Decision Guide

Use this guide to determine which type of test to write for different parts of the application:

| Component Type | Primary Test Type | Secondary Test Type | Example |
|----------------|-------------------|---------------------|----------|
| UI Components | Component Tests | Visual Regression | Button, Card, Modal |
| Pages | Component Tests | E2E Tests | Dashboard, Login, Profile |
| Hooks | Unit Tests | Integration Tests | useAuth, useForm, useData |
| Utilities | Unit Tests | - | formatDate, validateEmail |
| API Controllers | Unit Tests | Integration Tests | UserController, AuthController |
| Services | Unit Tests | Integration Tests | UserService, AuthService |
| Database Models | Integration Tests | - | User, Material, Collection |
| Middleware | Unit Tests | Integration Tests | Auth, Logging, Error Handling |
| External Integrations | Contract Tests | Integration Tests | MCP, Payment Processors |
| Critical Flows | E2E Tests | - | Registration, Checkout, Material Upload |

## Conclusion

Following this testing approach ensures that our application is well-tested, reliable, and maintainable. By using a combination of unit tests, integration tests, contract tests, component tests, and end-to-end tests, we can have confidence that our application works as expected and that changes don't introduce regressions.

When adding new features or modifying existing ones, refer to this guide to determine the appropriate testing strategy. Remember that tests are an investment in the long-term health of the codebase, and the time spent writing good tests will pay off in reduced bugs and easier maintenance.
