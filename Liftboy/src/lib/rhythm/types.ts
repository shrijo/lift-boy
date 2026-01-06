/**
 * Rhythm Module Types
 *
 * Type definitions for rhythm sequencing (XOX step sequencer).
 */

/**
 * Step playback order mode
 */
export type StepOrder = "forward" | "backwards" | "random";

/**
 * Individual step state in the sequencer
 */
export interface StepState {
  /** Step index (0-63) */
  id: number;
  /** Whether step triggers */
  active: boolean;
  /** Step duration in steps (0.25-4) */
  duration: number;
  /** Trigger probability percentage (0-100) */
  probability: number;
}

/**
 * Sequencer settings
 */
export interface SequencerSettings {
  /** Pattern length (1-64 steps) */
  length: number;
  /** Clock division index (0-3) */
  clockIndex: number;
  /** Playback order index (0-2) */
  orderIndex: number;
}

/**
 * Serializable sequencer state snapshot
 */
export interface SequencerSnapshot {
  steps: StepState[];
  settings: SequencerSettings;
}

/**
 * Euclidean rhythm sequencer snapshot
 */
export interface EuclideanSnapshot {
  steps: number;
  pulses: number;
  rotation: number;
  settings: {
    clockIndex: number;
    orderIndex: number;
  };
}

/**
 * M185 sequence entry play mode
 * - repeat: Trigger note and repeat for 'steps' times
 * - hold: Trigger note with duration of 'steps' beats
 * - skip: Skip 'steps' without triggering
 */
export type M185Mode = "repeat" | "hold" | "skip";

/**
 * Individual M185 sequence entry
 */
export interface M185Entry {
  id: number;
  steps: number;
  mode: M185Mode;
}

/**
 * M185 sequencer snapshot
 */
export interface M185Snapshot {
  entries: M185Entry[];
  selectedEntry: number;
  settings: {
    length: number;
    clockIndex: number;
    orderIndex: number;
  };
}
