/**
 * Instrument Module Types
 *
 * Type definitions for instrument synthesis (FM synth).
 */

/**
 * Available waveform types for FM synthesis
 */
export const waveOptions = [
  "sine",
  "square",
  "triangle",
  "sawtooth",
  "amtriangle",
] as const;

/**
 * Available modulation waveforms
 */
export const modulationOptions = [
  "sine",
  "triangle",
  "square",
  "sawtooth",
] as const;

/**
 * Carrier waveform type
 */
export type WaveType = (typeof waveOptions)[number];

/**
 * Modulator waveform type
 */
export type ModulationType = (typeof modulationOptions)[number];

/**
 * FM Synthesizer state
 */
export interface SynthState {
  /** Carrier waveform */
  wave: WaveType;
  /** Harmonicity ratio (0-2) */
  harmonicity: number;
  /** Modulator waveform */
  modulation: ModulationType;
  /** Attack time in seconds (0-1) */
  attack: number;
  /** Decay time in seconds (0-1) */
  decay: number;
  /** Sustain level (0-1) */
  sustain: number;
  /** Release time in seconds (0-3) */
  release: number;
  /** Portamento/glide time in seconds (0-1) */
  portamento: number;
}
