import type { Project, ProjectSnapshot } from "../types/project";
import { logger } from "../utils/logger";

const STORAGE_KEY = "liftboy.projects.v1";
const SCHEMA_VERSION = 1;

export interface SaveResult {
  success: boolean;
  error?: "quota_exceeded" | "storage_unavailable" | "unknown";
  message?: string;
}

function canUseStorage() {
  return typeof localStorage !== "undefined";
}

export function loadProjects(): Project[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const snapshots = JSON.parse(raw) as ProjectSnapshot[];
    return snapshots.map(hydrateProjectSnapshot);
  } catch (error) {
    logger.error("[projects] failed to parse storage", error);
    return [];
  }
}

export function saveProjects(projects: Project[]): SaveResult {
  if (!canUseStorage()) {
    return {
      success: false,
      error: "storage_unavailable",
      message: "LocalStorage is not available",
    };
  }

  try {
    const payload: ProjectSnapshot[] = projects.map((project) => ({
      ...project,
      schemaVersion: SCHEMA_VERSION,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      logger.error("[projects] storage quota exceeded", error);
      return {
        success: false,
        error: "quota_exceeded",
        message: "Storage quota exceeded. Consider removing old projects.",
      };
    }
    logger.error("[projects] failed to persist storage", error);
    return {
      success: false,
      error: "unknown",
      message: "Failed to save projects",
    };
  }
}

/**
 * Get current storage usage
 *
 * @returns Storage usage in bytes, or null if unavailable
 */
export function getStorageUsage(): { used: number; available: number } | null {
  if (!canUseStorage()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    const used = new Blob([raw]).size;
    // Most browsers have 5-10MB limit, we'll use 5MB as conservative estimate
    const available = 5 * 1024 * 1024;
    return { used, available };
  } catch {
    return null;
  }
}

function hydrateProjectSnapshot(snapshot: ProjectSnapshot): Project {
  const { schemaVersion, ...rest } = snapshot;
  if (!rest.meta?.createdAt) {
    const timestamp = new Date().toISOString();
    rest.meta = {
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
  return rest;
}
