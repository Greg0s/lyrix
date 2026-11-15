/**
 * A question mark in a ring: the rules' mark on the header button. Drawn in one
 * colour, the text's own, like the header's other icons: a filled disc with a
 * glyph cut out of it came out as a plain white disc in Samsung Internet, whose
 * dark mode recolours the glyph and leaves the disc light (docs/LEARNINGS.md).
 */
export function HelpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.6-2.8 2.6M12 17h.01" />
    </svg>
  );
}
