export type VisualizationData = Readonly<Record<string, unknown>>;

export type UiToScene =
  | { type: 'battle:play'; timeline: readonly VisualizationData[] }
  | { type: 'battle:skip' };

export type SceneToUi = { type: 'battle:finished' };

// Phaser integration intentionally does not exist yet. These contracts reserve
// a narrow, typed bridge so future scenes never read GameState directly.
