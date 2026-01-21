# HIGH Priority Issues - Analysis and Fixes

**Date:** January 21, 2026
**Status:** Ready for Implementation
**Scope:** 3 HIGH priority issues from CRITICAL_ISSUES.md

---

## Summary

| Issue | Location | Risk | Effort | Status |
|-------|----------|------|--------|--------|
| HIGH-1 | Magic Link Endpoint | Email spam abuse | 15 min | Ready to fix |
| HIGH-2 | Error Handler | Process instability | 10 min | Ready to fix |
| HIGH-3 | React Error Boundary | App crashes | 30 min | Ready to fix |

**Total Estimated Effort:** ~1 hour

---

## HIGH-1: Magic Link Email Rate Limiting

### Location
`server/supabaseRoutes.ts` - Line 346 - `/api/auth/magic-link`

### Current Code
```typescript
app.post('/api/auth/magic-link', async (req, res) => {
  try {
    const { email, patentId } = req.body;
    // ... no rate limiting
```

### The Problem
Anyone can spam the magic link endpoint, resulting in:
1. **Email bombing:** Malicious actor sends 1000s of emails to a victim
2. **SendGrid rate limits:** Supabase has rate limits, but you hit them
3. **Cost:** Each email costs money (small but adds up)
4. **Reputation:** Your domain gets flagged as spam source

### Attack Scenario
```bash
# Attacker script (trivial)
for i in {1..1000}; do
  curl -X POST https://your-app.replit.app/api/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email": "victim@example.com"}'
done
```

### Risk Assessment for Alpha
- **Severity:** HIGH
- **Likelihood:** Medium (requires intent, but easy to execute)
- **Impact:** Email abuse, potential domain blacklisting
- **Alpha-specific:** With 5-10 users, any abuse is immediately obvious

### The Fix

Add rate limiting similar to the upload endpoint:

```typescript
// Add at the top with other rate limiters (around line 49)
const magicLinkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute per IP
  message: {
    error: 'Too many login attempts',
    details: 'Please wait a moment before requesting another magic link.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log('[RateLimit] Magic link rate limit exceeded for IP:', req.ip);
    res.status(429).json({
      error: 'Too many requests',
      details: 'Please wait a minute before requesting another magic link.',
      retryAfter: 60, // seconds
    });
  },
});

// Also add per-email limiting (more sophisticated)
const emailLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkEmailLimit(email: string): boolean {
  const now = Date.now();
  const limit = emailLimitMap.get(email);

  // Reset if window expired
  if (!limit || now > limit.resetTime) {
    emailLimitMap.set(email, { count: 1, resetTime: now + 5 * 60 * 1000 }); // 5 min window
    return true;
  }

  // Check if under limit (5 per 5 minutes per email)
  if (limit.count < 5) {
    limit.count++;
    return true;
  }

  return false;
}

// Update the endpoint (around line 346)
app.post('/api/auth/magic-link', magicLinkLimiter, async (req, res) => {
  try {
    const { email, patentId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check per-email rate limit
    if (!checkEmailLimit(normalizedEmail)) {
      console.log('[RateLimit] Per-email limit exceeded for:', normalizedEmail);
      return res.status(429).json({
        error: 'Too many requests for this email',
        details: 'Multiple magic links have been sent to this email. Please check your inbox (including spam) or wait 5 minutes.',
      });
    }

    // ... rest of existing code
```

### Files to Modify
- `server/supabaseRoutes.ts`

### Verification Steps
1. Request magic link 3 times rapidly - 4th should be blocked
2. Request to same email 5 times - 6th should be blocked
3. Wait 1 minute, request should work again
4. Check that legitimate requests still work

---

## HIGH-2: Global Error Handler Re-throws Errors

### Location
`server/index.ts` - Lines 74-80

### Current Code
```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  throw err; // <-- THIS IS THE PROBLEM
});
```

### The Problem
After sending a response to the client, the error is re-thrown. This causes:
1. **Unhandled rejection warnings** in console
2. **Potential process crash** if error bubbles up
3. **Double logging** (once in handler, once in unhandled rejection)
4. **Confusing logs** making debugging harder

### What Happens
```
1. Error occurs in route handler
2. Error reaches error handler middleware
3. Response sent to client (good)
4. Error re-thrown (bad)
5. Node.js catches it as unhandled rejection
6. Warning printed, possible instability
```

### Risk Assessment for Alpha
- **Severity:** HIGH
- **Likelihood:** High (happens on every error)
- **Impact:** Process instability, log noise, potential crashes
- **Alpha-specific:** Every error becomes two issues to debug

### The Fix

```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log the error with full context for debugging
  console.error('[Error Handler]', {
    status,
    message: err.message,
    stack: err.stack,
    path: _req.path,
    method: _req.method,
  });

  // Only send response if not already sent (prevents "headers already sent" error)
  if (!res.headersSent) {
    res.status(status).json({ message });
  }

  // DO NOT re-throw - error is handled
  // The old code had: throw err; <-- REMOVED
});
```

### Full Updated Error Handler (with Sentry Integration)

If you're implementing Sentry (from MONITORING_GUIDE.md):

```typescript
import { Sentry } from './lib/sentry';

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error for debugging
  console.error('[Error Handler]', {
    status,
    message: err.message,
    path: _req.path,
    method: _req.method,
    userId: _req.user?.id,
  });

  // Send to Sentry (if configured)
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setExtra('status', status);
      scope.setExtra('path', _req.path);
      scope.setExtra('method', _req.method);
      if (_req.user) {
        scope.setUser({ id: _req.user.id, email: _req.user.email });
      }
      Sentry.captureException(err);
    });
  }

  // Send response if not already sent
  if (!res.headersSent) {
    // In production, don't expose error details
    const responseMessage = process.env.NODE_ENV === 'production'
      ? (status === 500 ? 'Internal Server Error' : message)
      : message;

    res.status(status).json({ message: responseMessage });
  }
});
```

### Files to Modify
- `server/index.ts`

### Verification Steps
1. Trigger an error (e.g., invalid route, bad request)
2. Verify response is sent correctly
3. Verify NO "unhandled rejection" warnings in console
4. Verify error is logged only once
5. Check Sentry receives the error (if configured)

---

## HIGH-3: Missing React Error Boundary

### Location
`client/src/App.tsx` (and new component file)

### Current Code
```typescript
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### The Problem
When a React component throws an error:
1. **Entire app crashes** - white screen
2. **No recovery option** - user must refresh
3. **No error context** - you don't know what happened
4. **Poor UX** - users think app is broken forever

### What Happens Without Error Boundary
```
1. Component throws error (e.g., undefined.map())
2. React catches error
3. React unmounts entire component tree
4. User sees blank white screen
5. No way to recover without refresh
6. You have no idea this happened
```

### Risk Assessment for Alpha
- **Severity:** HIGH
- **Likelihood:** Medium (depends on code quality)
- **Impact:** Complete app crash for users
- **Alpha-specific:** Testers will lose work, think app is broken

### The Fix

#### Step 1: Create Error Boundary Component

Create `client/src/components/ErrorBoundary.tsx`:

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for debugging
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Save error info for display
    this.setState({ errorInfo });

    // Send to Sentry if configured
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.withScope((scope: any) => {
        scope.setExtra('componentStack', errorInfo.componentStack);
        (window as any).Sentry.captureException(error);
      });
    }

    // Send to PostHog if configured
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('react_error', {
        error: error.message,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
            </div>

            <h1 className="text-2xl font-bold mb-2">
              Something went wrong
            </h1>

            <p className="text-muted-foreground mb-6">
              We're sorry, but something unexpected happened. Your work may be saved -
              try refreshing the page.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-muted rounded-lg text-left">
                <p className="font-mono text-sm text-destructive mb-2">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="font-mono text-xs text-muted-foreground overflow-auto max-h-32">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="outline">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              <Button onClick={this.handleReload}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>

              <Button onClick={this.handleGoHome} variant="secondary">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              If this keeps happening, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Smaller error boundary for specific sections
export function SectionErrorBoundary({
  children,
  sectionName
}: {
  children: ReactNode;
  sectionName: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="text-sm text-destructive">
            Failed to load {sectionName}.
            <button
              onClick={() => window.location.reload()}
              className="underline ml-1"
            >
              Refresh
            </button>
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
```

#### Step 2: Update App.tsx

```typescript
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LandingPage } from "@/pages/LandingPage";
import { PreviewPage } from "@/pages/PreviewPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatentDetailPage } from "@/pages/PatentDetailPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import LoginPage from "@/pages/LoginPage";
import AdminPage from "@/pages/AdminPage";
import { DebugPage } from "@/pages/DebugPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/preview/:id" component={PreviewPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/patent/:id" component={PatentDetailPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/debug" component={DebugPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
```

### Files to Create/Modify
- Create: `client/src/components/ErrorBoundary.tsx`
- Modify: `client/src/App.tsx`

### Verification Steps
1. Temporarily add a component that throws an error:
   ```typescript
   function BrokenComponent() {
     throw new Error('Test error');
     return null;
   }
   ```
2. Navigate to page with broken component
3. Verify error boundary UI shows (not white screen)
4. Verify "Try Again" button attempts re-render
5. Verify "Refresh Page" reloads
6. Verify "Go Home" navigates to /
7. Remove test component
8. Check Sentry receives error (if configured)

---

## Implementation Order

### Recommended Order (Total: ~1 hour)

1. **HIGH-2: Error Handler** (10 min)
   - Smallest change, biggest stability impact
   - No new dependencies
   - Immediate benefit for all errors

2. **HIGH-1: Magic Link Rate Limiting** (15 min)
   - Uses existing rate-limit package
   - Copy pattern from upload endpoint
   - Protects against obvious abuse

3. **HIGH-3: Error Boundary** (30 min)
   - New component creation
   - Integration with existing UI
   - Optional Sentry integration

### Testing After Each Fix

After each fix, run:
```bash
npm run dev
```

And verify:
1. App starts without errors
2. Basic functionality works (landing page, login page)
3. No console warnings related to fix

---

## Post-Implementation Checklist

- [ ] HIGH-2: Error handler no longer re-throws
- [ ] HIGH-2: Console shows single error log (not double)
- [ ] HIGH-1: Magic link rate limit responds with 429 after threshold
- [ ] HIGH-1: Per-email limit works independently of IP limit
- [ ] HIGH-3: Error boundary catches render errors
- [ ] HIGH-3: Recovery buttons work correctly
- [ ] All existing functionality still works
- [ ] No new console errors or warnings

---

## Code Snippets Ready to Copy

All code in this document is ready to copy-paste. The fixes are designed to:
- Be minimal and focused
- Not break existing functionality
- Be easy to verify
- Work with or without Sentry configured

Copy the relevant sections and apply them to the specified files.
