import type { CSSProperties } from "react";
import { proximityHeat } from "../game/similarity";

/**
 * The inline style that shades a scored word along game.css's cold-to-hot
 * ramp: its heat, as the --heat custom property.
 */
export function heatStyle(score: number): CSSProperties {
  return { "--heat": String(proximityHeat(score)) } as CSSProperties;
}
