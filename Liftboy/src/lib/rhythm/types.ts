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
