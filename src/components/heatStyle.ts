import type { CSSProperties } from "react";
import { proximityHeat, proximityOpacity } from "../game/similarity";

/**
 * The inline style that shades a scored word along game.css's cold-to-hot
 * ramp: its heat, as the --heat custom property.
 */
export function heatStyle(score: number): CSSProperties {
  return { "--heat": String(proximityHeat(score)) } as CSSProperties;
}

/**
 * The inline style of a hidden word holding a close guess: how clearly the
 * guess is written over its bar, as the --near-opacity custom property.
 */
export function nearStyle(score: number): CSSProperties {
  return { "--near-opacity": String(proximityOpacity(score)) } as CSSProperties;
}
