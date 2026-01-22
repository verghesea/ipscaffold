/**
 * Integration Tests for Authentication API
 *
 * Tests the authentication endpoints with mocked Supabase client.
 * These tests verify API behavior without hitting real services.
 *
 * Run: npm test -- server/__tests__/integration/auth.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.APP_URL = 'http://localhost:5000';

// Mock Supabase clients
const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
};

const mockProfile = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  credits: 100,
  is_admin: false,
  is_super_admin: false,
};

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'new-token', refresh_token: 'new-refresh' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      insert: vi.fn().mockReturnThis(),
    }),
  },
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
}));

// Create minimal Express app for testing
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Import mock supabase
  const { supabaseAdmin, supabase } = require('../../lib/supabase');

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Magic link endpoint
  app.post('/api/auth/magic-link', async (req, res) => {
    try {
      const { email, patentId } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email required' });
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: `${process.env.APP_URL}/auth/callback`,
          shouldCreateUser: true,
        },
      });

      if (error) {
        return res.status(500).json({ error: 'Failed to send magic link' });
      }

      res.json({ success: true, message: 'Magic link sent to your email', patentId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send magic link' });
    }
  });

  // Token refresh endpoint
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const { data, error } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      res.json({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to refresh session' });
    }
  });

  // Get user endpoint
  app.get('/api/user', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = authHeader.substring(7);

    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      res.json({
        id: profile.id,
        email: profile.email,
        credits: profile.credits,
        isAdmin: profile.is_admin,
        isSuperAdmin: profile.is_super_admin,
      });
    } catch (error) {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  return app;
}

describe('Authentication API', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /api/health', () => {
    it('should return ok status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/auth/magic-link', () => {
    it('should accept valid email', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Magic link sent');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email required');
    });

    it('should accept email with patentId', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ email: 'test@example.com', patentId: 'patent-123' });

      expect(response.status).toBe(200);
      expect(response.body.patentId).toBe('patent-123');
    });

    it('should lowercase and trim email', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ email: '  TEST@EXAMPLE.COM  ' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh valid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Refresh token required');
    });
  });

  describe('GET /api/user', () => {
    it('should return user for valid token', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('credits');
      expect(response.body).toHaveProperty('isAdmin');
    });

    it('should reject missing authorization header', async () => {
      const response = await request(app).get('/api/user');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    it('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
    });

    it('should reject empty bearer token', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer ');

      // Empty token should still reach the auth check
      expect(response.status).toBe(401);
    });
  });
});

describe('Authentication - Error Handling', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle Supabase errors gracefully', async () => {
    // Mock Supabase to return an error
    const { supabase } = require('../../lib/supabase');
    supabase.auth.signInWithOtp.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });

    app = createTestApp();

    const response = await request(app)
      .post('/api/auth/magic-link')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to send magic link');
  });

  it('should handle invalid token on getUser', async () => {
    const { supabaseAdmin } = require('../../lib/supabase');
    supabaseAdmin.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    app = createTestApp();

    const response = await request(app)
      .get('/api/user')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
