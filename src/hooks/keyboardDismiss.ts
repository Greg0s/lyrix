/**
 * How much shorter than its tallest the page must get for a phone's keyboard
 * to be up. A keyboard takes 250px or more; the address bar coming and going
 * takes about 56px, and must not count.
 */
export const KEYBOARD_MIN_HEIGHT = 150;

/** A field a phone's keyboard opens for: text inputs and text areas. */
function isTextField(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return ["text", "search", "email", "url", "tel", "password", "number"].includes(element.type);
}

/**
 * Blurs the focused text field once a phone's keyboard goes down while it
 * still has focus. Android's Back button, or the keyboard's own "hide" key,
 * closes the keyboard and leaves the input focused: the tab bar, hidden while
 * a field has focus (game.css, `:focus`), never came back.
 *
 * Under `interactive-widget=resizes-content` (index.html) the keyboard resizes
 * the page itself, so it shows as `innerHeight`: the page's tallest height at
 * its current width is the keyboard-free one, a keyboard is up while the page
 * is `KEYBOARD_MIN_HEIGHT` shorter than that, and down once it grows back.
 * Only the layout viewport is read, never `visualViewport`, whose numbers
 * Android browsers got wrong (docs/LEARNINGS.md, 2026-10-19). A browser that
 * doesn't resize the page for its keyboard (Safari on iOS, which blurs the
 * field itself when its keyboard closes) never looks up, so nothing is blurred.
 */
export function watchKeyboardDismiss(win: Window = window): () => void {
  let width = win.innerWidth;
  let tallest = win.innerHeight;
  let keyboardUp = false;

  const onResize = () => {
    const height = win.innerHeight;
    // Turned or resized: the keyboard-free height is measured anew.
    if (win.innerWidth !== width) {
      width = win.innerWidth;
      tallest = height;
      keyboardUp = false;
      return;
    }
    if (height > tallest) tallest = height;
    const up = tallest - height >= KEYBOARD_MIN_HEIGHT;
    if (keyboardUp && !up) {
      const focused = win.document.activeElement;
      if (isTextField(focused)) focused.blur();
    }
    keyboardUp = up;
  };

  win.addEventListener("resize", onResize);
  return () => win.removeEventListener("resize", onResize);
}
