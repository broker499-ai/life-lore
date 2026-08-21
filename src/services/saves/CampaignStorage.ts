import { deserializeGame, serializeGame } from '@/core/saves/saveFile';
import type { GameState } from '@/core/state/GameState';

export type CampaignViewSnapshot = 'map' | 'army' | 'artifacts' | 'cities';

export type CampaignMapCameraSnapshot = {
  zoom: number;
  centerX: number;
  centerY: number;
};

export type CampaignUiSnapshot = {
  view: CampaignViewSnapshot;
  selectedNodeId: string | null;
  mapCamera: CampaignMapCameraSnapshot | null;
};

export type CampaignSaveReason = 'auto' | 'manual';

export type LoadedCampaignSnapshot = {
  state: GameState;
  ui: CampaignUiSnapshot;
  savedAt: string;
  reason: CampaignSaveReason;
  recoveredFromBackup: boolean;
};

export type CampaignSaveStatus =
  | { kind: 'none' }
  | { kind: 'ready'; snapshot: LoadedCampaignSnapshot }
  | { kind: 'corrupt' };

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StoredCampaignEnvelope = {
  format: 1;
  savedAt: string;
  reason: CampaignSaveReason;
  game: string;
  ui: CampaignUiSnapshot;
};

const AUTOSAVE_KEY = 'koren-zhivoznaniya.autosave.v1';
const BACKUP_KEY = 'koren-zhivoznaniya.autosave.backup.v1';
const STORAGE_FORMAT = 1 as const;

export function getDefaultCampaignUiSnapshot(): CampaignUiSnapshot {
  return { view: 'map', selectedNodeId: null, mapCamera: null };
}

export function saveCampaignSnapshot(
  state: GameState,
  ui: CampaignUiSnapshot,
  reason: CampaignSaveReason = 'auto',
  storage: StorageLike | null = getBrowserStorage(),
): { ok: true } | { ok: false; error: 'storage_unavailable' | 'write_failed' } {
  if (!storage) return { ok: false, error: 'storage_unavailable' };

  const game = serializeGame(state);
  const envelope: StoredCampaignEnvelope = {
    format: STORAGE_FORMAT,
    savedAt: new Date().toISOString(),
    reason,
    game,
    ui: sanitizeUiSnapshot(ui),
  };

  try {
    const currentRaw = storage.getItem(AUTOSAVE_KEY);
    const currentEnvelope = currentRaw ? parseEnvelope(currentRaw) : null;

    // Rotate the backup only when the serialised game state changes. Camera pans,
    // tab switches and selection changes should not destroy the useful previous turn.
    if (currentRaw && currentEnvelope && currentEnvelope.game !== game) {
      storage.setItem(BACKUP_KEY, currentRaw);
    }

    storage.setItem(AUTOSAVE_KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch {
    return { ok: false, error: 'write_failed' };
  }
}

export function loadCampaignSnapshot(
  storage: StorageLike | null = getBrowserStorage(),
): LoadedCampaignSnapshot | null {
  if (!storage) return null;

  const primary = readSlot(storage, AUTOSAVE_KEY, false);
  if (primary) return primary;
  return readSlot(storage, BACKUP_KEY, true);
}

export function getCampaignSaveStatus(
  storage: StorageLike | null = getBrowserStorage(),
): CampaignSaveStatus {
  if (!storage) return { kind: 'none' };

  const hasAnySave = storage.getItem(AUTOSAVE_KEY) !== null || storage.getItem(BACKUP_KEY) !== null;
  if (!hasAnySave) return { kind: 'none' };

  const snapshot = loadCampaignSnapshot(storage);
  return snapshot ? { kind: 'ready', snapshot } : { kind: 'corrupt' };
}

export function clearCampaignSaves(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.removeItem(AUTOSAVE_KEY);
  storage.removeItem(BACKUP_KEY);
}

function readSlot(storage: StorageLike, key: string, recoveredFromBackup: boolean): LoadedCampaignSnapshot | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const envelope = parseEnvelope(raw);
    if (!envelope) return null;
    const state = deserializeGame(envelope.game);
    return {
      state,
      ui: sanitizeUiSnapshot(envelope.ui),
      savedAt: envelope.savedAt,
      reason: envelope.reason,
      recoveredFromBackup,
    };
  } catch {
    return null;
  }
}

function parseEnvelope(raw: string): StoredCampaignEnvelope | null {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || parsed.format !== STORAGE_FORMAT) return null;
  if (typeof parsed.savedAt !== 'string' || !isSaveReason(parsed.reason) || typeof parsed.game !== 'string') {
    return null;
  }
  if (!isRecord(parsed.ui)) return null;

  return {
    format: STORAGE_FORMAT,
    savedAt: parsed.savedAt,
    reason: parsed.reason,
    game: parsed.game,
    ui: sanitizeUiSnapshot(parsed.ui as Partial<CampaignUiSnapshot>),
  };
}

function sanitizeUiSnapshot(ui: Partial<CampaignUiSnapshot>): CampaignUiSnapshot {
  const view: CampaignViewSnapshot = ui.view === 'army' || ui.view === 'artifacts' || ui.view === 'cities' ? ui.view : 'map';
  const selectedNodeId = typeof ui.selectedNodeId === 'string' ? ui.selectedNodeId : null;
  const camera = ui.mapCamera;
  const mapCamera = isRecord(camera)
    && typeof camera.zoom === 'number'
    && Number.isFinite(camera.zoom)
    && typeof camera.centerX === 'number'
    && Number.isFinite(camera.centerX)
    && typeof camera.centerY === 'number'
    && Number.isFinite(camera.centerY)
      ? { zoom: camera.zoom, centerX: camera.centerX, centerY: camera.centerY }
      : null;

  return { view, selectedNodeId, mapCamera };
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSaveReason(value: unknown): value is CampaignSaveReason {
  return value === 'auto' || value === 'manual';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
