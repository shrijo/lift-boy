/**
 * Module Registry
 *
 * Central registry for all module definitions in Lift-Boy.
 * Modules are pluggable components that define lane behavior.
 *
 * Module Categories:
 * - rhythm: Generate trigger patterns (e.g., XOX sequencer)
 * - melody: Generate note sequences (e.g., bar sequencer)
 * - instrument: Synthesize audio (e.g., FM synth)
 * - effect: Process audio (e.g., reverb, delay)
 *
 * Module Definition:
 * - id: Unique identifier (e.g., "rhythm.xox-basic")
 * - category: Module category
 * - version: Schema version for migration
 * - defaultState: Default module state (JSON-serializable)
 *
 * Usage:
 * - Modules are registered on app startup
 * - Each lane has one module per category
 * - Module states are stored in lane.modules[category].state
 *
 * See: docs/MODULES.md for detailed documentation
 */

import type { ModuleCategory, ModuleDefinition } from "../core/types/project";
import { createSequencerSnapshot } from "../rhythm/stores/sequencer";
import { createEuclideanSnapshot } from "../rhythm/stores/euclidean";
import { createM185Snapshot } from "../rhythm/stores/m185";
import { createMelodySnapshot } from "../melody/stores/melody";
import { createStochasticSnapshot } from "../melody/stores/stochastic";
import { createSynthSnapshot } from "../instrument/stores/synth";
import { createKickSnapshot } from "../instrument/stores/kick";
import { createHihatSnapshot } from "../instrument/stores/hihat";
import { createSnareSnapshot } from "../instrument/stores/snare";
import { createCongaSnapshot } from "../instrument/stores/conga";
import { createClapSnapshot } from "../instrument/stores/clap";
import { createDelaySnapshot } from "../effect/stores/delay";
import { createReverbSnapshot } from "../effect/stores/reverb";

const moduleRegistry = new Map<string, ModuleDefinition>();

/**
 * Register a module definition
 *
 * Adds a module to the registry, making it available for use in lanes.
 *
 * @param definition - Module definition with id, category, version, and defaultState
 */
export function registerModule(definition: ModuleDefinition) {
  moduleRegistry.set(definition.id, definition);
}

/**
 * Get a module definition by ID
 *
 * @param id - Module ID (e.g., "rhythm.xox-basic")
 * @returns Module definition or undefined if not found
 */
export function getModuleDefinition(id: string) {
  return moduleRegistry.get(id);
}

/**
 * List modules by category
 *
 * @param category - Optional category filter (rhythm, melody, instrument, effect)
 * @returns Array of module definitions
 */
export function listModulesByCategory(category?: ModuleCategory) {
  const entries = Array.from(moduleRegistry.values());
  if (!category) return entries;
  return entries.filter((definition) => definition.category === category);
}

function bootstrapDefinitions() {
  const defaults: ModuleDefinition[] = [
    {
      id: "rhythm.xox-basic",
      category: "rhythm",
      label: "XOX Basic",
      version: 1,
      description: "16-step trigger grid",
      defaultState: createSequencerSnapshot(),
    },
    {
      id: "rhythm.euclidean",
      category: "rhythm",
      label: "Euclidean",
      version: 1,
      description: "Algorithmic rhythm generator",
      defaultState: createEuclideanSnapshot(),
    },
    {
      id: "rhythm.m185",
      category: "rhythm",
      label: "M185 Sequencer",
      version: 1,
      description: "Roland 100m style sequencer",
      defaultState: createM185Snapshot(),
    },
    {
      id: "melody.melody-basic",
      category: "melody",
      label: "Melody Blocks",
      version: 1,
      description: "Bar-based pitch lane",
      defaultState: createMelodySnapshot(),
    },
    {
      id: "melody.stochastic",
      category: "melody",
      label: "Stochastic",
      version: 1,
      description: "Random note generator",
      defaultState: createStochasticSnapshot(),
    },
    {
      id: "instrument.synth-simple",
      category: "instrument",
      label: "Simple Synth",
      version: 1,
      description: "Single voice synth",
      defaultState: createSynthSnapshot(),
    },
    {
      id: "instrument.kick",
      category: "instrument",
      label: "Kick Drum",
      version: 1,
      description: "Bass drum synthesizer",
      defaultState: createKickSnapshot(),
    },
    {
      id: "instrument.hihat",
      category: "instrument",
      label: "Hi-Hat",
      version: 1,
      description: "Metallic hi-hat synthesizer",
      defaultState: createHihatSnapshot(),
    },
    {
      id: "instrument.snare",
      category: "instrument",
      label: "Snare Drum",
      version: 1,
      description: "Snare drum synthesizer",
      defaultState: createSnareSnapshot(),
    },
    {
      id: "instrument.conga",
      category: "instrument",
      label: "Conga Drum",
      version: 1,
      description: "Tuned conga drum synthesizer",
      defaultState: createCongaSnapshot(),
    },
    {
      id: "instrument.clap",
      category: "instrument",
      label: "Clap",
      version: 1,
      description: "Hand clap synthesizer",
      defaultState: createClapSnapshot(),
    },
    {
      id: "effect.none",
      category: "effect",
      label: "Dry",
      version: 1,
      description: "Pass-through",
      defaultState: {},
    },
    {
      id: "effect.delay",
      category: "effect",
      label: "Delay",
      version: 1,
      description: "Feedback delay effect",
      defaultState: createDelaySnapshot(),
    },
    {
      id: "effect.reverb",
      category: "effect",
      label: "Reverb",
      version: 1,
      description: "Reverb effect",
      defaultState: createReverbSnapshot(),
    },
  ];

  defaults.forEach(registerModule);
}

bootstrapDefinitions();
