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
      defaultState: {
        length: 16,
        density: 0.5,
        shuffle: 0,
      },
    },
    {
      id: "melody.melody-basic",
      category: "melody",
      label: "Melody Blocks",
      version: 1,
      description: "Bar-based pitch lane",
      defaultState: {
        length: 8,
        spread: 2,
        randomize: 0,
      },
    },
    {
      id: "instrument.synth-simple",
      category: "instrument",
      label: "Simple Synth",
      version: 1,
      description: "Single voice synth",
      defaultState: {
        wave: "amtriangle",
        attack: 0.05,
        decay: 0.2,
        sustain: 0.2,
        release: 1.5,
      },
    },
    {
      id: "effect.none",
      category: "effect",
      label: "Dry",
      version: 1,
      description: "Pass-through",
      defaultState: {},
    },
  ];

  defaults.forEach(registerModule);
}

bootstrapDefinitions();
