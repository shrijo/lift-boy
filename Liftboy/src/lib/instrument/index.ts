/**
 * Instrument Module
 *
 * FM synthesizer for sound generation.
 *
 * Exports:
 * - Types: WaveType, ModulationType, SynthState
 * - Constants: waveOptions, modulationOptions, RELEASE_MAX
 * - Stores: synthSettings
 * - Functions: cycleWave, adjustHarmonicity, etc.
 * - Components: SimpleSynth
 */

// Re-export all types
export { waveOptions, modulationOptions, type WaveType, type ModulationType, type SynthState } from "./types";

// Re-export all stores and functions
export {
  synthSettings,
  cycleWave,
  adjustHarmonicity,
  cycleModulation,
  adjustPortamento,
  adjustAttack,
  adjustDecay,
  adjustSustain,
  adjustRelease,
  getSynthState,
  RELEASE_MAX,
  resetSynth,
  loadSynthState,
  createSynthSnapshot,
} from "./stores/synth";

// Components are imported directly from ./components/SimpleSynth.svelte
