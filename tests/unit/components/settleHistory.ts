/**
 * Waits out a Back (or any `history.go`) still on its way. jsdom carries one
 * out two tasks later: a `setTimeout(0)` to find the entry, then a second one
 * nested in it to move there and fire `popstate` (SessionHistory's
 * traverseByDelta). Waiting a single task let a dialog's Back, queued at the
 * end of one test, land in the next and swap its screen for the one before
 * (docs/LEARNINGS.md, 2026-11-27).
 */
export async function settleHistory(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
