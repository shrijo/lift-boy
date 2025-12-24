/**
 * Rhythm Module
 *
 * XOX-style step sequencer for trigger pattern generation.
 *
 * Exports:
 * - Types: StepState, StepOrder, SequencerSettings, SequencerSnapshot
 * - Stores: steps, selectedStep, sequencerSettings, activeStep, etc.
 * - Functions: toggleStepActive, adjustStepDuration, etc.
 * - Components: XoxSequencer
 */

// Re-export all types
export type { StepOrder, StepState, SequencerSettings, SequencerSnapshot } from "./types";

// Re-export all stores and functions
export {
  steps,
  selectedStep,
  sequencerSettings,
  activeStep,
  patternLength,
  clockLabel,
  orderLabel,
  clockOptions,
  orderOptions,
  selectStep,
  incrementSelectedStep,
  toggleStepActive,
  setStepActive,
  adjustStepDuration,
  adjustStepProbability,
  adjustPatternLength,
  cycleClock,
  cycleOrder,
  resetSequencer,
  getSequencerSnapshot,
  loadSequencerSnapshot,
  createSequencerSnapshot,
} from "./stores/sequencer";

// Components are imported directly from ./components/XoxSequencer.svelte
