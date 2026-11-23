import { apiUrl } from "../api/base";

/** Where a won song's cover is asked for (worker/src/covers.ts). */
export function coverUrl(cover: string): string {
  return apiUrl(`/api/cover/${encodeURIComponent(cover)}`).href;
}
