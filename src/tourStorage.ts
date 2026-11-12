/**
 * Whether the guided tour (ProductTour) has been shown on this device. It is
 * offered once, ever: the moment it shows, it is marked seen, whether the
 * player goes through it, skips it, or leaves the page halfway.
 */
export const TOUR_STORAGE_KEY = "lyrix:tour-seen";

/**
 * Seen when stored. A storage that can't be read counts as seen: nothing
 * could remember the tour was shown, so it would come back on every visit.
 */
export function isTourSeen(storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    return !storage || storage.getItem(TOUR_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(TOUR_STORAGE_KEY, "1");
  } catch {
    // Persistence is a nice-to-have (private browsing, quota): never fatal.
  }
}
