export type AudioCue = 'ui.tap' | 'map.select' | 'battle.start' | 'battle.end';

export interface AudioService {
  play(cue: AudioCue): void;
  stopAll(): void;
}

export const silentAudioService: AudioService = {
  play: () => undefined,
  stopAll: () => undefined,
};
