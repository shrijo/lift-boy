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

  selectedLaneIndex.subscribe((nextIndex) => {
    const target = sanitizeIndex(nextIndex);
    if (target === activeLaneIndex) return;
    persistLaneState(activeLaneIndex);
    activeLaneIndex = target;
    ensureLaneSnapshots(activeLaneIndex);
    applyLaneState(activeLaneIndex);
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
  bars.subscribe(handleMelodyChange);
  melodySettings.subscribe(handleMelodyChange);
  synthSettings.subscribe(handleSynthChange);
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
  updateModuleState(index, "rhythm", getSequencerSnapshot());
  updateModuleState(index, "melody", getMelodySnapshot());
  updateModuleState(index, "instrument", getSynthState());
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
  const melodyState = lane.modules.melody?.state;
  const synthState = lane.modules.instrument?.state;
  loadSequencerSnapshot(
    isSequencerSnapshot(rhythmState) ? rhythmState : createSequencerSnapshot()
  );
  loadMelodySnapshot(
    isMelodySnapshot(melodyState) ? melodyState : createMelodySnapshot()
  );
  loadSynthState(isSynthState(synthState) ? synthState : createSynthSnapshot());
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
