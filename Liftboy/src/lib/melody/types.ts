/**
 * Melody Module Types
 *
 * Type definitions for melody sequencing (bar-based pitch sequences).
 */

/**
 * Melody playback order mode
 */
export type MelodyOrder = "forward" | "backwards" | "random";

/**
 * Skip divisor for melody advancement
 * - none: Advance every trigger
 * - second: Advance every 2nd trigger
 * - third: Advance every 3rd trigger
 * - fourth: Advance every 4th trigger
 */
export type SkipOption = "none" | "second" | "third" | "fourth";

/**
 * Individual bar state in melody sequence
 */
export interface BarState {
  /** Bar index (0-31) */
  id: number;
  /** Pitch value (0-7 scale degrees) */
  value: number;
  /** Enable portamento/glide */
  glide: boolean;
  /** Enable random pitch variation */
  randomize: boolean;
}

/**
 * Melody sequencer settings
 */
export interface MelodySettings {
  /** Sequence length (1-32 bars) */
  length: number;
  /** Skip divisor index (0-3) */
  skipIndex: number;
  /** Playback order index (0-2) */
  orderIndex: number;
}

/**
 * Serializable melody state snapshot
 */
export interface MelodySnapshot {
  bars: BarState[];
  settings: MelodySettings;
}
