import { describe, expect, it } from 'vitest';

import type { MemoryQueryResult } from '../../shared/types/index.js';
import {
  composeQueryMemoryAnswer,
  createQueryMemoryToolExample,
} from './query-memory-tool-example.js';

describe('query memory tool example', () => {
  it('builds a query_memory tool that forwards query, time range, and source types', async () => {
    const calls: unknown[] = [];
    const tool = createQueryMemoryToolExample({
      executeQuery: async (input) => {
        calls.push(input);

        return {
          items: [],
        };
      },
    });

    await expect(
      tool.execute({
        query: 'What did I work on yesterday?',
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        sourceTypes: ['browser'],
      }),
    ).resolves.toEqual({
      items: [],
    });
    expect(tool.name).toBe('query_memory');
    expect(calls).toEqual([
      {
        query: 'What did I work on yesterday?',
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        sourceTypes: ['browser'],
      },
    ]);
  });

  it('composes a natural-language answer by summarizing results in order with lightweight source hints', () => {
    const result: MemoryQueryResult = {
      explanation:
        'MirrorBrain grouped adjacent shell commands into a problem-solving sequence for this solve-oriented shell query.',
      items: [
        {
          id: 'memory-result:activitywatch-browser-example-tasks',
          theme: 'Example Tasks',
          title: 'Example Tasks',
          summary: 'You mostly reviewed task documentation and follow-up notes.',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:20:00.000Z',
          },
          sourceRefs: [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
            },
          ],
        },
        {
          id: 'memory-result:activitywatch-browser-fix-review-workflow',
          theme: 'Fix review workflow',
          title: 'Fix review workflow',
          summary: 'You also compared implementation details for the review flow.',
          timeRange: {
            startAt: '2026-03-20T09:00:00.000Z',
            endAt: '2026-03-20T09:10:00.000Z',
          },
          sourceRefs: [
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T09:00:00.000Z',
            },
          ],
        },
      ],
    };

    expect(composeQueryMemoryAnswer(result)).toBe(
      [
        'MirrorBrain grouped adjacent shell commands into a problem-solving sequence for this solve-oriented shell query.',
        '1. Example Tasks: You mostly reviewed task documentation and follow-up notes. Source: activitywatch-browser at 2026-03-20T08:00:00.000Z.',
        '2. Fix review workflow: You also compared implementation details for the review flow. Source: activitywatch-browser at 2026-03-20T09:00:00.000Z.',
      ].join('\n\n'),
    );
  });
});
