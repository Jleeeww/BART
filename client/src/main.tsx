import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// GlitchTip/Sentry error tracking — no-op unless VITE_SENTRY_DSN is set.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.01,
  });
}

createRoot(document.getElementById("root")!).render(<App />);
