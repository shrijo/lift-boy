/**
 * Lane Module Synchronization
 *
 * Bidirectional sync layer between editor stores and project store.
 * Keeps lane module states in sync as user edits and switches lanes.
 *
 * Architecture:
 * - Editor stores (sequencer, melody, synth) represent CURRENT LANE only
 * - Project store contains ALL lanes with their module states
 * - This layer syncs changes bidirectionally
 *
 * Sync Flow:
 * 1. User edits → Editor store updates → persistLaneState() → Project store
 * 2. User switches lane → persistLaneState(old) → applyLaneState(new) → Editor stores
 *
 * Critical Pattern:
 * - isApplying guard flag prevents circular updates
 * - When loading snapshots, set isApplying=true to skip persist
 * - Without guard, loading would trigger subscriptions → infinite loop
 *
 * See: docs/STATE_MANAGEMENT.md for detailed explanation
 */

import { get } from "svelte/store";
import { lanes, selectedLaneIndex } from "../session/lanes";
import { updateModuleState } from "../data/projects";
import {
  steps,
  sequencerSettings,
  getSequencerSnapshot,
  loadSequencerSnapshot,
  createSequencerSnapshot,
} from "../../../rhythm/stores/sequencer";
import {
  bars,
  melodySettings,
  getMelodySnapshot,
  loadMelodySnapshot,
  createMelodySnapshot,
} from "../../../melody/stores/melody";
import {
  synthSettings,
  getSynthState,
  loadSynthState,
  createSynthSnapshot,
} from "../../../instrument/stores/synth";
import {
  kickSettings,
  getKickSnapshot,
  loadKickSnapshot,
  createKickSnapshot,
} from "../../../instrument/stores/kick";
import {
  hihatSettings,
  getHihatSnapshot,
  loadHihatSnapshot,
  createHihatSnapshot,
} from "../../../instrument/stores/hihat";
import {
  snareSettings,
  getSnareSnapshot,
  loadSnareSnapshot,
  createSnareSnapshot,
} from "../../../instrument/stores/snare";
import {
  congaSettings,
  getCongaSnapshot,
  loadCongaSnapshot,
  createCongaSnapshot,
} from "../../../instrument/stores/conga";
import {
  clapSettings,
  getClapSnapshot,
  loadClapSnapshot,
  createClapSnapshot,
} from "../../../instrument/stores/clap";
import {
  euclideanSteps,
  euclideanPulses,
  euclideanRotation,
  euclideanSettings,
  getEuclideanSnapshot,
  loadEuclideanSnapshot,
  createEuclideanSnapshot,
} from "../../../rhythm/stores/euclidean";
import {
  m185Entries,
  selectedEntry as m185SelectedEntry,
  m185Settings,
  getM185Snapshot,
  loadM185Snapshot,
  createM185Snapshot,
} from "../../../rhythm/stores/m185";
import {
  stochasticMinNote,
  stochasticMaxNote,
  stochasticChangeProb,
  stochasticCurrentNote,
  stochasticSettings,
  getStochasticSnapshot,
  loadStochasticSnapshot,
  createStochasticSnapshot,
} from "../../../melody/stores/stochastic";
import {
  delayTime,
  delayFeedback,
  delayMix,
  getDelaySnapshot,
  loadDelaySnapshot,
  createDelaySnapshot,
} from "../../../effect/stores/delay";
import {
  reverbRoomSize,
  reverbDecay,
  reverbMix,
  reverbPreDelay,
  getReverbSnapshot,
  loadReverbSnapshot,
  createReverbSnapshot,
} from "../../../effect/stores/reverb";
import type { SequencerSnapshot } from "../../../rhythm/stores/sequencer";
import type { MelodySnapshot } from "../../../melody/stores/melody";
import type { SynthState } from "../../../instrument/stores/synth";

let initialized = false;
let activeLaneIndex: number | null = null;

/**
 * Guard flag to prevent circular store updates
 *
 * Problem: When applyLaneState() loads a snapshot:
 * 1. loadSequencerSnapshot() updates steps store
 * 2. steps subscription fires → handleRhythmChange()
 * 3. Without guard, would call persistLaneState() immediately
 * 4. That would overwrite the state we just loaded!
 *
 * Solution: Check isApplying before persisting
 */
let isApplying = false;

/**
 * Initialize lane module synchronization
 *
 * Sets up bidirectional sync between editor stores and project store.
 * Call once on app startup, before user interaction.
 *
 * Setup:
 * 1. Load initial lane state into editor stores
 * 2. Subscribe to selectedLaneIndex → switch lane on change
 * 3. Subscribe to all editor stores → persist on change
 *
 * Important: Editor store subscriptions check isApplying guard
 * to prevent circular updates during lane switching.
 */
export function initLaneModuleSync() {
  if (initialized) return;
  initialized = true;

  activeLaneIndex = sanitizeIndex(get(selectedLaneIndex));
  ensureLaneSnapshots(activeLaneIndex);
  applyLaneState(activeLaneIndex);

  // Track module definition IDs to detect changes
  let previousModuleIds = getModuleIds(activeLaneIndex);

  // Subscribe to lane changes to detect module definition updates
  lanes.subscribe((laneList) => {
    const currentModuleIds = getModuleIds(activeLaneIndex);

    // Check if any module definition changed on the active lane
    if (
      activeLaneIndex !== null &&
      previousModuleIds &&
      currentModuleIds &&
      hasModuleChanged(previousModuleIds, currentModuleIds)
    ) {
      // Module definition changed - reload editor stores
      ensureLaneSnapshots(activeLaneIndex);
      applyLaneState(activeLaneIndex);
    }

    previousModuleIds = currentModuleIds;
  });

  selectedLaneIndex.subscribe((nextIndex) => {
    const target = sanitizeIndex(nextIndex);
    if (target === activeLaneIndex) return;
    persistLaneState(activeLaneIndex);
    activeLaneIndex = target;
    ensureLaneSnapshots(activeLaneIndex);
    applyLaneState(activeLaneIndex);
    previousModuleIds = getModuleIds(activeLaneIndex);
  });

  const handleRhythmChange = () => {
    if (isApplying) return;  // Guard: skip if loading state
    persistLaneState(activeLaneIndex);
  };

  const handleMelodyChange = () => {
    if (isApplying) return;  // Guard: skip if loading state
    persistLaneState(activeLaneIndex);
  };

  const handleSynthChange = () => {
    if (isApplying) return;  // Guard: skip if loading state
    persistLaneState(activeLaneIndex);
  };

  steps.subscribe(handleRhythmChange);
  sequencerSettings.subscribe(handleRhythmChange);
  euclideanSteps.subscribe(handleRhythmChange);
  euclideanPulses.subscribe(handleRhythmChange);
  euclideanRotation.subscribe(handleRhythmChange);
  euclideanSettings.subscribe(handleRhythmChange);
  m185Entries.subscribe(handleRhythmChange);
  m185SelectedEntry.subscribe(handleRhythmChange);
  m185Settings.subscribe(handleRhythmChange);
  bars.subscribe(handleMelodyChange);
  melodySettings.subscribe(handleMelodyChange);
  stochasticMinNote.subscribe(handleMelodyChange);
  stochasticMaxNote.subscribe(handleMelodyChange);
  stochasticChangeProb.subscribe(handleMelodyChange);
  stochasticCurrentNote.subscribe(handleMelodyChange);
  stochasticSettings.subscribe(handleMelodyChange);
  synthSettings.subscribe(handleSynthChange);
  kickSettings.subscribe(handleSynthChange);
  hihatSettings.subscribe(handleSynthChange);
  snareSettings.subscribe(handleSynthChange);
  congaSettings.subscribe(handleSynthChange);
  clapSettings.subscribe(handleSynthChange);
  delayTime.subscribe(handleSynthChange);
  delayFeedback.subscribe(handleSynthChange);
  delayMix.subscribe(handleSynthChange);
  reverbRoomSize.subscribe(handleSynthChange);
  reverbDecay.subscribe(handleSynthChange);
  reverbMix.subscribe(handleSynthChange);
  reverbPreDelay.subscribe(handleSynthChange);
}

/**
 * Persist editor state to project store
 *
 * Saves current editor stores (sequencer, melody, synth) to the
 * specified lane's module states in the project store.
 *
 * Direction: Editor stores → Project store
 *
 * Called when:
 * - User edits any editor store (via subscriptions)
 * - User switches lanes (save old lane before loading new)
 *
 * @param index - Lane index to persist to
 */
function persistLaneState(index: number | null) {
  if (index === null) return;
  const laneList = get(lanes);
  if (!laneList[index]) return;
  const lane = laneList[index];

  // Save rhythm module state based on active module type
  const rhythmId = lane.modules.rhythm?.definitionId;
  if (rhythmId === "rhythm.euclidean") {
    updateModuleState(index, "rhythm", getEuclideanSnapshot());
  } else if (rhythmId === "rhythm.m185") {
    updateModuleState(index, "rhythm", getM185Snapshot());
  } else {
    // Default: XOX sequencer
    updateModuleState(index, "rhythm", getSequencerSnapshot());
  }

  // Save melody module state based on active module type
  const melodyId = lane.modules.melody?.definitionId;
  if (melodyId === "melody.stochastic") {
    updateModuleState(index, "melody", getStochasticSnapshot());
  } else {
    // Default: Basic melody
    updateModuleState(index, "melody", getMelodySnapshot());
  }

  // Save instrument state based on active module type
  const instrumentId = lane.modules.instrument?.definitionId;
  if (instrumentId === "instrument.kick") {
    updateModuleState(index, "instrument", getKickSnapshot());
  } else if (instrumentId === "instrument.hihat") {
    updateModuleState(index, "instrument", getHihatSnapshot());
  } else if (instrumentId === "instrument.snare") {
    updateModuleState(index, "instrument", getSnareSnapshot());
  } else if (instrumentId === "instrument.conga") {
    updateModuleState(index, "instrument", getCongaSnapshot());
  } else if (instrumentId === "instrument.clap") {
    updateModuleState(index, "instrument", getClapSnapshot());
  } else {
    // Default: Simple synth
    updateModuleState(index, "instrument", getSynthState());
  }

  // Save effect states (delay and reverb both stored in effect module)
  // Note: Currently only one effect module per lane is supported
  if (lane.modules.effect?.definitionId === "effect.delay") {
    updateModuleState(index, "effect", getDelaySnapshot());
  } else if (lane.modules.effect?.definitionId === "effect.reverb") {
    updateModuleState(index, "effect", getReverbSnapshot());
  }
}

/**
 * Load lane state into editor stores
 *
 * Loads module states from project store into editor stores.
 * Sets isApplying guard to prevent persistence during load.
 *
 * Direction: Project store → Editor stores
 *
 * Called when:
 * - App initializes (load first lane)
 * - User switches lanes (load new lane)
 *
 * Critical: isApplying=true prevents handleRhythmChange etc.
 * from firing persistLaneState() during the load.
 *
 * @param index - Lane index to load from
 */
function applyLaneState(index: number | null) {
  const lane = getLane(index);
  if (!lane) return;
  isApplying = true;  // Set guard before loading

  const rhythmState = lane.modules.rhythm?.state;
  const rhythmId = lane.modules.rhythm?.definitionId;
  const melodyState = lane.modules.melody?.state;
  const melodyId = lane.modules.melody?.definitionId;
  const synthState = lane.modules.instrument?.state;
  const effectState = lane.modules.effect?.state;
  const effectId = lane.modules.effect?.definitionId;

  // Load rhythm module state based on active module type
  if (rhythmId === "rhythm.euclidean") {
    loadEuclideanSnapshot(
      isEuclideanSnapshot(rhythmState) ? rhythmState : createEuclideanSnapshot()
    );
  } else if (rhythmId === "rhythm.m185") {
    loadM185Snapshot(
      isM185Snapshot(rhythmState) ? rhythmState : createM185Snapshot()
    );
  } else {
    // Default: XOX sequencer
    loadSequencerSnapshot(
      isSequencerSnapshot(rhythmState) ? rhythmState : createSequencerSnapshot()
    );
  }

  // Load melody module state based on active module type
  if (melodyId === "melody.stochastic") {
    loadStochasticSnapshot(
      isStochasticSnapshot(melodyState) ? melodyState : createStochasticSnapshot()
    );
  } else {
    // Default: Basic melody
    loadMelodySnapshot(
      isMelodySnapshot(melodyState) ? melodyState : createMelodySnapshot()
    );
  }

  // Load instrument state based on active module type
  const instrumentId = lane.modules.instrument?.definitionId;
  if (instrumentId === "instrument.kick") {
    loadKickSnapshot(isKickState(synthState) ? synthState : createKickSnapshot());
  } else if (instrumentId === "instrument.hihat") {
    loadHihatSnapshot(isHihatState(synthState) ? synthState : createHihatSnapshot());
  } else if (instrumentId === "instrument.snare") {
    loadSnareSnapshot(isSnareState(synthState) ? synthState : createSnareSnapshot());
  } else if (instrumentId === "instrument.conga") {
    loadCongaSnapshot(isCongaState(synthState) ? synthState : createCongaSnapshot());
  } else if (instrumentId === "instrument.clap") {
    loadClapSnapshot(isClapState(synthState) ? synthState : createClapSnapshot());
  } else {
    // Default: Simple synth
    loadSynthState(isSynthState(synthState) ? synthState : createSynthSnapshot());
  }

  // Load effect state based on active effect module
  if (effectId === "effect.delay") {
    loadDelaySnapshot(isDelaySnapshot(effectState) ? effectState : createDelaySnapshot());
  } else if (effectId === "effect.reverb") {
    loadReverbSnapshot(isReverbSnapshot(effectState) ? effectState : createReverbSnapshot());
  }

  isApplying = false;  // Clear guard after loading
}

function ensureLaneSnapshots(index: number | null) {
  if (index === null) return;
  const lane = getLane(index);
  if (!lane) return;
  if (!isSequencerSnapshot(lane.modules.rhythm?.state)) {
    updateModuleState(index, "rhythm", createSequencerSnapshot());
  }
  if (!isMelodySnapshot(lane.modules.melody?.state)) {
    updateModuleState(index, "melody", createMelodySnapshot());
  }
  if (!isSynthState(lane.modules.instrument?.state)) {
    updateModuleState(index, "instrument", createSynthSnapshot());
  }
}

function getLane(index: number | null) {
  if (index === null) return null;
  const list = get(lanes);
  return list[index] ?? null;
}

function sanitizeIndex(index: number | null | undefined) {
  if (typeof index !== "number" || Number.isNaN(index)) return 0;
  return Math.max(index, 0);
}

function isSequencerSnapshot(value: unknown): value is SequencerSnapshot {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Validate steps array
  if (!Array.isArray(obj.steps)) return false;
  if (
    !obj.steps.every(
      (step) =>
        typeof step === "object" &&
        step !== null &&
        typeof (step as Record<string, unknown>).id === "number" &&
        typeof (step as Record<string, unknown>).active === "boolean" &&
        typeof (step as Record<string, unknown>).duration === "number" &&
        typeof (step as Record<string, unknown>).probability === "number"
    )
  )
    return false;

  // Validate settings object
  if (typeof obj.settings !== "object" || obj.settings === null) return false;
  const settings = obj.settings as Record<string, unknown>;
  if (typeof settings.length !== "number") return false;
  if (typeof settings.clockIndex !== "number") return false;
  if (typeof settings.orderIndex !== "number") return false;

  return true;
}

function isMelodySnapshot(value: unknown): value is MelodySnapshot {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Validate bars array
  if (!Array.isArray(obj.bars)) return false;
  if (
    !obj.bars.every(
      (bar) =>
        typeof bar === "object" &&
        bar !== null &&
        typeof (bar as Record<string, unknown>).id === "number" &&
        typeof (bar as Record<string, unknown>).value === "number" &&
        typeof (bar as Record<string, unknown>).glide === "boolean" &&
        typeof (bar as Record<string, unknown>).randomize === "boolean"
    )
  )
    return false;

  // Validate settings object
  if (typeof obj.settings !== "object" || obj.settings === null) return false;
  const settings = obj.settings as Record<string, unknown>;
  if (typeof settings.length !== "number") return false;
  if (typeof settings.skipIndex !== "number") return false;
  if (typeof settings.orderIndex !== "number") return false;

  return true;
}

function isSynthState(value: unknown): value is Partial<SynthState> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Must have at least the wave property to be considered a SynthState
  if (!("wave" in obj)) return false;

  // If properties exist, validate their types
  if ("wave" in obj && typeof obj.wave !== "string") return false;
  if ("harmonicity" in obj && typeof obj.harmonicity !== "number") return false;
  if ("modulation" in obj && typeof obj.modulation !== "string") return false;
  if ("portamento" in obj && typeof obj.portamento !== "number") return false;
  if ("attack" in obj && typeof obj.attack !== "number") return false;
  if ("decay" in obj && typeof obj.decay !== "number") return false;
  if ("sustain" in obj && typeof obj.sustain !== "number") return false;
  if ("release" in obj && typeof obj.release !== "number") return false;

  return true;
}

function isDelaySnapshot(value: unknown): value is ReturnType<typeof createDelaySnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.time === "number" &&
    typeof obj.feedback === "number" &&
    typeof obj.mix === "number"
  );
}

function isReverbSnapshot(value: unknown): value is ReturnType<typeof createReverbSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.roomSize === "number" &&
    typeof obj.decay === "number" &&
    typeof obj.mix === "number" &&
    typeof obj.preDelay === "number"
  );
}

interface ModuleIds {
  rhythm?: string;
  melody?: string;
  instrument?: string;
  effect?: string;
}

function getModuleIds(index: number | null): ModuleIds | null {
  const lane = getLane(index);
  if (!lane) return null;

  return {
    rhythm: lane.modules.rhythm?.definitionId,
    melody: lane.modules.melody?.definitionId,
    instrument: lane.modules.instrument?.definitionId,
    effect: lane.modules.effect?.definitionId,
  };
}

function hasModuleChanged(prev: ModuleIds, current: ModuleIds): boolean {
  return (
    prev.rhythm !== current.rhythm ||
    prev.melody !== current.melody ||
    prev.instrument !== current.instrument ||
    prev.effect !== current.effect
  );
}

function isEuclideanSnapshot(value: unknown): value is ReturnType<typeof createEuclideanSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.steps === "number" &&
    typeof obj.pulses === "number" &&
    typeof obj.rotation === "number" &&
    typeof obj.settings === "object" &&
    obj.settings !== null
  );
}

function isM185Snapshot(value: unknown): value is ReturnType<typeof createM185Snapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    Array.isArray(obj.entries) &&
    typeof obj.selectedEntry === "number" &&
    typeof obj.settings === "object" &&
    obj.settings !== null
  );
}

function isStochasticSnapshot(value: unknown): value is ReturnType<typeof createStochasticSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.minNote === "number" &&
    typeof obj.maxNote === "number" &&
    typeof obj.changeProb === "number" &&
    typeof obj.currentNote === "number" &&
    typeof obj.settings === "object" &&
    obj.settings !== null
  );
}

function isKickState(value: unknown): value is ReturnType<typeof createKickSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.pitch === "number" &&
    typeof obj.pitchDecay === "number" &&
    typeof obj.tone === "number" &&
    typeof obj.decay === "number"
  );
}

function isHihatState(value: unknown): value is ReturnType<typeof createHihatSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.tone === "number" &&
    typeof obj.decay === "number" &&
    typeof obj.resonance === "number"
  );
}

function isSnareState(value: unknown): value is ReturnType<typeof createSnareSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.tone === "number" &&
    typeof obj.snap === "number" &&
    typeof obj.decay === "number"
  );
}

function isCongaState(value: unknown): value is ReturnType<typeof createCongaSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.pitch === "number" &&
    typeof obj.pitchDecay === "number" &&
    typeof obj.tone === "number" &&
    typeof obj.decay === "number"
  );
}

function isClapState(value: unknown): value is ReturnType<typeof createClapSnapshot> {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.tone === "number" &&
    typeof obj.decay === "number" &&
    typeof obj.spread === "number"
  );
}
