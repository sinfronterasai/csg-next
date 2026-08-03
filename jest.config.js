/** @type {import('jest').Config} */
process.env.NODE_ENV = 'test';
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', allowJs: true },
      },
    ],
  },
  collectCoverageFrom: ['src/lib/tarot/**/*.ts', 'src/app/api/tarot/**/*.ts'],
};
