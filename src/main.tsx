import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { prefetchTodayRound } from "./roundPrefetch";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/game.css";

// Before React renders anything: see roundPrefetch.ts.
prefetchTodayRound();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
