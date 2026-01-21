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

/**
 * ErrorBoundary - Catches React rendering errors and displays a fallback UI
 *
 * Without this component, any unhandled React error would crash the entire app,
 * showing users a blank white screen with no way to recover.
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourApp />
 * </ErrorBoundary>
 */
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
            {import.meta.env.DEV && this.state.error && (
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

/**
 * SectionErrorBoundary - A smaller error boundary for specific sections
 *
 * Use this to wrap individual sections that might fail without crashing
 * the entire page.
 *
 * Usage:
 * <SectionErrorBoundary sectionName="Patent Details">
 *   <PatentDetails />
 * </SectionErrorBoundary>
 */
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
            Failed to load {sectionName}.{' '}
            <button
              onClick={() => window.location.reload()}
              className="underline ml-1"
            >
              Refresh page
            </button>
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
