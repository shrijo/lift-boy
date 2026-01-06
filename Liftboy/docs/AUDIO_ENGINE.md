# Audio Engine Documentation

## Overview

The audio engine (`src/lib/audio/engine.ts`) is the core of Lift-Boy's sound generation. It:
- Manages Tone.js audio graph and timing
- Maintains per-lane audio state (LaneRuntime)
- Syncs with Svelte stores for reactive updates
- Schedules MIDI-based note playback

## Architecture

```
Svelte Stores (lanes, bpm)
         ↓
    [Subscribe]
         ↓
   Audio Engine
         ↓
   ┌─────────────────────────┐
   │  LaneRuntime (internal) │
   │  - FMSynth nodes        │
   │  - Tone.Loop            │
   │  - Step/melody pointers │
   └─────────────────────────┘
         ↓
   Tone.Transport
         ↓
   Web Audio API
         ↓
   Audio Output
```

## Key Concepts

### 1. LaneRuntime

**Purpose**: Internal representation of a lane's audio state.

**Structure**:
```typescript
interface LaneRuntime {
  // Identity
  id: string;

  // Module type tracking
  rhythmModuleId: string;     // e.g., "rhythm.xox-basic" | "rhythm.euclidean" | "rhythm.m185"
  melodyModuleId: string;     // e.g., "melody.melody-basic" | "melody.stochastic"
  instrumentModuleId: string; // e.g., "instrument.synth-simple" | "instrument.kick" | "instrument.hihat"
  effectModuleIds: string[];  // e.g., ["effect.delay"], ["effect.reverb"], []

  // Audio nodes
  synth: Tone.FMSynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth | null; // Synthesizer (type varies by instrument)
  delayNode: Tone.FeedbackDelay | null; // Delay effect (optional)
  reverbNode: Tone.Reverb | null;       // Reverb effect (optional)
  gain: Tone.Gain | null;               // Volume control
  pan: Tone.Panner | null;              // Stereo panning

  // Timing
  loop: Tone.Loop | null;     // Subdivision-based timing loop
  subdivision: string;        // e.g., "16n"

  // Rhythm module states (module-specific)
  steps: StepState[];           // XOX sequencer
  sequencer: SequencerSettings; // XOX settings
  euclideanSteps: number;       // Euclidean total steps
  euclideanPulses: number;      // Euclidean pulse count
  euclideanRotation: number;    // Euclidean rotation offset
  euclideanSettings: {...};     // Euclidean settings
  m185Entries: M185Entry[];     // M185 entries
  m185Settings: {...};          // M185 settings

  // Melody module states
  bars: BarState[];             // Basic melody
  melody: MelodySettings;       // Basic melody settings
  stochasticMinNote: number;    // Stochastic range min
  stochasticMaxNote: number;    // Stochastic range max
  stochasticChangeProb: number; // Stochastic change probability
  stochasticCurrentNote: number; // Stochastic current note

  // Instrument states (module-specific)
  synthState: SynthState;       // FM synth
  kickState: KickState;         // Kick drum
  hihatState: HihatState;       // Hi-hat
  snareState: SnareState;       // Snare drum
  congaState: CongaState;       // Conga drum
  clapState: ClapState;         // Hand clap

  // Effect states
  delayState: DelaySnapshot;
  reverbState: ReverbSnapshot;

  // Playback pointers
  stepPointer: number;        // Current step in rhythm pattern
  melodyPointer: number;      // Current bar in melody sequence
  triggerCounter: number;     // For melody skip logic

  // Mixer settings
  mixer: LaneMixer;
  mode: LaneMode;
}
```

**Lifecycle**:
1. Created by `createLaneRuntime()` when lane added
2. Hydrated with state via `hydrateLaneRuntime()`
3. Audio nodes created via `ensureLaneNodes()`
4. Loop created via `rebuildLaneLoop()`
5. Destroyed when lane removed

### 2. Tone.Loop Per Lane

Each lane has an independent `Tone.Loop` that fires at the clock subdivision interval:

```typescript
const loop = new Tone.Loop((time) => {
  tickLane(runtime, time);
}, subdivision);  // e.g., "8n" = 8th note
```

**Why per-lane loops?**
- Independent clock subdivisions (lane 1: 16th notes, lane 2: 8th notes)
- Mute/solo logic per lane
- Easy to add/remove lanes without affecting others

**Timing**:
- All loops share `Tone.Transport` (master clock)
- BPM set globally on transport
- Loops fire in sync despite different subdivisions

### 3. Module-Aware Dispatching

**Purpose**: Route audio processing to the correct handler based on active module type.

**Dispatcher Pattern**:
```typescript
function tickLane(runtime: LaneRuntime, time: number) {
  if (!shouldPlayLane(runtime)) return;

  // Dispatch to appropriate rhythm handler
  if (runtime.rhythmModuleId === "rhythm.euclidean") {
    tickLaneEuclidean(runtime, time);
  } else if (runtime.rhythmModuleId === "rhythm.m185") {
    tickLaneM185(runtime, time);
  } else {
    // Default: XOX sequencer
    tickLaneXox(runtime, time);
  }
}

function triggerLaneMelody(runtime: LaneRuntime, step: StepState, time: number) {
  // Dispatch to appropriate melody handler
  if (runtime.melodyModuleId === "melody.stochastic") {
    triggerLaneMelodyStochastic(runtime, step, time);
  } else {
    // Default: Basic melody sequencer
    triggerLaneMelodyBasic(runtime, step, time);
  }
}
```

**Module Handlers**:
- `tickLaneXox()` - XOX step sequencer logic
- `tickLaneEuclidean()` - Bjorklund algorithm generation
- `tickLaneM185()` - Entry-based sequencing
- `triggerLaneMelodyBasic()` - 32-bar melody sequencer
- `triggerLaneMelodyStochastic()` - Random note generation

**Audio Chain**:
```
Synth → [Delay (optional)] → [Reverb (optional)] → Gain → Pan → Destination
```

Effect nodes are created conditionally based on `effectModuleIds`.

### 4. Pointers

**Step Pointer**: Tracks current position in rhythm pattern
- Advances on each tick
- Wraps based on module type (XOX: at `sequencer.length`, Euclidean: at `euclideanSteps`)
- Respects playback order (forward, backward, random)

**Melody Pointer**: Tracks current position in bar sequence
- Advances on each **active step trigger**
- Wraps at `melody.length`
- Respects skip divisor and playback order

**Example**:
```
Step sequence:   [X _ X _ X _ X _]  (X = active, _ = inactive)
Step pointer:     0 1 2 3 4 5 6 7
Melody pointer:   0 - 1 - 2 - 3 -   (advances only on X)
```

### 4. Audio Graph

**Per-Lane Chain**:
```
FMSynth → Gain → Panner → Destination
```

**Multi-Lane Mixing**:
```
Lane 1: [Synth → Gain → Pan] ↘
Lane 2: [Synth → Gain → Pan] → Master Out
Lane 3: [Synth → Gain → Pan] ↗
Lane 4: [Synth → Gain → Pan] ↗
```

**Node Types**:
- `Tone.FMSynth`: FM synthesis with modulator and carrier
- `Tone.Gain`: Volume control (0-1 mapped to dB)
- `Tone.Panner`: Stereo positioning (-1 = left, 1 = right)
- `Tone.Destination`: Master output (speakers/headphones)

## Core Functions

### ensureInitialized()

**Purpose**: Initialize audio engine and start subscriptions.

**Flow**:
```
1. Start Tone.Transport (Web Audio context)
2. Subscribe to lanes store
   → syncLaneRuntimes() on change
3. Subscribe to bpm store
   → Update Tone.Transport.bpm
4. Subscribe to selectedLaneIndex store
   → Track which lane is being edited
5. Create initial lane runtimes
```

**When called**: On app mount, before any playback.

### syncLaneRuntimes(lanes: Lane[])

**Purpose**: Keep LaneRuntime array in sync with lanes store.

**Operations**:
```typescript
// Add new lanes
for (const lane of lanes) {
  if (!runtimeExists(lane.id)) {
    createLaneRuntime(lane);
    hydrateLaneRuntime(runtime, lane);
    ensureLaneNodes(runtime);
    rebuildLaneLoop(runtime);
  }
}

// Remove deleted lanes
for (const runtime of runtimes) {
  if (!laneExists(runtime.laneId)) {
    destroyLaneRuntime(runtime);
  }
}

// Update existing lanes
for (const runtime of runtimes) {
  hydrateLaneRuntime(runtime, findLane(runtime.laneId));
  syncLaneNodes(runtime);  // Volume, pan, synth params
}
```

**Triggers**: Whenever `lanes` store changes (lane added/removed/updated).

### hydrateLaneRuntime(runtime, lane)

**Purpose**: Copy state from lane (projects store) into runtime.

**What's copied**:
```typescript
runtime.sequencer = lane.modules.rhythm.state;
runtime.melody = lane.modules.melody.state;
runtime.synth = lane.modules.instrument.state;
runtime.mixer = lane.mixer;

// Sanitize and expand
runtime.steps = sanitizeSteps(runtime.sequencer.steps);
runtime.bars = sanitizeBars(runtime.melody.bars);
```

**Why sanitize?**
- Validates loaded state (e.g., duration in valid range)
- Provides defaults for missing properties
- Prevents crashes from corrupted LocalStorage

### ensureLaneNodes(runtime)

**Purpose**: Create Tone.js audio nodes if they don't exist.

**Node Creation**:
```typescript
async function ensureLaneNodes(runtime: LaneRuntime) {
  if (runtime.synth) return; // Already initialized

  // Create synth based on instrument module type
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
      envelope: { attack: runtime.snareState.snap * 0.01, decay: runtime.snareState.decay, sustain: 0, release: 0.01 },
    });
  } else if (runtime.instrumentModuleId === "instrument.conga") {
    runtime.synth = new Tone.MembraneSynth({
      pitchDecay: runtime.congaState.pitchDecay,
      octaves: runtime.congaState.tone * 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: runtime.congaState.decay, sustain: 0, release: 0.01 },
    });
  } else if (runtime.instrumentModuleId === "instrument.clap") {
    runtime.synth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: runtime.clapState.decay, sustain: 0, release: 0.01 },
    });
  } else {
    // Default: FM synth
    runtime.synth = new Tone.FMSynth();
  }

  runtime.gain = new Tone.Gain(runtime.mixer.volume);
  runtime.pan = new Tone.Panner(runtime.mixer.pan);

  // Create effect nodes conditionally
  if (runtime.effectModuleIds.includes("effect.delay")) {
    runtime.delayNode = new Tone.FeedbackDelay({
      delayTime: runtime.delayState.time,
      feedback: runtime.delayState.feedback,
      wet: runtime.delayState.mix,
    });
  }

  if (runtime.effectModuleIds.includes("effect.reverb")) {
    const finalDecay = runtime.reverbState.roomSize * runtime.reverbState.decay;
    runtime.reverbNode = new Tone.Reverb({
      decay: finalDecay,
      preDelay: runtime.reverbState.preDelay,
      wet: runtime.reverbState.mix,
    });
    // IMPORTANT: Reverb requires async impulse response generation
    await runtime.reverbNode.generate();
  }

  // Connect audio chain
  let chainStart = runtime.synth;

  if (runtime.delayNode) {
    chainStart.connect(runtime.delayNode);
    chainStart = runtime.delayNode;
  }

  if (runtime.reverbNode) {
    chainStart.connect(runtime.reverbNode);
    chainStart = runtime.reverbNode;
  }

  chainStart.connect(runtime.gain);
  runtime.gain.connect(runtime.pan);
  runtime.pan.toDestination();
}
```

**Connection Order**: `Synth → [Delay] → [Reverb] → Gain → Pan → Destination`

**Important Notes**:
- Function is **async** to await reverb generation
- All callers (`syncLaneRuntimes`, `prepareAllLaneRuntimes`) must await this function
- Effect nodes are created conditionally based on `effectModuleIds`
- Reverb impulse response must be generated before audio can pass through

### rebuildReverbNode(runtime)

**Purpose**: Recreate reverb node when decay or roomSize changes.

**Why Needed**: Tone.Reverb requires regenerating the impulse response when decay changes. You cannot simply update the `decay` parameter on an existing reverb node.

**Process**:
```typescript
async function rebuildReverbNode(runtime: LaneRuntime) {
  // Find previous node in chain
  let chainStart = runtime.synth;
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

  // Create and generate new reverb
  const finalDecay = runtime.reverbState.roomSize * runtime.reverbState.decay;
  runtime.reverbNode = new Tone.Reverb({
    decay: finalDecay,
    preDelay: runtime.reverbState.preDelay,
    wet: runtime.reverbState.mix,
  });
  await runtime.reverbNode.generate();

  // Reconnect chain
  chainStart.connect(runtime.reverbNode);
  runtime.reverbNode.connect(runtime.gain);
}
```

**When Called**:
- During `syncLaneRuntimes()` when decay or roomSize changes
- After detecting parameter changes via comparison with previous values

**Updatable Parameters**:
- **Require rebuild**: `decay`, `roomSize` (changes final decay time)
- **Update in place**: `preDelay`, `wet` (mix) - via `.set()`

### applyLaneSynthState(runtime)

**Purpose**: Update node parameters to match runtime state.

**Parameters Updated**:
```typescript
// Synth parameters (FM Synth)
if (runtime.instrumentModuleId === "instrument.synth-simple") {
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

// Drum parameters are applied during synth creation (ensureLaneNodes)
// and may require rebuilding the synth node for certain parameters

// Delay parameters (if delay node exists)
if (runtime.delayNode) {
  runtime.delayNode.set({
    delayTime: runtime.delayState.time,
    feedback: runtime.delayState.feedback,
    wet: runtime.delayState.mix,
  });
}

// Reverb parameters (only preDelay and wet can be updated)
// decay and roomSize require rebuilding the node
if (runtime.reverbNode) {
  runtime.reverbNode.set({
    preDelay: runtime.reverbState.preDelay,
    wet: runtime.reverbState.mix,
  });
}
```

### applyLaneMixer(runtime)

**Purpose**: Update mixer parameters (volume and pan).

**Parameters Updated**:
```typescript
runtime.gain.gain.value = runtime.mixer.volume;
runtime.pan.pan.value = runtime.mixer.pan;
```

**Triggers**: After hydration, when mixer/synth settings change.

### rebuildLaneLoop(runtime)

**Purpose**: Create or recreate the Tone.Loop for a lane.

**When Called**:
- Lane created
- Clock subdivision changed (e.g., 16th → 8th notes)

**Process**:
```typescript
// Dispose old loop
if (runtime.loop) {
  runtime.loop.stop();
  runtime.loop.dispose();
}

// Create new loop
const subdivision = CLOCK_SUBDIVISIONS[runtime.sequencer.settings.clockIndex];
runtime.loop = new Tone.Loop((time) => {
  tickLane(runtime, time);
}, subdivision);

// Start if transport is playing
if (Tone.Transport.state === 'started') {
  runtime.loop.start(0);
}
```

**Subdivision Values**: `["4n", "8n", "16n", "32n"]` (quarter, eighth, sixteenth, thirty-second notes)

### tickLane(runtime, time)

**Purpose**: Execute one tick of a lane's sequencer.

**Flow**:
```typescript
1. Check if lane should play (mute/solo logic)
2. Get next step index based on playback order
3. Read step from runtime.steps[stepIndex]
4. Update UI playback indicator (if this is the edited lane)
5. Skip if step is inactive
6. Skip if probability roll fails (Math.random() * 100 > step.probability)
7. Call triggerLaneMelody() to play notes
8. Advance step pointer
```

**Critical**: Uses `time` parameter from Tone.Loop for sample-accurate scheduling.

### triggerLaneMelody(runtime, step, time)

**Purpose**: Play melody notes based on current bar.

**Flow**:
```typescript
1. Get next bar index based on melody playback order
2. Read bar from runtime.bars[barIndex]
3. Skip if skip divisor check fails
4. Determine note/pitch based on instrument type:

   For melodic instruments (synth-simple):
   - Convert bar.value (0-7) to MIDI note:
     - BASE_MIDI = 48 (C3)
     - scaleOffset = SCALE_OFFSETS[bar.value]
     - midiNote = BASE_MIDI + scaleOffset
   - Apply randomness if bar.randomize is true:
     - midiNote += random(-2, 2) semitones
   - Convert MIDI to frequency: Tone.Frequency(midiNote, "midi").toNote()

   For drum instruments (kick, hihat, snare, conga, clap):
   - Use fixed pitch/frequency regardless of melody value
   - Kick: runtime.kickState.pitch (Hz)
   - Hi-hat: 200 (Hz, fixed)
   - Snare: "C4" (NoiseSynth doesn't use pitch)
   - Conga: runtime.congaState.pitch (Hz)
   - Clap: "C4" (NoiseSynth doesn't use pitch)

5. Calculate note duration from step.duration
6. Check glide settings for portamento (melodic instruments only)
7. Trigger synth:
   runtime.synth.triggerAttackRelease(note, duration, time)
8. Advance melody pointer
9. Update UI melody indicator
```

**Scale** (melodic instruments): Major scale offsets `[0, 2, 4, 5, 7, 9, 11, 12]` (semitones)

**Drum Behavior**: Drum instruments ignore melody note values and always play at their configured pitch. This allows rhythm patterns to trigger consistent drum sounds while still using the same melody sequencer infrastructure.

### nextLaneStepIndex(runtime, length)

**Purpose**: Get next step index based on playback order.

**Orders**:
```typescript
// Forward: 0, 1, 2, 3, ...
stepPointer = (stepPointer + 1) % length;

// Backward: ..., 3, 2, 1, 0
stepPointer = (stepPointer - 1 + length) % length;

// Random: any index
stepPointer = Math.floor(Math.random() * length);
```

**Returns**: Next index and updates `runtime.stepPointer`

### nextLaneMelodyIndex(runtime, length)

**Purpose**: Get next bar index based on melody playback order.

**Skip Divisor Logic**:
```typescript
// skipIndex tracks trigger count
runtime.skipIndex = (runtime.skipIndex + 1) % skipDivisor;

// Only advance melody pointer every Nth trigger
if (runtime.skipIndex === 0) {
  melodyPointer = calculateNextBarIndex(runtime, length);
}
```

**Example**: Skip divisor = 2 means melody advances every 2 steps.

### shouldPlayLane(runtime)

**Purpose**: Check if lane should produce sound.

**Logic**:
```typescript
const mode = runtime.mixer.mode;
const anyLaneSolo = runtimes.some(r => r.mixer.mode === 'solo');

if (mode === 'mute') return false;
if (anyLaneSolo && mode !== 'solo') return false;
return true;
```

**Modes**:
- `on`: Normal playback
- `mute`: Silent
- `solo`: Only solo lanes play (mutes all non-solo)

## State Sanitization

### Why Sanitize?

LocalStorage can be corrupted by:
- Manual edits
- Schema changes
- Browser bugs

Sanitization ensures audio engine never crashes from bad data.

### sanitizeSteps(steps)

```typescript
const TOTAL_STEPS = 64;
const DURATION_MIN = 0.25, DURATION_MAX = 4;
const PROBABILITY_MIN = 0, PROBABILITY_MAX = 100;

return Array.from({ length: TOTAL_STEPS }, (_, i) => ({
  id: steps[i]?.id ?? `step-${i}`,
  active: steps[i]?.active ?? false,
  duration: clamp(steps[i]?.duration ?? 1, DURATION_MIN, DURATION_MAX),
  probability: clamp(steps[i]?.probability ?? 100, PROBABILITY_MIN, PROBABILITY_MAX)
}));
```

**Guarantees**:
- Always 64 steps
- Duration and probability within valid ranges
- Missing steps filled with defaults

### sanitizeBars(bars)

Similar to steps, ensures 32 bars with valid note values (0-7).

### sanitizeSynthSnapshot(state)

Validates synth parameters:
- Waveforms in allowed set
- Envelope values in 0-10 range
- Harmonicity in 0-2 range

## Playback Controls

### play()

```typescript
export function play() {
  ensureInitialized();
  if (Tone.Transport.state !== 'started') {
    Tone.Transport.start();
    startAllLaneLoops();
  }
}
```

Starts master clock and all lane loops.

### pause()

```typescript
export function pause() {
  if (Tone.Transport.state === 'started') {
    Tone.Transport.pause();
  }
}
```

Pauses transport without resetting pointers.

### stop()

```typescript
export function stop() {
  Tone.Transport.stop();
  resetAllLanePointers();
  clearPlaybackIndicators();
}
```

Stops playback and resets to beginning.

### setBpm(bpm: number)

```typescript
export function setBpm(bpm: number) {
  Tone.Transport.bpm.value = clamp(bpm, 40, 240);
}
```

Updates master clock tempo.

## UI Update Scheduling

### scheduleUIUpdate(callback, time)

**Problem**: UI updates from audio thread cause jank.

**Solution**: Schedule updates just before the audio event:
```typescript
const now = Tone.now();
const delay = Math.max(0, time - now - 0.05);  // 50ms before
setTimeout(callback, delay * 1000);
```

**Used For**:
- Updating playback step indicator
- Updating melody bar indicator

**Why 50ms Early?**: Gives UI time to render before audio plays.

## Timing & Synchronization

### Web Audio Timing

Tone.Loop callbacks receive `time` parameter in **seconds** (Web Audio context time):

```typescript
loop = new Tone.Loop((time) => {
  // time = 1.234 (absolute context time)
  synth.triggerAttackRelease("C4", "8n", time);
}, "8n");
```

**Critical**: Always pass `time` to trigger methods for sample-accurate playback.

### Subdivision Table

| Index | Subdivision | Note Value | BPM 120 Interval |
|-------|-------------|------------|-------------------|
| 0 | `"4n"` | Quarter | 500ms |
| 1 | `"8n"` | Eighth | 250ms |
| 2 | `"16n"` | Sixteenth | 125ms |
| 3 | `"32n"` | Thirty-second | 62.5ms |

### Pointer Synchronization

**Problem**: Step and melody pointers can drift if not careful.

**Solution**:
- Step pointer advances **every tick**
- Melody pointer advances **only on active step triggers**
- Both wrap independently based on their respective lengths

**Example**:
```
Steps: 8 (rhythm pattern length)
Bars:  4 (melody sequence length)

Tick 0: step=0, melody=0 → trigger → melody advances
Tick 1: step=1, melody=1 (step inactive, melody doesn't advance)
Tick 2: step=2, melody=1 → trigger → melody advances to 2
...
```

## MIDI & Frequency Conversion

### Scale System

```typescript
const BASE_MIDI = 48;  // C3
const SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];  // Major scale
```

**Bar Value to MIDI**:
```
bar.value = 0 → MIDI 48 (C3)
bar.value = 1 → MIDI 50 (D3)
bar.value = 2 → MIDI 52 (E3)
...
bar.value = 7 → MIDI 60 (C4)
```

**MIDI to Frequency**:
```typescript
const freq = Tone.Frequency(midiNote, "midi").toNote();
// Returns note name: "C3", "D3", etc.
```

### Randomization

```typescript
if (bar.randomize) {
  const randomOffset = Math.floor(Math.random() * 5) - 2;  // -2 to +2
  midiNote += randomOffset;
}
```

Adds ±2 semitones variation.

### Glide (Portamento)

```typescript
if (bar.glide) {
  synth.portamento = runtime.synth.portamento;  // Use synth's portamento time
} else {
  synth.portamento = 0;  // Instant pitch change
}
```

Portamento = smooth pitch transition time (0-1 seconds).

## Performance Optimization

### Audio Thread Separation
- Audio processing runs in separate Web Audio thread
- UI updates scheduled via `setTimeout` to avoid blocking
- Store subscriptions debounced to prevent excessive updates

### Node Reuse
- Synth nodes reused across playback sessions
- Only destroyed when lane removed
- Parameter updates use `.value` setters (no node recreation)

### Pointer Arithmetic
- All pointer math uses modulo (%) for wrapping
- No array slicing or copying in hot path
- Minimal allocations during `tickLane()`

## Error Handling

### Audio Context Restrictions

**Problem**: Browsers block audio until user interaction.

**Solution**:
```typescript
export async function resumeAudioContext() {
  if (Tone.context.state === 'suspended') {
    await Tone.context.resume();
  }
}
```

Call on first user click/keypress.

### State Loading Failures

All load functions use sanitization:
```typescript
try {
  hydrateLaneRuntime(runtime, lane);
} catch (err) {
  console.error('Failed to load lane state:', err);
  // Fallback to default state
  runtime.sequencer = createSequencerSnapshot();
}
```

### Node Creation Failures

```typescript
try {
  ensureLaneNodes(runtime);
} catch (err) {
  console.error('Failed to create audio nodes:', err);
  // Lane will be silent but app won't crash
}
```

## Debugging

### Useful Console Commands

```javascript
// Check transport state
Tone.Transport.state

// Check BPM
Tone.Transport.bpm.value

// Inspect lane runtimes (in engine.ts scope)
console.log(runtimes);

// Manual playback test
import { play, stop } from '$lib/audio/engine';
play();
// ... listen ...
stop();
```

### Common Issues

**No Sound**:
1. Check audio context state: `Tone.context.state` (should be "running")
2. Check if any lanes in solo mode
3. Verify step.active = true
4. Check probability (should be > 0)
5. Check mixer volume > 0

**Timing Drift**:
1. Verify Tone.Transport is running
2. Check loop.state for each lane
3. Ensure `time` parameter passed to triggers

**Clicks/Pops**:
1. Increase envelope attack time
2. Check for NaN in frequency values
3. Verify duration values are valid

## Further Reading

- [Tone.js Documentation](https://tonejs.github.io/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [State Management](STATE_MANAGEMENT.md) - How audio syncs with stores
- [Architecture](ARCHITECTURE.md) - Overall system design
