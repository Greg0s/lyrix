/**
 * Where the Worker answers. In production Pages and the Worker are on
 * different origins, so the build gets the Worker's absolute URL (see the
 * deploy job in .github/workflows/ci.yml and docs/LEARNINGS.md, 2026-09-12);
 * in dev it is unset, and vite.config.ts proxies same-origin /api calls.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function apiUrl(path: string): URL {
  return new URL(path, API_BASE || window.location.origin);
}
