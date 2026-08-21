export const MAX_ORSIA_KNOWLEDGE = 12;
export const ROOT_KNOWLEDGE_REQUIRED = 8;
export const ARTIFACT_KNOWLEDGE_GAIN = 1;

export type KnowledgeCorruptionStage = 0 | 1 | 2;

export function clampKnowledge(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_ORSIA_KNOWLEDGE, Math.max(0, Math.round(value)));
}

export function getKnowledgePercent(value: number): number {
  return Math.round((clampKnowledge(value) / MAX_ORSIA_KNOWLEDGE) * 100);
}

export function getKnowledgeCorruptionStage(value: number): KnowledgeCorruptionStage {
  const percent = getKnowledgePercent(value);
  if (percent >= 75) return 2;
  if (percent >= 25) return 1;
  return 0;
}
