import { describe, expect, it } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import {
  createIncrementalShellHistorySyncPlan,
  createInitialShellHistorySyncPlan,
  normalizeShellHistoryEntry,
  parseShellHistory,
} from './index.js';

describe('shell history source', () => {
  it('uses a controlled backfill window for initial shell sync', () => {
    const config = getMirrorBrainConfig();

    expect(
      createInitialShellHistorySyncPlan(config, {
        now: '2026-03-20T08:00:00.000Z',
      }),
    ).toEqual({
      strategy: 'initial-backfill',
      start: '2026-03-19T08:00:00.000Z',
      end: '2026-03-20T08:00:00.000Z',
    });
  });

  it('uses the checkpoint window for incremental shell sync', () => {
    const config = getMirrorBrainConfig();

    expect(
      createIncrementalShellHistorySyncPlan(config, {
        lastSyncedAt: '2026-03-20T07:00:00.000Z',
        now: '2026-03-20T08:00:00.000Z',
      }),
    ).toEqual({
      strategy: 'incremental',
      start: '2026-03-20T07:00:00.000Z',
      end: '2026-03-20T08:00:00.000Z',
    });
  });

  it('parses zsh extended history lines into timestamped shell entries', () => {
    expect(
      parseShellHistory(`
: 1773974100:0;git status
: 1773974160:0;pnpm vitest run
`.trim()),
    ).toEqual([
      {
        id: 'shell-history:1773974100:git-status',
        timestamp: '2026-03-20T02:35:00.000Z',
        command: 'git status',
      },
      {
        id: 'shell-history:1773974160:pnpm-vitest-run',
        timestamp: '2026-03-20T02:36:00.000Z',
        command: 'pnpm vitest run',
      },
    ]);
  });

  it('ignores malformed shell history lines that do not expose a timestamp and command', () => {
    expect(
      parseShellHistory(`
plain line
: bad-timestamp:0;git status
: 1773974100:0;
`.trim()),
    ).toEqual([]);
  });

  it('normalizes a shell history entry into a shell memory event', () => {
    expect(
      normalizeShellHistoryEntry({
        scopeId: 'scope-shell',
        event: {
          id: 'shell-history:1773974100:git-status',
          timestamp: '2026-03-18T16:35:00.000Z',
          command: 'git status',
        },
      }),
    ).toEqual({
      id: 'shell:shell-history:1773974100:git-status',
      sourceType: 'shell-history',
      sourceRef: 'shell-history:1773974100:git-status',
      timestamp: '2026-03-18T16:35:00.000Z',
      authorizationScopeId: 'scope-shell',
      content: {
        command: 'git status',
        commandName: 'git',
      },
      captureMetadata: {
        upstreamSource: 'shell-history',
        checkpoint: '2026-03-18T16:35:00.000Z',
      },
    });
  });
});
