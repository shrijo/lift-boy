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

/**
 * Kick Drum state (uses Tone.MembraneSynth)
 */
export interface KickState {
  /** Base frequency in Hz (20-100) */
  pitch: number;
  /** Pitch envelope decay in seconds (0-1) */
  pitchDecay: number;
  /** Body tone - affects octaves (0-1) */
  tone: number;
  /** Amplitude decay in seconds (0-2) */
  decay: number;
}

/**
 * Hi-hat state (uses Tone.MetalSynth)
 */
export interface HihatState {
  /** Frequency/brightness (0-1) */
  tone: number;
  /** Note length in seconds (0-1) */
  decay: number;
  /** Harmonicity/resonance (0-1) */
  resonance: number;
}

/**
 * Snare Drum state (uses Tone.NoiseSynth)
 */
export interface SnareState {
  /** Noise type blend - white to brown (0-1) */
  tone: number;
  /** Attack sharpness (0-1) */
  snap: number;
  /** Note length in seconds (0-1) */
  decay: number;
}

/**
 * Conga Drum state (uses Tone.MembraneSynth)
 */
export interface CongaState {
  /** Base frequency in Hz (80-300) */
  pitch: number;
  /** Pitch envelope decay in seconds (0-0.5) */
  pitchDecay: number;
  /** Resonance (0-1) */
  tone: number;
  /** Amplitude decay in seconds (0-1) */
  decay: number;
}

/**
 * Clap state (uses Tone.NoiseSynth)
 */
export interface ClapState {
  /** Noise brightness (0-1) */
  tone: number;
  /** Note length in seconds (0-1) */
  decay: number;
  /** Stereo width (0-1) */
  spread: number;
}
