# ADR 0002: Snapshot Serialization Pattern

## Status

Accepted

## Context

Lift-Boy needs to persist user projects to browser storage (`localStorage`). The state includes:
- Step sequencer patterns (64 steps × multiple properties)
- Melody sequences (32 bars)
- Synth parameters (oscillator, envelope, etc.)
- Lane configurations (volume, pan, mute/solo)
- Project metadata

### Requirements

1. **LocalStorage Compatible**: Must serialize to JSON
2. **Versionable**: Support schema evolution
3. **Immutable**: Prevent accidental mutations
4. **Editor Decoupled**: Editor UI shouldn't directly persist
5. **Undo/Redo Ready**: Snapshots enable time-travel debugging (future)

### Constraints

- LocalStorage only stores strings (JSON serialization required)
- LocalStorage limit ~5-10MB per domain
- Svelte stores use writable/derived pattern

### Alternatives Considered

#### Alternative 1: Direct Store Persistence

**Approach**: Persist Svelte store values directly.

```typescript
import { steps, sequencerSettings } from './stores/sequencer';
import { get } from 'svelte/store';

function saveProject() {
  localStorage.setItem('project', JSON.stringify({
    steps: get(steps),
    sequencerSettings: get(sequencerSettings)
  }));
}
```

**Pros**:
- Simple, no intermediate layer
- Direct access to store values

**Cons**:
- Tight coupling between UI stores and persistence
- Hard to version schemas
- No validation on load
- Store values might not be JSON-serializable
- Doesn't support multiple projects (no project concept)

**Rejected**: Couples UI state to persistence too tightly.

#### Alternative 2: Event Sourcing

**Approach**: Store events (actions) instead of state.

```typescript
const events = [
  { type: 'STEP_TOGGLED', stepIndex: 0, timestamp: 1234 },
  { type: 'DURATION_CHANGED', stepIndex: 0, value: 1.5 },
  // ... hundreds of events
];

function replayEvents(events) {
  events.forEach(event => applyEvent(event));
}
```

**Pros**:
- Complete history (undo/redo trivial)
- Audit trail of all changes
- Time-travel debugging

**Cons**:
- Event log grows unbounded
- Slow to load (must replay all events)
- Complex: need event handlers for every action
- Overkill for this use case

**Rejected**: Too complex for current needs.

#### Alternative 3: ORM/Database

**Approach**: Use IndexedDB with an ORM like Dexie.

```typescript
const db = new Dexie('liftboy');
db.version(1).stores({
  projects: 'id, name, tempo',
  lanes: 'id, projectId, order',
  steps: 'id, laneId, index, active'
});
```

**Pros**:
- Structured queries
- Larger storage limits
- Built-in indexing

**Cons**:
- Async API (complicates sync)
- Heavier dependency
- More complex than needed
- Normalizing/denormalizing adds overhead

**Rejected**: Overkill for small data set.

## Decision

**Implement snapshot pattern** where each module provides:
1. `createSnapshot()`: Returns default state
2. `getSnapshot()`: Returns current state as JSON-serializable object
3. `loadSnapshot(snapshot?)`: Loads snapshot into stores

### Snapshot Functions

```typescript
// stores/sequencer.ts
export interface SequencerSnapshot {
  steps: StepState[];
  settings: SequencerSettings;
}

export function createSequencerSnapshot(): SequencerSnapshot {
  return {
    steps: Array.from({ length: 64 }, (_, i) => ({
      id: `step-${i}`,
      active: false,
      duration: 1,
      probability: 100
    })),
    settings: {
      length: 16,
      clockIndex: 2,
      orderIndex: 0
    }
  };
}

export function getSequencerSnapshot(): SequencerSnapshot {
  return {
    steps: get(steps).map(s => ({ ...s })),  // Clone
    settings: { ...get(sequencerSettings) }
  };
}

export function loadSequencerSnapshot(snapshot?: SequencerSnapshot) {
  const safe = snapshot ?? createSequencerSnapshot();
  steps.set(safe.steps.map(s => ({ ...s })));
  sequencerSettings.set({ ...safe.settings });
}
```

### Storage Schema

```typescript
interface ProjectsSnapshot {
  projects: Project[];
  activeProjectId: string | null;
}

interface Project {
  id: string;
  name: string;
  tempo: number;
  lanes: Lane[];
  meta: ProjectMeta;
}

interface Lane {
  id: string;
  modules: {
    rhythm: ModuleInstance;
    melody: ModuleInstance;
    instrument: ModuleInstance;
    effect: ModuleInstance;
  };
  // ... other lane properties
}

interface ModuleInstance {
  id: string;
  definitionId: string;
  state: unknown;  // Snapshot from module
  bypassed: boolean;
}
```

**Key**: `localStorage.setItem('liftboy.projects.v1', JSON.stringify(snapshot))`

## Rationale

### Why Snapshots?

**Immutability**: Snapshots are cloned on get/load:
```typescript
// Clone on get
steps: get(steps).map(s => ({ ...s }))

// Clone on load
steps.set(safe.steps.map(s => ({ ...s })))
```

Prevents accidental mutation of persisted state.

**Validation**: Loading can sanitize/validate:
```typescript
export function loadSequencerSnapshot(snapshot?: any) {
  const safe = snapshot ?? createSequencerSnapshot();

  // Sanitize steps
  const validSteps = safe.steps.map(s => ({
    id: s.id ?? 'step-0',
    active: s.active ?? false,
    duration: clamp(s.duration ?? 1, 0.25, 4),
    probability: clamp(s.probability ?? 100, 0, 100)
  }));

  steps.set(validSteps);
}
```

**Versioning**: Snapshots can include version field:
```typescript
interface SequencerSnapshot {
  version: number;
  steps: StepState[];
  settings: SequencerSettings;
}

export function loadSequencerSnapshot(snapshot?: any) {
  if (snapshot?.version === 1) {
    return loadSequencerSnapshotV1(snapshot);
  } else if (snapshot?.version === 2) {
    return loadSequencerSnapshotV2(snapshot);
  }
  // Fallback
  return createSequencerSnapshot();
}
```

### Why Three Functions?

**create**: Provides defaults when no data exists
```typescript
// New project, no data
const newProject = {
  lanes: [{
    modules: {
      rhythm: {
        state: createSequencerSnapshot()  // Defaults
      }
    }
  }]
};
```

**get**: Exports current state
```typescript
// User clicked "save"
const snapshot = getSequencerSnapshot();
updateModuleState(laneIndex, 'rhythm', snapshot);
```

**load**: Imports state
```typescript
// User switched lanes
const lane = currentLanes[1];
loadSequencerSnapshot(lane.modules.rhythm.state);
```

### Why `unknown` for ModuleInstance.state?

**Type Safety with Flexibility**:
```typescript
interface ModuleInstance {
  state: unknown;  // Can be any snapshot type
}
```

Allows different module types without union:
```typescript
// Rhythm module
state: SequencerSnapshot

// Melody module
state: MelodySnapshot

// Custom module
state: CustomSnapshot
```

Caller must cast:
```typescript
const rhythmState = lane.modules.rhythm.state as SequencerSnapshot;
```

TypeScript ensures we handle the cast safely.

## Consequences

### Positive

✅ **Clean Separation**: Editor stores never directly persist
✅ **Versionable**: Easy to add schema migrations
✅ **Testable**: Can test create/get/load in isolation
✅ **Immutable**: Cloning prevents bugs from shared references
✅ **Portable**: Snapshots are plain JSON (could export/import)
✅ **Fallback**: Always has valid defaults via `create`

### Negative

❌ **Duplication**: State exists in editor stores AND projects store
❌ **Sync Required**: `laneModuleSync` needed to keep in sync
❌ **Cloning Overhead**: Copying objects on every get/load (acceptable for small data)
❌ **Manual Wiring**: Each module needs three functions

### Neutral

➖ **No History**: Only current state saved (not undo/redo)
➖ **LocalStorage Size**: OK for 4 lanes × 3 modules, may not scale to 100 projects

## Implementation Notes

### Sanitization Example

```typescript
export function sanitizeSteps(steps: any[]): StepState[] {
  return Array.from({ length: TOTAL_STEPS }, (_, i) => {
    const step = steps[i] ?? {};
    return {
      id: step.id ?? `step-${i}`,
      active: step.active ?? false,
      duration: clamp(step.duration ?? 1, DURATION_MIN, DURATION_MAX),
      probability: clamp(step.probability ?? 100, PROBABILITY_MIN, PROBABILITY_MAX)
    };
  });
}
```

Guarantees:
- Always 64 steps
- All properties present
- Values within valid ranges

### Sync Pattern

**Persist Direction** (editor → project):
```typescript
const handleSequencerChange = () => {
  if (isApplying) return;  // Guard
  const snapshot = getSequencerSnapshot();
  updateModuleState(activeLaneIndex, 'rhythm', snapshot);
};

sequencer.subscribe(handleSequencerChange);
```

**Apply Direction** (project → editor):
```typescript
function applyLaneState(laneIndex: number) {
  isApplying = true;
  const lane = currentLanes[laneIndex];
  loadSequencerSnapshot(lane.modules.rhythm.state);
  isApplying = false;
}
```

### Testing

```typescript
test('Snapshot roundtrip', () => {
  // Set state
  toggleStepActive(0);
  adjustStepDuration(0, 0.5);

  // Get snapshot
  const snapshot = getSequencerSnapshot();
  expect(snapshot.steps[0].active).toBe(true);
  expect(snapshot.steps[0].duration).toBe(1.5);

  // Clear state
  loadSequencerSnapshot(createSequencerSnapshot());
  expect(get(steps)[0].active).toBe(false);

  // Load snapshot
  loadSequencerSnapshot(snapshot);
  expect(get(steps)[0].active).toBe(true);
  expect(get(steps)[0].duration).toBe(1.5);
});
```

## Related Decisions

- [ADR 0001: Lane-Based Architecture](0001-lane-architecture.md) - Why modules have state
- [ADR 0003: Store-Based State Management](0003-store-based-state.md) - How stores work

## Future Considerations

### Undo/Redo

Store snapshot history:
```typescript
const history = {
  past: SequencerSnapshot[];
  present: SequencerSnapshot;
  future: SequencerSnapshot[];
};

function undo() {
  if (history.past.length === 0) return;
  const previous = history.past.pop();
  history.future.unshift(history.present);
  history.present = previous;
  loadSequencerSnapshot(previous);
}
```

### Cloud Sync

Snapshots are JSON, easy to sync:
```typescript
async function syncToCloud() {
  const snapshot = getProjectsSnapshot();
  await fetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify(snapshot)
  });
}
```

### Export/Import

```typescript
function exportProject(projectId: string) {
  const project = projects.find(p => p.id === projectId);
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json'
  });
  saveAs(blob, `${project.name}.liftboy.json`);
}

function importProject(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const project = JSON.parse(e.target.result);
    // Validate and add to projects
    addProject(hydrateProject(project));
  };
  reader.readAsText(file);
}
```

## References

- [State Management Documentation](../STATE_MANAGEMENT.md)
- [Module System Documentation](../MODULES.md)
- [Types Reference](../TYPES.md)

## Date

2025-01-15
