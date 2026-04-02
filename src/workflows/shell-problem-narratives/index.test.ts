import { describe, expect, it } from 'vitest';

import { generateShellProblemNarratives } from './index.js';

describe('shell problem narratives', () => {
  it('creates shell problem narratives with inferred workspace context and operation phases', () => {
    expect(
      generateShellProblemNarratives({
        memoryEvents: [
          {
            id: 'shell:1',
            sourceType: 'shell-history',
            sourceRef: '1',
            timestamp: '2026-03-20T09:00:00.000Z',
            authorizationScopeId: 'scope-shell',
            content: {
              command: 'cd /Users/wanbo/Workspace/mirrorbrain',
              commandName: 'cd',
            },
            captureMetadata: {
              upstreamSource: 'shell-history',
              checkpoint: '2026-03-20T09:00:00.000Z',
            },
          },
          {
            id: 'shell:2',
            sourceType: 'shell-history',
            sourceRef: '2',
            timestamp: '2026-03-20T09:01:00.000Z',
            authorizationScopeId: 'scope-shell',
            content: {
              command: 'git status',
              commandName: 'git',
            },
            captureMetadata: {
              upstreamSource: 'shell-history',
              checkpoint: '2026-03-20T09:01:00.000Z',
            },
          },
          {
            id: 'shell:3',
            sourceType: 'shell-history',
            sourceRef: '3',
            timestamp: '2026-03-20T09:02:00.000Z',
            authorizationScopeId: 'scope-shell',
            content: {
              command: 'apply_patch fix.diff',
              commandName: 'apply_patch',
            },
            captureMetadata: {
              upstreamSource: 'shell-history',
              checkpoint: '2026-03-20T09:02:00.000Z',
            },
          },
          {
            id: 'shell:4',
            sourceType: 'shell-history',
            sourceRef: '4',
            timestamp: '2026-03-20T09:04:00.000Z',
            authorizationScopeId: 'scope-shell',
            content: {
              command: 'pnpm vitest run',
              commandName: 'pnpm',
            },
            captureMetadata: {
              upstreamSource: 'shell-history',
              checkpoint: '2026-03-20T09:04:00.000Z',
            },
          },
        ],
      }),
    ).toEqual([
      {
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
          {
            id: 'shell:3',
            sourceType: 'shell-history',
            sourceRef: '3',
            timestamp: '2026-03-20T09:02:00.000Z',
          },
          {
            id: 'shell:4',
            sourceType: 'shell-history',
            sourceRef: '4',
            timestamp: '2026-03-20T09:04:00.000Z',
          },
        ],
        queryHints: ['mirrorbrain', 'git', 'pnpm', 'vitest'],
        operationPhases: ['inspected state', 'applied changes', 'verified the result'],
        context: {
          inferredCwd: '/Users/wanbo/Workspace/mirrorbrain',
          workspaceLabel: 'mirrorbrain',
          sessionId: 'shell-session:2026-03-20:1',
        },
      },
    ]);
  });
});
