/**
 * Lift-Boy Library
 *
 * Main entry point for all modules and core functionality.
 *
 * Module Categories:
 * - rhythm: Trigger pattern generation (XOX sequencer)
 * - melody: Pitch sequence generation (bar sequencer)
 * - instrument: Audio synthesis (FM synth)
 * - effect: Audio processing (future)
 *
 * Core:
 * - Audio engine (Tone.js integration)
 * - Stores (state management)
 * - Services (persistence)
 * - Components (UI)
 * - Types (shared definitions)
 * - Utilities (keyboard, etc.)
 */

// Module categories
export * as rhythm from "./rhythm";
export * as melody from "./melody";
export * as instrument from "./instrument";
export * as effect from "./effect";

// Module registry
export * from "./modules/registry";

// Core functionality
export * from "./core";
