import { writable, get } from "svelte/store";

export const waveOptions = [
  "sine",
  "square",
  "triangle",
  "sawtooth",
  "amtriangle",
] as const;
export const modulationOptions = [
  "sine",
  "triangle",
  "square",
  "sawtooth",
] as const;

export type WaveType = (typeof waveOptions)[number];
export type ModulationType = (typeof modulationOptions)[number];

export interface SynthState {
  wave: WaveType;
  harmonicity: number;
  modulation: ModulationType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  portamento: number;
}

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
  return get(synthSettings);
}

export const RELEASE_MAX = RELEASE_RANGE.max;
