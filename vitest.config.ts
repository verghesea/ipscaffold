/**
 * Vitest Configuration
 *
 * Configuration for unit and integration tests.
 *
 * Run all tests: npm test
 * Run with UI: npm run test:ui
 * Run with coverage: npm run test:coverage
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Enable globals (describe, it, expect)
    globals: true,

    // Test file patterns
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', 'e2e', '.replit'],

    // Setup files (run before tests)
    setupFiles: ['./vitest.setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules',
        'dist',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types/**',
        'vitest.config.ts',
        'vitest.setup.ts',
      ],
      // Minimum coverage thresholds (adjust as needed)
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },

    // Timeout for async operations
    testTimeout: 30000,

    // Reporter options
    reporter: ['verbose'],

    // Pool options for parallel execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Useful for tests that share state
      },
    },
  },

  // Path resolution for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});
