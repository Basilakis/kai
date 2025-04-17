/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
    '!src/types/**/*',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageDirectory: 'coverage',
  // Different test environments for different types of tests
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/src/tests/integration/',
        '<rootDir>/src/tests/contract/',
      ],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/tests/integration/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/'],
    },
    {
      displayName: 'contract',
      testMatch: ['<rootDir>/src/tests/contract/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/'],
    },
  ],
};
