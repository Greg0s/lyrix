import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiPreconnectPlugin } from "./scripts/lib/apiPreconnect";
import { invitePagePlugin } from "./scripts/lib/invitePage";
import { serviceWorkerPlugin } from "./scripts/lib/serviceWorker";

// Where the dev server forwards /api/*: by default the Worker `npm run dev:all`
// starts on wrangler's default port. playwright.config.ts points it at the
// Worker the e2e run starts itself, so e2e never reaches one left running by
// another checkout.
const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:8787";

export default defineConfig({
  // apiPreconnectPlugin: index.html opens the connection to the API early, when it is on another origin.
  // invitePagePlugin: the page invite links (/salon/<code>) answer with, and its link preview.
  // serviceWorkerPlugin: /sw.js, which keeps the app shell for an installed Lyrix (#79).
  plugins: [react(), apiPreconnectPlugin(), invitePagePlugin(), serviceWorkerPlugin()],
  server: {
    proxy: {
      // ws: rooms keep their members live over a WebSocket on /api/rooms/:code/ws.
      "/api": { target: apiProxyTarget, ws: true },
    },
  },
});
