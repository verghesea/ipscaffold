/**
 * Vitest Setup File
 *
 * This file runs before all tests.
 * Use it to set up global mocks, environment variables, etc.
 */

import { vi } from 'vitest';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.APP_URL = 'http://localhost:5000';

// Mock console methods to reduce noise in tests (optional)
// Uncomment if you want to suppress console output during tests
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Global test utilities
global.testUtils = {
  /**
   * Create a mock JWT token for testing
   */
  createMockJWT: (payload: Record<string, any>): string => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
      sub: 'test-user-id',
      ...payload,
    })).toString('base64url');
    const signature = 'test-signature';

    return `${header}.${body}.${signature}`;
  },

  /**
   * Wait for a condition to be true
   */
  waitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },

  /**
   * Create a mock Supabase response
   */
  mockSupabaseResponse: <T>(data: T | null, error: { message: string } | null = null) => ({
    data,
    error,
  }),
};

// Extend Vitest's expect with custom matchers if needed
// expect.extend({
//   toBeValidUUID(received) {
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//     const pass = uuidRegex.test(received);
//     return {
//       pass,
//       message: () => pass
//         ? `expected ${received} not to be a valid UUID`
//         : `expected ${received} to be a valid UUID`,
//     };
//   },
// });

// Declare global types for TypeScript
declare global {
  var testUtils: {
    createMockJWT: (payload: Record<string, any>) => string;
    waitFor: (condition: () => boolean | Promise<boolean>, timeout?: number, interval?: number) => Promise<void>;
    mockSupabaseResponse: <T>(data: T | null, error?: { message: string } | null) => { data: T | null; error: { message: string } | null };
  };
}

export {};
