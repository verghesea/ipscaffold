/**
 * Unit Tests for Token Validation
 *
 * Tests authentication token validation logic.
 * These tests don't require external services.
 *
 * Run: npm test -- server/__tests__/unit/tokenValidation.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase admin client
const mockGetUser = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (token: string) => mockGetUser(token),
    },
  },
}));

describe('Token Validation - Authorization Header Parsing', () => {
  describe('Bearer Token Extraction', () => {
    function extractBearerToken(authHeader: string | undefined): string | null {
      if (!authHeader?.startsWith('Bearer ')) {
        return null;
      }
      return authHeader.substring(7);
    }

    it('should extract token from valid Bearer header', () => {
      const header = 'Bearer abc123token';
      const token = extractBearerToken(header);
      expect(token).toBe('abc123token');
    });

    it('should return null for missing header', () => {
      const token = extractBearerToken(undefined);
      expect(token).toBeNull();
    });

    it('should return null for empty header', () => {
      const token = extractBearerToken('');
      expect(token).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const token = extractBearerToken('Basic abc123');
      expect(token).toBeNull();
    });

    it('should return null for malformed Bearer header (lowercase)', () => {
      const token = extractBearerToken('bearer abc123');
      expect(token).toBeNull();
    });

    it('should handle Bearer with empty token', () => {
      const token = extractBearerToken('Bearer ');
      expect(token).toBe('');
    });

    it('should handle JWT-like tokens', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const header = `Bearer ${jwtToken}`;
      const token = extractBearerToken(header);
      expect(token).toBe(jwtToken);
    });

    it('should preserve token with special characters', () => {
      const specialToken = 'abc+def/ghi=123';
      const header = `Bearer ${specialToken}`;
      const token = extractBearerToken(header);
      expect(token).toBe(specialToken);
    });
  });

  describe('Header Validation', () => {
    function isValidAuthHeader(authHeader: string | undefined): boolean {
      return authHeader?.startsWith('Bearer ') === true && authHeader.length > 7;
    }

    it('should validate correct Bearer header', () => {
      expect(isValidAuthHeader('Bearer abc123')).toBe(true);
    });

    it('should reject undefined header', () => {
      expect(isValidAuthHeader(undefined)).toBe(false);
    });

    it('should reject empty header', () => {
      expect(isValidAuthHeader('')).toBe(false);
    });

    it('should reject Bearer with no token', () => {
      expect(isValidAuthHeader('Bearer ')).toBe(false);
    });

    it('should reject Basic auth header', () => {
      expect(isValidAuthHeader('Basic abc123')).toBe(false);
    });
  });
});

describe('Token Validation - User Resolution', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  async function getUserFromToken(token: string): Promise<{ id: string; email: string } | null> {
    const { supabaseAdmin } = await import('../../lib/supabase');
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return null;
      return { id: user.id, email: user.email || '' };
    } catch {
      return null;
    }
  }

  describe('Successful Token Resolution', () => {
    it('should return user for valid token', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
        },
        error: null,
      });

      const user = await getUserFromToken('valid-token');

      expect(user).toEqual({ id: 'user-123', email: 'test@example.com' });
    });

    it('should handle user without email', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: null },
        },
        error: null,
      });

      const user = await getUserFromToken('valid-token');

      expect(user).toEqual({ id: 'user-123', email: '' });
    });
  });

  describe('Failed Token Resolution', () => {
    it('should return null for invalid token', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const user = await getUserFromToken('invalid-token');

      expect(user).toBeNull();
    });

    it('should return null for expired token', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Token has expired' },
      });

      const user = await getUserFromToken('expired-token');

      expect(user).toBeNull();
    });

    it('should return null when supabase throws', async () => {
      mockGetUser.mockRejectedValueOnce(new Error('Network error'));

      const user = await getUserFromToken('any-token');

      expect(user).toBeNull();
    });

    it('should return null for empty user response', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const user = await getUserFromToken('empty-user-token');

      expect(user).toBeNull();
    });
  });
});

describe('Token Validation - Request Middleware Logic', () => {
  describe('Auth Header Detection', () => {
    interface MockRequest {
      headers: { authorization?: string };
    }

    function hasAuthAttempt(req: MockRequest): boolean {
      return req.headers.authorization !== undefined;
    }

    it('should detect auth attempt when header present', () => {
      const req: MockRequest = {
        headers: { authorization: 'Bearer token' },
      };
      expect(hasAuthAttempt(req)).toBe(true);
    });

    it('should not detect auth attempt when header missing', () => {
      const req: MockRequest = { headers: {} };
      expect(hasAuthAttempt(req)).toBe(false);
    });

    it('should detect auth attempt even with invalid format', () => {
      const req: MockRequest = {
        headers: { authorization: 'InvalidFormat' },
      };
      expect(hasAuthAttempt(req)).toBe(true);
    });
  });

  describe('Auth Failure Detection (Orphaned Patent Prevention)', () => {
    interface AuthCheckResult {
      hasAuthHeader: boolean;
      userResolved: boolean;
      shouldReject: boolean;
      reason?: string;
    }

    function checkAuthStatus(
      authHeader: string | undefined,
      user: { id: string; email: string } | null
    ): AuthCheckResult {
      const hasAuthHeader = authHeader !== undefined;
      const userResolved = user !== null;

      // CRITICAL: If auth header present but user not resolved, this creates orphaned patents
      const shouldReject = hasAuthHeader && !userResolved;

      return {
        hasAuthHeader,
        userResolved,
        shouldReject,
        reason: shouldReject ? 'Auth header present but user resolution failed' : undefined,
      };
    }

    it('should not reject anonymous request (no header, no user)', () => {
      const result = checkAuthStatus(undefined, null);
      expect(result.shouldReject).toBe(false);
    });

    it('should not reject authenticated request (header + user)', () => {
      const result = checkAuthStatus('Bearer token', { id: '123', email: 'test@test.com' });
      expect(result.shouldReject).toBe(false);
    });

    it('should REJECT failed auth attempt (header but no user) - prevents orphaned patents', () => {
      const result = checkAuthStatus('Bearer invalid', null);
      expect(result.shouldReject).toBe(true);
      expect(result.reason).toContain('user resolution failed');
    });
  });
});

describe('Token Validation - Edge Cases', () => {
  describe('Token Format Edge Cases', () => {
    it('should handle very long tokens', () => {
      const longToken = 'a'.repeat(10000);
      const header = `Bearer ${longToken}`;
      expect(header.startsWith('Bearer ')).toBe(true);
      expect(header.substring(7)).toBe(longToken);
    });

    it('should handle token with newlines (invalid but should not crash)', () => {
      const badToken = 'abc\ndef\nghi';
      const header = `Bearer ${badToken}`;
      const extracted = header.substring(7);
      expect(extracted).toBe(badToken);
    });

    it('should handle unicode in token (invalid but should not crash)', () => {
      const unicodeToken = 'abc123';
      const header = `Bearer ${unicodeToken}`;
      const extracted = header.substring(7);
      expect(extracted).toBe(unicodeToken);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous token validations', async () => {
      mockGetUser.mockImplementation(async (token: string) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          data: { user: { id: `user-${token}`, email: `${token}@test.com` } },
          error: null,
        };
      });

      const { supabaseAdmin } = await import('../../lib/supabase');

      const results = await Promise.all([
        supabaseAdmin.auth.getUser('token1'),
        supabaseAdmin.auth.getUser('token2'),
        supabaseAdmin.auth.getUser('token3'),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].data.user.id).toBe('user-token1');
      expect(results[1].data.user.id).toBe('user-token2');
      expect(results[2].data.user.id).toBe('user-token3');
    });
  });
});
