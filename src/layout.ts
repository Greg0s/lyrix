/**
 * The phone's layout (game.css): the tab bar, the header's progress, the
 * dock's shortcuts, the side column out of the page. Below 880px, and on
 * every touch screen whatever its width (asked for by the developer): a phone
 * turned sideways, 900px wide but barely 400px tall, and a tablet keep the
 * app's layout rather than the computer's.
 */
export const PHONE_LAYOUT_MEDIA = "(max-width: 879px), (hover: none) and (pointer: coarse)";

/**
 * Its complement, the computer's layout: from 880px, with a mouse or a
 * trackpad (or no pointer at all). game.css spells both out in every media
 * query that switches layout (tests/unit/ci/layoutMedia.test.ts).
 */
export const COMPUTER_LAYOUT_MEDIA =
  "(min-width: 880px) and (hover: hover), (min-width: 880px) and (pointer: fine), (min-width: 880px) and (pointer: none)";
