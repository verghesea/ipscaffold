# Monitoring Guide for IP Scaffold

**Last Updated:** January 21, 2026
**Status:** Alpha Launch Preparation

---

## Why Monitoring Matters

When your app is live with real users, **things will break**. The question isn't "if" but "when" and "how quickly can you find out?"

Without monitoring, you'll learn about problems from:
- Angry user emails (worst case)
- Complete service outages (worse)
- Massive unexpected bills (even worse)

With monitoring, you learn about problems:
- Before users notice
- With exact details of what went wrong
- With context to fix issues quickly

---

## The Three Pillars of Monitoring

### 1. Error Monitoring (Sentry) - "What's Breaking?"

**What it does:**
- Catches JavaScript errors in React (client-side)
- Catches server crashes and API failures (server-side)
- Captures stack traces, user context, browser info
- Groups similar errors together
- Tracks error frequency and impact

**Real example of what you'll see:**
```
Error: Cannot read property 'credits' of null
  at DashboardPage.tsx:45
  User: alice@example.com
  Browser: Chrome 120 on macOS
  Occurred: 15 times in last hour
  First seen: 2 hours ago
```

**Why you need it for alpha:**
- Know when authentication breaks
- Know when uploads fail
- Know when PDF parsing crashes
- Debug production issues without asking users for details

**Cost:** Free tier covers 5,000 errors/month (plenty for alpha)

---

### 2. Analytics (PostHog) - "What Are Users Doing?"

**What it does:**
- Tracks user actions (page views, button clicks, feature usage)
- Shows user journeys (how people move through your app)
- Creates funnels (where do users drop off?)
- Identifies traffic sources (how did users find you?)
- Session recordings (watch user interactions)

**Real example of what you'll see:**
```
Upload Funnel (last 7 days):
  Landing Page Visit: 100 users
  Clicked Upload: 45 users (45% conversion)
  File Selected: 40 users (89% of clickers)
  Upload Complete: 35 users (88% of selectors)
  Viewed Results: 30 users (86% of completers)

Drop-off insight: 55% of visitors never click Upload
Action: Test different CTA copy or positioning
```

**Why you need it for alpha:**
- Understand which features users actually use
- Find where users get confused
- Measure success of the upload flow
- Get feedback without asking users

**Cost:** Free tier covers 1M events/month (way more than alpha needs)

---

### 3. Server Health (Built-in + UptimeRobot) - "Is Everything Running?"

**What it does:**
- Tracks CPU, memory, response times
- Monitors uptime (is the server reachable?)
- Alerts when things slow down or crash
- Shows historical performance trends

**Real example of what you'll see:**
```
Health Check Alert!
  Endpoint: /api/health
  Status: DOWN
  Since: 5 minutes ago
  Last Response Time: 2,450ms (usually 50ms)

Action Required: Server may be overloaded or crashed
```

**Why you need it for alpha:**
- Know immediately if Replit deployment goes down
- Track if expensive operations slow everything down
- Prevent "is it down for everyone or just me?" confusion

**Cost:** Free tier covers basic monitoring

---

## Implementation Guide

### Part A: Sentry Setup (Error Monitoring)

#### Step 1: Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up with GitHub (recommended for easy integration)
3. Create a new project:
   - Platform: **Node.js (Express)** for server
   - Create another project: **React** for client
4. Copy your DSN (Data Source Name) - looks like:
   ```
   https://abc123@o123456.ingest.sentry.io/789
   ```

#### Step 2: Install Sentry Packages

```bash
# Server (Express)
npm install @sentry/node

# Client (React)
npm install @sentry/react
```

#### Step 3: Configure Server (Express)

Create `server/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/node';

export function initSentry() {
  // Only initialize in production or if DSN is provided
  if (!process.env.SENTRY_DSN) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Capture 100% of errors in alpha (reduce in production)
    tracesSampleRate: 1.0,

    // Don't send errors for these common scenarios
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'Network request failed',
    ],

    // Add useful context to every error
    beforeSend(event) {
      // Remove sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  console.log('[Sentry] Initialized for', process.env.NODE_ENV);
}

// Helper to capture errors with context
export function captureError(error: Error, context?: Record<string, any>) {
  if (!process.env.SENTRY_DSN) {
    console.error('[Error]', error.message, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

// Helper to add user context
export function setUserContext(userId: string, email: string) {
  Sentry.setUser({ id: userId, email });
}

// Helper to clear user context (on logout)
export function clearUserContext() {
  Sentry.setUser(null);
}

export { Sentry };
```

Update `server/index.ts`:

```typescript
import express from 'express';
import { initSentry, Sentry } from './lib/sentry';

// Initialize Sentry FIRST, before any other imports
initSentry();

const app = express();

// ... existing middleware ...

// Add Sentry request handler (after body parser, before routes)
app.use(Sentry.Handlers.requestHandler());

// Your routes
// app.use('/api', routes);

// Add Sentry error handler BEFORE your error handler
app.use(Sentry.Handlers.errorHandler());

// Your existing error handler
app.use((err, req, res, next) => {
  // ... existing error handling
});
```

#### Step 4: Configure Client (React)

Create `client/src/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    // Capture 100% of transactions in alpha
    tracesSampleRate: 1.0,

    // Capture 10% of sessions for replay (optional)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      // Capture browser performance data
      Sentry.browserTracingIntegration(),
      // Optional: Record user sessions on errors
      Sentry.replayIntegration(),
    ],

    // Don't capture common client errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /Loading chunk .* failed/,
    ],
  });

  console.log('[Sentry] Client initialized');
}

// Helper to identify users (call on login)
export function identifyUser(userId: string, email: string) {
  Sentry.setUser({ id: userId, email });
}

// Helper to clear user on logout
export function clearUser() {
  Sentry.setUser(null);
}

// Helper to capture errors with context
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

export { Sentry };
```

Update `client/src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from './lib/sentry';
import App from './App';
import './index.css';

// Initialize Sentry before rendering
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### Step 5: Add Environment Variables

Add to your `.env` (and Replit Secrets):

```bash
# Server
SENTRY_DSN=https://your-server-dsn@sentry.io/project-id

# Client (must be prefixed with VITE_)
VITE_SENTRY_DSN=https://your-client-dsn@sentry.io/project-id
```

---

### Part B: PostHog Setup (Analytics)

#### Step 1: Create PostHog Account

1. Go to [posthog.com](https://posthog.com)
2. Sign up (GitHub recommended)
3. Create a new project
4. Copy your API key (looks like: `phc_xxxxxxxxxxxxxxx`)

#### Step 2: Install PostHog

```bash
npm install posthog-js
```

#### Step 3: Configure PostHog Client

Create `client/src/lib/analytics.ts`:

```typescript
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

export function initAnalytics() {
  if (!POSTHOG_KEY) {
    console.log('[Analytics] No PostHog key configured, skipping initialization');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // Enable session recordings (optional but useful for alpha)
    session_recording: {
      recordCrossOriginIframes: false,
    },

    // Automatically capture pageviews
    capture_pageview: true,

    // Respect Do Not Track
    respect_dnt: true,

    // Disable in development (optional)
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        // Uncomment to disable in dev:
        // posthog.opt_out_capturing();
      }
    },
  });

  console.log('[Analytics] PostHog initialized');
}

// Identify user on login
export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;

  posthog.identify(userId, {
    ...properties,
    environment: import.meta.env.MODE,
  });
}

// Clear user on logout
export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

// Track custom events
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) {
    console.log('[Analytics]', eventName, properties);
    return;
  }

  posthog.capture(eventName, properties);
}

// Pre-defined events for IP Scaffold
export const Analytics = {
  // Page views
  pageView: (pageName: string) => trackEvent('page_view', { page: pageName }),

  // Upload flow
  uploadStarted: () => trackEvent('upload_started'),
  uploadFileSelected: (fileSize: number) => trackEvent('upload_file_selected', { file_size_bytes: fileSize }),
  uploadCompleted: (patentId: string) => trackEvent('upload_completed', { patent_id: patentId }),
  uploadFailed: (error: string) => trackEvent('upload_failed', { error }),

  // Authentication
  loginStarted: () => trackEvent('login_started'),
  loginCompleted: (method: string) => trackEvent('login_completed', { method }),
  logoutClicked: () => trackEvent('logout_clicked'),

  // Patent interactions
  patentViewed: (patentId: string) => trackEvent('patent_viewed', { patent_id: patentId }),
  artifactViewed: (artifactType: string) => trackEvent('artifact_viewed', { artifact_type: artifactType }),
  artifactDownloaded: (artifactType: string) => trackEvent('artifact_downloaded', { artifact_type: artifactType }),

  // Credit system
  creditsPurchaseStarted: () => trackEvent('credits_purchase_started'),
  creditsPurchaseCompleted: (amount: number) => trackEvent('credits_purchase_completed', { amount }),

  // Errors
  errorDisplayed: (errorType: string) => trackEvent('error_displayed', { error_type: errorType }),
};

export { posthog };
```

Update `client/src/main.tsx`:

```typescript
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';

// Initialize monitoring before rendering
initSentry();
initAnalytics();

// ... rest of main.tsx
```

#### Step 4: Add Analytics to Key Components

Example: Track upload flow in your upload component:

```typescript
import { Analytics } from '@/lib/analytics';

function UploadComponent() {
  const handleFileSelect = (file: File) => {
    Analytics.uploadFileSelected(file.size);
    // ... existing logic
  };

  const handleUploadStart = () => {
    Analytics.uploadStarted();
    // ... existing logic
  };

  const handleUploadComplete = (patentId: string) => {
    Analytics.uploadCompleted(patentId);
    // ... existing logic
  };

  const handleUploadError = (error: Error) => {
    Analytics.uploadFailed(error.message);
    // ... existing logic
  };

  // ... component JSX
}
```

#### Step 5: Add Environment Variables

```bash
# Add to .env and Replit Secrets
VITE_POSTHOG_KEY=phc_your_key_here
VITE_POSTHOG_HOST=https://app.posthog.com
```

---

### Part C: Health Monitoring Setup

#### Step 1: Enhanced Health Check Endpoint

Update `server/supabaseRoutes.ts` - the existing `/api/health` endpoint:

```typescript
// Enhanced health check with detailed status
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  // Check database connectivity
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('count')
      .limit(1)
      .single();

    health.checks.database = {
      status: error ? 'degraded' : 'healthy',
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    health.checks.database = { status: 'unhealthy', error: 'Connection failed' };
    health.status = 'degraded';
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning',
    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
  };

  // Overall response time
  health.responseTime = Date.now() - startTime;

  // Return appropriate status code
  const statusCode = health.status === 'ok' ? 200 :
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

// Simple ping endpoint for uptime monitoring
app.get('/api/ping', (req, res) => {
  res.send('pong');
});
```

#### Step 2: Set Up UptimeRobot (Free Monitoring)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up for free account
3. Add a new monitor:
   - **Type:** HTTP(s)
   - **Friendly Name:** IP Scaffold
   - **URL:** `https://your-app.replit.app/api/ping`
   - **Monitoring Interval:** 5 minutes
4. Set up alert contacts (email, Slack, etc.)

#### Step 3: Replit-Specific Health Considerations

Replit deployments can go to sleep. To keep your app warm:

1. UptimeRobot pings will help keep it active
2. Consider the "Always On" feature for production (paid Replit feature)
3. The first request after sleep may be slow (cold start)

---

## Alert Configuration

### Sentry Alerts

1. Go to your Sentry project
2. Navigate to Alerts > Create Alert Rule
3. Recommended alerts for alpha:

**High-Priority Error Alert:**
- Condition: Error count > 10 in 5 minutes
- Action: Email immediately
- Use for: Server crashes, auth failures

**New Error Alert:**
- Condition: First occurrence of error
- Action: Email (can be daily digest)
- Use for: Discovering new bugs

### PostHog Alerts

1. Go to PostHog > Insights
2. Create insight for key metrics
3. Set up alerts:

**Upload Failure Alert:**
- Metric: `upload_failed` events
- Threshold: > 5 in 1 hour
- Action: Email

**Zero Activity Alert:**
- Metric: `page_view` events
- Threshold: 0 in 4 hours
- Action: Email (might indicate downtime)

### UptimeRobot Alerts

Configure in UptimeRobot dashboard:
- Email on downtime
- SMS for critical (optional)
- Slack webhook (if you use Slack)

---

## What to Watch During Alpha

### First 24 Hours Checklist

1. **Sentry:** Any new errors appearing?
2. **PostHog:** Are users completing the upload flow?
3. **UptimeRobot:** Any downtime notifications?
4. **Replit Logs:** Any unexpected patterns?

### Daily Review (5 minutes)

1. Check Sentry for new errors
2. Review PostHog funnels
3. Verify health endpoint response times
4. Check credit usage vs API costs

### Weekly Review (15 minutes)

1. PostHog: Feature adoption report
2. Sentry: Error trends
3. Performance: Slow endpoints
4. User feedback vs analytics data

---

## Debugging with Monitoring Data

### Scenario: User Reports "Upload Not Working"

**Step 1: Check Sentry**
- Search for errors from that user's email
- Look at stack trace and browser info
- Check error context (file size, credits, etc.)

**Step 2: Check PostHog**
- Find user's session recording (if enabled)
- See exactly what they did
- Identify where they got stuck

**Step 3: Check Server Logs**
- Filter by timestamp and user ID
- Look for error messages
- Check API response times

### Scenario: Spike in Errors

**Step 1: Sentry**
- Look at error grouping
- Check if it's one error or many
- Identify common factors (browser, action, time)

**Step 2: Check Health Endpoint**
- Is database responding?
- Memory usage normal?
- Response times elevated?

**Step 3: Correlate with Deploys**
- Did this start after a deploy?
- Roll back if necessary
- Fix in staging first

---

## Cost Estimates for Alpha (5-10 Users)

| Service | Free Tier | Alpha Usage | Cost |
|---------|-----------|-------------|------|
| Sentry | 5K errors/mo | ~100 errors | $0 |
| PostHog | 1M events/mo | ~10K events | $0 |
| UptimeRobot | 50 monitors | 1 monitor | $0 |
| **Total** | | | **$0** |

---

## Quick Reference

### Environment Variables Needed

```bash
# Sentry (error monitoring)
SENTRY_DSN=https://xxx@sentry.io/xxx           # Server
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx      # Client

# PostHog (analytics)
VITE_POSTHOG_KEY=phc_xxx
VITE_POSTHOG_HOST=https://app.posthog.com

# Optional: Enable debug mode
DEBUG_MONITORING=true
```

### Key URLs

- Sentry Dashboard: `https://sentry.io/organizations/YOUR_ORG/issues/`
- PostHog Dashboard: `https://app.posthog.com/project/YOUR_PROJECT`
- UptimeRobot: `https://uptimerobot.com/dashboard`
- Health Check: `https://your-app.replit.app/api/health`

### Quick Troubleshooting

| Symptom | Check First | Likely Cause |
|---------|-------------|--------------|
| No errors in Sentry | DSN configured? | Missing env var |
| No events in PostHog | API key correct? | Missing env var |
| Health check slow | Database query | Supabase issue |
| Memory warning | Process restart | Memory leak |

---

## Next Steps

1. [ ] Create Sentry account and project
2. [ ] Create PostHog account and project
3. [ ] Add environment variables to Replit
4. [ ] Deploy and verify health endpoint
5. [ ] Create first test upload and verify tracking
6. [ ] Set up alert rules
7. [ ] Document your monitoring URLs in team docs
