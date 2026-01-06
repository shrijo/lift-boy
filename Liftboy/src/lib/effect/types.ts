/**
 * Effect Module Types
 *
 * Type definitions for audio effects.
 */

/**
 * Effect state (placeholder)
 */
export interface EffectState {
  // Future: effect parameters
}

/**
 * Delay effect snapshot
 */
export interface DelaySnapshot {
  time: number;
  feedback: number;
  mix: number;
}

/**
 * Reverb effect snapshot
 */
export interface ReverbSnapshot {
  roomSize: number;
  decay: number;
  mix: number;
  preDelay: number;
}
