# Lift-Boy Project Context

## Project Overview

Lift-Boy is a browser-based polyphonic audio sequencer with keyboard-first workflow. Built with Svelte 5 + Tone.js.

**Core Features**:
- Multi-lane architecture (1-12 simultaneous voices)
- XOX step sequencer (64-step trigger patterns)
- Melody sequencer (32-bar pitch sequences)
- FM synthesizer with ADSR envelope
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
- Rhythm module (XOX sequencer)
- Melody module
- Instrument module (FM synth)
- Mixer settings (volume, pan, mute/solo)

**Lane Management**:
- Projects support 1-12 lanes (defined in `PROJECT_LANE_LIMIT`)
- When adding a lane, it automatically becomes the selected/active lane
- When removing lanes, selection is preserved if the lane still exists
- If the selected lane is deleted, the last remaining lane becomes active
- Lane selection logic is in `src/lib/core/stores/session/lanes.ts`

See: `docs/adr/0001-lane-architecture.md`

### Dual State System
- **Editor Stores**: Temporary editing state for current lane
- **Project Store**: Persistent project data for all lanes
- **Sync Layer**: `laneModuleSync.ts` bridges the two

See: `docs/STATE_MANAGEMENT.md`

### Audio Engine
- Per-lane `Tone.Loop` for independent timing
- Shared `Tone.Transport` for synchronized playback
- Audio graph: `FMSynth → Gain → Panner → Destination`

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
├── audio/          # Audio engine (LaneRuntime, AudioManager)
├── modules/        # Module registry and definitions
├── services/       # Project persistence (LocalStorage)
├── stores/         # Svelte stores (state management)
├── types/          # TypeScript type definitions
├── *.svelte        # UI components
└── keyboard.ts     # Keyboard event dispatcher
```

### Component Patterns
- Keep components focused and single-purpose
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Props should be readonly unless explicitly mutable
- Emit custom events for parent communication

## Important Context Files

When working on specific areas, reference these files:

**State Management**:
- `src/lib/core/stores/session/transport.ts` - Playback control
- `src/lib/core/stores/session/lanes.ts` - Lane configuration & selection
- `src/lib/core/stores/data/projects.ts` - Project persistence
- `src/lib/core/stores/sync/laneModuleSync.ts` - Sync layer

**Audio**:
- `src/lib/audio/LaneRuntime.ts` - Per-lane audio engine
- `src/lib/audio/AudioManager.ts` - Global audio coordination

**Types**:
- `src/lib/types.ts` - Shared type definitions
- `src/lib/types/modules.ts` - Module system types

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
1. Test keyboard controls (arrow keys, space, 1-4, etc.)
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

## Notes

- This project is under active development
- Prefer existing patterns over introducing new ones unless justified
- Document architectural decisions in ADRs
- Keyboard-first workflow is a core design principle
