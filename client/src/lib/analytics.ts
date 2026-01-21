/**
 * Analytics Integration
 *
 * This module provides analytics tracking supporting multiple providers:
 * - PostHog (recommended for alpha - full-featured, free tier)
 * - Umami (lightweight, privacy-focused alternative)
 *
 * Setup for PostHog:
 * 1. Create account at posthog.com
 * 2. Create a project
 * 3. Set VITE_POSTHOG_KEY environment variable
 *
 * Usage:
 * import { initAnalytics, Analytics, identifyUser } from '@/lib/analytics';
 *
 * // Initialize at app startup (main.tsx)
 * initAnalytics();
 *
 * // Track events
 * Analytics.uploadStarted();
 * Analytics.uploadCompleted('patent-123');
 *
 * // Identify user on login
 * identifyUser(userId, { email, credits });
 */

// PostHog instance (loaded dynamically)
let posthog: any = null;

/**
 * Initialize analytics
 * Call this in main.tsx before rendering
 */
export function initAnalytics(): void {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

  if (!posthogKey) {
    console.log('[Analytics] No PostHog key configured');
    console.log('[Analytics] Set VITE_POSTHOG_KEY to enable PostHog');
    return;
  }

  // Dynamic import PostHog
  import('posthog-js').then((module) => {
    posthog = module.default;

    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
      respect_dnt: true,

      // Privacy settings
      session_recording: {
        maskAllInputs: true,
      },

      loaded: (ph: any) => {
        // Disable in dev unless explicitly enabled
        if (import.meta.env.DEV && !import.meta.env.VITE_ANALYTICS_DEV) {
          console.log('[Analytics] Dev mode - PostHog tracking disabled');
          ph.opt_out_capturing();
        } else {
          console.log('[Analytics] PostHog initialized');
        }
      },
    });

    // Make available globally
    (window as any).posthog = posthog;
  }).catch((err) => {
    console.error('[Analytics] Failed to load PostHog:', err);
  });
}

/**
 * Track an event to all configured providers
 */
export const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
  // PostHog
  if (posthog && !posthog.has_opted_out_capturing?.()) {
    posthog.capture(eventName, eventData);
  }

  // Umami (legacy support)
  if (typeof window !== 'undefined' && (window as any).umami) {
    (window as any).umami.track(eventName, eventData);
  }

  // Dev logging
  if (import.meta.env.DEV) {
    console.log('[Analytics]', eventName, eventData);
  }
};

/**
 * Identify user
 * Call this when user logs in
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, any>
): void {
  if (posthog) {
    posthog.identify(userId, {
      ...properties,
      environment: import.meta.env.MODE,
    });
  }
}

/**
 * Reset user identity
 * Call this when user logs out
 */
export function resetUser(): void {
  if (posthog) {
    posthog.reset();
  }
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  return !!(posthog && !posthog.has_opted_out_capturing?.());
}

// =================================
// Pre-defined Analytics Events
// =================================

/**
 * Analytics helper with typed events for IP Scaffold
 */
export const Analytics = {
  // Upload Flow
  uploadStarted: () => {
    trackEvent('upload_started');
  },

  uploadFileSelected: (fileSize: number) => {
    trackEvent('upload_file_selected', {
      file_size_bytes: fileSize,
      file_size_mb: Math.round(fileSize / 1024 / 1024 * 100) / 100,
    });
  },

  uploadCompleted: (patentId: string, processingTime?: number) => {
    trackEvent('upload_completed', {
      patent_id: patentId,
      processing_time_ms: processingTime,
    });
  },

  uploadFailed: (error: string) => {
    trackEvent('upload_failed', { error });
  },

  // Authentication
  loginStarted: () => {
    trackEvent('login_started');
  },

  loginCompleted: () => {
    trackEvent('login_completed');
  },

  logoutClicked: () => {
    trackEvent('logout_clicked');
  },

  // Patent Interactions
  patentViewed: (patentId: string) => {
    trackEvent('patent_viewed', { patent_id: patentId });
  },

  artifactViewed: (artifactType: string, patentId: string) => {
    trackEvent('artifact_viewed', {
      artifact_type: artifactType,
      patent_id: patentId,
    });
  },

  artifactDownloaded: (artifactType: string, format: string) => {
    trackEvent('artifact_downloaded', {
      artifact_type: artifactType,
      format,
    });
  },

  // Credits
  creditsViewed: (credits: number) => {
    trackEvent('credits_viewed', { current_credits: credits });
  },

  insufficientCredits: (current: number, required: number) => {
    trackEvent('insufficient_credits', {
      current_credits: current,
      required_credits: required,
    });
  },

  // Dashboard
  dashboardViewed: (patentCount: number) => {
    trackEvent('dashboard_viewed', { patent_count: patentCount });
  },

  // Errors
  errorDisplayed: (errorType: string) => {
    trackEvent('error_displayed', { error_type: errorType });
  },

  errorBoundaryTriggered: (componentStack?: string) => {
    trackEvent('error_boundary_triggered', {
      component_stack: componentStack?.substring(0, 200),
    });
  },

  // Page views
  pageView: (page: string) => {
    trackEvent('page_view', { page });
  },
};

// Legacy analytics export for backwards compatibility
export const analytics = {
  trackPatentUpload: (title: string) => {
    trackEvent('patent-upload', { title });
  },

  trackArtifactView: (artifactType: string) => {
    trackEvent('artifact-view', { type: artifactType });
  },

  trackDownload: (format: string, artifactType: string) => {
    trackEvent('download', { format, artifactType });
  },

  trackMagicLinkSent: (email: string) => {
    trackEvent('magic-link-sent', { email });
  },

  trackLogin: () => {
    trackEvent('login-success');
  },

  trackPromoCodeRedeemed: (code: string, credits: number) => {
    trackEvent('promo-redeemed', { code, credits });
  },

  trackPageView: (page: string) => {
    trackEvent('page-view', { page });
  }
};

// Export PostHog instance for advanced usage
export { posthog };
