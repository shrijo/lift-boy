import { writable, derived, get } from "svelte/store";
import type { StepOrder, StepState, SequencerSettings, SequencerSnapshot } from "../types";

// Re-export types for convenience
export type { StepOrder, StepState, SequencerSettings, SequencerSnapshot };

const TOTAL_STEPS = 64;
const DEFAULT_PATTERN_LENGTH = 16;
const DURATION_MIN = 0.25;
const DURATION_MAX = 4;
const DURATION_STEP = 0.25;
const PROBABILITY_STEP = 5;

export const clockOptions = [
  { label: "1 per beat", division: "4n" },
  { label: "2 per beat", division: "8n" },
  { label: "4 per beat", division: "16n" },
  { label: "8 per beat", division: "32n" },
];
export const orderOptions: StepOrder[] = ["forward", "backwards", "random"];

const createInitialSteps = () =>
  Array.from(
    { length: TOTAL_STEPS },
    (_, id): StepState => ({
      id,
      active: false,
      duration: 1,
      probability: 100,
    })
  );

export const steps = writable<StepState[]>(createInitialSteps());
export const selectedStep = writable(0);
const DEFAULT_SEQUENCER_SETTINGS: SequencerSettings = {
  length: DEFAULT_PATTERN_LENGTH,
  clockIndex: 2,
  orderIndex: 0,
};

export const sequencerSettings = writable<SequencerSettings>({ ...DEFAULT_SEQUENCER_SETTINGS });

export const activeStep = derived(
  [steps, selectedStep],
  ([$steps, $selected]) => $steps[$selected]
);

export const patternLength = derived(
  sequencerSettings,
  ($settings) => $settings.length
);

export const clockLabel = derived(
  sequencerSettings,
  ($settings) => clockOptions[$settings.clockIndex]?.label ?? "4 per beat"
);

export const orderLabel = derived(
  sequencerSettings,
  ($settings) => orderOptions[$settings.orderIndex]
);

function clampSelected(index: number) {
  const length = get(sequencerSettings).length;
  return Math.max(0, Math.min(index, Math.max(length - 1, 0)));
}

export function selectStep(index: number) {
  selectedStep.set(clampSelected(index));
}

export function incrementSelectedStep(delta: number) {
  const next = clampSelected(get(selectedStep) + delta);
  selectedStep.set(next);
}

export function toggleStepActive(index = get(selectedStep)) {
  steps.update((list) =>
    list.map((step, idx) =>
      idx === index ? { ...step, active: !step.active } : step
    )
  );
}

export function setStepActive(active: boolean, index = get(selectedStep)) {
  steps.update((list) =>
    list.map((step, idx) => (idx === index ? { ...step, active } : step))
  );
}

export function adjustStepDuration(delta: number, index = get(selectedStep)) {
  steps.update((list) =>
    list.map((step, idx) => {
      if (idx !== index) return step;
      const next = Math.min(
        Math.max(step.duration + delta * DURATION_STEP, DURATION_MIN),
        DURATION_MAX
      );
      return { ...step, duration: Number(next.toFixed(2)) };
    })
  );
}

export function adjustStepProbability(
  delta: number,
  index = get(selectedStep)
) {
  steps.update((list) =>
    list.map((step, idx) => {
      if (idx !== index) return step;
      const next = Math.min(
        Math.max(step.probability + delta * PROBABILITY_STEP, 0),
        100
      );
      return { ...step, probability: Math.round(next) };
    })
  );
}

export function adjustPatternLength(delta: number) {
  sequencerSettings.update((settings) => {
    const nextLength = Math.min(
      Math.max(settings.length + delta, 1),
      TOTAL_STEPS
    );
    const nextSettings = { ...settings, length: nextLength };
    selectedStep.update((value) =>
      value >= nextLength ? Math.max(nextLength - 1, 0) : value
    );
    return nextSettings;
  });
}

export function cycleClock(delta: number) {
  sequencerSettings.update((settings) => {
    const count = clockOptions.length;
    const nextIndex = (settings.clockIndex + delta + count) % count;
    return { ...settings, clockIndex: nextIndex };
  });
}

export function cycleOrder(delta: number) {
  sequencerSettings.update((settings) => {
    const count = orderOptions.length;
    const nextIndex = (settings.orderIndex + delta + count) % count;
    return { ...settings, orderIndex: nextIndex };
  });
}

export function resetSequencer() {
  loadSequencerSnapshot(createSequencerSnapshot());
}

export function getSequencerSnapshot(): SequencerSnapshot {
  return {
    steps: cloneSteps(get(steps)),
    settings: { ...get(sequencerSettings) },
  };
}

export function loadSequencerSnapshot(snapshot?: SequencerSnapshot) {
  const source = snapshot ?? createSequencerSnapshot();
  steps.set(cloneSteps(source.steps));
  const targetSettings: SequencerSettings = {
    length: Math.min(Math.max(source.settings.length, 1), TOTAL_STEPS),
    clockIndex: clampIndex(source.settings.clockIndex, clockOptions.length),
    orderIndex: clampIndex(source.settings.orderIndex, orderOptions.length),
  };
  sequencerSettings.set(targetSettings);
  selectedStep.set(0);
}

export function createSequencerSnapshot(): SequencerSnapshot {
  return {
    steps: createInitialSteps(),
    settings: { ...DEFAULT_SEQUENCER_SETTINGS },
  };
}

function cloneSteps(list: StepState[]) {
  return list.map((step) => ({ ...step }));
}

function clampIndex(index: number, length: number) {
  if (!length) return 0;
  const normalized = index % length;
  return normalized < 0 ? normalized + length : normalized;
}
