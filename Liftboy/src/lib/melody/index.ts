/**
 * Melody Module
 *
 * Bar-based pitch sequencer for melodic patterns.
 *
 * Exports:
 * - Types: BarState, MelodyOrder, SkipOption, MelodySettings, MelodySnapshot
 * - Stores: bars, selectedBar, melodySettings, activeBar, etc.
 * - Functions: adjustBarValue, setBarGlide, etc.
 * - Components: MelodySequencer
 */

// Re-export all types
export type { MelodyOrder, SkipOption, BarState, MelodySettings, MelodySnapshot } from "./types";

// Re-export all stores and functions
export {
  bars,
  selectedBar,
  melodySettings,
  activeBar,
  sequenceLength,
  skipLabel,
  orderLabel,
  skipOptions,
  melodyOrderOptions,
  selectBar,
  incrementSelectedBar,
  adjustBarValue,
  setBarGlide,
  setBarRandomize,
  randomizeBar,
  adjustMelodyLength,
  cycleSkip,
  cycleMelodyOrder,
  resetMelody,
  getMelodySnapshot,
  loadMelodySnapshot,
  createMelodySnapshot,
} from "./stores/melody";

// Components are imported directly from ./components/MelodySequencer.svelte
