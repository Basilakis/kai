/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageDirectory: 'coverage',
  // Different test environments for different types of tests
  projects: [
    {
      displayName: 'components',
      testMatch: ['<rootDir>/src/components/**/__tests__/**/*.test.tsx'],
      testPathIgnorePatterns: ['/node_modules/'],
    },
    {
      displayName: 'analytics',
      testMatch: ['<rootDir>/src/components/analytics/**/__tests__/**/*.test.tsx'],
      testPathIgnorePatterns: ['/node_modules/'],
    },
  ],
};
