import { describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import type { KnowledgeArtifact, MemoryEvent, ReviewedMemory } from '../../shared/types/index.js';
import { createMirrorBrainService } from './index.js';

const runtimeService = {
  status: 'running' as const,
  config: getMirrorBrainConfig(),
  syncBrowserMemory: vi.fn(),
  syncShellMemory: vi.fn(),
  stop: vi.fn(),
};

const reviewedMemory: ReviewedMemory = {
  id: 'reviewed:candidate:browser:vitest',
  candidateMemoryId: 'candidate:browser:vitest',
  candidateTitle: 'Vitest setup and debugging',
  candidateSummary: 'Reviewed Vitest docs and fixed failing test setup.',
  candidateTheme: 'vitest testing',
  memoryEventIds: ['event:vitest-docs'],
  candidateSourceRefs: [
    {
      id: 'event:vitest-docs',
      sourceType: 'activitywatch-browser',
      timestamp: '2026-04-21T09:00:00.000Z',
      title: 'Vitest Config',
      url: 'https://vitest.dev/config/',
      contribution: 'primary',
    },
  ],
  reviewDate: '2026-04-21',
  decision: 'keep',
  reviewedAt: '2026-04-21T10:00:00.000Z',
};

const memoryEvent: MemoryEvent = {
  id: 'event:vitest-docs',
  sourceType: 'activitywatch-browser',
  sourceRef: 'aw-event-1',
  timestamp: '2026-04-21T09:00:00.000Z',
  authorizationScopeId: 'scope-browser',
  content: {
    title: 'Vitest Config',
    url: 'https://vitest.dev/config/',
    pageText: 'Step 1: install Vitest. Step 2: configure projects.',
  },
  captureMetadata: {
    upstreamSource: 'activitywatch',
    checkpoint: '2026-04-21T09:00:00.000Z',
  },
};

describe('mirrorbrain service knowledge generation', () => {
  it('generates knowledge with captured page text instead of only candidate summaries', async () => {
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain/knowledge.md',
      rootUri: 'viking://resources/mirrorbrain/knowledge.md',
    }));
    const analyzeKnowledge = vi.fn(async (prompt: string) => {
      if (prompt.includes('Classify this reviewed work note')) {
        return 'tutorial';
      }

      return [
        '# Vitest setup and debugging',
        '',
        '## Source Synthesis',
        'Step 1: install Vitest. Step 2: configure projects.',
      ].join('\n');
    });
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listRawWorkspaceMemoryEvents: vi.fn(async () => [memoryEvent]),
        publishKnowledge,
        analyzeKnowledge,
      },
    );

    const artifact = await api.generateKnowledgeFromReviewedMemories([
      reviewedMemory,
    ]);

    expect(artifact.body).toContain('Step 1: install Vitest');
    expect(artifact.body).toContain('## Source Synthesis');
    expect(analyzeKnowledge).toHaveBeenCalledWith(
      expect.stringContaining('Step 1: install Vitest'),
    );
    expect(publishKnowledge).toHaveBeenCalledWith({
      baseUrl: getMirrorBrainConfig().openViking.baseUrl,
      workspaceDir: '/tmp/mirrorbrain-workspace',
      artifact,
    });
  });

  it('approves an existing draft by id through the topic merge workflow', async () => {
    const draft: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest setup and debugging',
      summary: '1 reviewed memory synthesized into tutorial knowledge.',
      body: '## Source Synthesis\nStep 1: install Vitest and configure projects.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-21T12:00:00.000Z',
      reviewedAt: '2026-04-21T10:00:00.000Z',
      recencyLabel: '2026-04-21',
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:browser:vitest',
        },
      ],
    };
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain/knowledge.md',
      rootUri: 'viking://resources/mirrorbrain/knowledge.md',
    }));
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listKnowledge: vi.fn(async () => [draft]),
        publishKnowledge,
      },
    );

    const result = await api.approveKnowledgeDraft(draft.id);

    expect(result.assignedTopic).toEqual({
      topicKey: 'vitest-testing',
      title: 'Vitest setup and debugging',
    });
    expect(result.publishedArtifact).toMatchObject({
      artifactType: 'topic-knowledge',
      draftState: 'published',
      topicKey: 'vitest-testing',
      title: 'Vitest setup and debugging',
    });
    expect(publishKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: result.publishedArtifact,
      }),
    );
  });

  it('approves the caller draft snapshot when the persisted draft lookup has not caught up', async () => {
    const draft: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest setup and debugging',
      summary: '1 reviewed memory synthesized into tutorial knowledge.',
      body: '## Source Synthesis\nStep 1: install Vitest and configure projects.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-21T12:00:00.000Z',
      reviewedAt: '2026-04-21T10:00:00.000Z',
      recencyLabel: '2026-04-21',
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:browser:vitest',
        },
      ],
    };
    const publishKnowledge = vi.fn(async () => ({
      sourcePath: '/tmp/mirrorbrain/knowledge.md',
      rootUri: 'viking://resources/mirrorbrain/knowledge.md',
    }));
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listKnowledge: vi.fn(async () => []),
        publishKnowledge,
      },
    );

    const result = await api.approveKnowledgeDraft(draft.id, draft);

    expect(result.assignedTopic).toEqual({
      topicKey: 'vitest-testing',
      title: 'Vitest setup and debugging',
    });
    expect(result.publishedArtifact).toMatchObject({
      artifactType: 'topic-knowledge',
      draftState: 'published',
      topicKey: 'vitest-testing',
      title: 'Vitest setup and debugging',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
    });
    expect(publishKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: result.publishedArtifact,
      }),
    );
  });
});
