/**
 * Jest Setup File
 * 
 * This file runs before each test file and sets up the test environment.
 */

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SUPABASE_URL = 'https://test-supabase-url.com';
process.env.SUPABASE_KEY = 'test-supabase-key';
process.env.MCP_SERVER_URL = 'http://test-mcp-server.com';
process.env.MCP_TIMEOUT = '5000';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

// Global beforeAll and afterAll hooks
beforeAll(() => {
  // Setup global test environment
  console.log('Setting up test environment...');
});

afterAll(() => {
  // Clean up global test environment
  console.log('Cleaning up test environment...');
});

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out expected errors during tests
  if (
    args[0]?.includes('Warning:') ||
    args[0]?.includes('Error:') ||
    args[0]?.includes('test environment')
  ) {
    return;
  }
  originalConsoleError(...args);
};
