import type { CSSProperties } from "react";
import { proximityHeat, proximityNearHeat } from "../game/similarity";

/**
 * The inline style that shades a scored word along game.css's cold-to-hot
 * ramp: its heat, as the --heat custom property.
 */
export function heatStyle(score: number): CSSProperties {
  return { "--heat": String(proximityHeat(score)) } as CSSProperties;
}

/**
 * The inline style of a hidden word holding a close guess: where its bar sits
 * on the chips' cold-to-hot ramp, as the --heat custom property.
 */
export function nearStyle(score: number): CSSProperties {
  return { "--heat": String(proximityNearHeat(score)) } as CSSProperties;
}
