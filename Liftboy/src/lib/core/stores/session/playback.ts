import { writable } from "svelte/store";

const NO_INDEX = -1;

export const playingStep = writable<number>(NO_INDEX);
export const playingBar = writable<number>(NO_INDEX);

export function setPlayingStep(index: number) {
  playingStep.set(index);
}

export function setPlayingBar(index: number) {
  playingBar.set(index);
}

export function resetPlayingIndicators() {
  playingStep.set(NO_INDEX);
  playingBar.set(NO_INDEX);
}
