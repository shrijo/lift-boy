import { writable, get } from "svelte/store";
import type { CongaState } from "../types";

// Re-export type for convenience
export type { CongaState };

const INITIAL_STATE: CongaState = {
  pitch: 150,
  pitchDecay: 0.08,
  tone: 0.6,
  decay: 0.2,
};

const PITCH_RANGE = { min: 80, max: 300, step: 5 } as const;
const PITCH_DECAY_RANGE = { min: 0, max: 0.5, step: 0.01 } as const;
const TONE_RANGE = { min: 0, max: 1, step: 0.05 } as const;
const DECAY_RANGE = { min: 0, max: 1, step: 0.01 } as const;

export const congaSettings = writable<CongaState>(INITIAL_STATE);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function adjustValue(
  key: keyof CongaState,
  range: { min: number; max: number; step: number },
  delta: number
) {
  congaSettings.update((state) => ({
    ...state,
    [key]: Number(
      clamp(state[key] + range.step * delta, range.min, range.max).toFixed(2)
    ),
  }));
}

export function adjustPitch(delta: number) {
  adjustValue("pitch", PITCH_RANGE, delta);
}

export function adjustPitchDecay(delta: number) {
  adjustValue("pitchDecay", PITCH_DECAY_RANGE, delta);
}

export function adjustTone(delta: number) {
  adjustValue("tone", TONE_RANGE, delta);
}

export function adjustDecay(delta: number) {
  adjustValue("decay", DECAY_RANGE, delta);
}

export function getCongaSnapshot(): CongaState {
  return { ...get(congaSettings) };
}

export function loadCongaSnapshot(state?: Partial<CongaState>) {
  const base = createCongaSnapshot();
  const next = state ? { ...base, ...state } : base;
  congaSettings.set(next as CongaState);
}

export function createCongaSnapshot(): CongaState {
  return { ...INITIAL_STATE };
}

export function resetConga() {
  loadCongaSnapshot();
}
