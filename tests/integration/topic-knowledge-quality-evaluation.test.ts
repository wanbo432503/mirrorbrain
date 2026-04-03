import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { KnowledgeArtifact } from '../../src/shared/types/index.js';
import { evaluateTopicKnowledgeQuality } from '../../src/workflows/topic-knowledge-quality/index.js';

function readFixture(name: string) {
  return JSON.parse(
    readFileSync(`tests/fixtures/topic-knowledge-quality/${name}.json`, 'utf8'),
  ) as {
    fixtureName: string;
    dailyReviewDraft: KnowledgeArtifact;
    currentBestTopic: KnowledgeArtifact;
    history: KnowledgeArtifact[];
  };
}

describe('topic knowledge quality fixtures', () => {
  for (const fixtureName of [
    'single-topic-multi-day',
    'multiple-interleaved-topics',
    'noisy-daily-review-input',
    'topic-rewrite-supersede',
  ]) {
    it(`evaluates fixture ${fixtureName}`, () => {
      const fixture = readFixture(fixtureName);
      const result = evaluateTopicKnowledgeQuality(fixture);

      expect(result.fixtureName).toBe(fixture.fixtureName);
      expect(result.comparisons.provenanceRetained).toBe(true);
      expect(result.comparisons.historyRetained).toBe(true);
      expect(result.scores.provenanceCompleteness).toBeGreaterThanOrEqual(3);
      expect(result.scores.recencyClarity).toBeGreaterThanOrEqual(3);
      expect(result.pass).toBe(true);
    });
  }
});
