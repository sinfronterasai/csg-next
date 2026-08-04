/** @type {import('jest').Config} */
process.env.NODE_ENV = 'test';
const path = require('path');
module.exports = {
  rootDir: __dirname,
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests', '<rootDir>/src'],
      testMatch: ['**/*.test.ts'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      transform: {
        '^.+\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', allowJs: true } }],
      },
    },
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/tests', '<rootDir>/src'],
      testMatch: ['**/*.test.tsx'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      transform: {
        '^.+\.(ts|tsx)$': ['ts-jest', { isolatedModules: true, tsconfig: { jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', allowJs: true } }],
      },
    },
  ],
  collectCoverageFrom: ['src/lib/tarot/**/*.ts', 'src/app/api/tarot/**/*.ts'],
};
