import { describe, expect, it } from 'vitest';

import type { MemoryNarrative } from '../../shared/types/index.js';
import { queryMemory } from './index.js';

const browserNarrative: MemoryNarrative = {
  id: 'memory-narrative:browser-theme:2026-03-20:vitest-config',
  narrativeType: 'browser-theme',
  sourceCategory: 'browser',
  title: 'Vitest Config',
  theme: 'Vitest Config',
  summary:
    'You researched Vitest Config by searching and reading documentation across 2 pages and 3 browser visits.',
  timeRange: {
    startAt: '2026-03-20T08:00:00.000Z',
    endAt: '2026-03-20T08:06:00.000Z',
  },
  sourceEventIds: ['browser:1', 'browser:2', 'browser:3'],
  sourceRefs: [
    {
      id: 'browser:1',
      sourceType: 'activitywatch-browser',
      sourceRef: '1',
      timestamp: '2026-03-20T08:00:00.000Z',
    },
  ],
  queryHints: ['vitest config', 'vitest'],
};

const shellNarrative: MemoryNarrative = {
  id: 'memory-narrative:shell-problem:2026-03-20:mirrorbrain:1',
  narrativeType: 'shell-problem',
  sourceCategory: 'shell',
  title: 'Mirrorbrain shell fix sequence',
  theme: 'Mirrorbrain shell fix sequence',
  summary:
    'You inspected state, applied changes, and verified the result in the mirrorbrain workspace across 4 shell commands.',
  timeRange: {
    startAt: '2026-03-20T09:00:00.000Z',
    endAt: '2026-03-20T09:04:00.000Z',
  },
  sourceEventIds: ['shell:1', 'shell:2', 'shell:3', 'shell:4'],
  sourceRefs: [
    {
      id: 'shell:2',
      sourceType: 'shell-history',
      sourceRef: '2',
      timestamp: '2026-03-20T09:01:00.000Z',
    },
  ],
  queryHints: ['mirrorbrain', 'git', 'pnpm', 'vitest'],
  operationPhases: ['inspected state', 'applied changes', 'verified the result'],
  context: {
    inferredCwd: '/Users/wanbo/Workspace/mirrorbrain',
    workspaceLabel: 'mirrorbrain',
    sessionId: 'shell-session:2026-03-20:1',
  },
};

const otherShellNarrative: MemoryNarrative = {
  id: 'memory-narrative:shell-problem:2026-03-20:docker:2',
  narrativeType: 'shell-problem',
  sourceCategory: 'shell',
  title: 'Docker shell fix sequence',
  theme: 'Docker shell fix sequence',
  summary:
    'You inspected state and verified the result in the docker workspace across 2 shell commands.',
  timeRange: {
    startAt: '2026-03-20T10:00:00.000Z',
    endAt: '2026-03-20T10:05:00.000Z',
  },
  sourceEventIds: ['shell:5', 'shell:6'],
  sourceRefs: [
    {
      id: 'shell:5',
      sourceType: 'shell-history',
      sourceRef: '5',
      timestamp: '2026-03-20T10:00:00.000Z',
    },
  ],
  queryHints: ['docker', 'compose'],
};

describe('agent memory api memory narratives', () => {
  it('prefers offline browser theme narratives for browser work-recall queries', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
        },
        {
          listMemoryEvents: async () => [],
          listMemoryNarratives: async () => [browserNarrative],
        },
      ),
    ).resolves.toEqual({
      explanation:
        'MirrorBrain returned offline browser theme narratives for this work-recall query.',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: browserNarrative.id,
          theme: browserNarrative.theme,
          title: browserNarrative.title,
          summary: browserNarrative.summary,
          timeRange: browserNarrative.timeRange,
          sourceRefs: browserNarrative.sourceRefs,
        },
      ],
    });
  });

  it('prefers offline shell problem narratives for solve-oriented shell queries', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: '我之前是怎么通过命令行解决这个问题的？',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [],
          listMemoryNarratives: async () => [shellNarrative],
        },
      ),
    ).resolves.toEqual({
      explanation:
        'MirrorBrain returned offline shell problem narratives for this solve-oriented shell query.',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: shellNarrative.id,
          theme: shellNarrative.theme,
          title: shellNarrative.title,
          summary: shellNarrative.summary,
          timeRange: shellNarrative.timeRange,
          sourceRefs: shellNarrative.sourceRefs,
        },
      ],
    });
  });

  it('narrows stored shell narratives by query hints when the solve query names a topic', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I fix the vitest problem from the command line?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [],
          listMemoryNarratives: async () => [shellNarrative, otherShellNarrative],
        },
      ),
    ).resolves.toEqual({
      explanation:
        'MirrorBrain returned offline shell problem narratives for this solve-oriented shell query.',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: shellNarrative.id,
          theme: shellNarrative.theme,
          title: shellNarrative.title,
          summary: shellNarrative.summary,
          timeRange: shellNarrative.timeRange,
          sourceRefs: shellNarrative.sourceRefs,
        },
      ],
    });
  });
});
