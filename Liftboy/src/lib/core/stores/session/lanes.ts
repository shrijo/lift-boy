import { derived, get, writable } from "svelte/store";
import type { LaneMode } from "../../types/project";
import {
  currentLanes,
  mutateLane,
  adjustLaneCount as adjustLaneCountInternal,
} from "../data/projects";
export type { LaneMode } from "../../types/project";

const VOLUME_STEP = 0.05;
const PAN_STEP = 0.1;
const LANE_MODES: LaneMode[] = ["on", "mute", "solo"];

export const lanes = currentLanes;
export const selectedLaneIndex = writable(0);
export const laneSelectorActive = writable(false);
export const laneSelectorSlide = writable(0);

export const laneCount = derived(lanes, ($lanes) => $lanes.length);
export const currentLane = derived(
  [lanes, selectedLaneIndex],
  ([$lanes, $index]) => $lanes[$index]
);

lanes.subscribe((list) => {
  selectedLaneIndex.update((index) => {
    if (!list.length) return 0;
    return Math.min(index, list.length - 1);
  });
});

export function activateLaneSelector() {
  laneSelectorSlide.set(0);
  laneSelectorActive.set(true);
}

export function deactivateLaneSelector() {
  laneSelectorActive.set(false);
}

export function setLaneSelectorSlide(index: number) {
  laneSelectorSlide.set(index);
}

export function incrementSelectedLane(delta: number) {
  const count = get(lanes).length;
  if (!count) return;
  selectedLaneIndex.update((index) => {
    const next = (index + delta + count) % count;
    return next < 0 ? next + count : next;
  });
}

export function cycleLaneMode(delta: number) {
  const index = get(selectedLaneIndex);
  mutateLane(index, (lane) => {
    const modeIndex = LANE_MODES.indexOf(lane.mixer.mode);
    const nextMode =
      LANE_MODES[(modeIndex + delta + LANE_MODES.length) % LANE_MODES.length];
    return {
      ...lane,
      mixer: { ...lane.mixer, mode: nextMode },
    };
  });
}

export function adjustLaneVolume(delta: number) {
  const index = get(selectedLaneIndex);
  mutateLane(index, (lane) => {
    const nextVolume = clamp(lane.mixer.volume + delta * VOLUME_STEP, 0, 1);
    return {
      ...lane,
      mixer: { ...lane.mixer, volume: Number(nextVolume.toFixed(2)) },
    };
  });
}

export function adjustLanePan(delta: number) {
  const index = get(selectedLaneIndex);
  mutateLane(index, (lane) => {
    const nextPan = clamp(lane.mixer.pan + delta * PAN_STEP, -1, 1);
    return {
      ...lane,
      mixer: { ...lane.mixer, pan: Number(nextPan.toFixed(2)) },
    };
  });
}

export function adjustLaneCount(delta: number) {
  const currentCount = get(lanes).length;
  adjustLaneCountInternal(delta);
  // Auto-select newly added lane
  if (delta > 0) {
    const newCount = get(lanes).length;
    if (newCount > currentCount) {
      selectedLaneIndex.set(newCount - 1);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
