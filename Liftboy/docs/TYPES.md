# Type Reference

## Overview

This document provides a comprehensive reference of all TypeScript types and interfaces used in Lift-Boy. Types are organized by domain: projects, modules, sequencer, audio, and UI.

## Project Types

### Project

Top-level container for all project data.

```typescript
interface Project {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // User-provided name
  tempo: number;                 // BPM (40-240)
  lanes: Lane[];                 // Array of lanes (1-12)
  meta: ProjectMeta;             // Metadata
}
```

**Example**:
```typescript
{
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  name: 'My Track',
  tempo: 128,
  lanes: [/* Lane objects */],
  meta: {
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T12:30:00Z'
  }
}
```

### Lane

Individual voice/track in a project.

```typescript
interface Lane {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // User-provided name
  order: number;                 // Display order (0-3)
  modules: LaneModules;          // Module instances
  mixer: MixerSettings;          // Volume, pan, mode
}
```

**Example**:
```typescript
{
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  name: 'Bass',
  order: 0,
  modules: {/* LaneModules */},
  mixer: {
    volume: 0.8,
    pan: -0.2,
    mode: 'on'
  }
}
```

### LaneModules

Container for all module instances in a lane.

```typescript
interface LaneModules {
  rhythm: ModuleInstance;        // Trigger pattern generator
  melody: ModuleInstance;        // Note sequence generator
  instrument: ModuleInstance;    // Sound synthesizer
  effect: ModuleInstance;        // Audio processor
}
```

**Constraint**: Exactly one module per category.

### ModuleInstance

Runtime instance of a module with state.

```typescript
interface ModuleInstance {
  id: string;                    // Unique instance ID (UUID)
  definitionId: string;          // Reference to ModuleDefinition.id
  state: unknown;                // Module-specific state (JSON-serializable)
  bypassed: boolean;             // If true, module is inactive
}
```

**Example**:
```typescript
{
  id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  definitionId: 'rhythm.xox-basic',
  state: {
    steps: [/* StepState[] */],
    settings: {/* SequencerSettings */}
  },
  bypassed: false
}
```

### MixerSettings

Per-lane mixer controls.

```typescript
interface MixerSettings {
  volume: number;                // 0-1 (linear gain)
  pan: number;                   // -1 (left) to 1 (right)
  mode: LaneMode;                // 'on' | 'mute' | 'solo'
}
```

**LaneMode**:
```typescript
type LaneMode = 'on' | 'mute' | 'solo';
```

- `on`: Normal playback
- `mute`: Silent
- `solo`: Only solo lanes play (mutes all non-solo lanes)

### ProjectMeta

Project metadata.

```typescript
interface ProjectMeta {
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

### ProjectsSnapshot

Persistence format for all projects.

```typescript
interface ProjectsSnapshot {
  projects: Project[];           // All saved projects
  activeProjectId: string | null; // Currently selected project
}
```

**Storage**: Saved to `localStorage` as `liftboy.projects.v1`.

## Module Types

### ModuleDefinition

Static definition of a module type.

```typescript
interface ModuleDefinition {
  id: string;                    // Unique identifier (e.g., "rhythm.xox-basic")
  category: ModuleCategory;      // Module category
  label?: string;                // Display name
  version: number;               // Schema version
  defaultState: unknown;         // Default state snapshot
}
```

### ModuleCategory

Four module categories per lane.

```typescript
type ModuleCategory = 'rhythm' | 'melody' | 'instrument' | 'effect';
```

## Sequencer Types (Rhythm Module)

### StepState

Single step in the XOX sequencer.

```typescript
interface StepState {
  id: string;                    // Unique identifier (e.g., "step-0")
  active: boolean;               // If true, triggers on this step
  duration: number;              // Note length in steps (0.25-4)
  probability: number;           // Chance of triggering (0-100%)
}
```

**Constraints**:
- `duration`: 0.25 to 4 (allows 1/4 step to 4 steps)
- `probability`: 0 to 100

**Example**:
```typescript
{
  id: 'step-0',
  active: true,
  duration: 1.5,     // 1.5 steps long
  probability: 75    // 75% chance to trigger
}
```

### SequencerSettings

Global settings for the step sequencer.

```typescript
interface SequencerSettings {
  length: number;                // Pattern length (1-64 steps)
  clockIndex: number;            // Subdivision index (0-3)
  orderIndex: number;            // Playback order index (0-2)
}
```

**Clock Subdivisions** (clockIndex):
- `0`: Quarter notes (4n)
- `1`: Eighth notes (8n)
- `2`: Sixteenth notes (16n)
- `3`: Thirty-second notes (32n)

**Playback Orders** (orderIndex):
- `0`: Forward
- `1`: Backward
- `2`: Random

### SequencerSnapshot

Serializable state for rhythm module.

```typescript
interface SequencerSnapshot {
  steps: StepState[];            // All 64 steps
  settings: SequencerSettings;   // Pattern settings
}
```

### StepOrder

Playback order enum.

```typescript
type StepOrder = 'forward' | 'backward' | 'random';
```

## Melody Types (Melody Module)

### BarState

Single bar in the melody sequencer.

```typescript
interface BarState {
  id: string;                    // Unique identifier (e.g., "bar-0")
  value: number;                 // Note value (0-7, maps to scale)
  glide: boolean;                // Enable portamento
  randomize: boolean;            // Add random pitch variation
}
```

**Note Values** (major scale):
- `0`: Root (C)
- `1`: Major 2nd (D)
- `2`: Major 3rd (E)
- `3`: Perfect 4th (F)
- `4`: Perfect 5th (G)
- `5`: Major 6th (A)
- `6`: Major 7th (B)
- `7`: Octave (C)

### MelodySettings

Global settings for the melody sequencer.

```typescript
interface MelodySettings {
  length: number;                // Sequence length (1-32 bars)
  skipIndex: number;             // Skip divisor index (0-4)
  orderIndex: number;            // Playback order index (0-2)
}
```

**Skip Divisors** (skipIndex):
- `0`: None (advance every trigger)
- `1`: 2x (advance every 2 triggers)
- `2`: 3x (advance every 3 triggers)
- `3`: 4x (advance every 4 triggers)

### MelodySnapshot

Serializable state for melody module.

```typescript
interface MelodySnapshot {
  bars: BarState[];              // All 32 bars
  settings: MelodySettings;      // Sequence settings
}
```

## Synth Types (Instrument Module)

### SynthSnapshot

Complete synth state.

```typescript
interface SynthSnapshot {
  oscillator: OscillatorState;   // Carrier oscillator
  modulation: ModulationState;   // FM modulator
  envelope: EnvelopeState;       // ADSR envelope
  portamento: number;            // Glide time (0-1 seconds)
}
```

### OscillatorState

Oscillator settings.

```typescript
interface OscillatorState {
  wave: WaveType;                // Waveform type
  harmonicity: number;           // Frequency multiplier (0-2)
}
```

### ModulationState

FM modulation settings.

```typescript
interface ModulationState {
  wave: WaveType;                // Modulator waveform
  index: number;                 // Modulation depth (0-10)
}
```

### EnvelopeState

ADSR envelope.

```typescript
interface EnvelopeState {
  attack: number;                // Attack time (0-2 seconds)
  decay: number;                 // Decay time (0-2 seconds)
  sustain: number;               // Sustain level (0-1)
  release: number;               // Release time (0-10 seconds)
}
```

### WaveType

Oscillator waveform types.

```typescript
type WaveType = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'amtriangle';
```

**Waveforms**:
- `sine`: Pure tone, smooth
- `square`: Hollow, clarinet-like
- `triangle`: Softer square wave
- `sawtooth`: Bright, brassy
- `amtriangle`: Amplitude-modulated triangle

## Audio Engine Types

### LaneRuntime

Internal audio engine representation of a lane.

```typescript
interface LaneRuntime {
  // Identity
  laneId: string;                // Reference to Lane.id
  laneIndex: number;             // Position in lanes array (0-3)

  // Audio nodes
  synth: Tone.FMSynth;           // Tone.js synthesizer
  gainNode: Tone.Gain;           // Volume control
  pannerNode: Tone.Panner;       // Stereo panning

  // Timing
  loop: Tone.Loop | null;        // Subdivision-based loop
  stepPointer: number;           // Current step position
  melodyPointer: number;         // Current bar position
  skipIndex: number;             // Skip divisor counter

  // State snapshots (cached)
  sequencer: SequencerSnapshot;
  melody: MelodySnapshot;
  synth: SynthSnapshot;
  steps: StepState[];
  bars: BarState[];
  mixer: MixerSettings;
}
```

**Note**: This is an internal type not exposed to UI or persistence.

## UI Types

### SectionKind

Sequencer section identifiers.

```typescript
type SectionKind = 'xox' | 'melody' | 'synth';
```

Maps to:
- `xox`: XOX step sequencer
- `melody`: Melody bar sequencer
- `synth`: Synth parameter editor

### SectionData

Section metadata for navigation.

```typescript
interface SectionData {
  name: string;                  // Display name
  kind: SectionKind;             // Section type
  slides: SlideData[];           // Slides in this section
}
```

**Example**:
```typescript
{
  name: 'XOX Sequencer',
  kind: 'xox',
  slides: [
    { id: 'steps-grid', label: 'Steps' },
    { id: 'pattern-settings', label: 'Pattern' },
    { id: 'timing-settings', label: 'Timing' }
  ]
}
```

### SlideData

Individual slide in a section.

```typescript
interface SlideData {
  id: string;                    // Unique identifier
  label: string;                 // Display name
  inputs?: SlideInput[];         // Input controls (optional)
}
```

### SlideInput

Input control definition.

```typescript
interface SlideInput {
  key: string;                   // Store property key
  value: any;                    // Current value
  unit?: string;                 // Display unit (e.g., "ms", "%")
  options?: string[];            // Options for select inputs
  min?: number;                  // Min value for range inputs
  max?: number;                  // Max value for range inputs
  step?: number;                 // Step size for range inputs
}
```

**Example**:
```typescript
{
  key: 'duration',
  value: 1.5,
  unit: 'steps',
  min: 0.25,
  max: 4,
  step: 0.25
}
```

### KeyboardEventType

Custom keyboard event types.

```typescript
type KeyboardEventType =
  | 'scroll-next-section'
  | 'scroll-prev-section'
  | 'scroll-next-slide'
  | 'scroll-prev-slide'
  | 'select-input'
  | 'clear-input-selection'
  | 'adjust-input-up'
  | 'adjust-input-down'
  | 'increment-input'
  | 'select-bpm'
  | 'clear-bpm-selection'
  | 'adjust-bpm-up'
  | 'adjust-bpm-down'
  | 'toggle-playback'
  | 'open-module-selector';
```

**Event Detail Interface**:
```typescript
interface KeyboardEventDetail {
  type: KeyboardEventType;
  inputIndex?: number;  // Which input (0-3) is selected
  magnitude?: number;   // Increment size (always 1 currently)
}
```

**Key Events**:
- `increment-input`: Emitted on quick tap (<200ms) of number keys 1-4
- `adjust-input-up/down`: Emitted when holding number key + pressing arrows
- `scroll-*`: Navigation events when no input is selected
- `select-input`: Emitted on number key press (hold mode)
- `clear-input-selection`: Emitted on number key release

## Utility Types

### Range

Numeric range definition.

```typescript
interface Range {
  min: number;
  max: number;
  step?: number;
}
```

**Example**:
```typescript
const durationRange: Range = {
  min: 0.25,
  max: 4,
  step: 0.25
};
```

## Constants

### Sequencer Constants

```typescript
const TOTAL_STEPS = 64;
const DURATION_MIN = 0.25;
const DURATION_MAX = 4;
const PROBABILITY_MIN = 0;
const PROBABILITY_MAX = 100;
const PATTERN_LENGTH_MIN = 1;
const PATTERN_LENGTH_MAX = 64;

const CLOCK_SUBDIVISIONS = ['4n', '8n', '16n', '32n'];
const STEP_ORDERS = ['forward', 'backward', 'random'];
```

### Melody Constants

```typescript
const TOTAL_BARS = 32;
const BAR_VALUE_MIN = 0;
const BAR_VALUE_MAX = 7;
const MELODY_LENGTH_MIN = 1;
const MELODY_LENGTH_MAX = 32;

const SKIP_DIVISORS = [1, 2, 3, 4];  // None, 2x, 3x, 4x
const MELODY_ORDERS = ['forward', 'backward', 'random'];
```

### Synth Constants

```typescript
const HARMONICITY_MIN = 0;
const HARMONICITY_MAX = 2;
const MODULATION_INDEX_MIN = 0;
const MODULATION_INDEX_MAX = 10;

const ATTACK_MIN = 0;
const ATTACK_MAX = 2;
const DECAY_MIN = 0;
const DECAY_MAX = 2;
const SUSTAIN_MIN = 0;
const SUSTAIN_MAX = 1;
const RELEASE_MIN = 0;
const RELEASE_MAX = 10;
const PORTAMENTO_MIN = 0;
const PORTAMENTO_MAX = 1;

const WAVE_TYPES: WaveType[] = [
  'sine',
  'square',
  'triangle',
  'sawtooth',
  'amtriangle'
];
```

### Audio Constants

```typescript
const BASE_MIDI = 48;  // C3
const SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];  // Major scale (semitones)
```

### Transport Constants

```typescript
const BPM_MIN = 40;
const BPM_MAX = 240;
const BPM_DEFAULT = 120;
```

## Type Guards

### isProject

```typescript
function isProject(obj: any): obj is Project {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.tempo === 'number' &&
    Array.isArray(obj.lanes) &&
    typeof obj.meta === 'object'
  );
}
```

### isLane

```typescript
function isLane(obj: any): obj is Lane {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.order === 'number' &&
    typeof obj.modules === 'object' &&
    typeof obj.mixer === 'object'
  );
}
```

### isStepState

```typescript
function isStepState(obj: any): obj is StepState {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.active === 'boolean' &&
    typeof obj.duration === 'number' &&
    typeof obj.probability === 'number'
  );
}
```

## Type Conversions

### MIDI to Frequency

```typescript
function midiToFrequency(midiNote: number): string {
  return Tone.Frequency(midiNote, 'midi').toNote();
}
```

**Example**:
```typescript
midiToFrequency(48)  // "C3"
midiToFrequency(60)  // "C4"
```

### Bar Value to MIDI

```typescript
function barValueToMidi(barValue: number): number {
  const scaleOffset = SCALE_OFFSETS[Math.floor(barValue)];
  return BASE_MIDI + scaleOffset;
}
```

**Example**:
```typescript
barValueToMidi(0)  // 48 (C3)
barValueToMidi(4)  // 55 (G3)
barValueToMidi(7)  // 60 (C4)
```

### Subdivision to Duration

```typescript
function subdivisionToSeconds(subdivision: string, bpm: number): number {
  const beatDuration = 60 / bpm;  // Seconds per beat

  switch (subdivision) {
    case '4n': return beatDuration;
    case '8n': return beatDuration / 2;
    case '16n': return beatDuration / 4;
    case '32n': return beatDuration / 8;
    default: return beatDuration / 4;
  }
}
```

**Example** (120 BPM):
```typescript
subdivisionToSeconds('4n', 120)   // 0.5s
subdivisionToSeconds('8n', 120)   // 0.25s
subdivisionToSeconds('16n', 120)  // 0.125s
```

## Type Usage Examples

### Creating a New Project

```typescript
import { v4 as uuid } from 'uuid';
import type { Project, Lane, ModuleInstance } from '$lib/types/project';

function createNewProject(): Project {
  return {
    id: uuid(),
    name: 'Untitled Project',
    tempo: 120,
    lanes: [createDefaultLane()],
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

function createDefaultLane(): Lane {
  return {
    id: uuid(),
    name: 'Lane 1',
    order: 0,
    modules: {
      rhythm: createModuleInstance('rhythm.xox-basic'),
      melody: createModuleInstance('melody.melody-basic'),
      instrument: createModuleInstance('instrument.synth-simple'),
      effect: createModuleInstance('effect.none')
    },
    mixer: {
      volume: 0.8,
      pan: 0,
      mode: 'on'
    }
  };
}
```

### Type-Safe Store Updates

```typescript
import type { StepState } from '$lib/types';

function toggleStep(steps: StepState[], index: number): StepState[] {
  return steps.map((step, i) =>
    i === index
      ? { ...step, active: !step.active }
      : step
  );
}
```

### Type-Safe Event Handlers

```typescript
import type { KeyboardEventType } from '$lib/types';

function handleKeyboardEvent(
  type: KeyboardEventType,
  detail?: { inputIndex?: number }
) {
  switch (type) {
    case 'arrow-up':
      if (detail?.inputIndex !== undefined) {
        adjustInput(detail.inputIndex, +1);
      }
      break;
    case 'toggle-playback':
      togglePlayback();
      break;
    // ...
  }
}
```

## Type Documentation Best Practices

1. **Always export types**: Make them available for import
2. **Use JSDoc**: Add descriptions for complex types
3. **Provide examples**: Show usage in comments
4. **Define constraints**: Document valid ranges
5. **Use discriminated unions**: For type narrowing

**Example**:
```typescript
/**
 * Step state in XOX sequencer
 *
 * @property id - Unique identifier (e.g., "step-0")
 * @property active - If true, triggers on this step
 * @property duration - Note length in steps (0.25-4)
 * @property probability - Chance of triggering (0-100%)
 *
 * @example
 * const step: StepState = {
 *   id: 'step-0',
 *   active: true,
 *   duration: 1.5,
 *   probability: 75
 * };
 */
export interface StepState {
  id: string;
  active: boolean;
  duration: number;
  probability: number;
}
```

## Further Reading

- [Architecture](ARCHITECTURE.md) - How types fit into system design
- [State Management](STATE_MANAGEMENT.md) - Store types and patterns
- [Modules](MODULES.md) - Module type system
- [Audio Engine](AUDIO_ENGINE.md) - Audio-specific types
