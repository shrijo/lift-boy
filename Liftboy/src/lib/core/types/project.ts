export type ModuleCategory = "rhythm" | "melody" | "instrument" | "effect";

export type ModuleState = unknown;

export interface ModuleDefinition {
  id: string;
  category: ModuleCategory;
  label: string;
  version: number;
  description?: string;
  defaultState: ModuleState;
}

export interface ModuleInstance {
  id: string;
  definitionId: string;
  state: ModuleState;
  bypassed?: boolean;
}

export type LaneMode = "on" | "mute" | "solo";

export interface LaneMixer {
  volume: number;
  pan: number;
  mode: LaneMode;
}

export interface Lane {
  id: string;
  name: string;
  order: number;
  modules: Partial<Record<ModuleCategory, ModuleInstance>>;
  mixer: LaneMixer;
}

export interface ProjectMeta {
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  tempo: number;
  lanes: Lane[];
  meta: ProjectMeta;
}

export interface ProjectSnapshot extends Project {
  schemaVersion: number;
}
