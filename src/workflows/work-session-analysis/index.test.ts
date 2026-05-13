import { describe, expect, it } from 'vitest';

import type { MemoryEvent } from '../../shared/types/index.js';
import { analyzeWorkSessionCandidates } from './index.js';

function memoryEvent(input: {
  id: string;
  timestamp: string;
  sourceType: string;
  title: string;
  summary: string;
  project?: string;
  topic?: string;
  url?: string;
}): MemoryEvent {
  const entities: Array<{ kind: string; label: string; ref?: string }> = [];

  if (input.project !== undefined) {
    entities.push({
      kind: 'project',
      label: input.project,
    });
  }

  if (input.topic !== undefined) {
    entities.push({
      kind: 'topic',
      label: input.topic,
    });
  }

  if (input.url !== undefined) {
    entities.push({
      kind: 'url',
      label: input.url,
      ref: input.url,
    });
  }

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
      entities,
      sourceSpecific: {
        ...(input.url !== undefined ? { url: input.url } : {}),
      },
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

  it('filters local browser noise, deduplicates repeated pages, and clusters one project into topic candidates', () => {
    const result = analyzeWorkSessionCandidates({
      analysisWindow: {
        preset: 'last-6-hours',
        startAt: '2026-05-12T06:00:00.000Z',
        endAt: '2026-05-12T12:00:00.000Z',
      },
      generatedAt: '2026-05-12T12:00:00.000Z',
      memoryEvents: [
        memoryEvent({
          id: 'local-browser-1',
          timestamp: '2026-05-12T09:00:00.000Z',
          sourceType: 'browser',
          title: 'MirrorBrain - Personal Memory & Knowledge System',
          summary: 'Local MirrorBrain UI.',
          project: 'mirrorbrain',
          topic: 'Review UI',
          url: 'http://127.0.0.1:3007/',
        }),
        memoryEvent({
          id: 'source-ledger-page-1',
          timestamp: '2026-05-12T10:00:00.000Z',
          sourceType: 'browser',
          title: 'Source ledger architecture',
          summary: 'Explained ledger importer boundaries and bad-line policy.',
          project: 'mirrorbrain',
          topic: 'Source ledger',
          url: 'https://docs.example.com/source-ledger',
        }),
        memoryEvent({
          id: 'source-ledger-page-duplicate',
          timestamp: '2026-05-12T10:03:00.000Z',
          sourceType: 'browser',
          title: 'Source ledger architecture',
          summary: 'Explained ledger importer boundaries and bad-line policy.',
          project: 'mirrorbrain',
          topic: 'Source ledger',
          url: 'https://docs.example.com/source-ledger',
        }),
        memoryEvent({
          id: 'source-ledger-shell-1',
          timestamp: '2026-05-12T10:15:00.000Z',
          sourceType: 'shell',
          title: 'Run source ledger tests',
          summary: 'Ran Vitest for the source-ledger importer.',
          project: 'mirrorbrain',
          topic: 'Source ledger',
        }),
        memoryEvent({
          id: 'memory-sources-page-1',
          timestamp: '2026-05-12T11:00:00.000Z',
          sourceType: 'browser',
          title: 'Memory Sources layout',
          summary: 'Reviewed the memory source detail layout and ledger format tab.',
          project: 'mirrorbrain',
          topic: 'Memory Sources UI',
          url: 'https://docs.example.com/memory-sources-ui',
        }),
      ],
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => candidate.title)).toEqual([
      'Memory Sources UI',
      'Source ledger',
    ]);
    expect(result.candidates[0]).toMatchObject({
      projectHint: 'mirrorbrain',
      memoryEventIds: ['memory-sources-page-1'],
      relationHints: ['Memory Sources UI', 'Memory Sources layout'],
    });
    expect(result.candidates[1]).toMatchObject({
      projectHint: 'mirrorbrain',
      memoryEventIds: ['source-ledger-page-1', 'source-ledger-shell-1'],
      relationHints: [
        'Source ledger',
        'Source ledger architecture',
        'Run source ledger tests',
      ],
    });
    expect(result.candidates[1].summary).toContain(
      'Explained ledger importer boundaries',
    );
    expect(result.candidates[1].summary).toContain(
      'Ran Vitest for the source-ledger importer',
    );
    expect(result.excludedMemoryEventIds).toEqual([
      'local-browser-1',
      'source-ledger-page-duplicate',
    ]);
  });

  it('infers project and topic hints for source-ledger browser records without explicit entities', () => {
    const result = analyzeWorkSessionCandidates({
      analysisWindow: {
        preset: 'last-6-hours',
        startAt: '2026-05-12T06:00:00.000Z',
        endAt: '2026-05-12T12:00:00.000Z',
      },
      generatedAt: '2026-05-12T12:00:00.000Z',
      memoryEvents: [
        memoryEvent({
          id: 'browser-doc-1',
          timestamp: '2026-05-12T10:00:00.000Z',
          sourceType: 'browser',
          title: 'MirrorBrain work-session review design',
          summary: 'Reviewed the work-session review design.',
          url: 'https://docs.example.com/mirrorbrain/work-session-review',
        }),
        memoryEvent({
          id: 'browser-doc-2',
          timestamp: '2026-05-12T10:15:00.000Z',
          sourceType: 'browser',
          title: 'MirrorBrain work-session candidate clustering',
          summary: 'Compared clustering rules for candidate generation.',
          url: 'https://docs.example.com/mirrorbrain/candidate-clustering',
        }),
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      projectHint: 'docs.example.com',
      title: 'mirrorbrain work session',
      memoryEventIds: ['browser-doc-1', 'browser-doc-2'],
    });
  });
});
