import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// Only a browser that says so is offline: one that says nothing isn't.
const isOnline = () => navigator.onLine !== false;

/**
 * Whether the device has a network at all (#79). Only "offline" is sure: a
 * device online may still reach nothing, which a request that fails says.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
