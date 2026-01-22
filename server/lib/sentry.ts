/**
 * Sentry Error Monitoring - Server Configuration
 *
 * This module initializes Sentry for error tracking on the server.
 * It captures:
 * - Unhandled exceptions
 * - API errors
 * - Performance data (if enabled)
 *
 * Setup:
 * 1. Create account at sentry.io
 * 2. Create a Node.js project
 * 3. Copy DSN and set SENTRY_DSN environment variable
 *
 * Usage:
 * import { initSentry, captureError, setUserContext } from './lib/sentry';
 *
 * // Initialize at app startup
 * initSentry();
 *
 * // Capture errors with context
 * captureError(error, { patentId: 'abc123' });
 *
 * // Set user context on authentication
 * setUserContext(userId, email);
 */

// Conditional import - only load Sentry if DSN is configured
let Sentry: any = null;

/**
 * Initialize Sentry error monitoring
 * Call this at the very beginning of your app, before importing other modules
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[Sentry] No DSN configured, error monitoring disabled');
    console.log('[Sentry] Set SENTRY_DSN environment variable to enable');
    return;
  }

  try {
    // Dynamic import to avoid loading Sentry when not configured
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn,

      // Environment (development, staging, production)
      environment: process.env.NODE_ENV || 'development',

      // Release version (helps track which version introduced bugs)
      release: process.env.npm_package_version || '1.0.0',

      // Sample rate for performance monitoring (1.0 = 100% in alpha)
      // Reduce this for higher traffic: 0.1 = 10%
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 1.0,

      // Don't capture these common errors
      ignoreErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'Network request failed',
        'AbortError',
      ],

      // Sanitize data before sending
      beforeSend(event: any) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }

        // Remove sensitive body data
        if (event.request?.data) {
          const data = event.request.data;
          if (typeof data === 'object') {
            delete data.password;
            delete data.token;
            delete data.accessToken;
            delete data.refreshToken;
          }
        }

        return event;
      },

      // Add server-specific tags
      initialScope: {
        tags: {
          runtime: 'node',
          platform: process.platform,
        },
      },
    });

    console.log(`[Sentry] Initialized for ${process.env.NODE_ENV}`);
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Capture an error with optional context
 *
 * @param error - The error to capture
 * @param context - Additional context (key-value pairs)
 *
 * @example
 * captureError(error, {
 *   patentId: 'abc123',
 *   userId: 'user-456',
 *   action: 'upload'
 * });
 */
export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  // Log to console regardless of Sentry
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
 * Capture a message (non-error event)
 *
 * @param message - The message to capture
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
 * Set user context for error tracking
 * Call this when a user authenticates
 *
 * @param userId - The user's ID
 * @param email - The user's email
 */
export function setUserContext(userId: string, email: string): void {
  if (!Sentry) return;

  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context
 * Call this when a user logs out
 */
export function clearUserContext(): void {
  if (!Sentry) return;
  Sentry.setUser(null);
}

/**
 * Add a breadcrumb (trail of events leading to an error)
 *
 * @param message - Description of the event
 * @param category - Category (e.g., 'http', 'user', 'navigation')
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

/**
 * Express error handler middleware
 * Add this BEFORE your custom error handler
 *
 * @example
 * app.use(getSentryErrorHandler());
 * app.use(yourCustomErrorHandler);
 */
export function getSentryErrorHandler(): any {
  if (!Sentry) {
    // Return a no-op middleware if Sentry not configured
    return (err: any, req: any, res: any, next: any) => next(err);
  }

  return Sentry.Handlers.errorHandler();
}

/**
 * Express request handler middleware
 * Add this AFTER body parser, BEFORE routes
 *
 * @example
 * app.use(express.json());
 * app.use(getSentryRequestHandler());
 * app.use('/api', routes);
 */
export function getSentryRequestHandler(): any {
  if (!Sentry) {
    // Return a no-op middleware if Sentry not configured
    return (req: any, res: any, next: any) => next();
  }

  return Sentry.Handlers.requestHandler();
}

// Export Sentry instance for advanced usage
export { Sentry };
