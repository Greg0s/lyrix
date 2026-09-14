import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Where the dev server forwards /api/*: by default the Worker `npm run dev:all`
// starts on wrangler's default port. playwright.config.ts points it at the
// Worker the e2e run starts itself, so e2e never reaches one left running by
// another checkout.
const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": apiProxyTarget,
    },
  },
});
