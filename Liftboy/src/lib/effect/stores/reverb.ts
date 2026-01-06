import { writable, derived, get } from "svelte/store";
import type { ReverbSnapshot } from "../types";

// Re-export type for convenience
export type { ReverbSnapshot };

const MIN_ROOM_SIZE = 0;
const MAX_ROOM_SIZE = 1;
const ROOM_STEP = 0.05;

const MIN_DECAY = 0;
const MAX_DECAY = 10;
const DECAY_STEP = 0.1;

const MIN_MIX = 0;
const MAX_MIX = 1;
const MIX_STEP = 0.05;

const MIN_PREDELAY = 0;
const MAX_PREDELAY = 0.1;
const PREDELAY_STEP = 0.001;

const DEFAULT_REVERB_SETTINGS = {
  roomSize: 0.5,
  decay: 1.5,
  mix: 0.3,
  preDelay: 0.01,
};

export const reverbRoomSize = writable(DEFAULT_REVERB_SETTINGS.roomSize);
export const reverbDecay = writable(DEFAULT_REVERB_SETTINGS.decay);
export const reverbMix = writable(DEFAULT_REVERB_SETTINGS.mix);
export const reverbPreDelay = writable(DEFAULT_REVERB_SETTINGS.preDelay);

export const reverbRoomLabel = derived(
  reverbRoomSize,
  ($size) => `${Math.round($size * 100)}%`
);

export const reverbDecayLabel = derived(
  reverbDecay,
  ($decay) => `${$decay.toFixed(1)} s`
);

export const reverbMixLabel = derived(
  reverbMix,
  ($mix) => `${Math.round($mix * 100)}%`
);

export const reverbPreDelayLabel = derived(
  reverbPreDelay,
  ($preDelay) => `${Math.round($preDelay * 1000)} ms`
);

export function adjustReverbRoomSize(delta: number) {
  reverbRoomSize.update((value) => {
    const next = Math.min(Math.max(value + delta * ROOM_STEP, MIN_ROOM_SIZE), MAX_ROOM_SIZE);
    return Number(next.toFixed(2));
  });
}

export function adjustReverbDecay(delta: number) {
  reverbDecay.update((value) => {
    const next = Math.min(Math.max(value + delta * DECAY_STEP, MIN_DECAY), MAX_DECAY);
    return Number(next.toFixed(1));
  });
}

export function adjustReverbMix(delta: number) {
  reverbMix.update((value) => {
    const next = Math.min(Math.max(value + delta * MIX_STEP, MIN_MIX), MAX_MIX);
    return Number(next.toFixed(2));
  });
}

export function adjustReverbPreDelay(delta: number) {
  reverbPreDelay.update((value) => {
    const next = Math.min(Math.max(value + delta * PREDELAY_STEP, MIN_PREDELAY), MAX_PREDELAY);
    return Number(next.toFixed(3));
  });
}

export function getReverbSnapshot(): ReverbSnapshot {
  return {
    roomSize: get(reverbRoomSize),
    decay: get(reverbDecay),
    mix: get(reverbMix),
    preDelay: get(reverbPreDelay),
  };
}

export function loadReverbSnapshot(snapshot?: ReverbSnapshot) {
  const source = snapshot ?? createReverbSnapshot();
  reverbRoomSize.set(Math.min(Math.max(source.roomSize, MIN_ROOM_SIZE), MAX_ROOM_SIZE));
  reverbDecay.set(Math.min(Math.max(source.decay, MIN_DECAY), MAX_DECAY));
  reverbMix.set(Math.min(Math.max(source.mix, MIN_MIX), MAX_MIX));
  reverbPreDelay.set(Math.min(Math.max(source.preDelay, MIN_PREDELAY), MAX_PREDELAY));
}

export function createReverbSnapshot(): ReverbSnapshot {
  return { ...DEFAULT_REVERB_SETTINGS };
}

export function resetReverb() {
  loadReverbSnapshot(createReverbSnapshot());
}
