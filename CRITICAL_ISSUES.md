# Critical Issues - IP Scaffold Alpha Release

**Document Version:** 1.0
**Date:** January 21, 2026
**Status:** Pre-Alpha Checklist

---

## Summary

This document lists issues that must be addressed before alpha release, organized by priority.

| Priority | Count | Status | Description |
|----------|-------|--------|-------------|
| **BLOCKER** | 2 | ✅ COMPLETE | Must fix before ANY alpha users |
| **HIGH** | 3 | 🔄 PENDING | Should fix before general alpha |
| **MEDIUM** | 5 | 🔄 PENDING | Fix during alpha period |
| **LOW** | 4 | 🔄 PENDING | Nice to have, can wait for beta |

---

## BLOCKER Issues (Fix Before Alpha)

### BLOCKER-1: No Rate Limiting on Upload Endpoint

**Location:** `server/supabaseRoutes.ts` - `/api/upload`

**Risk:**
- Any user can upload unlimited PDFs
- Each upload triggers expensive AI processing (Claude API, DALL-E)
- Could result in massive API costs ($100s-$1000s per day)
- Denial of service risk

**Current Behavior:**
- No rate limiting implemented
- No per-user upload limits
- No IP-based restrictions

**Required Fix:**
```typescript
// Install: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 uploads per 15 minutes per IP
  message: { error: 'Too many uploads. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to upload endpoint
app.post('/api/upload', uploadLimiter, upload.single('pdf'), async (req, res) => {
  // existing code
});
```

**Effort:** 30 minutes
**Status:** ✅ COMPLETED (Commit: da0ff99)

---

### BLOCKER-2: No Pre-Upload Credit Check

**Location:** `server/supabaseRoutes.ts` - `/api/upload` handler

**Risk:**
- Users with 0 credits can upload
- Processing starts but patent becomes effectively useless
- Poor user experience
- Wasted API costs on processing

**Current Behavior:**
- Upload proceeds regardless of credit balance
- Credits only checked when claiming patent
- No upfront credit reservation

**Required Fix:**
```typescript
app.post('/api/upload', uploadLimiter, upload.single('pdf'), async (req, res) => {
  // ... after file validation, before processing

  // Check credits for authenticated users
  if (user) {
    const profile = await supabaseStorage.getProfile(user.id);
    if (!profile || profile.credits < 10) {
      // Clean up uploaded file
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(402).json({
        error: 'Insufficient credits',
        details: 'You need at least 10 credits to upload a patent. Visit the dashboard to add credits.',
        currentCredits: profile?.credits || 0,
        required: 10,
      });
    }
  }

  // Continue with processing...
});
```

**Effort:** 30 minutes
**Status:** ✅ COMPLETED (Commit: da0ff99)

---

## HIGH Priority Issues

### HIGH-1: Magic Link Email Rate Limiting

**Location:** `server/supabaseRoutes.ts` - `/api/auth/magic-link`

**Risk:**
- Email spam abuse
- SendGrid rate limits/blocks
- Cost for outbound emails

**Required Fix:**
```typescript
const magicLinkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute per IP
  message: { error: 'Too many requests. Please wait a moment.' },
});

app.post('/api/auth/magic-link', magicLinkLimiter, async (req, res) => {
  // existing code
});
```

**Effort:** 15 minutes
**Status:** NOT STARTED

---

### HIGH-2: Global Error Handler Re-throws Errors

**Location:** `server/index.ts:74-80`

**Problem:**
```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err; // <-- THIS IS THE PROBLEM
});
```

**Risk:**
- After sending response, error is re-thrown
- May cause unhandled rejection warnings
- Potential for process instability

**Required Fix:**
```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log the error instead of re-throwing
  console.error('[Error Handler]', err);

  // Don't send error response if headers already sent
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});
```

**Effort:** 15 minutes
**Status:** NOT STARTED

---

### HIGH-3: Missing React Error Boundary

**Location:** `client/src/App.tsx`

**Risk:**
- Unhandled React errors crash entire app
- Users see blank page with no recovery option
- Poor alpha tester experience

**Required Fix:**
```typescript
// client/src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // TODO: Send to Sentry when implemented
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              We're sorry, but something unexpected happened.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Then wrap in App.tsx:
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* ... rest of app */}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

**Effort:** 45 minutes
**Status:** NOT STARTED

---

## MEDIUM Priority Issues

### MEDIUM-1: Dashboard N+1 Query Problem

**Location:** `server/supabaseRoutes.ts:579-619`

**Problem:** Fetches artifacts separately for each patent.

**Impact:** Slow dashboard load for users with many patents.

**Current:**
```typescript
const patentsWithArtifactCount = await Promise.all(
  patents.map(async (patent) => {
    const artifacts = await supabaseStorage.getArtifactsByPatent(patent.id);
    return { ...patent, artifactCount: artifacts.length };
  })
);
```

**Better:**
```typescript
// Option A: Add artifact_count column to patents table
// Option B: Single query with JOIN
const { data } = await supabaseAdmin
  .from('patents')
  .select(`
    *,
    artifacts:artifacts(count)
  `)
  .eq('user_id', userId);
```

**Effort:** 2 hours
**Status:** NOT STARTED

---

### MEDIUM-2: PDF MIME-Only Validation

**Location:** `server/supabaseRoutes.ts:39-45`

**Problem:** Only checks MIME type, not actual file content.

**Risk:** Malicious files could bypass filter.

**Required Fix:**
```typescript
// Add magic byte validation in upload handler
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

fileFilter: async (req, file, cb) => {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'));
  }
  // Note: Full magic byte check requires reading file
  // This is a first-pass filter
  cb(null, true);
},

// In handler, after file received:
const buffer = await fs.readFile(filePath);
const isPDF = buffer[0] === 0x25 && buffer[1] === 0x50 &&
              buffer[2] === 0x44 && buffer[3] === 0x46;
if (!isPDF) {
  await fs.unlink(filePath);
  return res.status(400).json({ error: 'Invalid PDF file' });
}
```

**Effort:** 1 hour
**Status:** NOT STARTED

---

### MEDIUM-3: Credit Operation Race Condition

**Location:** `server/supabaseRoutes.ts:399-411` and `server/supabaseStorage.ts:304-318`

**Problem:** Non-atomic credit operations could race.

**Scenario:**
1. User has 15 credits
2. Two concurrent operations each check balance (15)
3. Both deduct 10
4. User ends up with 5 instead of -5 (or error)

**Required Fix:** Use Supabase RPC for atomic operations:
```sql
-- Create RPC function
CREATE OR REPLACE FUNCTION deduct_credits(
  user_id UUID,
  amount INTEGER,
  description TEXT
)
RETURNS TABLE(new_balance INTEGER, success BOOLEAN) AS $$
DECLARE
  current_balance INTEGER;
  new_bal INTEGER;
BEGIN
  -- Lock row for update
  SELECT credits INTO current_balance
  FROM profiles WHERE id = user_id FOR UPDATE;

  IF current_balance < amount THEN
    RETURN QUERY SELECT current_balance, FALSE;
    RETURN;
  END IF;

  new_bal := current_balance - amount;

  UPDATE profiles SET credits = new_bal WHERE id = user_id;

  INSERT INTO credit_transactions (user_id, amount, balance_after, transaction_type, description)
  VALUES (user_id, -amount, new_bal, 'ip_processing', description);

  RETURN QUERY SELECT new_bal, TRUE;
END;
$$ LANGUAGE plpgsql;
```

**Effort:** 3 hours
**Status:** NOT STARTED

---

### MEDIUM-4: Debug Logging in Production

**Location:** `server/supabaseStorage.ts:137-179`

**Problem:** `getPatentsByUser` logs all patents for debugging.

**Impact:** Unnecessary database queries, log noise.

**Required Fix:**
```typescript
async getPatentsByUser(userId: string): Promise<Patent[]> {
  // Remove or gate behind debug flag
  if (process.env.DEBUG_QUERIES === 'true') {
    // debugging code
  }

  const { data, error } = await supabaseAdmin
    .from('patents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getPatentsByUser] Error:', error.message);
    return [];
  }

  return data || [];
}
```

**Effort:** 30 minutes
**Status:** NOT STARTED

---

### MEDIUM-5: Image Generation No Retry Logic

**Location:** `server/services/imageGenerator.ts`

**Problem:** Failed DALL-E calls don't retry.

**Impact:** Temporary failures cause permanent missing images.

**Required Fix:** Add retry with exponential backoff:
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}
```

**Effort:** 1 hour
**Status:** NOT STARTED

---

## LOW Priority Issues (Post-Alpha)

### LOW-1: Supabase Config Endpoint

**Location:** `server/supabaseRoutes.ts:88-93`

**Issue:** Exposes Supabase URL and anon key via API.

**Risk:** Low - anon keys are designed to be public.

**Recommendation:** Consider moving to build-time env vars.

---

### LOW-2: Local Upload Cleanup Job

**Location:** `server/supabaseRoutes.ts` - uploads directory

**Issue:** Files could accumulate if cleanup fails.

**Recommendation:** Add cron job to clean up old files.

---

### LOW-3: Session Warning Timing

**Location:** `client/src/hooks/useAuth.tsx:93-112`

**Issue:** Complex logic to avoid warning on fresh tokens.

**Status:** Working but could be simplified.

---

### LOW-4: API Text Search Debug Query

**Location:** `server/supabaseStorage.ts:174-178`

**Issue:** Text search query in production code.

**Recommendation:** Remove before production.

---

## Pre-Alpha Checklist

Before releasing to ANY alpha testers:

- [ ] **BLOCKER-1:** Rate limiting on upload endpoint
- [ ] **BLOCKER-2:** Credit check before upload
- [ ] **HIGH-1:** Rate limiting on magic link endpoint
- [ ] **HIGH-2:** Fix error handler re-throw
- [ ] **HIGH-3:** Add Error Boundary (optional but recommended)

## Implementation Order

1. **Day 1 (2 hours):**
   - BLOCKER-1: Rate limiting
   - BLOCKER-2: Credit check
   - HIGH-1: Magic link rate limit

2. **Day 2 (1 hour):**
   - HIGH-2: Error handler fix
   - HIGH-3: Error boundary

3. **Alpha Period:**
   - MEDIUM-1 through MEDIUM-5 as time permits

4. **Pre-Beta:**
   - All MEDIUM issues
   - LOW issues if time permits

---

## Risk Mitigation During Alpha

If blockers cannot be fixed immediately:

1. **Limit alpha access** to 5-10 trusted testers
2. **Monitor costs daily** for API usage spikes
3. **Manual user creation** instead of self-signup
4. **Direct communication** with testers about known issues

---

## Acceptance Criteria for Alpha

Before inviting alpha testers, verify:

- [ ] Rate limiting responds with 429 after threshold
- [ ] Users with <10 credits see clear error on upload
- [ ] Error handler doesn't throw after responding
- [ ] Server stays stable under moderate load (10 concurrent uploads)
- [ ] All existing features still work (regression test)
