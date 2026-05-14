import { describe, expect, it, vi } from 'vitest';

import type { WorkSessionCandidate } from '../../workflows/work-session-analysis/index.js';
import { generateKnowledgeArticlePreview } from './index.js';

const candidate: WorkSessionCandidate = {
  id: 'work-session-candidate:clustering',
  projectHint: '聚类算法研究',
  title: '聚类算法方法与应用',
  summary: '阅读 K-Means、DBSCAN 和层次聚类资料。',
  memoryEventIds: ['browser-kmeans', 'browser-dbscan'],
  sourceTypes: ['browser'],
  timeRange: {
    startAt: '2026-05-14T01:12:00.000Z',
    endAt: '2026-05-14T01:30:00.000Z',
  },
  relationHints: ['聚类算法方法与应用'],
  evidenceItems: [
    {
      memoryEventId: 'browser-kmeans',
      sourceType: 'browser',
      title: 'K-Means 聚类',
      url: 'https://example.com/kmeans',
      summary: 'K-Means 适合球状簇。',
      excerpt: 'K-Means 通过迭代更新质心，把样本分配到最近的簇，适合大规模数值数据。',
    },
    {
      memoryEventId: 'browser-dbscan',
      sourceType: 'browser',
      title: 'DBSCAN 密度聚类',
      url: 'https://example.com/dbscan',
      summary: 'DBSCAN 能识别噪声点。',
      excerpt: 'DBSCAN 通过密度可达关系形成簇，适合非凸形状数据，但参数敏感。',
    },
  ],
  reviewState: 'pending',
};

describe('knowledge article preview synthesis', () => {
  it('uses LLM synthesis over candidate evidence excerpts', async () => {
    const analyzeWithLLM = vi.fn(async (prompt: string) => {
      expect(prompt).toContain('K-Means 通过迭代更新质心');
      expect(prompt).toContain('DBSCAN 通过密度可达关系形成簇');
      expect(prompt).toContain('topic-oriented wiki page');

      return [
        '# 聚类算法选择与应用知识',
        '',
        '## 核心结论',
        'K-Means、DBSCAN 和层次聚类应按数据形状、噪声和解释需求选择。',
        '',
        '## 来源',
        '- [S1] K-Means 聚类',
      ].join('\n');
    });

    const preview = await generateKnowledgeArticlePreview({
      candidate,
      generatedAt: '2026-05-14T02:00:00.000Z',
      analyzeWithLLM,
    });

    expect(preview).toMatchObject({
      candidateId: candidate.id,
      title: '聚类算法选择与应用知识',
      summary: candidate.summary,
      knowledgeType: 'systematic-knowledge',
      sourceTypes: ['browser'],
      memoryEventCount: 2,
    });
    expect(preview.body).toContain('## 核心结论');
    expect(preview.body).toContain('K-Means、DBSCAN');
    expect(analyzeWithLLM).toHaveBeenCalledTimes(1);
  });

  it('formats fallback sources as markdown links for URLs and local file paths', async () => {
    const preview = await generateKnowledgeArticlePreview({
      candidate: {
        ...candidate,
        evidenceItems: [
          {
            memoryEventId: 'browser-kmeans',
            sourceType: 'browser',
            title: 'K-Means 聚类',
            url: 'https://example.com/kmeans?token=secret#section',
            excerpt: 'K-Means evidence.',
          },
          {
            memoryEventId: 'file-notes',
            sourceType: 'file-activity',
            title: '聚类笔记.md',
            filePath: '/Users/wanbo/Notes/聚类笔记.md',
            excerpt: 'Local file evidence.',
          },
        ],
      },
      generatedAt: '2026-05-14T02:00:00.000Z',
    });

    expect(preview.body).toContain(
      '- [S1] [K-Means 聚类](https://example.com/kmeans#section): K-Means evidence.',
    );
    expect(preview.body).toContain(
      '- [S2] [聚类笔记.md](file:///Users/wanbo/Notes/%E8%81%9A%E7%B1%BB%E7%AC%94%E8%AE%B0.md): Local file evidence.',
    );
    expect(preview.body).not.toContain('https://example.com/kmeans?token=secret');
    expect(preview.body).not.toContain('/Users/wanbo/Notes/聚类笔记.md');
  });
});
