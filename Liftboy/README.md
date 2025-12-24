# Lift-Boy

A browser-based polyphonic audio sequencer with keyboard-first workflow. Built with Svelte + Tone.js.

## Features

### XOX Step Sequencer
- 64-step trigger pattern with configurable length (1-64)
- Per-step duration (0.25-4 steps)
- Per-step probability (0-100%)
- Clock subdivisions: 1/4, 1/8, 1/16, 1/32 notes
- Playback modes: forward, backward, random

### Melody Sequencer
- 32-bar pitch sequence
- Scale-based note values (0-7 → major scale)
- Per-bar glide/portamento toggle
- Per-bar randomization (±2 semitones)
- Skip divisor (advance melody every N triggers)
- Playback modes: forward, backward, random

### FM Synthesizer
- 5 waveforms: sine, square, triangle, sawtooth, AM triangle
- Harmonicity modulation (0-2)
- Modulation index (0-10)
- ADSR envelope
- Portamento/glide control

### Multi-Lane Architecture
- 1-12 simultaneous voices
- Independent sequencer + melody + synth per lane
- Per-lane volume, pan, and mute/solo
- Centered carousel lane selector with auto-selection
- Hot-swappable lane selection

### Project Management
- Multi-project support
- Browser LocalStorage persistence
- Project duplication
- Auto-save on changes

### Keyboard Controls
- Arrow keys: Navigate sections and slides
- Space: Play/Pause
- 1-4: Select input for editing
- T: Select BPM
- Escape: Clear selection

Full keyboard reference in [docs/KEYBOARD.md](docs/KEYBOARD.md)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run check
```

Visit [http://localhost:5173](http://localhost:5173)

## Browser Compatibility

**Requires**:
- Modern browser with Web Audio API support
  - Chrome 34+
  - Firefox 25+
  - Safari 14.1+
  - Edge 79+
- JavaScript ES6+
- LocalStorage API

**Not Supported**: IE11, older mobile browsers

## Project Structure

```
Liftboy/
├── src/
│   ├── lib/
│   │   ├── audio/          # Audio engine (Tone.js integration)
│   │   ├── modules/        # Module registry
│   │   ├── services/       # Project persistence
│   │   ├── stores/         # Svelte stores (state management)
│   │   ├── types/          # TypeScript type definitions
│   │   ├── *Sequencer.svelte   # UI components
│   │   └── keyboard.ts     # Keyboard event dispatcher
│   ├── App.svelte          # Root component
│   └── main.ts             # Entry point
├── docs/                   # Documentation
├── public/                 # Static assets
└── package.json
```

## Documentation

### Getting Started
- [Architecture Overview](docs/ARCHITECTURE.md) - System design and component relationships
- [Quick Start Guide](#quick-start) - Installation and setup

### Core Concepts
- [Audio Engine](docs/AUDIO_ENGINE.md) - Tone.js integration, LaneRuntime, and timing
- [State Management](docs/STATE_MANAGEMENT.md) - Svelte stores and sync patterns
- [Keyboard System](docs/KEYBOARD.md) - Input handling and event dispatch
- [Module System](docs/MODULES.md) - Extensibility and custom modules
- [Type Reference](docs/TYPES.md) - TypeScript types and interfaces

### Design Decisions
- [ADR 0001: Lane-Based Architecture](docs/adr/0001-lane-architecture.md)
- [ADR 0002: Snapshot Serialization](docs/adr/0002-snapshot-serialization.md)
- [ADR 0003: Store-Based State Management](docs/adr/0003-store-based-state.md)

## Development

### Commands

```bash
npm run dev         # Start dev server with HMR
npm run build       # Build for production
npm run preview     # Preview production build
npm run check       # TypeScript + Svelte type check
```

### Tech Stack

- **Framework**: Svelte 5
- **Build Tool**: Vite
- **Language**: TypeScript
- **Audio**: Tone.js (Web Audio wrapper)
- **State**: Svelte stores
- **Persistence**: Browser LocalStorage

### Key Libraries

- `tone@^15.0.4` - Audio synthesis and scheduling
- `svelte@^5.0.0` - Reactive UI framework
- `typescript@^5.0.0` - Type safety

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (2-space indents, semicolons)
- **Naming**:
  - Components: PascalCase (`XoxSequencer.svelte`)
  - Stores: camelCase (`sequencer.ts`, `melody.ts`)
  - Functions: camelCase (`toggleStepActive()`)
  - Types: PascalCase (`StepState`, `SequencerSnapshot`)

### State Management Patterns

**Stores**: Use Svelte writable/derived stores for all state
**Snapshots**: All persisted state uses JSON-serializable snapshots
**Immutability**: Always use `store.update()` for state changes

See [State Management docs](docs/STATE_MANAGEMENT.md) for details.

## Architecture Highlights

### Lane-Based Multi-Voice

Each lane is an independent voice with its own:
- Rhythm module (sequencer)
- Melody module
- Instrument module (synth)
- Effect module (future)
- Mixer settings (volume, pan, mute/solo)

See [ADR 0001](docs/adr/0001-lane-architecture.md) for rationale.

### Dual State System

- **Editor Stores**: Temporary editing state (current lane)
- **Project Store**: Persistent project data (all lanes)
- **Sync Layer**: `laneModuleSync.ts` bridges the two

See [State Management docs](docs/STATE_MANAGEMENT.md#synchronization-layer) for details.

### Audio Engine

- Per-lane Tone.Loop for independent timing
- Shared Tone.Transport for synchronized playback
- Audio graph: `FMSynth → Gain → Panner → Destination`
- Sample-accurate MIDI-based note triggering

See [Audio Engine docs](docs/AUDIO_ENGINE.md) for details.

## Usage Tips

### Keyboard Workflow

Lift-Boy is designed for keyboard-first workflow:

1. Use **arrow keys** to navigate sections (XOX, Melody, Synth)
2. Press **1-4** to select an input for editing
3. Use **up/down arrows** to adjust the selected input
4. Press **Space** to play/pause
5. Press **Escape** to clear selection

### Creating Patterns

1. **Rhythm**: Toggle steps in XOX grid, set pattern length
2. **Melody**: Adjust bar values (0-7) for pitch sequence
3. **Synth**: Tweak envelope and harmonicity for timbre
4. **Mix**: Adjust volume and pan per lane

### Multi-Lane Composition

1. Start with one lane (drums/rhythm)
2. Add lane 2 (bass line)
3. Add lane 3 (lead melody)
4. Use solo/mute to isolate lanes while composing

## Troubleshooting

### No Sound

1. Check browser audio isn't muted
2. Verify Web Audio API support (check console)
3. Ensure at least one step is active
4. Check step probability > 0%
5. Verify no lanes are in mute mode

### Timing Issues

1. Close other audio applications
2. Increase browser audio buffer size (in OS settings)
3. Reduce number of active lanes
4. Check CPU usage

### State Not Persisting

1. Ensure LocalStorage is enabled
2. Check browser storage quota
3. Clear browser cache and reload
4. Check console for errors

See [docs/AUDIO_ENGINE.md](docs/AUDIO_ENGINE.md#debugging) for more debugging tips.

## License

[To be determined]

## Credits

Built with:
- [Svelte](https://svelte.dev/) - Cybernetically enhanced web apps
- [Tone.js](https://tonejs.github.io/) - Web Audio framework
- [Vite](https://vitejs.dev/) - Next generation frontend tooling

---

**Note**: This project is under active development. Features and API may change.
