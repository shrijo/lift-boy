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
  createEuclideanSnapshot,
  type EuclideanSnapshot,
} from "../../rhythm/stores/euclidean";
import {
  createM185Snapshot,
  type M185Snapshot,
  type M185Entry,
} from "../../rhythm/stores/m185";
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
  createStochasticSnapshot,
  type StochasticSnapshot,
} from "../../melody/stores/stochastic";
import {
  createSynthSnapshot,
  resetSynth,
  type SynthState,
} from "../../instrument/stores/synth";
import {
  createKickSnapshot,
  type KickState,
} from "../../instrument/stores/kick";
import {
  createHihatSnapshot,
  type HihatState,
} from "../../instrument/stores/hihat";
import {
  createSnareSnapshot,
  type SnareState,
} from "../../instrument/stores/snare";
import {
  createCongaSnapshot,
  type CongaState,
} from "../../instrument/stores/conga";
import {
  createClapSnapshot,
  type ClapState,
} from "../../instrument/stores/clap";
import {
  createDelaySnapshot,
  type DelaySnapshot,
} from "../../effect/stores/delay";
import {
  createReverbSnapshot,
  type ReverbSnapshot,
} from "../../effect/stores/reverb";
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
 *
 * Module Type Support:
 * - Rhythm: XOX sequencer, Euclidean, M185
 * - Melody: Basic melody, Stochastic
 * - Effects: Delay, Reverb
 */
interface LaneRuntime {
  id: string;

  // Module type tracking
  rhythmModuleId: string;
  melodyModuleId: string;
  instrumentModuleId: string;
  effectModuleIds: string[];

  // XOX Sequencer state
  steps: StepState[];
  sequencer: SequencerSnapshot["settings"];
  subdivision: string;

  // Euclidean sequencer state
  euclideanSteps: number;
  euclideanPulses: number;
  euclideanRotation: number;
  euclideanSettings: EuclideanSnapshot["settings"];

  // M185 sequencer state
  m185Entries: M185Entry[];
  m185SelectedEntry: number;
  m185Settings: M185Snapshot["settings"];
  m185EntryPointer: number;
  m185StepCounter: number;

  // Basic melody state
  bars: BarState[];
  melody: MelodySnapshot["settings"];

  // Stochastic melody state
  stochasticMinNote: number;
  stochasticMaxNote: number;
  stochasticChangeProb: number;
  stochasticCurrentNote: number;
  stochasticSettings: StochasticSnapshot["settings"];

  // Instrument states
  synthState: SynthState;
  kickState: KickState;
  hihatState: HihatState;
  snareState: SnareState;
  congaState: CongaState;
  clapState: ClapState;

  // Effect states
  delayState: DelaySnapshot;
  reverbState: ReverbSnapshot;

  // Mixer and playback
  mixer: LaneMixer;
  mode: LaneMode;

  // Audio nodes
  synth: Tone.FMSynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth | null;
  delayNode: Tone.FeedbackDelay | null;
  reverbNode: Tone.Reverb | null;
  gain: Tone.Gain | null;
  pan: Tone.Panner | null;
  loop: Tone.Loop | null;

  // Playback pointers
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
    lanes.subscribe(async (list) => {
      await syncLaneRuntimes(list);
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
    await prepareAllLaneRuntimes();
    audioError.set(null);
  } catch (error) {
    const message = "Audio initialization failed. Check browser permissions.";
    audioError.set(message);
    throw new Error(message);
  }
}
async function prepareAllLaneRuntimes() {
  for (const runtime of laneRuntimes.values()) {
    await ensureLaneNodes(runtime);
    applyLaneMixer(runtime);
    applyLaneSynthState(runtime);
    rebuildLaneLoop(runtime);
  }
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
async function syncLaneRuntimes(list: Lane[]) {
  const activeIds = new Set(list.map((lane) => lane.id));
  for (const [id, runtime] of laneRuntimes) {
    if (!activeIds.has(id)) {
      disposeLaneRuntime(runtime);
      laneRuntimes.delete(id);
    }
  }

  orderedLaneIds = list.map((lane) => lane.id);

  for (const lane of list) {
    const runtime = laneRuntimes.get(lane.id) ?? createLaneRuntime(lane.id);
    const prevSubdivision = runtime.subdivision;

    // Track previous reverb decay settings to detect changes
    const prevReverbDecay = runtime.reverbState.decay;
    const prevReverbRoomSize = runtime.reverbState.roomSize;

    hydrateLaneRuntime(runtime, lane);
    laneRuntimes.set(lane.id, runtime);
    if (initialized) {
      await ensureLaneNodes(runtime);

      // Rebuild reverb if decay or roomSize changed
      if (
        runtime.reverbNode &&
        (runtime.reverbState.decay !== prevReverbDecay ||
          runtime.reverbState.roomSize !== prevReverbRoomSize)
      ) {
        await rebuildReverbNode(runtime);
      }

      applyLaneMixer(runtime);
      applyLaneSynthState(runtime);
      if (!runtime.loop || prevSubdivision !== runtime.subdivision) {
        rebuildLaneLoop(runtime);
      }
    }
  }

  updateSoloState();
}

function createLaneRuntime(id: string): LaneRuntime {
  const sequencer = createSequencerSnapshot();
  const melody = createMelodySnapshot();
  const euclidean = createEuclideanSnapshot();
  const m185 = createM185Snapshot();
  const stochastic = createStochasticSnapshot();
  const delay = createDelaySnapshot();
  const reverb = createReverbSnapshot();

  return {
    id,

    // Module type tracking (defaults to XOX, basic melody, simple synth, no effects)
    rhythmModuleId: "rhythm.xox",
    melodyModuleId: "melody.basic",
    instrumentModuleId: "instrument.synth-simple",
    effectModuleIds: [],

    // XOX Sequencer
    steps: cloneSteps(sequencer.steps),
    sequencer: sequencer.settings,
    subdivision:
      clockOptions[sequencer.settings.clockIndex]?.division ??
      DEFAULT_SUBDIVISION,

    // Euclidean sequencer
    euclideanSteps: euclidean.steps,
    euclideanPulses: euclidean.pulses,
    euclideanRotation: euclidean.rotation,
    euclideanSettings: euclidean.settings,

    // M185 sequencer
    m185Entries: cloneM185Entries(m185.entries),
    m185SelectedEntry: m185.selectedEntry,
    m185Settings: m185.settings,
    m185EntryPointer: 0,
    m185StepCounter: 0,

    // Basic melody
    bars: cloneBars(melody.bars),
    melody: melody.settings,

    // Stochastic melody
    stochasticMinNote: stochastic.minNote,
    stochasticMaxNote: stochastic.maxNote,
    stochasticChangeProb: stochastic.changeProb,
    stochasticCurrentNote: stochastic.currentNote,
    stochasticSettings: stochastic.settings,

    // Instruments
    synthState: createSynthSnapshot(),
    kickState: createKickSnapshot(),
    hihatState: createHihatSnapshot(),
    snareState: createSnareSnapshot(),
    congaState: createCongaSnapshot(),
    clapState: createClapSnapshot(),

    // Effects
    delayState: delay,
    reverbState: reverb,

    // Mixer
    mixer: { volume: 0.8, pan: 0, mode: "on" },
    mode: "on",

    // Audio nodes
    synth: null,
    delayNode: null,
    reverbNode: null,
    gain: null,
    pan: null,
    loop: null,

    // Playback pointers
    stepPointer: 0,
    melodyPointer: 0,
    triggerCounter: 0,
  };
}

function hydrateLaneRuntime(runtime: LaneRuntime, lane: Lane) {
  // Detect active module types
  runtime.rhythmModuleId = lane.modules.rhythm?.definitionId ?? "rhythm.xox";
  runtime.melodyModuleId = lane.modules.melody?.definitionId ?? "melody.basic";
  runtime.instrumentModuleId = lane.modules.instrument?.definitionId ?? "instrument.synth-simple";
  runtime.effectModuleIds = [];
  if (lane.modules.effect) {
    runtime.effectModuleIds.push(lane.modules.effect.definitionId);
  }

  // Load rhythm module state based on type
  if (runtime.rhythmModuleId === "rhythm.euclidean") {
    const euclidean = toEuclideanSnapshot(lane.modules.rhythm?.state);
    runtime.euclideanSteps = euclidean.steps;
    runtime.euclideanPulses = euclidean.pulses;
    runtime.euclideanRotation = euclidean.rotation;
    runtime.euclideanSettings = euclidean.settings;
    runtime.subdivision =
      clockOptions[euclidean.settings.clockIndex]?.division ?? DEFAULT_SUBDIVISION;
    runtime.stepPointer = 0;  // Reset step pointer for Euclidean
  } else if (runtime.rhythmModuleId === "rhythm.m185") {
    const m185 = toM185Snapshot(lane.modules.rhythm?.state);
    runtime.m185Entries = cloneM185Entries(m185.entries);
    runtime.m185SelectedEntry = m185.selectedEntry;
    runtime.m185Settings = m185.settings;
    runtime.m185EntryPointer = 0;
    runtime.m185StepCounter = 0;
    runtime.subdivision =
      clockOptions[m185.settings.clockIndex]?.division ?? DEFAULT_SUBDIVISION;
  } else {
    // Default to XOX sequencer
    const seqSnapshot = toSequencerSnapshot(lane.modules.rhythm?.state);
    runtime.steps = cloneSteps(seqSnapshot.steps);
    runtime.sequencer = sanitizeSequencerSettings(seqSnapshot.settings);
    runtime.subdivision =
      clockOptions[runtime.sequencer.clockIndex]?.division ?? DEFAULT_SUBDIVISION;
    runtime.stepPointer = normalizeIndex(
      runtime.stepPointer,
      runtime.sequencer.length
    );
  }

  // Load melody module state based on type
  if (runtime.melodyModuleId === "melody.stochastic") {
    const stochastic = toStochasticSnapshot(lane.modules.melody?.state);
    runtime.stochasticMinNote = stochastic.minNote;
    runtime.stochasticMaxNote = stochastic.maxNote;
    runtime.stochasticChangeProb = stochastic.changeProb;
    runtime.stochasticCurrentNote = stochastic.currentNote;
    runtime.stochasticSettings = stochastic.settings;
  } else {
    // Default to basic melody
    const melodySnapshot = toMelodySnapshot(lane.modules.melody?.state);
    runtime.bars = cloneBars(melodySnapshot.bars);
    runtime.melody = sanitizeMelodySettings(melodySnapshot.settings);
    runtime.melodyPointer = normalizeIndex(
      runtime.melodyPointer,
      runtime.melody.length
    );
  }

  // Load instrument module state based on type
  if (runtime.instrumentModuleId === "instrument.kick") {
    runtime.kickState = toKickSnapshot(lane.modules.instrument?.state);
  } else if (runtime.instrumentModuleId === "instrument.hihat") {
    runtime.hihatState = toHihatSnapshot(lane.modules.instrument?.state);
  } else if (runtime.instrumentModuleId === "instrument.snare") {
    runtime.snareState = toSnareSnapshot(lane.modules.instrument?.state);
  } else if (runtime.instrumentModuleId === "instrument.conga") {
    runtime.congaState = toCongaSnapshot(lane.modules.instrument?.state);
  } else if (runtime.instrumentModuleId === "instrument.clap") {
    runtime.clapState = toClapSnapshot(lane.modules.instrument?.state);
  } else {
    // Default to simple synth
    runtime.synthState = normalizeSynthState(lane.modules.instrument?.state);
  }

  // Load effect states
  if (runtime.effectModuleIds.includes("effect.delay")) {
    runtime.delayState = toDelaySnapshot(lane.modules.effect?.state);
  }
  if (runtime.effectModuleIds.includes("effect.reverb")) {
    runtime.reverbState = toReverbSnapshot(lane.modules.effect?.state);
  }

  // Reset trigger counter
  runtime.triggerCounter = 0;

  // Load mixer
  runtime.mixer = { ...lane.mixer };
  runtime.mode = lane.mixer.mode;
}

/**
 * Ensure audio nodes exist for a lane
 *
 * Creates and connects Tone.js audio nodes for the lane.
 * Audio chain: Synth → Delay (optional) → Reverb (optional) → Gain → Pan → Destination
 *
 * @param runtime - Lane's audio state
 */
async function ensureLaneNodes(runtime: LaneRuntime) {
  if (runtime.synth) return;

  // Create synth based on instrument type
  if (runtime.instrumentModuleId === "instrument.kick") {
    runtime.synth = new Tone.MembraneSynth({
      pitchDecay: runtime.kickState.pitchDecay,
      octaves: runtime.kickState.tone * 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: runtime.kickState.decay, sustain: 0, release: 0.01 },
    });
  } else if (runtime.instrumentModuleId === "instrument.hihat") {
    runtime.synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: runtime.hihatState.decay, release: 0.01 },
      harmonicity: runtime.hihatState.resonance * 12,
      modulationIndex: runtime.hihatState.tone * 50,
      resonance: 1000 + runtime.hihatState.tone * 4000,
    });
  } else if (runtime.instrumentModuleId === "instrument.snare") {
    runtime.synth = new Tone.NoiseSynth({
      noise: { type: runtime.snareState.tone < 0.5 ? "white" : "brown" },
      envelope: {
        attack: 0.001 + (1 - runtime.snareState.snap) * 0.01,
        decay: runtime.snareState.decay,
        sustain: 0,
        release: 0.01,
      },
    });
  } else if (runtime.instrumentModuleId === "instrument.conga") {
    runtime.synth = new Tone.MembraneSynth({
      pitchDecay: runtime.congaState.pitchDecay,
      octaves: runtime.congaState.tone * 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: runtime.congaState.decay, sustain: 0, release: 0.01 },
    });
  } else if (runtime.instrumentModuleId === "instrument.clap") {
    runtime.synth = new Tone.NoiseSynth({
      noise: { type: runtime.clapState.tone < 0.5 ? "white" : "pink" },
      envelope: {
        attack: 0.001,
        decay: runtime.clapState.decay,
        sustain: 0,
        release: 0.01,
      },
    });
  } else {
    // Default: FM Synth
    runtime.synth = new Tone.FMSynth();
  }

  runtime.gain = new Tone.Gain(runtime.mixer.volume);
  runtime.pan = new Tone.Panner(runtime.mixer.pan);

  // Create effect nodes if enabled
  if (runtime.effectModuleIds.includes("effect.delay")) {
    runtime.delayNode = new Tone.FeedbackDelay({
      delayTime: runtime.delayState.time,
      feedback: runtime.delayState.feedback,
      wet: runtime.delayState.mix,
    });
  }

  if (runtime.effectModuleIds.includes("effect.reverb")) {
    // Combine roomSize and decay for final decay time
    // roomSize scales the decay (bigger room = longer decay)
    const finalDecay = runtime.reverbState.roomSize * runtime.reverbState.decay;
    runtime.reverbNode = new Tone.Reverb({
      decay: finalDecay,
      preDelay: runtime.reverbState.preDelay,
      wet: runtime.reverbState.mix,
    });
    // Reverb needs async generation - await it
    await runtime.reverbNode.generate();
  }

  // Connect audio chain: Synth → Effects → Gain → Pan → Destination
  let chainStart: Tone.ToneAudioNode = runtime.synth;

  // Connect delay if present
  if (runtime.delayNode) {
    chainStart.connect(runtime.delayNode);
    chainStart = runtime.delayNode;
  }

  // Connect reverb if present
  if (runtime.reverbNode) {
    chainStart.connect(runtime.reverbNode);
    chainStart = runtime.reverbNode;
  }

  // Connect to mixer
  chainStart.connect(runtime.gain);
  runtime.gain.connect(runtime.pan);
  runtime.pan.toDestination();
}

/**
 * Rebuild reverb node when decay or roomSize changes
 *
 * Tone.Reverb requires regenerating the impulse response when decay changes.
 * This function disposes the old node and creates a new one.
 *
 * @param runtime - Lane's audio state
 */
async function rebuildReverbNode(runtime: LaneRuntime) {
  if (!runtime.synth || !runtime.gain) return;

  // Find what's connected before reverb in the chain
  let chainStart: Tone.ToneAudioNode = runtime.synth;
  if (runtime.delayNode) {
    chainStart = runtime.delayNode;
  }

  // Disconnect and dispose old reverb
  if (runtime.reverbNode) {
    chainStart.disconnect(runtime.reverbNode);
    runtime.reverbNode.disconnect();
    runtime.reverbNode.dispose();
    runtime.reverbNode = null;
  }

  // Create new reverb with updated settings
  const finalDecay = runtime.reverbState.roomSize * runtime.reverbState.decay;
  runtime.reverbNode = new Tone.Reverb({
    decay: finalDecay,
    preDelay: runtime.reverbState.preDelay,
    wet: runtime.reverbState.mix,
  });
  await runtime.reverbNode.generate();

  // Reconnect chain: chainStart → reverb → gain
  chainStart.connect(runtime.reverbNode);
  runtime.reverbNode.connect(runtime.gain);
}

function applyLaneMixer(runtime: LaneRuntime) {
  if (!runtime.gain || !runtime.pan) return;
  runtime.gain.gain.value = runtime.mixer.volume;
  runtime.pan.pan.value = runtime.mixer.pan;
}

function applyLaneSynthState(runtime: LaneRuntime) {
  if (!runtime.synth) return;

  // Apply synth parameters based on instrument type
  if (runtime.instrumentModuleId === "instrument.kick" && runtime.synth instanceof Tone.MembraneSynth) {
    runtime.synth.set({
      pitchDecay: runtime.kickState.pitchDecay,
      octaves: runtime.kickState.tone * 4,
      envelope: { decay: runtime.kickState.decay },
    });
  } else if (runtime.instrumentModuleId === "instrument.hihat" && runtime.synth instanceof Tone.MetalSynth) {
    runtime.synth.set({
      envelope: { decay: runtime.hihatState.decay },
      harmonicity: runtime.hihatState.resonance * 12,
      modulationIndex: runtime.hihatState.tone * 50,
      resonance: 1000 + runtime.hihatState.tone * 4000,
    });
  } else if (runtime.instrumentModuleId === "instrument.snare" && runtime.synth instanceof Tone.NoiseSynth) {
    runtime.synth.set({
      noise: { type: runtime.snareState.tone < 0.5 ? "white" : "brown" },
      envelope: {
        attack: 0.001 + (1 - runtime.snareState.snap) * 0.01,
        decay: runtime.snareState.decay,
      },
    });
  } else if (runtime.instrumentModuleId === "instrument.conga" && runtime.synth instanceof Tone.MembraneSynth) {
    runtime.synth.set({
      pitchDecay: runtime.congaState.pitchDecay,
      octaves: runtime.congaState.tone * 3,
      envelope: { decay: runtime.congaState.decay },
    });
  } else if (runtime.instrumentModuleId === "instrument.clap" && runtime.synth instanceof Tone.NoiseSynth) {
    runtime.synth.set({
      noise: { type: runtime.clapState.tone < 0.5 ? "white" : "pink" },
      envelope: {
        decay: runtime.clapState.decay,
      },
    });
  } else if (runtime.synth instanceof Tone.FMSynth) {
    // Default: FM Synth
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

  // Apply delay state
  if (runtime.delayNode) {
    runtime.delayNode.set({
      delayTime: runtime.delayState.time,
      feedback: runtime.delayState.feedback,
      wet: runtime.delayState.mix,
    });
  }

  // Apply reverb state - only preDelay and wet can be updated
  // decay and roomSize require regeneration (handled separately)
  if (runtime.reverbNode) {
    runtime.reverbNode.set({
      preDelay: runtime.reverbState.preDelay,
      wet: runtime.reverbState.mix,
    });
  }
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
 * Dispatcher function that routes to the appropriate rhythm module handler
 * based on the lane's active rhythm module type.
 *
 * @param runtime - Lane's audio state and nodes
 * @param time - Web Audio context time (seconds) for sample-accurate scheduling
 */
function tickLane(runtime: LaneRuntime, time: number) {
  if (!shouldPlayLane(runtime)) return;

  // Dispatch to appropriate rhythm module handler
  if (runtime.rhythmModuleId === "rhythm.euclidean") {
    tickLaneEuclidean(runtime, time);
  } else if (runtime.rhythmModuleId === "rhythm.m185") {
    tickLaneM185(runtime, time);
  } else {
    // Default: XOX sequencer
    tickLaneXox(runtime, time);
  }
}

/**
 * XOX Sequencer tick
 *
 * Original step sequencer logic with active/inactive steps and probability.
 */
function tickLaneXox(runtime: LaneRuntime, time: number) {
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
 * Euclidean Sequencer tick
 *
 * Generates Euclidean rhythm pattern using Bjorklund algorithm.
 * Pattern is determined by steps, pulses, and rotation parameters.
 */
function tickLaneEuclidean(runtime: LaneRuntime, time: number) {
  const pattern = generateEuclideanPattern(
    runtime.euclideanSteps,
    runtime.euclideanPulses,
    runtime.euclideanRotation
  );
  if (!pattern.length) return;

  // Get current step based on order setting
  const order = orderOptions[runtime.euclideanSettings.orderIndex] ?? "forward";
  let stepIndex: number;
  if (order === "random") {
    stepIndex = Math.floor(Math.random() * pattern.length);
  } else {
    stepIndex = normalizeIndex(runtime.stepPointer, pattern.length);
    if (order === "forward") {
      runtime.stepPointer = (stepIndex + 1) % pattern.length;
    } else {
      runtime.stepPointer = (stepIndex - 1 + pattern.length) % pattern.length;
    }
  }

  if (isEditorLane(runtime)) {
    scheduleUIUpdate(() => setPlayingStep(stepIndex), time);
  }

  // Trigger if pattern has a pulse at this position
  if (pattern[stepIndex]) {
    const fakeStep: StepState = { id: stepIndex, active: true, duration: 1, probability: 100 };
    triggerLaneMelody(runtime, fakeStep, time);
  }
}

/**
 * M185 Sequencer tick
 *
 * Roland 100m style sequencer with entries containing steps and modes.
 * Modes: repeat (play x times), hold (sustain for x length), skip (advance x steps).
 */
function tickLaneM185(runtime: LaneRuntime, time: number) {
  const length = Math.min(runtime.m185Settings.length, runtime.m185Entries.length);
  if (!length) return;

  const entries = runtime.m185Entries.slice(0, length);
  if (!entries.length) return;

  // Get current entry based on order setting
  const order = orderOptions[runtime.m185Settings.orderIndex] ?? "forward";
  let entryIndex: number;
  if (order === "random") {
    entryIndex = Math.floor(Math.random() * entries.length);
    runtime.m185EntryPointer = entryIndex;
    runtime.m185StepCounter = 0;
  } else {
    entryIndex = normalizeIndex(runtime.m185EntryPointer, entries.length);
  }

  const entry = entries[entryIndex];
  if (!entry) return;

  if (isEditorLane(runtime)) {
    scheduleUIUpdate(() => setPlayingStep(entryIndex), time);
  }

  // Process current entry based on mode
  if (entry.mode === "skip") {
    // Skip mode: Don't trigger, just advance counter
    runtime.m185StepCounter++;
    if (runtime.m185StepCounter >= entry.steps) {
      runtime.m185StepCounter = 0;
      if (order === "forward") {
        runtime.m185EntryPointer = (entryIndex + 1) % entries.length;
      } else if (order === "backwards") {
        runtime.m185EntryPointer = (entryIndex - 1 + entries.length) % entries.length;
      }
    }
    return;
  }

  if (entry.mode === "hold") {
    // Hold mode: Trigger only on first step, then sustain
    if (runtime.m185StepCounter === 0) {
      const fakeStep: StepState = { id: entryIndex, active: true, duration: entry.steps, probability: 100 };
      triggerLaneMelody(runtime, fakeStep, time);
    }
    runtime.m185StepCounter++;
    if (runtime.m185StepCounter >= entry.steps) {
      runtime.m185StepCounter = 0;
      if (order === "forward") {
        runtime.m185EntryPointer = (entryIndex + 1) % entries.length;
      } else if (order === "backwards") {
        runtime.m185EntryPointer = (entryIndex - 1 + entries.length) % entries.length;
      }
    }
    return;
  }

  // Repeat mode (default): Trigger on every step
  const fakeStep: StepState = { id: entryIndex, active: true, duration: 1, probability: 100 };
  triggerLaneMelody(runtime, fakeStep, time);
  runtime.m185StepCounter++;
  if (runtime.m185StepCounter >= entry.steps) {
    runtime.m185StepCounter = 0;
    if (order === "forward") {
      runtime.m185EntryPointer = (entryIndex + 1) % entries.length;
    } else if (order === "backwards") {
      runtime.m185EntryPointer = (entryIndex - 1 + entries.length) % entries.length;
    }
  }
}

/**
 * Generate Euclidean rhythm pattern using Bjorklund algorithm
 *
 * Distributes pulses as evenly as possible across steps, with optional rotation.
 *
 * @param steps - Total number of steps in pattern
 * @param pulses - Number of active pulses to distribute
 * @param rotation - Rotate pattern by this many steps
 * @returns Boolean array where true = pulse, false = rest
 */
function generateEuclideanPattern(steps: number, pulses: number, rotation: number): boolean[] {
  if (pulses >= steps) {
    return Array(steps).fill(true);
  }
  if (pulses === 0 || steps === 0) {
    return Array(steps).fill(false);
  }

  const pattern: boolean[] = Array(steps).fill(false);
  const bucket = steps - pulses;

  for (let i = 0; i < steps; i++) {
    pattern[i] = ((i * bucket) % steps) < pulses;
  }

  // Apply rotation
  if (rotation !== 0) {
    const normalized = ((rotation % steps) + steps) % steps;
    return [...pattern.slice(normalized), ...pattern.slice(0, normalized)];
  }

  return pattern;
}

/**
 * Trigger melody notes for a step
 *
 * Dispatcher function that routes to the appropriate melody module handler
 * based on the lane's active melody module type.
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
  // Dispatch to appropriate melody module handler
  if (runtime.melodyModuleId === "melody.stochastic") {
    triggerLaneMelodyStochastic(runtime, step, time);
  } else {
    // Default: Basic melody sequencer
    triggerLaneMelodyBasic(runtime, step, time);
  }
}

/**
 * Basic Melody Sequencer trigger
 *
 * Sequentially plays notes from bar array with optional skip divisor,
 * glide, and randomization.
 */
function triggerLaneMelodyBasic(
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

  // Determine note and duration based on instrument type
  let note: string | number;
  let durationSeconds: number;

  if (runtime.instrumentModuleId === "instrument.kick") {
    note = runtime.kickState.pitch;
    durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  } else if (runtime.instrumentModuleId === "instrument.hihat") {
    note = 200; // Fixed frequency for hihat
    durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  } else if (runtime.instrumentModuleId === "instrument.snare") {
    note = "C4"; // NoiseSynth doesn't use pitch but Tone requires it
    durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  } else if (runtime.instrumentModuleId === "instrument.conga") {
    note = runtime.congaState.pitch;
    durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  } else if (runtime.instrumentModuleId === "instrument.clap") {
    note = "C4"; // NoiseSynth doesn't use pitch but Tone requires it
    durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  } else {
    // Default: use melody note for melodic instruments
    note = valueToNote(bar);
    durationSeconds = getLaneStepDurationSeconds(runtime, step, bar);
  }

  runtime.synth?.triggerAttackRelease(note, durationSeconds, time);
}

/**
 * Stochastic Melody trigger
 *
 * Generates random notes within a specified range with configurable
 * change probability. Notes persist until probability triggers a change.
 */
function triggerLaneMelodyStochastic(
  runtime: LaneRuntime,
  step: StepState,
  time: number
) {
  // Calculate duration
  const baseSeconds = Tone.Time(runtime.subdivision).toSeconds();
  const durationSeconds = Math.max(baseSeconds * step.duration, 0.02);

  // Determine note based on instrument type
  let note: string | number;

  if (runtime.instrumentModuleId === "instrument.kick") {
    note = runtime.kickState.pitch;
  } else if (runtime.instrumentModuleId === "instrument.hihat") {
    note = 200; // Fixed frequency for hihat
  } else if (runtime.instrumentModuleId === "instrument.snare") {
    note = "C4"; // NoiseSynth doesn't use pitch
  } else if (runtime.instrumentModuleId === "instrument.conga") {
    note = runtime.congaState.pitch;
  } else if (runtime.instrumentModuleId === "instrument.clap") {
    note = "C4"; // NoiseSynth doesn't use pitch
  } else {
    // Default: use stochastic melody for melodic instruments
    // Check if we should change the note
    if (Math.random() * 100 < runtime.stochasticChangeProb) {
      // Generate new random note within range
      const range = runtime.stochasticMaxNote - runtime.stochasticMinNote;
      const randomValue = Math.floor(Math.random() * (range + 1));
      runtime.stochasticCurrentNote = runtime.stochasticMinNote + randomValue;
    }

    // Convert current note value to MIDI
    const clamped = Math.max(0, Math.min(runtime.stochasticCurrentNote, SCALE_OFFSETS.length - 1));
    const midi = BASE_MIDI + SCALE_OFFSETS[clamped];
    note = Tone.Frequency(midi, "midi").toNote();
  }

  // Trigger synth
  runtime.synth?.triggerAttackRelease(note, durationSeconds, time);

  // Update UI if this is the edited lane
  if (isEditorLane(runtime)) {
    scheduleUIUpdate(() => setPlayingBar(runtime.stochasticCurrentNote), time);
  }
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
  runtime.delayNode?.dispose();
  runtime.delayNode = null;
  runtime.reverbNode?.dispose();
  runtime.reverbNode = null;
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

function toKickSnapshot(value: unknown): KickState {
  if (isKickState(value)) {
    return value;
  }
  return createKickSnapshot();
}

function toHihatSnapshot(value: unknown): HihatState {
  if (isHihatState(value)) {
    return value;
  }
  return createHihatSnapshot();
}

function toSnareSnapshot(value: unknown): SnareState {
  if (isSnareState(value)) {
    return value;
  }
  return createSnareSnapshot();
}

function toCongaSnapshot(value: unknown): CongaState {
  if (isCongaState(value)) {
    return value;
  }
  return createCongaSnapshot();
}

function toClapSnapshot(value: unknown): ClapState {
  if (isClapState(value)) {
    return value;
  }
  return createClapSnapshot();
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

function cloneM185Entries(list: M185Entry[]) {
  return list.map((entry) => ({ ...entry }));
}

function toEuclideanSnapshot(value: unknown): EuclideanSnapshot {
  if (isEuclideanSnapshot(value)) {
    return value;
  }
  return createEuclideanSnapshot();
}

function toM185Snapshot(value: unknown): M185Snapshot {
  if (isM185Snapshot(value)) {
    return value;
  }
  return createM185Snapshot();
}

function toStochasticSnapshot(value: unknown): StochasticSnapshot {
  if (isStochasticSnapshot(value)) {
    return value;
  }
  return createStochasticSnapshot();
}

function toDelaySnapshot(value: unknown): DelaySnapshot {
  if (isDelaySnapshot(value)) {
    return value;
  }
  return createDelaySnapshot();
}

function toReverbSnapshot(value: unknown): ReverbSnapshot {
  if (isReverbSnapshot(value)) {
    return value;
  }
  return createReverbSnapshot();
}

function isEuclideanSnapshot(value: unknown): value is EuclideanSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "steps" in (value as Record<string, unknown>) &&
    "pulses" in (value as Record<string, unknown>) &&
    typeof (value as { settings?: unknown }).settings === "object"
  );
}

function isM185Snapshot(value: unknown): value is M185Snapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { entries?: unknown }).entries) &&
    typeof (value as { settings?: unknown }).settings === "object"
  );
}

function isStochasticSnapshot(value: unknown): value is StochasticSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "minNote" in (value as Record<string, unknown>) &&
    "maxNote" in (value as Record<string, unknown>) &&
    typeof (value as { settings?: unknown }).settings === "object"
  );
}

function isDelaySnapshot(value: unknown): value is DelaySnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "time" in (value as Record<string, unknown>) &&
    "feedback" in (value as Record<string, unknown>) &&
    "mix" in (value as Record<string, unknown>)
  );
}

function isReverbSnapshot(value: unknown): value is ReverbSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "roomSize" in (value as Record<string, unknown>) &&
    "decay" in (value as Record<string, unknown>) &&
    "mix" in (value as Record<string, unknown>)
  );
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

function isKickState(value: unknown): value is KickState {
  return (
    typeof value === "object" &&
    value !== null &&
    "pitch" in (value as Record<string, unknown>) &&
    "pitchDecay" in (value as Record<string, unknown>) &&
    "tone" in (value as Record<string, unknown>) &&
    "decay" in (value as Record<string, unknown>)
  );
}

function isHihatState(value: unknown): value is HihatState {
  return (
    typeof value === "object" &&
    value !== null &&
    "tone" in (value as Record<string, unknown>) &&
    "decay" in (value as Record<string, unknown>) &&
    "resonance" in (value as Record<string, unknown>)
  );
}

function isSnareState(value: unknown): value is SnareState {
  return (
    typeof value === "object" &&
    value !== null &&
    "tone" in (value as Record<string, unknown>) &&
    "snap" in (value as Record<string, unknown>) &&
    "decay" in (value as Record<string, unknown>)
  );
}

function isCongaState(value: unknown): value is CongaState {
  return (
    typeof value === "object" &&
    value !== null &&
    "pitch" in (value as Record<string, unknown>) &&
    "pitchDecay" in (value as Record<string, unknown>) &&
    "tone" in (value as Record<string, unknown>) &&
    "decay" in (value as Record<string, unknown>)
  );
}

function isClapState(value: unknown): value is ClapState {
  return (
    typeof value === "object" &&
    value !== null &&
    "tone" in (value as Record<string, unknown>) &&
    "decay" in (value as Record<string, unknown>) &&
    "spread" in (value as Record<string, unknown>)
  );
}

function isSynthState(value: unknown): value is Partial<SynthState> {
  return (
    typeof value === "object" &&
    value !== null &&
    "wave" in (value as Record<string, unknown>)
  );
}
