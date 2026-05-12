import { describe, expect, it } from 'vitest';

import type { MemoryEvent } from '../../shared/types/index.js';
import { analyzeWorkSessionCandidates } from './index.js';

function memoryEvent(input: {
  id: string;
  timestamp: string;
  sourceType: string;
  title: string;
  summary: string;
  project: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: input.sourceType,
    sourceRef: `${input.sourceType}:source:${input.id}`,
    timestamp: input.timestamp,
    authorizationScopeId: 'scope-source-ledger',
    content: {
      title: input.title,
      summary: input.summary,
      contentKind: input.sourceType,
      entities: [
        {
          kind: 'project',
          label: input.project,
        },
      ],
      sourceSpecific: {},
    },
    captureMetadata: {
      upstreamSource: `source-ledger:${input.sourceType}`,
      checkpoint: `ledgers/2026-05-12/${input.sourceType}.jsonl:1`,
    },
  };
}

describe('work-session analysis', () => {
  it('creates multiple project-scoped WorkSession candidates inside the selected window', () => {
    const result = analyzeWorkSessionCandidates({
      analysisWindow: {
        preset: 'last-6-hours',
        startAt: '2026-05-12T06:00:00.000Z',
        endAt: '2026-05-12T12:00:00.000Z',
      },
      generatedAt: '2026-05-12T12:00:00.000Z',
      memoryEvents: [
        memoryEvent({
          id: 'browser-1',
          timestamp: '2026-05-12T10:00:00.000Z',
          sourceType: 'browser',
          title: 'Phase 4 design',
          summary: 'Read source ledger design notes.',
          project: 'mirrorbrain',
        }),
        memoryEvent({
          id: 'shell-1',
          timestamp: '2026-05-12T10:15:00.000Z',
          sourceType: 'shell',
          title: 'Run source tests',
          summary: 'Ran vitest for source ledgers.',
          project: 'mirrorbrain',
        }),
        memoryEvent({
          id: 'browser-2',
          timestamp: '2026-05-12T11:00:00.000Z',
          sourceType: 'browser',
          title: 'Other product',
          summary: 'Read unrelated planning notes.',
          project: 'other-product',
        }),
        memoryEvent({
          id: 'old-1',
          timestamp: '2026-05-12T01:00:00.000Z',
          sourceType: 'browser',
          title: 'Old page',
          summary: 'Outside the selected window.',
          project: 'mirrorbrain',
        }),
      ],
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      projectHint: 'mirrorbrain',
      memoryEventIds: ['browser-1', 'shell-1'],
      sourceTypes: ['browser', 'shell'],
      reviewState: 'pending',
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:15:00.000Z',
      },
    });
    expect(result.candidates[1]).toMatchObject({
      projectHint: 'other-product',
      memoryEventIds: ['browser-2'],
    });
    expect(result.excludedMemoryEventIds).toEqual(['old-1']);
  });
});
