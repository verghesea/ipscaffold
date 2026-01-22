import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { initSentry } from "./lib/sentry";

// Initialize monitoring services
initSentry();
initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
