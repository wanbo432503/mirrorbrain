import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
        workspaceDir: mkdtempSync(join(tmpdir(), 'mirrorbrain-approval-existing-')),
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

  it('approves the caller draft snapshot when a stale persisted draft has the same id', async () => {
    const staleDraft: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest',
      draftState: 'draft',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      body: '',
    };
    const snapshot: KnowledgeArtifact = {
      id: staleDraft.id,
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Complete Vitest setup note',
      summary: 'Complete reviewed memory synthesized into tutorial knowledge.',
      body: '## Source Synthesis\nUse the complete caller snapshot body.',
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
        workspaceDir: mkdtempSync(join(tmpdir(), 'mirrorbrain-approval-snapshot-')),
      },
      {
        listKnowledge: vi.fn(async () => [staleDraft]),
        publishKnowledge,
      },
    );

    const result = await api.approveKnowledgeDraft(snapshot.id, snapshot);

    expect(result.assignedTopic).toEqual({
      topicKey: 'vitest-testing',
      title: 'Complete Vitest setup note',
    });
    expect(result.publishedArtifact).toMatchObject({
      title: 'Complete Vitest setup note',
      body: expect.stringContaining('complete caller snapshot body'),
      topicKey: 'vitest-testing',
    });
  });

  it('removes the source draft from knowledge listings after approval', async () => {
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
    const persistedArtifacts: KnowledgeArtifact[] = [draft];
    const publishKnowledge = vi.fn(async (input: { artifact: KnowledgeArtifact }) => {
      const existingIndex = persistedArtifacts.findIndex(
        (artifact) => artifact.id === input.artifact.id,
      );
      if (existingIndex === -1) {
        persistedArtifacts.push(input.artifact);
      } else {
        persistedArtifacts[existingIndex] = input.artifact;
      }

      return {
        sourcePath: '/tmp/mirrorbrain/knowledge.md',
        rootUri: 'viking://resources/mirrorbrain/knowledge.md',
      };
    });
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: mkdtempSync(join(tmpdir(), 'mirrorbrain-approval-cleanup-')),
      },
      {
        listKnowledge: vi.fn(async () => persistedArtifacts),
        publishKnowledge,
      },
    );

    const result = await api.approveKnowledgeDraft(draft.id);

    await expect(api.listKnowledge()).resolves.toEqual([result.publishedArtifact]);
  });

  it('removes the approved merge candidate from knowledge listings after approval', async () => {
    const mergeCandidate: KnowledgeArtifact = {
      id: 'topic-merge-candidate:vitest-testing:knowledge-new:knowledge-old',
      artifactType: 'topic-merge-candidate',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Merge candidate: Vitest debugging workflow',
      summary: 'Suggested merge with similar knowledge.',
      body: '## Merge Suggestion\nUse Vitest debug workflow.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      derivedFromKnowledgeIds: [
        'knowledge-draft:reviewed:candidate:browser:vitest-new',
        'topic-knowledge:vitest-testing:v1',
      ],
      updatedAt: '2026-04-21T12:00:00.000Z',
    };
    const persistedArtifacts: KnowledgeArtifact[] = [mergeCandidate];
    const publishKnowledge = vi.fn(async (input: { artifact: KnowledgeArtifact }) => {
      const existingIndex = persistedArtifacts.findIndex(
        (artifact) => artifact.id === input.artifact.id,
      );
      if (existingIndex === -1) {
        persistedArtifacts.push(input.artifact);
      } else {
        persistedArtifacts[existingIndex] = input.artifact;
      }

      return {
        sourcePath: '/tmp/mirrorbrain/knowledge.md',
        rootUri: 'viking://resources/mirrorbrain/knowledge.md',
      };
    });
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: mkdtempSync(join(tmpdir(), 'mirrorbrain-approval-merge-candidate-')),
      },
      {
        listKnowledge: vi.fn(async () => persistedArtifacts),
        publishKnowledge,
      },
    );

    const result = await api.approveKnowledgeDraft(mergeCandidate.id);

    await expect(api.listKnowledge()).resolves.toEqual([result.publishedArtifact]);
  });

  it('deletes the source draft when deleting a published knowledge artifact', async () => {
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
    };
    const published: KnowledgeArtifact = {
      ...draft,
      id: 'topic-knowledge:vitest-testing:v1',
      artifactType: 'topic-knowledge',
      draftState: 'published',
      derivedFromKnowledgeIds: [draft.id],
      isCurrentBest: true,
      updatedAt: '2026-04-21T13:00:00.000Z',
    };
    const persistedArtifacts: KnowledgeArtifact[] = [draft, published];
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: mkdtempSync(join(tmpdir(), 'mirrorbrain-published-delete-')),
      },
      {
        listKnowledge: vi.fn(async () => persistedArtifacts),
      },
    );

    await api.deleteKnowledgeArtifact(published.id);

    await expect(api.listKnowledge()).resolves.toEqual([]);
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

  it('refreshes related knowledge ids when a generated artifact overlaps existing knowledge', async () => {
    const existingArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest-old',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest testing setup',
      summary: 'Notes about Vitest configuration and test setup.',
      body: 'Vitest projects and setup files.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest-old'],
      tags: ['vitest'],
    };
    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest-new',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest debugging workflow',
      summary: 'More notes about Vitest tests.',
      body: 'Vitest debug and test workflow.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      tags: ['vitest'],
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
        listKnowledge: vi.fn(async () => [existingArtifact]),
        generateKnowledge: vi.fn(async () => generatedArtifact),
        publishKnowledge,
      },
    );

    const artifact = await api.generateKnowledgeFromReviewedMemories([
      reviewedMemory,
    ]);

    expect(artifact.relatedKnowledgeIds).toEqual([existingArtifact.id]);
    expect(publishKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: existingArtifact.id,
          relatedKnowledgeIds: [generatedArtifact.id],
        }),
      }),
    );
    expect(publishKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: generatedArtifact.id,
          relatedKnowledgeIds: [existingArtifact.id],
        }),
      }),
    );
  });

  it('returns the generated artifact when refreshing existing related knowledge fails', async () => {
    const existingArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest-old',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest testing setup',
      summary: 'Notes about Vitest configuration.',
      body: 'Vitest setup notes.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest-old'],
      tags: ['vitest'],
    };
    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest-new',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest debugging workflow',
      summary: 'More notes about Vitest tests.',
      body: 'Vitest debug workflow.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      tags: ['vitest'],
    };
    const publishKnowledge = vi.fn(async (input: { artifact: KnowledgeArtifact }) => {
      if (input.artifact.id === existingArtifact.id) {
        throw new Error('OpenViking existing relation publish failed');
      }

      return {
        sourcePath: '/tmp/mirrorbrain/knowledge.md',
        rootUri: 'viking://resources/mirrorbrain/knowledge.md',
      };
    });
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listKnowledge: vi.fn(async () => [existingArtifact]),
        generateKnowledge: vi.fn(async () => generatedArtifact),
        publishKnowledge,
      },
    );

    await expect(
      api.generateKnowledgeFromReviewedMemories([reviewedMemory]),
    ).resolves.toMatchObject({
      id: generatedArtifact.id,
      relatedKnowledgeIds: [existingArtifact.id],
    });
    expect(publishKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: generatedArtifact.id,
          relatedKnowledgeIds: [existingArtifact.id],
        }),
      }),
    );
  });

  it('schedules knowledge lint asynchronously after generating a knowledge draft', async () => {
    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest-new',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest debugging workflow',
      summary: 'More notes about Vitest tests.',
      body: 'Vitest debug workflow.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      tags: ['vitest'],
    };
    const lintKnowledge = vi.fn(async () => ({
      updateArtifacts: [],
      deleteArtifactIds: [],
      mergeCandidateArtifacts: [],
    }));
    const api = createMirrorBrainService(
      {
        service: runtimeService,
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        listKnowledge: vi.fn(async () => []),
        generateKnowledge: vi.fn(async () => generatedArtifact),
        publishKnowledge: vi.fn(async () => ({
          sourcePath: '/tmp/mirrorbrain/knowledge.md',
          rootUri: 'viking://resources/mirrorbrain/knowledge.md',
        })),
        lintKnowledge,
      },
    );

    const artifact = await api.generateKnowledgeFromReviewedMemories([
      reviewedMemory,
    ]);

    expect(artifact.id).toBe(generatedArtifact.id);
    await vi.waitFor(() => {
      expect(lintKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          seedKnowledgeIds: [generatedArtifact.id],
          knowledgeArtifacts: expect.arrayContaining([
            expect.objectContaining({ id: generatedArtifact.id }),
          ]),
        }),
      );
    });
  });

  it('publishes merge candidates returned by asynchronous knowledge lint', async () => {
    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:vitest-new',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Vitest debugging workflow',
      summary: 'More notes about Vitest tests.',
      body: 'Vitest debug workflow.',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      tags: ['vitest'],
    };
    const mergeCandidate: KnowledgeArtifact = {
      id: 'topic-merge-candidate:vitest-testing:knowledge-new:knowledge-old',
      artifactType: 'topic-merge-candidate',
      draftState: 'draft',
      topicKey: 'vitest-testing',
      title: 'Merge candidate: Vitest debugging workflow',
      summary: 'Suggested merge with similar knowledge.',
      body: '## Merge Suggestion',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:vitest'],
      derivedFromKnowledgeIds: [generatedArtifact.id, 'topic-knowledge:vitest-testing:v1'],
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
        generateKnowledge: vi.fn(async () => generatedArtifact),
        publishKnowledge,
        lintKnowledge: vi.fn(async () => ({
          updateArtifacts: [],
          deleteArtifactIds: [],
          mergeCandidateArtifacts: [mergeCandidate],
        })),
      },
    );

    await api.generateKnowledgeFromReviewedMemories([reviewedMemory]);

    await vi.waitFor(() => {
      expect(publishKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          artifact: mergeCandidate,
        }),
      );
    });
  });
});
