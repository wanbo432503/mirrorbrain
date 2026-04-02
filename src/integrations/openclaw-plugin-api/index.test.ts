import { describe, expect, it } from 'vitest';

import {
  listKnowledge,
  listSkillDrafts,
  queryMemory,
} from './index.js';

describe('openclaw plugin api', () => {
  it('returns theme-level memory retrieval results from OpenViking memory events', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/tasks',
                title: 'Example Tasks',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toEqual({
      explanation:
        'MirrorBrain grouped browser activity into theme-level work summaries for this work-recall query.',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: 'memory-result:activitywatch-browser-example-tasks',
          theme: 'Example Tasks',
          title: 'Example Tasks',
          summary:
            'You viewed 1 page about Example Tasks during the requested time range.',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
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
      ],
    });
  });

  it('groups shell history events by command name for generic shell recall queries', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What shell commands did I run yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git diff',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:3',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:3',
              timestamp: '2026-03-20T08:10:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'pnpm vitest run',
                commandName: 'pnpm',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T08:10:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'git',
          title: 'git',
          summary:
            'You inspected state with git across 2 shell commands during the requested time range.',
        },
        {
          theme: 'pnpm',
          title: 'pnpm',
          summary:
            'You verified changes with pnpm across 1 shell commands during the requested time range.',
        },
      ],
    });
  });

  it('uses an inspection-oriented shell summary for git status and diff commands', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I inspect this before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git diff',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'git',
          summary:
            'You inspected state with git across 2 shell commands during the requested time range.',
        },
      ],
    });
  });

  it('uses a verification-oriented shell summary for test commands', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I verify this before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'pnpm vitest run',
                commandName: 'pnpm',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'pnpm typecheck',
                commandName: 'pnpm',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'pnpm',
          summary:
            'You verified changes with pnpm across 2 shell commands during the requested time range.',
        },
      ],
    });
  });

  it('uses an apply-oriented shell summary for patch application commands', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I apply a fix in the shell before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply fix.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply tests.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'git',
          summary:
            'You applied changes with git across 2 shell commands during the requested time range.',
        },
      ],
    });
  });

  it('returns a shell problem-solving narrative for solve-oriented queries', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I solve this in the shell before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:03:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply fix.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:03:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:3',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:3',
              timestamp: '2026-03-20T09:07:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'pnpm vitest run',
                commandName: 'pnpm',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:07:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toEqual({
      explanation:
        'MirrorBrain grouped adjacent shell commands into a problem-solving sequence for this solve-oriented shell query.',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: 'memory-result:shell-history-problem-solving-sequence-1',
          theme: 'Shell problem-solving sequence',
          title: 'Shell problem-solving sequence',
          summary:
            'You inspected state, applied changes, and verified the result across 3 shell commands during the requested time range.',
          timeRange: {
            startAt: '2026-03-20T09:00:00.000Z',
            endAt: '2026-03-20T09:07:00.000Z',
          },
          sourceRefs: [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:03:00.000Z',
            },
            {
              id: 'shell:shell-history:3',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:3',
              timestamp: '2026-03-20T09:07:00.000Z',
            },
          ],
        },
      ],
    });
  });

  it('prefers shell problem-solving narratives for solve-oriented shell queries even without explicit source types', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I solve this in the shell before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:03:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply fix.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:03:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:3',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:3',
              timestamp: '2026-03-20T09:07:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'pnpm vitest run',
                commandName: 'pnpm',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:07:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      explanation:
        'MirrorBrain grouped adjacent shell commands into a problem-solving sequence for this solve-oriented shell query.',
      items: [
        {
          theme: 'Shell problem-solving sequence',
          summary:
            'You inspected state, applied changes, and verified the result across 3 shell commands during the requested time range.',
        },
      ],
    });
  });

  it('prioritizes more complete shell problem-solving sequences ahead of newer partial ones', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I solve this in the shell before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:04:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply fix.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:04:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:3',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:3',
              timestamp: '2026-03-20T09:08:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'pnpm vitest run',
                commandName: 'pnpm',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:08:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:4',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:4',
              timestamp: '2026-03-20T09:40:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:40:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:5',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:5',
              timestamp: '2026-03-20T09:45:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply quick-fix.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:45:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          timeRange: {
            startAt: '2026-03-20T09:00:00.000Z',
            endAt: '2026-03-20T09:08:00.000Z',
          },
          summary:
            'You inspected state, applied changes, and verified the result across 3 shell commands during the requested time range.',
        },
        {
          timeRange: {
            startAt: '2026-03-20T09:40:00.000Z',
            endAt: '2026-03-20T09:45:00.000Z',
          },
          summary:
            'You inspected state and applied changes across 2 shell commands during the requested time range.',
        },
      ],
    });
  });

  it('keeps a phase-specific shell narrative even when a solve-oriented sequence has only one phase', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'How did I solve this in the shell before?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['shell'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T10:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git apply quick-fix.patch',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T10:00:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          summary:
            'You applied changes across 1 shell commands while solving the problem during the requested time range.',
        },
      ],
    });
  });

  it('groups browser pages that differ only by common site-title suffixes into the same theme', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:15:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://blog.example.com/review-workflow',
                title: 'Review workflow | Example Blog',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:15:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          title: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('groups browser themes case-insensitively after title normalization', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://google.com/search?q=review+workflow',
                title: 'review workflow - Google Search',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:15:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:15:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          title: 'Review workflow',
          summary:
            'You researched Review workflow by reading documentation across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('uses a research-oriented browser summary when the grouped theme includes search pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://google.com/search?q=review+workflow',
                title: 'Review workflow - Google Search',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:15:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:15:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You researched Review workflow by reading documentation across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('uses a documentation-oriented browser summary when the grouped theme is made of docs pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T10:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow/intro',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T10:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T10:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow/api',
                title: 'Review workflow - API Reference - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T10:10:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You read documentation about Review workflow across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('uses a research-plus-documentation browser summary when a theme mixes search and docs pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T10:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://google.com/search?q=review+workflow',
                title: 'Review workflow - Google Search',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T10:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T10:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow/intro',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T10:10:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You researched Review workflow by reading documentation across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('uses a comparison-oriented browser summary when the grouped theme includes comparison pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T11:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T11:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T11:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-comparison',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T11:10:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You compared information about Review workflow across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('uses a debugging-oriented browser summary for error and troubleshooting themes', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T12:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://google.com/search?q=vitest+mock+error',
                title: 'Vitest mock error - Google Search',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T12:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T12:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/vitest/mock-error-troubleshooting',
                title: 'Vitest mock error - Troubleshooting - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T12:10:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Vitest mock error',
          summary:
            'You debugged Vitest mock error by reading documentation across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('uses a debugging-plus-documentation browser summary when an error theme includes docs pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T12:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/vitest/mock-error',
                title: 'Vitest mock error',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T12:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T12:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/vitest/mock-error-troubleshooting',
                title: 'Vitest mock error - Troubleshooting - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T12:10:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Vitest mock error',
          summary:
            'You debugged Vitest mock error by reading documentation across 2 pages and 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('prioritizes repeated browser themes ahead of one-off pages when shaping retrieval results', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/one-off',
                title: 'One-off page',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-2',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          title: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 2 browser visits during the requested time range.',
        },
        {
          theme: 'One-off page',
          title: 'One-off page',
          summary:
            'You viewed 1 page about One-off page during the requested time range.',
        },
      ],
    });
  });

  it('prioritizes action-oriented browser themes ahead of passive page views when counts are equal', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/passive-reading',
                title: 'Passive reading',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/vitest/mock-error',
                title: 'Vitest mock error',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Vitest mock error',
          summary:
            'You debugged Vitest mock error across 1 pages and 1 browser visits during the requested time range.',
        },
        {
          theme: 'Passive reading',
          summary:
            'You viewed 1 page about Passive reading during the requested time range.',
        },
      ],
    });
  });

  it('prioritizes browser work themes ahead of generic shell command groups for work-recall queries even when shell groups are larger', async () => {
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
          listMemoryEvents: async () => [
            {
              id: 'shell:shell-history:1',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:1',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git status',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'shell:shell-history:2',
              sourceType: 'shell-history',
              sourceRef: 'shell-history:2',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-shell',
              content: {
                command: 'git diff',
                commandName: 'git',
              },
              captureMetadata: {
                upstreamSource: 'shell-history',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://docs.example.com/review-workflow',
                title: 'Review workflow - Example Docs',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      explanation:
        'MirrorBrain grouped browser activity into theme-level work summaries for this work-recall query.',
      items: [
        {
          theme: 'Review workflow',
        },
        {
          theme: 'git',
        },
      ],
    });
  });

  it('compresses repeated visits to the same browser url into a single representative source ref', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:01:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:01:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-notes',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 3 browser visits during the requested time range.',
          sourceRefs: [
            {
              id: 'browser:aw-event-1',
              sourceRef: 'aw-event-1',
            },
            {
              id: 'browser:aw-event-3',
              sourceRef: 'aw-event-3',
            },
          ],
        },
      ],
    });
  });

  it('uses a browser-oriented summary that reflects repeated visits and unique pages', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:01:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:01:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow-notes',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You reviewed 2 pages about Review workflow across 3 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('keeps repeated browser themes ahead of one-off pages after url compression', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/one-off',
                title: 'One-off page',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T09:01:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/review-workflow',
                title: 'Review workflow',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:01:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Review workflow',
          summary:
            'You revisited 1 page about Review workflow across 2 browser visits during the requested time range.',
        },
        {
          theme: 'One-off page',
          summary:
            'You viewed 1 page about One-off page during the requested time range.',
        },
      ],
    });
  });

  it('prioritizes themes by grouped event count even when url compression leaves fewer source refs', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-2',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-2',
              timestamp: '2026-03-20T08:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:05:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-3',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-3',
              timestamp: '2026-03-20T08:10:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:10:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-4',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-4',
              timestamp: '2026-03-20T08:15:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/repeated-theme',
                title: 'Repeated theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:15:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-5',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-5',
              timestamp: '2026-03-20T09:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/split-theme-1',
                title: 'Split theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:00:00.000Z',
              },
            },
            {
              id: 'browser:aw-event-6',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-6',
              timestamp: '2026-03-20T09:05:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://example.com/split-theme-2',
                title: 'Split theme',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T09:05:00.000Z',
              },
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      items: [
        {
          theme: 'Repeated theme',
          summary:
            'You revisited 1 page about Repeated theme across 4 browser visits during the requested time range.',
        },
        {
          theme: 'Split theme',
          summary:
            'You reviewed 2 pages about Split theme across 2 browser visits during the requested time range.',
        },
      ],
    });
  });

  it('returns knowledge drafts from OpenViking', async () => {
    await expect(
      listKnowledge(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listKnowledgeArtifacts: async () => [
            {
              id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
              draftState: 'draft',
              sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
            },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    ]);
  });

  it('returns skill drafts from OpenViking', async () => {
    await expect(
      listSkillDrafts(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listSkillArtifacts: async () => [
            {
              id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
              approvalState: 'draft',
              workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
              executionSafetyMetadata: {
                requiresConfirmation: true,
              },
            },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    ]);
  });
});
