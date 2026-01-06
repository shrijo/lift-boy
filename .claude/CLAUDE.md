# Lift-Boy Project Context

## Project Overview

Lift-Boy is a browser-based polyphonic audio sequencer with keyboard-first workflow. Built with Svelte 5 + Tone.js.

**Core Features**:
- Multi-lane architecture (1-12 simultaneous voices)
- Multiple rhythm modules: XOX step sequencer, Euclidean rhythm generator, M185 entry-based sequencer
- Multiple melody modules: Basic melody sequencer, Stochastic probability-based generator
- FM synthesizer with ADSR envelope
- Effect modules: Delay, Reverb
- Browser LocalStorage persistence
- Keyboard-first controls

**Tech Stack**: Svelte 5, TypeScript, Tone.js, Vite

## Standard Development Procedure

For all implementation tasks, follow this **5-step process**:

### 1. Get Context Files
Before starting any task, gather necessary context:
- Read relevant documentation from `docs/` directory
- Check `docs/ARCHITECTURE.md` for system design
- Review `docs/STATE_MANAGEMENT.md` for store patterns
- Look at `docs/AUDIO_ENGINE.md` for Tone.js integration
- Check ADRs in `docs/adr/` for design decisions
- Review related source files in `src/lib/`

### 2. Ask Clarification Questions
Before proceeding, ensure understanding:
- What is the specific goal or problem to solve?
- Are there constraints or preferences (performance, UX, architecture)?
- Which lanes/modules are affected?
- Should this follow existing patterns or introduce new ones?
- Are there edge cases to consider?

### 3. Make a Plan for Review
Create a detailed implementation plan covering:
- Files to be modified or created
- State management approach (which stores affected)
- Audio engine changes (if any)
- UI/component changes
- Type definitions needed
- Testing approach

**Wait for user approval before proceeding.**

### 4. Implement After Approval
Once the plan is approved:
- Follow the code style guidelines below
- Make changes incrementally
- Update types as needed
- Test in browser (keyboard workflow, audio playback)
- Run `npm run check` for type validation

### 5. Update Context and Documentation
After implementation:
- Update relevant documentation in `docs/`
- Add or update ADRs for significant architectural decisions
- Update this CLAUDE.md if new patterns or conventions emerge
- Update README.md if user-facing features changed
- Document new keyboard shortcuts in `docs/KEYBOARD.md`

## Key Architecture Concepts

### Lane-Based Multi-Voice
Each lane is an independent voice with:
- Rhythm module (XOX, Euclidean, or M185 sequencer)
- Melody module (Basic melody or Stochastic generator)
- Instrument module (FM synth)
- Effect module (Delay or Reverb)
- Mixer settings (volume, pan, mute/solo)

**Lane Management**:
- Projects support 1-12 lanes (defined in `PROJECT_LANE_LIMIT`)
- Each lane runs in parallel with independent state and audio processing
- When adding a lane, it automatically becomes the selected/active lane
- When removing lanes, selection is preserved if the lane still exists
- If the selected lane is deleted, the last remaining lane becomes active
- Lane selection logic is in `src/lib/core/stores/session/lanes.ts`

**Important**: Lanes maintain independent state and audio nodes. Each lane has its own `LaneRuntime` in the audio engine with separate Tone.Loop, FMSynth, and effect nodes.

See: `docs/adr/0001-lane-architecture.md`

### Dual State System
- **Editor Stores**: Temporary editing state for current lane (module-specific stores)
- **Project Store**: Persistent project data for all lanes
- **Sync Layer**: `laneModuleSync.ts` bridges the two with module-aware persistence
- **Module-Aware Sync**: The sync layer detects module type and loads/saves appropriate snapshots
  - Rhythm: XOX/Euclidean/M185 snapshots based on `rhythmId`
  - Melody: Basic/Stochastic snapshots based on `melodyId`
  - Effect: Delay/Reverb snapshots based on `effectId`

See: `docs/STATE_MANAGEMENT.md`

### Module System
The project uses a pluggable module architecture:

**Module Categories**:
- **Rhythm**: Generates trigger events at different subdivisions
  - `rhythm.xox-basic` - Traditional step sequencer with 64 steps
  - `rhythm.euclidean` - Bjorklund algorithm for evenly-distributed pulses
  - `rhythm.m185` - Entry-based sequencer with repeat/hold/skip modes
- **Melody**: Determines note pitch when rhythm triggers
  - `melody.melody-basic` - 32-bar sequence with glide and randomization
  - `melody.stochastic` - Probability-based random note generator
- **Instrument**: Synthesizes audio from note events
  - `instrument.synth-simple` - FM synth with ADSR envelope
- **Effect**: Post-processing audio effects
  - `effect.delay` - Feedback delay with time/feedback/mix controls
  - `effect.reverb` - Reverb with room size/decay/mix/pre-delay (async impulse generation)
  - `effect.none` - No effect (bypass, has placeholder UI)

**Module Storage**:
Each module category has its own store directory with:
- Component files (`.svelte`)
- State stores (writable/derived stores with snapshot functions)
- Type definitions

**Integration Points**:
1. **Module Registry** (`src/lib/core/modules/registry.ts`) - Maps definitionIds to module definitions
2. **Sync Layer** (`laneModuleSync.ts`) - Module-aware state persistence
3. **Audio Engine** (`engine.ts`) - Module-aware dispatching and audio processing
4. **UI** (`App.svelte`) - Reactive section building from lane modules

### Keyboard Control System
The project uses a keyboard-first workflow with tap/hold detection:

**Control Modes**:
- **Tap Mode**: Quick press (<200ms) of number keys 1-4 increments values
- **Hold Mode**: Hold number key + arrows for continuous adjustment
- **Navigation**: Arrow keys navigate sections (up/down) and slides (left/right)

**Key Features**:
- Tap detection with 200ms threshold (`keyboard.ts`)
- Dual-mode arrows (navigation when no input selected, adjustment when selected)
- All increments use 1× step for consistency
- Special handling for toggles (just toggle) and cyclic options (just cycle)
- Custom event system for component integration (`keyboard:increment-input`, `keyboard:adjust-input-up/down`)

**Implementation**:
- `src/lib/core/utils/keyboard.ts` - Global keyboard dispatcher with tap/hold detection
- `src/lib/core/components/ui/Inputs.svelte` - Input adjustment logic with type classification
- Input types: numeric (standard increment), selector (navigate indices), toggle (on/off), cyclic (cycle options)

See: `docs/KEYBOARD.md`

### Audio Engine
- Per-lane `Tone.Loop` for independent timing
- Shared `Tone.Transport` for synchronized playback
- Audio graph: `FMSynth → [Delay] → [Reverb] → Gain → Panner → Destination`
- Module-aware dispatching: Audio engine routes to appropriate handlers based on module definitionId
- Each lane has isolated `LaneRuntime` with independent state and audio nodes

See: `docs/AUDIO_ENGINE.md`

## Code Style Guidelines

### TypeScript
- **Strict mode enabled**
- All exports must have explicit types
- Prefer interfaces over types for object shapes

### Naming Conventions
- **Components**: PascalCase (`XoxSequencer.svelte`, `Lane.svelte`)
- **Stores**: camelCase (`sequencer.ts`, `melody.ts`, `transport.ts`)
- **Functions**: camelCase (`toggleStepActive()`, `updateBpm()`)
- **Types**: PascalCase (`StepState`, `SequencerSnapshot`, `LaneConfig`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants

### State Management Patterns
- Use Svelte writable/derived stores for all state
- All persisted state uses JSON-serializable snapshots
- Always use `store.update()` for state changes (immutability)
- Never mutate state directly

### File Organization
```
src/lib/
├── core/
│   ├── audio/          # Audio engine (LaneRuntime, AudioManager)
│   ├── components/     # Core UI components (Header, LaneSelector, etc.)
│   ├── modules/        # Module registry and definitions
│   ├── services/       # Project persistence (LocalStorage)
│   ├── stores/         # Svelte stores (state management)
│   │   ├── data/       # Project and lane data stores
│   │   ├── session/    # Session state (transport, lanes, navigation)
│   │   └── sync/       # Lane module synchronization
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utilities (keyboard, scrolling, constants)
├── rhythm/
│   ├── components/     # XOX, Euclidean, M185 sequencer components
│   └── stores/         # Rhythm module stores
├── melody/
│   ├── components/     # Melody and Stochastic sequencer components
│   └── stores/         # Melody module stores
├── instrument/
│   ├── components/     # SimpleSynth component
│   └── stores/         # Synth state stores
└── effect/
    ├── components/     # DelayEffect, ReverbEffect, NoneEffect components
    └── stores/         # Effect state stores (delay, reverb)
```

### Component Patterns
- Keep components focused and single-purpose
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Props should be readonly unless explicitly mutable
- Emit custom events for parent communication

### UI Patterns
- **Reactive Sections**: UI sections should be derived from lane state, not hardcoded
  - Example: `App.svelte` builds `sections` array reactively from `$lanes[$selectedLaneIndex]`
  - This ensures UI updates when lanes change or modules are swapped
- **Module Components**: Each module type has its own component (XoxSequencer, EuclideanSequencer, etc.)
  - Components receive `slides` prop with input definitions
  - Components are rendered via `{#if}` blocks or dynamic component mapping

## Important Context Files

When working on specific areas, reference these files:

**State Management**:
- `src/lib/core/stores/session/transport.ts` - Playback control
- `src/lib/core/stores/session/lanes.ts` - Lane configuration & selection
- `src/lib/core/stores/data/projects.ts` - Project persistence
- `src/lib/core/stores/sync/laneModuleSync.ts` - Sync layer

**Audio**:
- `src/lib/core/audio/engine.ts` - Audio engine with LaneRuntime and dispatcher logic

**Types**:
- `src/lib/core/types/types.ts` - UI and component types
- `src/lib/core/types/project.ts` - Project, Lane, and Module types
- `src/lib/rhythm/types.ts` - Rhythm module types
- `src/lib/melody/types.ts` - Melody module types
- `src/lib/instrument/types.ts` - Instrument module types
- `src/lib/effect/types.ts` - Effect module types

**Documentation**:
- `docs/ARCHITECTURE.md` - System overview
- `docs/STATE_MANAGEMENT.md` - Store patterns
- `docs/AUDIO_ENGINE.md` - Tone.js integration
- `docs/KEYBOARD.md` - Keyboard controls
- `docs/MODULES.md` - Module system extensibility

## Development Commands

```bash
npm run dev         # Start dev server (http://localhost:5173)
npm run build       # Build for production
npm run preview     # Preview production build
npm run check       # TypeScript + Svelte type check
```

Always run `npm run check` before considering work complete.

## Testing Workflow

Since this is a browser-based audio app:
1. Test keyboard controls:
   - Arrow keys for navigation (sections/slides)
   - Tap 1-4 for quick increment
   - Hold 1-4 + arrows for continuous adjustment
   - Space for play/pause
   - T for BPM editing
   - L for module selector
   - Escape to clear selection
2. Verify audio playback (Web Audio API)
3. Check state persistence (LocalStorage)
4. Test multi-lane functionality
5. Verify type safety with `npm run check`

## Common Pitfalls to Avoid

- Don't mutate store state directly (use `.update()`)
- Don't forget to dispose Tone.js resources (loops, synths)
- Don't break snapshot serialization (keep state JSON-compatible)
- Don't bypass the sync layer between editor stores and project store
- Don't forget to update types when changing state shapes
- **Don't hardcode UI sections** - Always derive sections from lane state reactively
  - Bad: `let sections = [...]` (static array)
  - Good: `$: sections = buildSections($lanes[$selectedLaneIndex])`
- **Don't forget slide definitions** - Module components need `slides` array to render
  - Empty `slides: []` will result in nothing being displayed
  - Each module needs at least one slide with input definitions
- **Module-aware sync** - When adding new modules, update `laneModuleSync.ts`:
  - Add snapshot imports and type guards
  - Update `persistLaneState()` to save the module's snapshot
  - Update `applyLaneState()` to load the module's snapshot
- **Audio engine integration** - New rhythm/melody modules need:
  - Dispatcher logic in `tickLane()` to route to the correct handler
  - Handler function (e.g., `tickLaneEuclidean()`)
  - Hydration logic in `hydrateLaneRuntime()`
- **Reverb requires async generation** - `Tone.Reverb.generate()` must be awaited:
  - `ensureLaneNodes()` is async and awaits reverb generation
  - Decay and roomSize changes require rebuilding the reverb node (not just updating parameters)
  - Use `rebuildReverbNode()` when decay or roomSize changes
  - Only preDelay and wet (mix) can be updated in place
- **Component mapping for modules** - All module types must be registered:
  - Update `componentByKind` in both `App.svelte` and `Lane.svelte`
  - Add imports for new components
  - Update SectionKind type in `types.ts`
  - Add template rendering logic in component sections

## Notes

- This project is under active development
- Prefer existing patterns over introducing new ones unless justified
- Document architectural decisions in ADRs
- Keyboard-first workflow is a core design principle
