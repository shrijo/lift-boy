import { writable } from "svelte/store";

const MIN_BPM = 40;
const MAX_BPM = 240;
const STEP_BPM = 1;
export const DEFAULT_BPM = 120;

function clamp(value: number) {
  return Math.min(Math.max(value, MIN_BPM), MAX_BPM);
}

export const bpm = writable<number>(DEFAULT_BPM);

export function setBpm(value: number) {
  bpm.set(clamp(Math.round(value)));
}

export function adjustBpm(delta: number) {
  bpm.update((value) => clamp(value + delta * STEP_BPM));
}

export function resetBpm() {
  bpm.set(DEFAULT_BPM);
}
