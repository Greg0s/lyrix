import type { CSSProperties } from "react";
import type { RoomMember } from "../game/room";

/**
 * Hues a room's players are coloured with, in arrival order (the v3 mockup's
 * `oklch(74% 0.13 <hue>)`), chosen well away from the orange accent, which
 * is the local player's own colour. Past the eighth player they come round
 * again: a colour tells players apart at a glance, the name says who it is.
 */
export const PLAYER_HUES = [255, 150, 325, 195, 95, 290, 170, 355] as const;

/** A member's colour: the accent for the local player, else a fixed hue by arrival order, so it never changes. */
export function playerColor(member: RoomMember, you: string | null): string {
  if (member.id === you) return "var(--accent-solid)";
  return `oklch(74% 0.13 ${PLAYER_HUES[(member.number - 1) % PLAYER_HUES.length]})`;
}

/** The inline style an avatar is painted with: its colour, as the --player custom property. */
export function playerStyle(member: RoomMember, you: string | null): CSSProperties {
  return { "--player": playerColor(member, you) } as CSSProperties;
}
