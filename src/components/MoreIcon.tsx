/**
 * Three dots in a row: the tab bar's "Plus" tab, the rules and the theme's
 * card on a phone. Drawn in one colour, the text's own, like the other icons.
 */
export function MoreIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
