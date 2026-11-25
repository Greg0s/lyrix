import { useEffect, useId, useRef } from "react";

/** The key of the `history.state` an open layer (a dialog, a sheet, the guided tour) pushes. */
const LAYER_KEY = "lyrixLayer";

/** Whether a history entry is one an open layer pushed, rather than a screen's. */
export function isLayerEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && LAYER_KEY in state;
}

function isOwnEntry(state: unknown, id: string): boolean {
  return isLayerEntry(state) && (state as Record<string, unknown>)[LAYER_KEY] === id;
}

/**
 * Makes Back close a layer over the screen (a dialog, a sheet, the guided
 * tour), as in an installed app: Android's Back button, or the system's back
 * gesture, used to go to the previous screen behind the sheet, which stayed
 * open over it, or to leave the app altogether when there was none.
 *
 * While the layer is mounted, it has a history entry of its own on top of its
 * screen's, at the same address: Back pops it, and `onBack` closes the layer.
 * Closed any other way (its ✕, Escape, a choice), the layer takes its entry
 * back off, so Back then goes where it would have gone without it. A screen
 * change while the layer is open replaces its entry (useRoute's `navigate`),
 * so nothing is left to take off. The removal waits a microtask, which tells
 * an unmount from StrictMode's unmount and remount in development.
 */
export function useBackCloses(onBack: () => void): void {
  const id = useId();
  const callback = useRef(onBack);
  useEffect(() => {
    callback.current = onBack;
  }, [onBack]);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (!isOwnEntry(window.history.state, id)) window.history.pushState({ [LAYER_KEY]: id }, "");
    const onPopState = () => {
      if (!isOwnEntry(window.history.state, id)) callback.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      mounted.current = false;
      window.removeEventListener("popstate", onPopState);
      queueMicrotask(() => {
        if (!mounted.current && isOwnEntry(window.history.state, id)) window.history.back();
      });
    };
  }, [id]);
}
