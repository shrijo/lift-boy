# Contributing to Lift-Boy

Thank you for your interest in contributing to Lift-Boy! This document provides guidelines and instructions for development.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Architecture Guidelines](#architecture-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern browser with Web Audio API support
- Git
- Code editor (VS Code recommended)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/[repo]/lift-boy.git
   cd lift-boy/Liftboy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Verify setup**
   - Visit http://localhost:5173
   - Check console for errors
   - Test audio playback (press Space)

## Development Workflow

### Branch Strategy

- `main` - Stable production code
- Feature branches: `feature/your-feature-name`
- Bug fixes: `fix/bug-description`
- Docs: `docs/what-youre-documenting`

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following style guidelines
   - Add JSDoc comments for new functions
   - Update TypeScript types as needed

3. **Test your changes**
   ```bash
   npm run check   # Type check
   npm run dev     # Manual testing
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add feature description"
   ```

### Commit Message Format

Use conventional commits:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples**:
```
feat: add Euclidean rhythm module
fix: prevent audio glitches on lane switch
docs: update keyboard controls in README
refactor: simplify lane sync logic
```

## Code Style

### TypeScript

- **Strict mode**: Always enabled
- **No `any`**: Use proper types or `unknown`
- **Interfaces over types**: Prefer `interface` for object shapes
- **Explicit return types**: For exported functions

**Example**:
```typescript
// Good
export function toggleStepActive(index: number): void {
  steps.update(s => s.map((step, i) =>
    i === index ? { ...step, active: !step.active } : step
  ));
}

// Bad
export function toggleStepActive(index: any) {
  // ...
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `XoxSequencer.svelte` |
| Stores | camelCase | `sequencer.ts` |
| Functions | camelCase | `toggleStepActive()` |
| Types/Interfaces | PascalCase | `StepState`, `SequencerSnapshot` |
| Constants | UPPER_SNAKE_CASE | `TOTAL_STEPS`, `BASE_MIDI` |

### File Organization

```typescript
// 1. Imports (external first, then internal)
import { writable, derived } from 'svelte/store';
import type { StepState } from '../types';

// 2. Constants
const TOTAL_STEPS = 64;

// 3. Types/Interfaces
export interface SequencerSnapshot {
  steps: StepState[];
  settings: SequencerSettings;
}

// 4. Store declarations
export const steps = writable<StepState[]>([]);

// 5. Functions (private first, then exported)
function createDefaultSteps(): StepState[] { /* ... */ }

export function toggleStepActive(index: number): void { /* ... */ }
```

### JSDoc Comments

Add JSDoc comments for:
- All exported functions
- Complex internal functions
- Non-obvious logic

**Template**:
```typescript
/**
 * Brief description of function
 *
 * Longer description if needed.
 * Can span multiple lines.
 *
 * @param paramName - Parameter description
 * @returns Return value description
 */
export function functionName(paramName: Type): ReturnType {
  // ...
}
```

**Example**:
```typescript
/**
 * Toggle step active state
 *
 * Toggles the active state of a step at the given index.
 * If no index provided, uses currently selected step.
 *
 * @param index - Optional step index (0-63)
 */
export function toggleStepActive(index?: number): void {
  const targetIndex = index ?? get(selectedStep);
  steps.update(s => s.map((step, i) =>
    i === targetIndex ? { ...step, active: !step.active } : step
  ));
}
```

## Architecture Guidelines

### State Management

**Always use Svelte stores**:
```typescript
// Good
export const steps = writable<StepState[]>([]);
export function toggleStepActive(index: number) {
  steps.update(s => /* ... */);
}

// Bad - component local state for shared data
let steps = [];  // Don't do this for shared state
```

**Immutable updates**:
```typescript
// Good
steps.update(s => s.map((step, i) =>
  i === index ? { ...step, active: true } : step
));

// Bad - mutation
const current = get(steps);
current[index].active = true;  // ❌ Doesn't trigger reactivity
```

**Use derived stores for computed values**:
```typescript
// Good
export const activeStep = derived(
  [steps, selectedStep],
  ([$steps, $selected]) => $steps[$selected]
);

// Bad - redundant state
export const activeStep = writable<StepState | null>(null);
// Now you have to manually sync this!
```

### Snapshot Pattern

All persisted state uses snapshots:

```typescript
// Create default snapshot
export function createSequencerSnapshot(): SequencerSnapshot {
  return { steps: [...], settings: {...} };
}

// Get current snapshot
export function getSequencerSnapshot(): SequencerSnapshot {
  return {
    steps: get(steps).map(s => ({ ...s })),  // Clone
    settings: { ...get(sequencerSettings) }
  };
}

// Load snapshot
export function loadSequencerSnapshot(snapshot?: SequencerSnapshot) {
  const safe = snapshot ?? createSequencerSnapshot();
  steps.set(safe.steps.map(s => ({ ...s })));
  sequencerSettings.set({ ...safe.settings });
}
```

### Audio Engine Guidelines

**Always use `time` parameter**:
```typescript
// Good
function tickLane(runtime: LaneRuntime, time: number) {
  runtime.synth.triggerAttackRelease(note, duration, time);
}

// Bad - timing will drift
function tickLane(runtime: LaneRuntime) {
  runtime.synth.triggerAttackRelease(note, duration);  // Uses "now"
}
```

**Sanitize loaded state**:
```typescript
function hydrateLaneRuntime(runtime: LaneRuntime, lane: Lane) {
  runtime.steps = sanitizeSteps(lane.modules.rhythm.state?.steps);
  // Never trust loaded data!
}

function sanitizeSteps(steps: unknown): StepState[] {
  if (!Array.isArray(steps)) return createDefaultSteps();
  return steps.map(s => ({
    id: s.id ?? `step-${i}`,
    active: Boolean(s.active),
    duration: clamp(s.duration ?? 1, 0.25, 4),
    probability: clamp(s.probability ?? 100, 0, 100)
  }));
}
```

### Component Guidelines

**Use stores, not props, for shared state**:
```svelte
<script>
  import { steps } from '$lib/stores/sequencer';
  // Good - subscribe to store
</script>

{#each $steps as step}
  ...
{/each}
```

**Keep components focused**:
- One responsibility per component
- Extract reusable logic into stores
- Avoid deep prop drilling (use stores instead)

## Testing

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] Audio playback works
- [ ] No console errors
- [ ] Keyboard controls work
- [ ] Lane switching preserves state
- [ ] Project persistence works
- [ ] Type checking passes (`npm run check`)

### Future: Automated Testing

(To be added)
- Unit tests for store functions
- Integration tests for sync layer
- E2E tests for user workflows

## Pull Request Process

### Before Submitting

1. **Update documentation** if needed
   - README.md for user-facing changes
   - JSDoc comments for new functions
   - docs/ for architectural changes

2. **Run checks**
   ```bash
   npm run check   # Must pass
   ```

3. **Test manually**
   - Test all affected features
   - Check for regressions
   - Verify in multiple browsers if possible

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Bullet list of changes
- Include file paths if helpful

## Testing
- How did you test this?
- What edge cases did you cover?

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] JSDoc comments added
- [ ] Type checking passes
- [ ] Manual testing complete
- [ ] Documentation updated
```

### Review Process

1. Maintainer will review your PR
2. Address any feedback or requested changes
3. Once approved, PR will be merged

## Project-Specific Guidelines

### Adding a New Module

1. **Define module type** in `types/project.ts`
2. **Create snapshot functions** in appropriate store
3. **Register module** in `modules/registry.ts`
4. **Update audio engine** to handle new module type
5. **Create UI component** for editing
6. **Add sanitization** in audio engine
7. **Update documentation**

See [docs/MODULES.md](docs/MODULES.md) for detailed guide.

### Adding a New Store

1. **Create store file** in `src/lib/stores/`
2. **Define types** for state and snapshots
3. **Export writable/derived stores**
4. **Add helper functions** for common operations
5. **Implement snapshot pattern** (create/get/load)
6. **Update sync layer** if persisted
7. **Add JSDoc comments**

See [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) for patterns.

### Modifying Audio Engine

⚠️ **Critical**: Audio engine changes can introduce timing issues or crashes.

**Required testing**:
- Test with all 4 lanes active
- Test lane switching
- Test rapid parameter changes
- Listen for audio glitches or pops
- Check CPU usage

**Common pitfalls**:
- Not using `time` parameter → timing drift
- Mutating runtime state → race conditions
- Missing sanitization → crashes from bad data
- Forgetting to dispose nodes → memory leaks

## Getting Help

- **Documentation**: See [docs/](docs/) for detailed guides
- **Architecture**: Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **State Management**: See [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md)
- **Questions**: Open an issue with "Question" label

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what is best for the project
- Show empathy towards other contributors

## License

By contributing to Lift-Boy, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Lift-Boy! 🎵
