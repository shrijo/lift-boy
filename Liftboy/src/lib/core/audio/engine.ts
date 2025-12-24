/**
 * Audio Engine
 *
 * Core audio engine for Lift-Boy sequencer. Manages Tone.js audio graph,
 * timing loops, and lane-based polyphonic playback.
 *
 * Architecture:
 * - Each lane has an independent LaneRuntime with its own Tone.Loop
 * - All lanes share Tone.Transport for synchronized timing
 * - Audio nodes per lane: FMSynth → Gain → Panner → Destination
 * - Subscribes to Svelte stores for reactive state updates
 *
 * Key Concepts:
 * - LaneRuntime: Internal representation of lane audio state
 * - Step Pointer: Current position in rhythm pattern
 * - Melody Pointer: Current position in bar sequence
 * - Sanitization: Validates all loaded state to prevent crashes
 *
 * See: docs/AUDIO_ENGINE.md for detailed documentation
 */

import * as Tone from "tone";
import { get, writable } from "svelte/store";
import {
  clockOptions,
  orderOptions,
  createSequencerSnapshot,
  resetSequencer,
  type SequencerSnapshot,
  type StepState,
} from "../../rhythm/stores/sequencer";
import {
  skipOptions,
  melodyOrderOptions,
  createMelodySnapshot,
  resetMelody,
  type MelodySnapshot,
  type BarState,
  type SkipOption,
} from "../../melody/stores/melody";
import {
  createSynthSnapshot,
  resetSynth,
  type SynthState,
} from "../../instrument/stores/synth";
import { bpm } from "../stores/session/transport";
import {
  setPlayingBar,
  setPlayingStep,
  resetPlayingIndicators,
} from "../stores/session/playback";
import { lanes, selectedLaneIndex } from "../stores/session/lanes";
import type { Lane, LaneMixer, LaneMode } from "../types/project";

/** Major scale offsets in semitones from root */
const SCALE_OFFSETS = [0, 2, 3, 5, 7, 9, 10, 12];
/** Base MIDI note (C3) */
const BASE_MIDI = 48;
/** Skip divisor mapping for melody advancement */
const SKIP_DIVISORS: Record<SkipOption, number> = {
  none: 1,
  second: 2,
  third: 3,
  fourth: 4,
};
/** Default clock subdivision if none specified */
const DEFAULT_SUBDIVISION = "16n";

/** Global playback state (for UI) */
export const isPlaying = writable(false);

/** Audio initialization error state (for UI notifications) */
export const audioError = writable<string | null>(null);

/**
 * LaneRuntime
 *
 * Internal representation of a lane's audio state and Tone.js nodes.
 * Each lane gets its own runtime with independent timing and synthesis.
 *
 * This type is not exposed to UI or persistence - it's audio engine only.
 */
interface LaneRuntime {
  id: string;
  steps: StepState[];
  sequencer: SequencerSnapshot["settings"];
  subdivision: string;
  bars: BarState[];
  melody: MelodySnapshot["settings"];
  synthState: SynthState;
  mixer: LaneMixer;
  mode: LaneMode;
  synth: Tone.FMSynth | null;
  gain: Tone.Gain | null;
  pan: Tone.Panner | null;
  loop: Tone.Loop | null;
  stepPointer: number;
  melodyPointer: number;
  triggerCounter: number;
}

let initialized = false;
let currentBpm = get(bpm);
let editorLaneIndex = get(selectedLaneIndex);
let soloActive = false;
const laneRuntimes = new Map<string, LaneRuntime>();
let orderedLaneIds: string[] = [];
const unsubscribers: Array<() => void> = [];

function scheduleUIUpdate(fn: () => void, time: number) {
  if (Tone.Draw && typeof Tone.Draw.schedule === "function") {
    Tone.Draw.schedule(fn, time);
    return;
  }
  fn();
}

function subscribeToStores() {
  unsubscribers.push(
    lanes.subscribe((list) => {
      syncLaneRuntimes(list);
    }),
    selectedLaneIndex.subscribe((value) => {
      editorLaneIndex = typeof value === "number" ? value : 0;
    }),
    bpm.subscribe((value) => {
      currentBpm = value;
      Tone.Transport.bpm.value = value;
    })
  );
}

/**
 * Initialize audio engine
 *
 * Sets up Web Audio context, starts Tone.Transport, and subscribes to stores.
 * Must be called before any playback (usually on first user interaction).
 *
 * Flow:
 * 1. Start Tone.js audio context (requires user gesture)
 * 2. Set master BPM on Tone.Transport
 * 3. Subscribe to lanes, selectedLaneIndex, and bpm stores
 * 4. lanes subscription fires immediately, creating lane runtimes
 * 5. Prepare all audio nodes and loops
 *
 * @returns Promise that resolves when audio context is ready
 * @throws Error if Web Audio API is not supported or user denies permissions
 */
async function ensureInitialized() {
  if (initialized) return;

  try {
    await Tone.start();
    Tone.Transport.bpm.value = currentBpm;
    subscribeToStores();
    // lanes subscribe fires immediately, populating runtime data
    initialized = true;
    prepareAllLaneRuntimes();
    audioError.set(null);
  } catch (error) {
    const message = "Audio initialization failed. Check browser permissions.";
    audioError.set(message);
    throw new Error(message);
  }
}
function prepareAllLaneRuntimes() {
  laneRuntimes.forEach((runtime) => {
    ensureLaneNodes(runtime);
    applyLaneMixer(runtime);
    applyLaneSynthState(runtime);
    rebuildLaneLoop(runtime);
  });
}

/**
 * Synchronize lane runtimes with lanes store
 *
 * Keeps the internal LaneRuntime map in sync with the lanes store.
 * Called automatically when lanes store updates.
 *
 * Operations:
 * - Remove runtimes for deleted lanes
 * - Create runtimes for new lanes
 * - Update existing runtimes with new state
 * - Rebuild loops if clock subdivision changed
 *
 * @param list - Current lanes from store
 */
function syncLaneRuntimes(list: Lane[]) {
  const activeIds = new Set(list.map((lane) => lane.id));
  for (const [id, runtime] of laneRuntimes) {
    if (!activeIds.has(id)) {
      disposeLaneRuntime(runtime);
      laneRuntimes.delete(id);
    }
  }

  orderedLaneIds = list.map((lane) => lane.id);

  list.forEach((lane) => {
    const runtime = laneRuntimes.get(lane.id) ?? createLaneRuntime(lane.id);
    const prevSubdivision = runtime.subdivision;
    hydrateLaneRuntime(runtime, lane);
    laneRuntimes.set(lane.id, runtime);
    if (initialized) {
      ensureLaneNodes(runtime);
      applyLaneMixer(runtime);
      applyLaneSynthState(runtime);
      if (!runtime.loop || prevSubdivision !== runtime.subdivision) {
        rebuildLaneLoop(runtime);
      }
    }
  });

  updateSoloState();
}

function createLaneRuntime(id: string): LaneRuntime {
  const sequencer = createSequencerSnapshot();
  const melody = createMelodySnapshot();
  return {
    id,
    steps: cloneSteps(sequencer.steps),
    sequencer: sequencer.settings,
    subdivision:
      clockOptions[sequencer.settings.clockIndex]?.division ??
      DEFAULT_SUBDIVISION,
    bars: cloneBars(melody.bars),
    melody: melody.settings,
    synthState: createSynthSnapshot(),
    mixer: { volume: 0.8, pan: 0, mode: "on" },
    mode: "on",
    synth: null,
    gain: null,
    pan: null,
    loop: null,
    stepPointer: 0,
    melodyPointer: 0,
    triggerCounter: 0,
  };
}

function hydrateLaneRuntime(runtime: LaneRuntime, lane: Lane) {
  const seqSnapshot = toSequencerSnapshot(lane.modules.rhythm?.state);
  const melodySnapshot = toMelodySnapshot(lane.modules.melody?.state);
  runtime.steps = cloneSteps(seqSnapshot.steps);
  runtime.sequencer = sanitizeSequencerSettings(seqSnapshot.settings);
  runtime.subdivision =
    clockOptions[runtime.sequencer.clockIndex]?.division ?? DEFAULT_SUBDIVISION;
  runtime.stepPointer = normalizeIndex(
    runtime.stepPointer,
    runtime.sequencer.length
  );
  runtime.bars = cloneBars(melodySnapshot.bars);
  runtime.melody = sanitizeMelodySettings(melodySnapshot.settings);
  runtime.melodyPointer = normalizeIndex(
    runtime.melodyPointer,
    runtime.melody.length
  );
  runtime.triggerCounter = 0;
  runtime.synthState = normalizeSynthState(lane.modules.instrument?.state);
  runtime.mixer = { ...lane.mixer };
  runtime.mode = lane.mixer.mode;
}

function ensureLaneNodes(runtime: LaneRuntime) {
  if (runtime.synth) return;
  runtime.synth = new Tone.FMSynth();
  runtime.gain = new Tone.Gain(runtime.mixer.volume);
  runtime.pan = new Tone.Panner(runtime.mixer.pan);
  runtime.synth.connect(runtime.gain);
  runtime.gain.connect(runtime.pan);
  runtime.pan.toDestination();
}

function applyLaneMixer(runtime: LaneRuntime) {
  if (!runtime.gain || !runtime.pan) return;
  runtime.gain.gain.value = runtime.mixer.volume;
  runtime.pan.pan.value = runtime.mixer.pan;
}

function applyLaneSynthState(runtime: LaneRuntime) {
  if (!runtime.synth) return;
  runtime.synth.set({
    oscillator: { type: runtime.synthState.wave },
    harmonicity: runtime.synthState.harmonicity,
    modulation: { type: runtime.synthState.modulation },
    envelope: {
      attack: runtime.synthState.attack,
      decay: runtime.synthState.decay,
      sustain: runtime.synthState.sustain,
      release: runtime.synthState.release,
    },
    portamento: runtime.synthState.portamento,
  });
}

function rebuildLaneLoop(runtime: LaneRuntime) {
  if (!initialized) return;
  runtime.loop?.stop();
  runtime.loop?.dispose();
  runtime.loop = new Tone.Loop(
    (time) => tickLane(runtime, time),
    runtime.subdivision
  );
  runtime.loop.start(0);
}

/**
 * Execute one tick of a lane's sequencer
 *
 * Called by Tone.Loop at each clock subdivision.
 * Advances step pointer, checks active/probability, triggers melody.
 *
 * Flow:
 * 1. Check if lane should play (mute/solo logic)
 * 2. Get next step index based on playback order
 * 3. Update UI playback indicator if this is the edited lane
 * 4. Skip if step is inactive
 * 5. Skip if probability roll fails
 * 6. Trigger melody notes for this step
 *
 * @param runtime - Lane's audio state and nodes
 * @param time - Web Audio context time (seconds) for sample-accurate scheduling
 */
function tickLane(runtime: LaneRuntime, time: number) {
  if (!shouldPlayLane(runtime)) return;
  const length = Math.min(runtime.sequencer.length, runtime.steps.length);
  if (!length) return;
  const stepIndex = nextLaneStepIndex(runtime, length);
  const step = runtime.steps[stepIndex];
  if (!step) return;
  if (isEditorLane(runtime)) {
    scheduleUIUpdate(() => setPlayingStep(stepIndex), time);
  }
  if (!step.active) return;
  if (Math.random() * 100 > step.probability) return;
  triggerLaneMelody(runtime, step, time);
}

/**
 * Trigger melody notes for a step
 *
 * Converts bar value to MIDI note and triggers synth.
 * Handles skip divisor, glide, randomization, and UI updates.
 *
 * Flow:
 * 1. Check skip divisor (e.g., advance melody every 2 triggers)
 * 2. Get next bar index based on melody playback order
 * 3. Convert bar value (0-7) to MIDI note using major scale
 * 4. Apply randomization if enabled (±2 semitones)
 * 5. Calculate note duration from step duration and glide
 * 6. Trigger synth with sample-accurate timing
 *
 * @param runtime - Lane's audio state and nodes
 * @param step - Current step (provides duration)
 * @param time - Web Audio context time for scheduling
 */
function triggerLaneMelody(
  runtime: LaneRuntime,
  step: StepState,
  time: number
) {
  const melodyLength = Math.min(runtime.melody.length, runtime.bars.length);
  if (!melodyLength) return;
  const activeBars = runtime.bars.slice(0, melodyLength);
  if (!activeBars.length) return;
  if (shouldSkipLaneTrigger(runtime)) {
    if (isEditorLane(runtime)) {
      scheduleUIUpdate(() => setPlayingBar(-1), time);
    }
    return;
  }
  const melodyIndex = nextLaneMelodyIndex(runtime, activeBars.length);
  const bar = activeBars[melodyIndex];
  if (!bar) return;
  if (isEditorLane(runtime)) {
    scheduleUIUpdate(() => setPlayingBar(bar.id), time);
  }
  const note = valueToNote(bar);
  const durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  runtime.synth?.triggerAttackRelease(note, durationSeconds, time);
}

function shouldPlayLane(runtime: LaneRuntime) {
  if (runtime.mode === "mute") return false;
  if (soloActive && runtime.mode !== "solo") return false;
  return true;
}

function shouldSkipLaneTrigger(runtime: LaneRuntime) {
  const option = skipOptions[runtime.melody.skipIndex] ?? "none";
  const divisor = SKIP_DIVISORS[option] ?? 1;
  const playIndex = runtime.triggerCounter;
  runtime.triggerCounter += 1;
  if (divisor <= 1) return false;
  return playIndex % divisor !== 0;
}

function nextLaneStepIndex(runtime: LaneRuntime, length: number) {
  const order = orderOptions[runtime.sequencer.orderIndex] ?? "forward";
  if (order === "random") {
    return Math.floor(Math.random() * length);
  }
  const index = normalizeIndex(runtime.stepPointer, length);
  if (order === "forward") {
    runtime.stepPointer = (index + 1) % length;
  } else {
    runtime.stepPointer = (index - 1 + length) % length;
  }
  return index;
}

function nextLaneMelodyIndex(runtime: LaneRuntime, length: number) {
  if (!length) return 0;
  const order = melodyOrderOptions[runtime.melody.orderIndex] ?? "forward";
  if (order === "random") {
    return Math.floor(Math.random() * length);
  }
  const index = normalizeIndex(runtime.melodyPointer, length);
  if (order === "forward") {
    runtime.melodyPointer = (index + 1) % length;
  } else {
    runtime.melodyPointer = (index - 1 + length) % length;
  }
  return index;
}

function getLaneStepDurationSeconds(
  runtime: LaneRuntime,
  step: StepState,
  bar: BarState
) {
  const baseSeconds = Tone.Time(runtime.subdivision).toSeconds();
  const glideFactor = bar.glide ? 1.5 : 1;
  return Math.max(baseSeconds * step.duration * glideFactor, 0.02);
}

function valueToNote(bar: BarState) {
  const clamped = Math.max(0, Math.min(bar.value, SCALE_OFFSETS.length - 1));
  const randomness = bar.randomize ? Math.floor(Math.random() * 5) - 2 : 0;
  const midi = BASE_MIDI + SCALE_OFFSETS[clamped] + randomness;
  return Tone.Frequency(midi, "midi").toNote();
}

export async function togglePlay() {
  try {
    await ensureInitialized();
    if (Tone.Transport.state === "started") {
      Tone.Transport.pause();
      isPlaying.set(false);
      return;
    }
    Tone.Transport.start();
    isPlaying.set(true);
  } catch (error) {
    // Error already set in audioError store by ensureInitialized()
    isPlaying.set(false);
    return;
  }
}

export function stopTransport() {
  if (!initialized) return;
  Tone.Transport.stop();
  Tone.Transport.position = 0;
  isPlaying.set(false);
  resetCounters();
  resetPlayingIndicators();
}

export function resetAll() {
  stopTransport();
  resetCounters();
  resetSequencer();
  resetMelody();
  resetSynth();
}

export function disposeAudio() {
  laneRuntimes.forEach((runtime) => {
    disposeLaneRuntime(runtime);
  });
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers.length = 0;
  initialized = false;
  resetCounters();
  isPlaying.set(false);
  resetPlayingIndicators();
}

function resetCounters() {
  laneRuntimes.forEach((runtime) => {
    runtime.stepPointer = 0;
    runtime.melodyPointer = 0;
    runtime.triggerCounter = 0;
  });
}

function normalizeIndex(pointer: number, length: number) {
  if (!length) return 0;
  const normalized = pointer % length;
  return normalized < 0 ? normalized + length : normalized;
}

function isEditorLane(runtime: LaneRuntime) {
  const laneIndex = orderedLaneIds.indexOf(runtime.id);
  return laneIndex === editorLaneIndex;
}

function disposeLaneRuntime(runtime: LaneRuntime) {
  runtime.loop?.stop();
  runtime.loop?.dispose();
  runtime.loop = null;
  runtime.synth?.dispose();
  runtime.synth = null;
  runtime.gain?.dispose();
  runtime.gain = null;
  runtime.pan?.dispose();
  runtime.pan = null;
}

function updateSoloState() {
  soloActive = Array.from(laneRuntimes.values()).some(
    (runtime) => runtime.mode === "solo"
  );
}

function toSequencerSnapshot(value: unknown): SequencerSnapshot {
  if (isSequencerSnapshot(value)) {
    return value;
  }
  return createSequencerSnapshot();
}

function toMelodySnapshot(value: unknown): MelodySnapshot {
  if (isMelodySnapshot(value)) {
    return value;
  }
  return createMelodySnapshot();
}

function normalizeSynthState(value: unknown): SynthState {
  const base = createSynthSnapshot();
  if (!isSynthState(value)) {
    return base;
  }
  return { ...base, ...value } as SynthState;
}

function sanitizeSequencerSettings(
  settings?: SequencerSnapshot["settings"]
): SequencerSnapshot["settings"] {
  const fallback = createSequencerSnapshot().settings;
  const source = settings ?? fallback;
  return {
    length: clampNumber(source.length, 1, fallback.length),
    clockIndex: clampIndex(source.clockIndex, clockOptions.length),
    orderIndex: clampIndex(source.orderIndex, orderOptions.length),
  };
}

function sanitizeMelodySettings(
  settings?: MelodySnapshot["settings"]
): MelodySnapshot["settings"] {
  const fallback = createMelodySnapshot().settings;
  const source = settings ?? fallback;
  return {
    length: clampNumber(source.length, 1, fallback.length),
    skipIndex: clampIndex(source.skipIndex, skipOptions.length),
    orderIndex: clampIndex(source.orderIndex, melodyOrderOptions.length),
  };
}

function clampIndex(index: number | undefined, length: number) {
  if (!length) return 0;
  if (typeof index !== "number" || Number.isNaN(index)) return 0;
  const normalized = index % length;
  return normalized < 0 ? normalized + length : normalized;
}

function clampNumber(value: number | undefined, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function cloneSteps(list: StepState[]) {
  return list.map((step) => ({ ...step }));
}

function cloneBars(list: BarState[]) {
  return list.map((bar) => ({ ...bar }));
}

function isSequencerSnapshot(value: unknown): value is SequencerSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { steps?: unknown }).steps) &&
    typeof (value as { settings?: unknown }).settings === "object"
  );
}

function isMelodySnapshot(value: unknown): value is MelodySnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { bars?: unknown }).bars) &&
    typeof (value as { settings?: unknown }).settings === "object"
  );
}

function isSynthState(value: unknown): value is Partial<SynthState> {
  return (
    typeof value === "object" &&
    value !== null &&
    "wave" in (value as Record<string, unknown>)
  );
}
