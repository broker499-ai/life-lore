import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import {
  getCampaignSaveStatus,
  getDefaultCampaignUiSnapshot,
  loadCampaignSnapshot,
  saveCampaignSnapshot,
  type StorageLike,
} from '@/services/saves/CampaignStorage';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  corruptPrimary(): void {
    this.values.set('koren-zhivoznaniya.autosave.v1', '{broken');
  }
}

describe('CampaignStorage', () => {
  it('round-trips current game state and UI snapshot', () => {
    const storage = new MemoryStorage();
    const state = createPrototypeGameState(1001, 'artemios');
    const ui = { ...getDefaultCampaignUiSnapshot(), view: 'cities' as const, selectedNodeId: 'moss-market' };

    expect(saveCampaignSnapshot(state, ui, 'manual', storage)).toEqual({ ok: true });
    const loaded = loadCampaignSnapshot(storage);

    expect(loaded?.state.turn).toBe(state.turn);
    expect(loaded?.state.selectedLeaderId).toBe('artemios');
    expect(loaded?.ui.view).toBe('cities');
    expect(loaded?.ui.selectedNodeId).toBe('moss-market');
    expect(loaded?.reason).toBe('manual');
  });

  it('keeps the previous game-state autosave as a backup', () => {
    const storage = new MemoryStorage();
    const first = createPrototypeGameState(1002, 'vlados');
    const second = { ...first, turn: first.turn + 1 };

    saveCampaignSnapshot(first, getDefaultCampaignUiSnapshot(), 'auto', storage);
    saveCampaignSnapshot(second, getDefaultCampaignUiSnapshot(), 'auto', storage);
    storage.corruptPrimary();

    const recovered = loadCampaignSnapshot(storage);
    expect(recovered?.state.turn).toBe(first.turn);
    expect(recovered?.recoveredFromBackup).toBe(true);
  });

  it('reports corrupted saves when neither slot can be loaded', () => {
    const storage = new MemoryStorage();
    storage.corruptPrimary();
    expect(getCampaignSaveStatus(storage)).toEqual({ kind: 'corrupt' });
  });
});
