import { describe, expect, it } from 'vitest';
import { getKnowledgeCorruptionStage, MAX_ORSIA_KNOWLEDGE } from './knowledgeRules';

describe('knowledge corruption thresholds', () => {
  it('darkens at 25% and becomes severe at 75%', () => {
    expect(MAX_ORSIA_KNOWLEDGE).toBe(12);
    expect(getKnowledgeCorruptionStage(2)).toBe(0);
    expect(getKnowledgeCorruptionStage(3)).toBe(1);
    expect(getKnowledgeCorruptionStage(8)).toBe(1);
    expect(getKnowledgeCorruptionStage(9)).toBe(2);
  });
});
