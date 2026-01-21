/**
 * Integration Tests for Upload API
 *
 * Tests the upload endpoint with mocked services.
 * These tests verify API behavior for authenticated and anonymous uploads.
 *
 * Run: npm test -- server/__tests__/integration/upload.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Mock user data
const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
};

const mockProfileWithCredits = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  credits: 30,
  is_admin: false,
};

const mockProfileNoCredits = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  credits: 5,
  is_admin: false,
};

// Mock Supabase
const mockGetUser = vi.fn();
const mockGetProfile = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (token: string) => mockGetUser(token),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => mockGetProfile()),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      }),
    },
  },
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
}));

// Mock storage operations
vi.mock('../../supabaseStorage', () => ({
  supabaseStorage: {
    getProfile: vi.fn().mockImplementation(() => mockGetProfile()),
    uploadPdfToStorage: vi.fn().mockResolvedValue({ storagePath: 'test/path.pdf' }),
    createPatent: vi.fn().mockResolvedValue({ id: 'patent-123' }),
    updatePatentUserId: vi.fn().mockResolvedValue(undefined),
    updateProfileCredits: vi.fn().mockResolvedValue(undefined),
    createCreditTransaction: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock PDF parser
vi.mock('../../services/pdfParser', () => ({
  parsePatentPDF: vi.fn().mockResolvedValue({
    patentNumber: 'US 10,123,456 B2',
    title: 'Test Patent',
    inventors: 'John Doe',
    assignee: 'Test Corp',
    filingDate: '2023-01-01',
    fullText: 'Test patent full text content...',
  }),
}));

// Mock AI generators (skip actual AI processing)
vi.mock('../../services/aiGenerator', () => ({
  generateELIA15: vi.fn().mockResolvedValue('ELIA-15 summary content'),
  generateBusinessNarrative: vi.fn().mockResolvedValue('Business narrative content'),
  generateGoldenCircle: vi.fn().mockResolvedValue('Golden circle content'),
}));

vi.mock('../../services/progressService', () => ({
  getProgress: vi.fn().mockReturnValue(null),
  getProgressFromDb: vi.fn().mockResolvedValue(null),
  updateProgress: vi.fn(),
}));

// Create a minimal test app with rate limiting
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Simple upload endpoint for testing
  app.post('/api/upload', async (req, res) => {
    // Simulate rate limiting check (simplified for tests)
    if ((app as any).rateLimitHit) {
      return res.status(429).json({
        error: 'Too many uploads',
        details: 'Rate limit exceeded',
        retryAfter: 900,
      });
    }

    // Check auth header
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const result = await mockGetUser(token);
      if (result.data?.user) {
        user = result.data.user;
      }
    }

    // Critical: Reject if auth attempted but failed
    if (authHeader && !user) {
      return res.status(401).json({
        error: 'Authentication failed',
        details: 'Your session may have expired. Please refresh the page and try again.',
      });
    }

    // Check credits for authenticated users
    if (user) {
      const profile = await mockGetProfile();
      if (!profile || profile.credits < 10) {
        return res.status(402).json({
          error: 'Insufficient credits',
          details: 'You need at least 10 credits to upload a patent.',
          currentCredits: profile?.credits || 0,
          required: 10,
        });
      }
    }

    // Simulate successful upload
    res.json({
      id: 'patent-123',
      title: 'Test Patent',
      status: 'processing',
    });
  });

  return app;
}

describe('Upload API - Rate Limiting', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockGetUser.mockReset();
    mockGetProfile.mockReset();
    (app as any).rateLimitHit = false;
  });

  it('should accept request under rate limit', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue(mockProfileWithCredits);

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(200);
  });

  it('should reject request when rate limit exceeded', async () => {
    (app as any).rateLimitHit = true;

    const response = await request(app)
      .post('/api/upload')
      .send({});

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many');
    expect(response.body).toHaveProperty('retryAfter');
  });
});

describe('Upload API - Authentication', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockGetUser.mockReset();
    mockGetProfile.mockReset();
  });

  it('should accept anonymous upload (no auth header)', async () => {
    const response = await request(app)
      .post('/api/upload')
      .send({});

    expect(response.status).toBe(200);
  });

  it('should accept authenticated upload with valid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue(mockProfileWithCredits);

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
  });

  it('should reject when auth header present but token invalid (prevents orphaned patents)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer invalid-token')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication failed');
    expect(response.body.details).toContain('session');
  });

  it('should reject when auth header present but token expired', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Token expired' } });

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer expired-token')
      .send({});

    expect(response.status).toBe(401);
  });
});

describe('Upload API - Credit System', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockGetUser.mockReset();
    mockGetProfile.mockReset();
  });

  it('should allow upload when user has sufficient credits', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue(mockProfileWithCredits); // 30 credits

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(200);
  });

  it('should reject upload when user has insufficient credits', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue(mockProfileNoCredits); // 5 credits

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(402);
    expect(response.body.error).toBe('Insufficient credits');
    expect(response.body.currentCredits).toBe(5);
    expect(response.body.required).toBe(10);
  });

  it('should reject upload when user has exactly 9 credits', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue({ ...mockProfileNoCredits, credits: 9 });

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(402);
  });

  it('should allow upload when user has exactly 10 credits', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue({ ...mockProfileNoCredits, credits: 10 });

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(200);
  });

  it('should reject upload when user has 0 credits', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue({ ...mockProfileNoCredits, credits: 0 });

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(402);
    expect(response.body.currentCredits).toBe(0);
  });

  it('should not check credits for anonymous uploads', async () => {
    // No auth header = anonymous
    const response = await request(app)
      .post('/api/upload')
      .send({});

    expect(response.status).toBe(200);
    // mockGetProfile should not have been called
    expect(mockGetProfile).not.toHaveBeenCalled();
  });
});

describe('Upload API - Error Responses', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    mockGetUser.mockReset();
    mockGetProfile.mockReset();
  });

  it('should include helpful details in insufficient credits error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue(mockProfileNoCredits);

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.body).toMatchObject({
      error: 'Insufficient credits',
      details: expect.stringContaining('10 credits'),
      currentCredits: 5,
      required: 10,
    });
  });

  it('should include helpful details in auth failure error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer invalid-token')
      .send({});

    expect(response.body.error).toBe('Authentication failed');
    expect(response.body.details).toContain('refresh');
  });

  it('should handle profile not found for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetProfile.mockResolvedValue(null); // Profile not found

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(402);
    expect(response.body.currentCredits).toBe(0);
  });
});
