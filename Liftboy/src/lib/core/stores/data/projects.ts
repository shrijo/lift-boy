import { writable, derived, get } from "svelte/store";
import type {
  Lane,
  ModuleCategory,
  ModuleInstance,
  ModuleState,
  Project,
} from "../../types/project";
import {
  loadProjects,
  saveProjects,
  type SaveResult,
} from "../../services/projectPersistence";
import { getModuleDefinition } from "../../../modules/registry";
import { createSequencerSnapshot } from "../../../rhythm/stores/sequencer";
import { createMelodySnapshot } from "../../../melody/stores/melody";
import { createSynthSnapshot } from "../../../instrument/stores/synth";

const DEFAULT_TEMPO = 120;
const DEFAULT_LANE_NAME = "Lane";
const INITIAL_LANE_COUNT = 1;
export const PROJECT_LANE_LIMIT = { min: 1, max: 12 } as const;

const hydratedProjects = loadProjects();
const bootstrapProjects =
  hydratedProjects.length > 0
    ? hydratedProjects
    : [createProjectTemplate("Project 01")];

export const projects = writable<Project[]>(bootstrapProjects);
export const activeProjectId = writable<string | null>(
  bootstrapProjects[0]?.id ?? null
);

/** Storage error state (for UI notifications) */
export const storageError = writable<string | null>(null);

projects.subscribe((value) => {
  const result = saveProjects(value);
  if (!result.success) {
    storageError.set(result.message ?? "Failed to save projects");
  } else {
    storageError.set(null);
  }
});

export const currentProject = derived(
  [projects, activeProjectId],
  ([$projects, $active]) =>
    $projects.find((project) => project.id === $active) ?? null
);

export const currentLanes = derived(
  currentProject,
  ($project) => $project?.lanes ?? []
);

export function selectProject(id: string) {
  if (!id) return;
  const exists = get(projects).some((project) => project.id === id);
  if (!exists) return;
  activeProjectId.set(id);
}

export function createProject(name?: string) {
  const nextName = name?.trim().length ? name : generateProjectName();
  const project = createProjectTemplate(nextName);
  projects.update((list) => [...list, project]);
  activeProjectId.set(project.id);
  return project;
}

export function duplicateProject(projectId: string) {
  const snapshot = get(projects).find((project) => project.id === projectId);
  if (!snapshot) return null;
  const cloned = deepClone(snapshot);
  cloned.id = createId("prj");
  cloned.name = `${snapshot.name} Copy`;
  stampProject(cloned);
  projects.update((list) => [...list, cloned]);
  activeProjectId.set(cloned.id);
  return cloned;
}

export function mutateLane(index: number, mutator: (lane: Lane) => Lane) {
  updateActiveProject((project) => {
    if (!project.lanes[index]) return project;
    const lanes = [...project.lanes];
    const original = deepClone(lanes[index]);
    lanes[index] = normalizeLane(mutator(original), index);
    project.lanes = lanes.map((lane, idx) => normalizeLane(lane, idx));
    return project;
  });
}

export function adjustLaneCount(delta: number) {
  updateActiveProject((project) => {
    const target = clamp(
      project.lanes.length + delta,
      PROJECT_LANE_LIMIT.min,
      PROJECT_LANE_LIMIT.max
    );
    if (target === project.lanes.length) return project;
    const lanes = [...project.lanes];
    if (target > lanes.length) {
      while (lanes.length < target) {
        lanes.push(createLaneTemplate(lanes.length));
      }
    } else {
      lanes.length = target;
    }
    project.lanes = lanes.map((lane, idx) => normalizeLane(lane, idx));
    return project;
  });
}

export function assignModule(
  laneIndex: number,
  category: ModuleCategory,
  definitionId: string
) {
  mutateLane(laneIndex, (lane) => {
    const instance = createModuleInstance(definitionId);
    lane.modules = {
      ...lane.modules,
      [category]: instance,
    };
    return lane;
  });
}

export function updateModuleState(
  laneIndex: number,
  category: ModuleCategory,
  nextState: ModuleState
) {
  mutateLane(laneIndex, (lane) => {
    const current = lane.modules[category];
    if (!current) return lane;
    lane.modules = {
      ...lane.modules,
      [category]: {
        ...current,
        state: deepClone(nextState),
      },
    };
    return lane;
  });
}

export function updateTempo(tempo: number) {
  updateActiveProject((project) => {
    project.tempo = tempo;
    return project;
  });
}

function updateActiveProject(mutator: (project: Project) => Project) {
  const activeId = get(activeProjectId);
  if (!activeId) return;

  projects.update((list) => {
    const index = list.findIndex((project) => project.id === activeId);
    if (index === -1) return list;

    const draft = deepClone(list[index]);
    const next = mutator(draft);
    stampProject(next);
    const updated = [...list];
    updated[index] = next;
    return updated;
  });
}

function createProjectTemplate(name: string): Project {
  const lanes = Array.from({ length: INITIAL_LANE_COUNT }, (_, idx) =>
    createLaneTemplate(idx)
  );
  return {
    id: createId("prj"),
    name,
    tempo: DEFAULT_TEMPO,
    lanes,
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function createLaneTemplate(order: number): Lane {
  const rhythmState = createSequencerSnapshot();
  const melodyState = createMelodySnapshot();
  const synthState = createSynthSnapshot();
  return normalizeLane(
    {
      id: createId("lane"),
      name: `${DEFAULT_LANE_NAME} ${String(order + 1).padStart(2, "0")}`,
      order,
      modules: {
        rhythm: createModuleInstance("rhythm.xox-basic", rhythmState),
        melody: createModuleInstance("melody.melody-basic", melodyState),
        instrument: createModuleInstance("instrument.synth-simple", synthState),
        effect: createModuleInstance("effect.none"),
      },
      mixer: {
        volume: 0.8,
        pan: 0,
        mode: "on",
      },
    },
    order
  );
}

function normalizeLane(lane: Lane, order: number): Lane {
  return {
    ...lane,
    order,
    name:
      lane.name || `${DEFAULT_LANE_NAME} ${String(order + 1).padStart(2, "0")}`,
  };
}

function createModuleInstance(
  definitionId: string,
  initialState?: ModuleState
): ModuleInstance {
  const definition = getModuleDefinition(definitionId);
  const sourceState = initialState ?? definition?.defaultState ?? {};
  return {
    id: createId("mod"),
    definitionId,
    state: deepClone(sourceState),
    bypassed: false,
  };
}

function generateProjectName() {
  const count = get(projects).length + 1;
  return `Project ${String(count).padStart(2, "0")}`;
}

function createId(prefix: string) {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${timePart}-${randomPart}`;
}

function deepClone<T>(value: T): T {
  // Use structuredClone if available (modern browsers)
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  // Fallback to JSON for older browsers
  return JSON.parse(JSON.stringify(value)) as T;
}

function stampProject(project: Project) {
  const timestamp = new Date().toISOString();
  project.meta = {
    createdAt: project.meta.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
