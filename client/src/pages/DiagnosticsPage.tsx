import { useEffect, useState } from 'react';

export default function DiagnosticsPage() {
  const [envVars, setEnvVars] = useState<Record<string, any>>({});

  useEffect(() => {
    // Check what environment variables are available
    const vars = {
      VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY || 'NOT SET',
      VITE_POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST || 'NOT SET',
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || 'NOT SET',
      VITE_ANALYTICS_DEV: import.meta.env.VITE_ANALYTICS_DEV || 'NOT SET',
      MODE: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
    };
    setEnvVars(vars);

    // Log to console too
    console.log('[Diagnostics] Environment Variables:', vars);
  }, []);

  const checkPostHog = () => {
    // @ts-ignore
    if (window.posthog) {
      console.log('[Diagnostics] PostHog is initialized!');
      // @ts-ignore
      console.log('[Diagnostics] PostHog instance:', window.posthog);
      alert('✅ PostHog is initialized! Check console for details.');
    } else {
      console.error('[Diagnostics] PostHog is NOT initialized');
      alert('❌ PostHog is NOT initialized. Check if VITE_POSTHOG_KEY is set and rebuild the app.');
    }
  };

  const checkSentry = () => {
    // @ts-ignore
    if (window.Sentry) {
      console.log('[Diagnostics] Sentry is initialized!');
      // @ts-ignore
      console.log('[Diagnostics] Sentry instance:', window.Sentry);
      alert('✅ Sentry is initialized! Check console for details.');
    } else {
      console.error('[Diagnostics] Sentry is NOT initialized');
      alert('❌ Sentry is NOT initialized. Check if VITE_SENTRY_DSN is set and rebuild the app.');
    }
  };

  const testPostHogEvent = () => {
    // @ts-ignore
    if (window.posthog) {
      // @ts-ignore
      window.posthog.capture('diagnostic_test', {
        timestamp: new Date().toISOString(),
        source: 'diagnostics_page',
      });
      console.log('[Diagnostics] PostHog test event sent!');
      alert('✅ PostHog test event sent! Check your PostHog dashboard.');
    } else {
      alert('❌ PostHog not initialized. Cannot send test event.');
    }
  };

  const testSentryError = () => {
    // @ts-ignore
    if (window.Sentry) {
      // @ts-ignore
      window.Sentry.captureException(new Error('Test error from diagnostics page'));
      console.log('[Diagnostics] Sentry test error sent!');
      alert('✅ Sentry test error sent! Check your Sentry dashboard.');
    } else {
      alert('❌ Sentry not initialized. Cannot send test error.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Diagnostics</h1>
        <p className="text-gray-600 mb-8">
          Check if PostHog and Sentry are properly configured
        </p>

        {/* Environment Variables */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 font-mono text-sm">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex justify-between border-b pb-2">
                <span className="font-semibold">{key}:</span>
                <span className={value === 'NOT SET' ? 'text-red-600' : 'text-green-600'}>
                  {typeof value === 'string' && value.length > 40
                    ? value.substring(0, 40) + '...'
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
          {(envVars.VITE_POSTHOG_KEY === 'NOT SET' || envVars.VITE_SENTRY_DSN === 'NOT SET') && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Environment variables not set!</strong>
                <br />
                If you added them to Replit Secrets, you need to <strong>rebuild the app</strong>.
                <br />
                Run: <code className="bg-yellow-100 px-2 py-1 rounded">npm run build</code>
              </p>
            </div>
          )}
        </div>

        {/* PostHog Checks */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">PostHog Diagnostics</h2>
          <div className="space-y-3">
            <button
              onClick={checkPostHog}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Check if PostHog is Initialized
            </button>
            <button
              onClick={testPostHogEvent}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Send Test Event to PostHog
            </button>
          </div>
        </div>

        {/* Sentry Checks */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Sentry Diagnostics</h2>
          <div className="space-y-3">
            <button
              onClick={checkSentry}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
            >
              Check if Sentry is Initialized
            </button>
            <button
              onClick={testSentryError}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
            >
              Send Test Error to Sentry
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Troubleshooting Steps</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <strong>Check Replit Secrets</strong> - Make sure you added:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li><code>VITE_POSTHOG_KEY</code> - Your PostHog API key (phc_...)</li>
                <li><code>VITE_SENTRY_DSN</code> - Your Sentry DSN (https://...)</li>
              </ul>
            </li>
            <li>
              <strong>Rebuild the app</strong> - VITE_ vars require rebuild:
              <pre className="bg-gray-800 text-white p-2 rounded mt-2">npm run build</pre>
            </li>
            <li>
              <strong>Restart the server</strong> - After rebuilding:
              <pre className="bg-gray-800 text-white p-2 rounded mt-2">npm run dev</pre>
            </li>
            <li>
              <strong>Hard refresh this page</strong> - Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
            </li>
            <li>
              <strong>Check this page again</strong> - Environment variables should now show
            </li>
            <li>
              <strong>Test the integrations</strong> - Use the buttons above to send test events
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
