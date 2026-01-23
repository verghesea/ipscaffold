import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { initSentry } from "./lib/sentry";
import { getStoredToken } from "./lib/api";

// Initialize monitoring services
initSentry();
initAnalytics();

// UUID MONITORING: Check current token on app load
try {
  const token = getStoredToken();
  if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub || 'unknown';

    console.log('[App Init] Current session user ID:', userId);

    if (userId.includes('4a0e')) {
      console.error('🚨 [App Init] WRONG UUID DETECTED ON PAGE LOAD:', userId);
      console.error('Expected: 0515a5f4-1401-4e0e-901a-c5484d3c0f4c (with 4e0e)');
      console.error('Got:      ' + userId + ' (with 4a0e)');
      console.error('This will cause empty dashboard. Recommend clearing localStorage and re-login.');
    } else if (userId.includes('4e0e')) {
      console.log('[App Init] ✓ Correct UUID verified on load (4e0e)');
    }
  }
} catch (e) {
  // Token parsing failed or no token, ignore
}

createRoot(document.getElementById("root")!).render(<App />);
