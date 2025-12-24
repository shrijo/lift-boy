import { writable, get } from "svelte/store";
import { waveOptions, modulationOptions, type WaveType, type ModulationType, type SynthState } from "../types";

// Re-export types for convenience
export { waveOptions, modulationOptions };
export type { WaveType, ModulationType, SynthState };

type NumericKey =
  | "harmonicity"
  | "attack"
  | "decay"
  | "sustain"
  | "release"
  | "portamento";

const INITIAL_STATE: SynthState = {
  wave: "amtriangle",
  harmonicity: 0.5,
  modulation: "sine",
  attack: 0.05,
  decay: 0.2,
  sustain: 0.2,
  release: 1.5,
  portamento: 0.05,
};

const HARMONICITY_RANGE = { min: 0, max: 2, step: 0.1 } as const;
const PORTAMENTO_RANGE = { min: 0, max: 1, step: 0.01 } as const;
const ATTACK_RANGE = { min: 0, max: 1, step: 0.01 } as const;
const DECAY_RANGE = { min: 0, max: 1, step: 0.01 } as const;
const SUSTAIN_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const RELEASE_RANGE = { min: 0, max: 3, step: 0.1 } as const;

export const synthSettings = writable<SynthState>(INITIAL_STATE);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function cycleOption<T>(list: readonly T[], current: T, delta: number) {
  const index = list.indexOf(current);
  const next = index === -1 ? 0 : (index + delta + list.length) % list.length;
  return list[next];
}

function adjustValue(
  key: NumericKey,
  range: { min: number; max: number; step: number },
  delta: number
) {
  synthSettings.update((state) => ({
    ...state,
    [key]: Number(
      clamp(
        (state[key] as number) + range.step * delta,
        range.min,
        range.max
      ).toFixed(2)
    ),
  }));
}

export function cycleWave(delta: number) {
  synthSettings.update((state) => ({
    ...state,
    wave: cycleOption(waveOptions, state.wave, delta),
  }));
}

export function adjustHarmonicity(delta: number) {
  adjustValue("harmonicity", HARMONICITY_RANGE, delta);
}

export function cycleModulation(delta: number) {
  synthSettings.update((state) => ({
    ...state,
    modulation: cycleOption(modulationOptions, state.modulation, delta),
  }));
}

export function adjustPortamento(delta: number) {
  adjustValue("portamento", PORTAMENTO_RANGE, delta);
}

export function adjustAttack(delta: number) {
  adjustValue("attack", ATTACK_RANGE, delta);
}

export function adjustDecay(delta: number) {
  adjustValue("decay", DECAY_RANGE, delta);
}

export function adjustSustain(delta: number) {
  adjustValue("sustain", SUSTAIN_RANGE, delta);
}

export function adjustRelease(delta: number) {
  adjustValue("release", RELEASE_RANGE, delta);
}

export function getSynthState() {
  return { ...get(synthSettings) };
}

export const RELEASE_MAX = RELEASE_RANGE.max;
export function resetSynth() {
  loadSynthState();
}

export function loadSynthState(state?: Partial<SynthState>) {
  const base = createSynthSnapshot();
  const next = state ? { ...base, ...state } : base;
  synthSettings.set(next as SynthState);
}

export function createSynthSnapshot(): SynthState {
  return { ...INITIAL_STATE };
}
