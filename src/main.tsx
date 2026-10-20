import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { startErrorReports } from "./errorReport";
import { registerServiceWorker } from "./pwa";
import { prefetchTodayRound } from "./roundPrefetch";
import { startVisit } from "./stats";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/game.css";

// Before React renders anything: errors are reported from the first line run
// (errorReport.ts), the round is asked for (roundPrefetch.ts), and the visit
// is read off the address before GameScreen rewrites an invite link's (stats.ts).
startErrorReports();
prefetchTodayRound();
startVisit();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (import.meta.env.PROD) registerServiceWorker();
