/**
 * Sentry Error Monitoring - Client Configuration
 *
 * This module initializes Sentry for error tracking in the React app.
 * It captures:
 * - React rendering errors
 * - JavaScript exceptions
 * - Performance data
 * - User session context
 *
 * Setup:
 * 1. Create account at sentry.io
 * 2. Create a React project
 * 3. Copy DSN and set VITE_SENTRY_DSN environment variable
 *
 * Usage:
 * import { initSentry, identifyUser, captureError } from './lib/sentry';
 *
 * // Initialize at app startup (in main.tsx)
 * initSentry();
 *
 * // Identify user on login
 * identifyUser(userId, email);
 */

// Conditional Sentry loading
let Sentry: any = null;

/**
 * Initialize Sentry for client-side error monitoring
 * Call this in main.tsx before rendering the app
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] No DSN configured, client error monitoring disabled');
    return;
  }

  try {
    // Dynamic import
    import('@sentry/react').then((SentryModule) => {
      Sentry = SentryModule;

      Sentry.init({
        dsn,

        // Environment
        environment: import.meta.env.MODE,

        // Sample rate (1.0 = 100% for alpha, reduce for production)
        tracesSampleRate: import.meta.env.PROD ? 0.5 : 1.0,

        // Session replay (optional - helps debug user issues)
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% when error occurs

        // Integrations
        integrations: [
          Sentry.browserTracingIntegration(),
          // Session replay for debugging (requires @sentry/replay)
          // Sentry.replayIntegration(),
        ],

        // Don't capture these common client errors
        ignoreErrors: [
          // Browser extensions
          'Extension context',
          // Network errors
          'NetworkError',
          'Failed to fetch',
          'Load failed',
          // ResizeObserver (benign)
          'ResizeObserver loop limit exceeded',
          // Promise rejections without error objects
          'Non-Error promise rejection captured',
          // Chunk loading errors (handled by retry)
          /Loading chunk .* failed/,
        ],

        // Filter URLs to ignore
        denyUrls: [
          // Browser extensions
          /extensions\//i,
          /^chrome:\/\//i,
          /^moz-extension:\/\//i,
        ],

        // Sanitize data
        beforeSend(event: any) {
          // Don't send in development if not needed
          if (import.meta.env.DEV && !import.meta.env.VITE_SENTRY_DEV) {
            console.log('[Sentry] Event (dev mode):', event.message || event.exception?.values?.[0]?.value);
            return null;
          }

          return event;
        },
      });

      console.log(`[Sentry] Client initialized for ${import.meta.env.MODE}`);

      // Make Sentry available globally for ErrorBoundary
      (window as any).Sentry = Sentry;
    });
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Identify the current user
 * Call this when a user logs in
 *
 * @param userId - User's ID
 * @param email - User's email
 * @param additionalData - Optional additional user data
 */
export function identifyUser(
  userId: string,
  email: string,
  additionalData?: Record<string, any>
): void {
  if (!Sentry) return;

  Sentry.setUser({
    id: userId,
    email,
    ...additionalData,
  });
}

/**
 * Clear user identity
 * Call this when a user logs out
 */
export function clearUser(): void {
  if (!Sentry) return;
  Sentry.setUser(null);
}

/**
 * Capture an error with context
 *
 * @param error - The error to capture
 * @param context - Additional context
 */
export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  console.error('[Error]', error.message, context);

  if (!Sentry) return;

  Sentry.withScope((scope: any) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message
 *
 * @param message - The message
 * @param level - Severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  if (!Sentry) {
    console.log(`[${level.toUpperCase()}]`, message, context);
    return;
  }

  Sentry.withScope((scope: any) => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
}

/**
 * Add breadcrumb for debugging
 *
 * @param message - Description
 * @param category - Category (navigation, ui, http, etc.)
 * @param data - Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  if (!Sentry) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };
