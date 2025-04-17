/**
 * Jest Setup File for React Testing
 * 
 * This file runs before each test file and sets up the test environment.
 */

// Import Jest DOM extensions
import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock MUI components that cause issues in tests
jest.mock('@mui/material', () => {
  const originalModule = jest.requireActual('@mui/material');
  
  return {
    __esModule: true,
    ...originalModule,
    useMediaQuery: () => false,
  };
});

// Mock recharts
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// Global beforeAll and afterAll hooks
beforeAll(() => {
  // Setup global test environment
  console.log('Setting up React test environment...');
});

afterAll(() => {
  // Clean up global test environment
  console.log('Cleaning up React test environment...');
});

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out expected errors during tests
  if (
    args[0]?.includes('Warning:') ||
    args[0]?.includes('Error:') ||
    args[0]?.includes('test environment') ||
    args[0]?.includes('React does not recognize the') ||
    args[0]?.includes('Invalid prop')
  ) {
    return;
  }
  originalConsoleError(...args);
};
