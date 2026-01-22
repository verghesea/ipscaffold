# Testing Strategy - IP Scaffold Alpha Release

**Document Version:** 1.0
**Date:** January 21, 2026

---

## Table of Contents

1. [Critical User Flows](#1-critical-user-flows)
2. [Test Suite Design](#2-test-suite-design)
3. [Manual Testing Checklist](#3-manual-testing-checklist)
4. [Automated Testing Recommendations](#4-automated-testing-recommendations)
5. [Monitoring & Observability](#5-monitoring--observability)

---

## 1. Critical User Flows

### Priority Tier 1: Must Work Perfectly (Alpha Blockers)

These flows, if broken, make the product unusable.

| Flow | Description | Impact |
|------|-------------|--------|
| **Magic Link Auth** | User requests magic link, receives email, clicks, gets authenticated | No access without this |
| **PDF Upload** | Authenticated user uploads PDF, processing starts | Core feature |
| **ELIA15 Generation** | PDF is parsed, Claude generates ELIA15 | Immediate value |
| **View Patent Results** | User can see patent details and all artifacts | Value delivery |

### Priority Tier 2: Should Work Reliably

| Flow | Description | Impact |
|------|-------------|--------|
| Business Narrative Generation | Generated after ELIA15 | Additional value |
| Golden Circle Generation | Generated after other artifacts | Additional value |
| Hero Image Generation | Auto-generated for dashboard | Visual appeal |
| Dashboard Display | Shows all user's patents | Navigation |
| Promo Code Redemption | User adds credits | Monetization |

### Priority Tier 3: Can Have Issues (Document Known Issues)

| Flow | Description | Impact |
|------|-------------|--------|
| Section Image Generation | Images for artifact sections | Enhancement |
| Admin Metrics | System statistics | Internal tool |
| Pattern Learning | Metadata extraction learning | Future improvement |
| System Prompt Management | Admin prompt editing | Admin feature |

---

## 2. Test Suite Design

### 2.1 Unit Tests

**What to Test:**
- PDF metadata extraction patterns
- Text parsing utilities
- Credit calculation logic
- Token validation utilities
- Date/time formatting
- Section parsing

**Example Test Cases:**

```typescript
// server/services/__tests__/pdfParser.test.ts
describe('PDF Parser', () => {
  describe('extractMetadataFromText', () => {
    it('should extract patent number from standard USPTO format', () => {
      const text = 'Patent No.: US 10,123,456 B2';
      const result = extractMetadataFromText(text);
      expect(result.patentNumber).toBe('US 10,123,456 B2');
    });

    it('should extract inventors from (72) format', () => {
      const text = '(72) Inventor: John Smith, San Jose, CA (US)';
      const result = extractMetadataFromText(text);
      expect(result.inventors).toBe('John Smith');
    });

    it('should extract assignee from (73) format', () => {
      const text = '(73) Assignee: Acme Corporation, Palo Alto, CA (US)';
      const result = extractMetadataFromText(text);
      expect(result.assignee).toBe('Acme Corporation');
    });

    it('should handle missing fields gracefully', () => {
      const text = 'Some random text without patent metadata';
      const result = extractMetadataFromText(text);
      expect(result.patentNumber).toBeNull();
      expect(result.inventors).toBeNull();
    });
  });
});
```

```typescript
// client/src/lib/__tests__/api.test.ts
describe('Token Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getTokenExpiration', () => {
    it('should parse valid JWT expiration', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockToken = createMockJWT({ exp: futureExp });
      localStorage.setItem('ip_scaffold_access_token', mockToken);

      const expiration = getTokenExpiration();
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeCloseTo(futureExp * 1000, -3);
    });

    it('should return null for missing token', () => {
      const expiration = getTokenExpiration();
      expect(expiration).toBeNull();
    });

    it('should return null for malformed token', () => {
      localStorage.setItem('ip_scaffold_access_token', 'not.a.jwt');
      const expiration = getTokenExpiration();
      expect(expiration).toBeNull();
    });
  });
});
```

### 2.2 Integration Tests

**What to Test:**
- API endpoint responses
- Database operations
- Authentication flow
- File upload handling

**Example Test Cases:**

```typescript
// server/__tests__/integration/auth.test.ts
describe('Authentication API', () => {
  describe('POST /api/auth/magic-link', () => {
    it('should accept valid email', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/magic-link')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email required');
    });
  });

  describe('GET /api/user', () => {
    it('should return user for valid token', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('credits');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/user');

      expect(response.status).toBe(401);
    });
  });
});
```

```typescript
// server/__tests__/integration/upload.test.ts
describe('Patent Upload API', () => {
  describe('POST /api/upload', () => {
    it('should accept valid PDF', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('pdf', 'test/fixtures/valid-patent.pdf');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.patentId).toBeDefined();
    });

    it('should reject non-PDF files', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('pdf', 'test/fixtures/image.png');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('PDF');
    });

    it('should reject files over 10MB', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('pdf', 'test/fixtures/large-file.pdf');

      expect(response.status).toBe(400);
    });

    it('should handle expired auth gracefully', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${expiredToken}`)
        .attach('pdf', 'test/fixtures/valid-patent.pdf');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication failed');
    });
  });
});
```

### 2.3 End-to-End Tests

**What to Test:**
- Complete user journeys
- UI interactions
- Visual regressions

**Example Test Cases (Playwright):**

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should complete magic link flow', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Enter email
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.click('[data-testid="button-send-link"]');

    // Verify confirmation message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('should handle auth callback', async ({ page }) => {
    // Simulate callback with valid token
    await page.goto('/auth/callback?token_hash=valid&type=magiclink');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="text-dashboard-title"]')).toBeVisible();
  });
});
```

```typescript
// e2e/upload.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Patent Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login with test user
    await loginAsTestUser(page);
  });

  test('should upload patent from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Upload via file input
    const fileInput = page.locator('[data-testid="input-file-upload"]');
    await fileInput.setInputFiles('test/fixtures/sample-patent.pdf');

    // Wait for processing redirect
    await expect(page).toHaveURL(/\/preview\/.+/, { timeout: 30000 });

    // Verify preview content loads
    await expect(page.locator('[data-testid="patent-title"]')).toBeVisible();
  });

  test('should show progress during processing', async ({ page }) => {
    await page.goto('/dashboard');

    // Upload file
    const fileInput = page.locator('[data-testid="input-file-upload"]');
    await fileInput.setInputFiles('test/fixtures/sample-patent.pdf');

    // Navigate to preview and verify progress
    await expect(page).toHaveURL(/\/preview\/.+/);

    // Progress indicator should be visible
    await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    // Upload invalid file
    const fileInput = page.locator('[data-testid="input-file-upload"]');
    await fileInput.setInputFiles('test/fixtures/not-a-pdf.txt');

    // Should show error toast
    await expect(page.locator('text=Invalid file type')).toBeVisible();
  });
});
```

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should display user patents', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard');

    // Verify dashboard loaded
    await expect(page.locator('[data-testid="text-dashboard-title"]')).toContainText('Your Patents');

    // Verify patents are displayed (or empty state)
    const patentCards = page.locator('[data-testid^="card-patent-"]');
    const emptyState = page.locator('text=No Patents Yet');

    // Either patents exist or empty state is shown
    await expect(patentCards.or(emptyState)).toBeVisible();
  });

  test('should switch between grid and table view', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/dashboard');

    // Switch to table view
    await page.click('[data-testid="button-view-table"]');
    await expect(page.locator('table')).toBeVisible();

    // Switch to grid view
    await page.click('[data-testid="button-view-grid"]');
    await expect(page.locator('[data-testid^="card-patent-"]').first()).toBeVisible();
  });
});
```

---

## 3. Manual Testing Checklist

### 3.1 Pre-Alpha Smoke Test Checklist

**Authentication (10 min)**
- [ ] Navigate to login page
- [ ] Enter valid email, click send
- [ ] Receive magic link email (check spam)
- [ ] Click magic link, verify redirect to dashboard
- [ ] Verify user info displayed correctly
- [ ] Logout, verify redirect to home
- [ ] Try accessing /dashboard without auth, verify redirect

**Upload Flow (15 min)**
- [ ] Login as test user
- [ ] Drag and drop valid PDF onto upload zone
- [ ] Verify upload indicator appears
- [ ] Verify redirect to preview page
- [ ] Wait for processing to complete (up to 5 min)
- [ ] Verify ELIA15 artifact appears
- [ ] Verify Business Narrative appears
- [ ] Verify Golden Circle appears

**Dashboard (10 min)**
- [ ] Navigate to dashboard
- [ ] Verify recently uploaded patent appears
- [ ] Click on patent, verify redirect to detail page
- [ ] Toggle between grid and table view
- [ ] Verify status badges show correctly

**Admin Functions (10 min) - Admin User Only**
- [ ] Navigate to /admin
- [ ] Verify metrics load correctly
- [ ] View user list
- [ ] Adjust a user's credits
- [ ] Create promo code
- [ ] Test promo code redemption as user

### 3.2 Alpha Tester Instructions

**Setup**
1. You will receive a magic link to sign up
2. Initial account includes 100 credits
3. Each patent analysis costs 10 credits

**What to Test**
1. Upload 3-5 different patent PDFs
2. Wait for each to complete processing
3. Review all generated artifacts for accuracy
4. Note any parsing errors or missing data
5. Test on both desktop and mobile (if possible)

**How to Report Issues**

Create issue report with:
- **What you did:** Step-by-step actions
- **What you expected:** Expected behavior
- **What happened:** Actual behavior
- **Screenshots:** If visual issue
- **Browser/Device:** Chrome, Safari, mobile, etc.
- **Time:** Approximate time of issue
- **Patent ID:** If relevant (from URL)

**Known Limitations (Alpha)**
- Large PDFs (>10MB) are rejected
- Processing may take 2-5 minutes
- Some older PDF formats may not parse well
- Image generation is optional and may fail

### 3.3 Regression Test Checklist (Before Each Deploy)

**Critical Paths**
- [ ] Magic link authentication works
- [ ] PDF upload works
- [ ] ELIA15 generates successfully
- [ ] User can view their patents
- [ ] Credits display correctly

**Data Integrity**
- [ ] New patent has correct user_id
- [ ] Artifacts linked to correct patent
- [ ] Credits deducted correctly

**Error Cases**
- [ ] Invalid file rejected with message
- [ ] Expired token prompts re-login
- [ ] Failed processing shows error state

---

## 4. Automated Testing Recommendations

### 4.1 Recommended Framework Stack

| Type | Framework | Why |
|------|-----------|-----|
| Unit | Vitest | Fast, Vite-native, good DX |
| Integration | Vitest + Supertest | HTTP testing support |
| E2E | Playwright | Cross-browser, reliable |
| Component | Vitest + Testing Library | React component testing |

### 4.2 Test Directory Structure

```
/
├── client/
│   └── src/
│       ├── __tests__/          # Client unit tests
│       │   ├── components/
│       │   └── lib/
│       └── e2e/                 # E2E tests (optional)
├── server/
│   └── __tests__/
│       ├── unit/               # Server unit tests
│       ├── integration/        # API integration tests
│       └── fixtures/           # Test files
├── e2e/                        # Global E2E tests
│   ├── auth.spec.ts
│   ├── upload.spec.ts
│   └── dashboard.spec.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### 4.3 Configuration Files

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', '**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
```

**playwright.config.ts:**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.4 Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "vitest run && playwright test"
  }
}
```

### 4.5 CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 4.6 Highest ROI Tests (Start Here)

**Week 1: Critical Path Coverage**
1. Auth flow integration tests
2. Upload API integration tests
3. E2E: Complete upload-to-view flow

**Week 2: Error Handling**
1. Unit tests for PDF parsing edge cases
2. Integration tests for error responses
3. E2E: Error state handling

**Week 3: Edge Cases**
1. Token expiration handling
2. Concurrent upload handling
3. Large file handling

---

## 5. Monitoring & Observability

### 5.1 Key Metrics to Track

**Business Metrics**
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Daily Active Users | Unique users per day | < 1 (alpha empty) |
| Patents Uploaded | Total uploads per day | > 100 (cost alert) |
| Successful Processing Rate | % completing successfully | < 80% |
| Credits Consumed | Total daily credit usage | > 10,000 |

**Technical Metrics**
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| API Response Time (p95) | 95th percentile latency | > 5s |
| Error Rate | 5xx errors / total requests | > 5% |
| PDF Parse Success Rate | % using each fallback | pdf.js > 30% |
| Claude API Usage | Daily token count | > $50/day |
| DALL-E Usage | Images generated | > 500/day |

### 5.2 Error Tracking (Sentry)

**Installation:**
```bash
npm install @sentry/node @sentry/react
```

**Server Setup:**
```typescript
// server/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Add error handler middleware
app.use(Sentry.Handlers.errorHandler());
```

**Client Setup:**
```typescript
// client/src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

### 5.3 User Analytics (PostHog)

**Installation:**
```bash
npm install posthog-js
```

**Setup:**
```typescript
// client/src/lib/analytics.ts
import posthog from 'posthog-js';

export const analytics = {
  init() {
    if (process.env.NODE_ENV === 'production') {
      posthog.init(process.env.VITE_POSTHOG_KEY!, {
        api_host: 'https://app.posthog.com',
      });
    }
  },

  identify(userId: string, email: string) {
    posthog.identify(userId, { email });
  },

  trackUpload(patentId: string) {
    posthog.capture('patent_uploaded', { patent_id: patentId });
  },

  trackArtifactView(artifactType: string) {
    posthog.capture('artifact_viewed', { artifact_type: artifactType });
  },
};
```

### 5.4 Server Health Monitoring

**Health Check Endpoint (exists):**
```typescript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

**Enhanced Health Check:**
```typescript
app.get('/api/health/detailed', async (req, res) => {
  const checks = {
    database: 'unknown',
    anthropic: 'unknown',
    openai: 'unknown',
    supabase_storage: 'unknown',
  };

  try {
    // Check database
    await supabaseAdmin.from('profiles').select('id').limit(1);
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'error';
  }

  // Add more checks as needed

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

### 5.5 Logging Strategy

**Current:** Console logging with prefixes like `[Upload]`, `[Dashboard]`

**Recommended Enhancement:**
```typescript
// server/lib/logger.ts
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    // Add file transport for production
    // new transports.File({ filename: 'error.log', level: 'error' })
  ],
});
```

### 5.6 Monitoring Dashboard (Suggested)

For alpha, a simple status page showing:
- System uptime
- Recent error count
- Processing queue status
- External API status (Claude, DALL-E)

---

## Appendix: Test Fixtures

### Sample Patent PDFs for Testing

Create test fixtures directory:
```
test/
└── fixtures/
    ├── valid-patent.pdf          # Standard USPTO PDF
    ├── valid-patent-large.pdf    # Near 10MB limit
    ├── valid-patent-scanned.pdf  # OCR-dependent
    ├── invalid-corrupted.pdf     # Corrupted PDF
    ├── invalid-not-patent.pdf    # Non-patent PDF
    └── invalid-not-pdf.txt       # Wrong file type
```

### Test User Accounts

For E2E testing, create dedicated test accounts:
- `test-user@ipscaffold.test` - Regular user, 100 credits
- `test-admin@ipscaffold.test` - Admin user
- `test-empty@ipscaffold.test` - User with 0 credits
