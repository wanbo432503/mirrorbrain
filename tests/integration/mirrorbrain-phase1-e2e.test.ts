import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createCandidateMemories,
  reviewCandidateMemory,
} from '../../src/modules/memory-review/index.js';
import {
  normalizeActivityWatchBrowserEvent,
  persistMemoryEvent,
} from '../../src/modules/memory-capture/index.js';
import { buildSkillDraftFromReviewedMemories } from '../../src/workflows/skill-draft-builder/index.js';
import {
  listSkillDrafts,
  queryMemory,
} from '../../src/integrations/agent-memory-api/index.js';
import type { MemoryEvent } from '../../src/shared/types/index.js';

describe('mirrorbrain phase 1 e2e', () => {
  it('flows from ActivityWatch browser events to agent-facing artifacts', async () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL('../fixtures/activitywatch/browser-events.json', import.meta.url),
        'utf8',
      ),
    ) as Array<{
      id: string;
      timestamp: string;
      data: {
        url: string;
        title: string;
      };
    }>;

    const persistedRecords: unknown[] = [];

    const memoryEvents = await Promise.all(
      fixture.map(async (event) => {
        const normalized = normalizeActivityWatchBrowserEvent({
          scopeId: 'scope-browser',
          event,
        });

        await persistMemoryEvent(normalized, {
          writeMemoryEvent: async (record) => {
            persistedRecords.push(record);
          },
        });

        return normalized;
      }),
    );

    const [candidateMemory] = createCandidateMemories({
      reviewDate: '2026-03-20',
      memoryEvents: memoryEvents as MemoryEvent[],
    });
    const reviewedMemory = reviewCandidateMemory(candidateMemory, {
      decision: 'keep',
      reviewedAt: '2026-03-20T10:00:00.000Z',
    });
    const skillDraft = buildSkillDraftFromReviewedMemories([reviewedMemory]);

    expect(persistedRecords).toHaveLength(2);
    const memoryResult = await queryMemory(
      {
        baseUrl: 'http://127.0.0.1:1933',
        query: 'What did I work on?',
      },
      {
        listMemoryEvents: async () => memoryEvents,
      },
    );

    expect(memoryResult.items).toHaveLength(2);
    expect(memoryResult.items.map((item) => item.theme)).toEqual([
      'Example Tasks 2',
      'Example Tasks',
    ]);
    expect(memoryResult.items[0]?.sourceRefs[0]).toMatchObject({
      id: 'browser:aw-event-2',
      sourceType: 'activitywatch-browser',
      sourceRef: 'aw-event-2',
    });
    expect(memoryResult.items[1]?.sourceRefs[0]).toMatchObject({
      id: 'browser:aw-event-1',
      sourceType: 'activitywatch-browser',
      sourceRef: 'aw-event-1',
    });
    await expect(
      listSkillDrafts(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listSkillArtifacts: async () => [skillDraft],
        },
      ),
    ).resolves.toEqual([skillDraft]);
  });
});
