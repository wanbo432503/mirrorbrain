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
          id: 'browser-1b',
          timestamp: '2026-05-12T10:20:00.000Z',
          sourceType: 'browser',
          title: 'Review source sync docs',
          summary: 'Reviewed source sync validation notes.',
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
          id: 'browser-3',
          timestamp: '2026-05-12T11:10:00.000Z',
          sourceType: 'browser',
          title: 'Other product roadmap',
          summary: 'Read additional roadmap notes.',
          project: 'other-product',
        }),
        memoryEvent({
          id: 'browser-4',
          timestamp: '2026-05-12T11:20:00.000Z',
          sourceType: 'browser',
          title: 'Other product review',
          summary: 'Read review notes for the other product.',
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
      memoryEventIds: ['browser-1', 'shell-1', 'browser-1b'],
      sourceTypes: ['browser', 'shell'],
      reviewState: 'pending',
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:20:00.000Z',
      },
    });
    expect(result.candidates[1]).toMatchObject({
      projectHint: 'other-product',
      memoryEventIds: ['browser-2', 'browser-3', 'browser-4'],
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
          id: 'source-ledger-page-2',
          timestamp: '2026-05-12T10:20:00.000Z',
          sourceType: 'browser',
          title: 'Source ledger bad-line policy',
          summary: 'Reviewed source-ledger bad-line handling.',
          project: 'mirrorbrain',
          topic: 'Source ledger',
          url: 'https://docs.example.com/source-ledger-bad-lines',
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
        memoryEvent({
          id: 'memory-sources-page-2',
          timestamp: '2026-05-12T11:10:00.000Z',
          sourceType: 'browser',
          title: 'Memory Sources ledger format',
          summary: 'Reviewed source-specific ledger format rendering.',
          project: 'mirrorbrain',
          topic: 'Memory Sources UI',
          url: 'https://docs.example.com/memory-sources-ledger-format',
        }),
        memoryEvent({
          id: 'memory-sources-page-3',
          timestamp: '2026-05-12T11:20:00.000Z',
          sourceType: 'browser',
          title: 'Memory Sources settings',
          summary: 'Reviewed source settings behavior.',
          project: 'mirrorbrain',
          topic: 'Memory Sources UI',
          url: 'https://docs.example.com/memory-sources-settings',
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
      memoryEventIds: [
        'memory-sources-page-1',
        'memory-sources-page-2',
        'memory-sources-page-3',
      ],
      relationHints: [
        'Memory Sources UI',
        'Memory Sources layout',
        'Memory Sources ledger format',
        'Memory Sources settings',
      ],
    });
    expect(result.candidates[1]).toMatchObject({
      projectHint: 'mirrorbrain',
      memoryEventIds: [
        'source-ledger-page-1',
        'source-ledger-shell-1',
        'source-ledger-page-2',
      ],
      relationHints: [
        'Source ledger',
        'Source ledger architecture',
        'Run source ledger tests',
        'Source ledger bad-line policy',
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
        memoryEvent({
          id: 'browser-doc-3',
          timestamp: '2026-05-12T10:30:00.000Z',
          sourceType: 'browser',
          title: 'MirrorBrain work-session publish flow',
          summary: 'Reviewed manual generate and publish behavior.',
          url: 'https://docs.example.com/mirrorbrain/work-session-publish',
        }),
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      projectHint: 'MirrorBrain',
      title: 'Work-session review flow',
      memoryEventIds: ['browser-doc-1', 'browser-doc-2', 'browser-doc-3'],
    });
  });

  it('filters low-value update pages and only emits abstract topics with at least three memory events', () => {
    const result = analyzeWorkSessionCandidates({
      analysisWindow: {
        preset: 'last-6-hours',
        startAt: '2026-05-12T06:00:00.000Z',
        endAt: '2026-05-12T12:00:00.000Z',
      },
      generatedAt: '2026-05-12T12:00:00.000Z',
      memoryEvents: [
        memoryEvent({
          id: 'adblock-update',
          timestamp: '2026-05-12T09:00:00.000Z',
          sourceType: 'browser',
          title: '您的 AdBlock 已更新！',
          summary: '您的 AdBlock 已更新！',
          url: 'https://getadblock.com/zh_CN/update/latest/',
        }),
        memoryEvent({
          id: 'cluster-cloud',
          timestamp: '2026-05-12T10:00:00.000Z',
          sourceType: 'browser',
          title: '8个超级经典的聚类算法 腾讯云开发者社区 腾讯云',
          summary: '阅读聚类算法的经典方法和适用场景。',
          url: 'https://cloud.tencent.com/developer/article/2430459',
        }),
        memoryEvent({
          id: 'cluster-zhihu',
          timestamp: '2026-05-12T10:10:00.000Z',
          sourceType: 'browser',
          title: '常用聚类算法 知乎 常用聚类算法',
          summary: '阅读常见聚类算法的区别。',
          url: 'https://zhuanlan.zhihu.com/p/104355127',
        }),
        memoryEvent({
          id: 'cluster-chatgpt',
          timestamp: '2026-05-12T10:20:00.000Z',
          sourceType: 'browser',
          title: '聚类算法与任务发现',
          summary: '讨论如何用聚类算法发现任务主题。',
          url: 'https://chatgpt.com/c/clustering-task-discovery',
        }),
        memoryEvent({
          id: 'one-off-page',
          timestamp: '2026-05-12T11:00:00.000Z',
          sourceType: 'browser',
          title: 'Unrelated single page',
          summary: 'A one-off page should not become a topic.',
          url: 'https://example.com/single-page',
        }),
      ],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      projectHint: '聚类算法研究',
      title: '聚类算法方法与应用',
      memoryEventIds: ['cluster-cloud', 'cluster-zhihu', 'cluster-chatgpt'],
      sourceTypes: ['browser'],
    });
    expect(result.excludedMemoryEventIds).toEqual([
      'adblock-update',
      'one-off-page',
    ]);
  });
});
