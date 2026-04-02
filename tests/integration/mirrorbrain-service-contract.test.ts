import { describe, expect, it } from 'vitest';

import { createMirrorBrainService } from '../../src/apps/mirrorbrain-service/index.js';
import { getMirrorBrainConfig } from '../../src/shared/config/index.js';
import type {
  CandidateMemory,
  ReviewedMemory,
} from '../../src/shared/types/index.js';

function createCandidateMemoryFixture(): CandidateMemory {
  return {
    id: 'candidate:2026-03-20:activitywatch-browser:example-com:tasks',
    memoryEventIds: ['browser:aw-event-1'],
    title: 'Example Com / tasks',
    summary: '1 browser event about Example Com / tasks on 2026-03-20.',
    theme: 'example.com / tasks',
    reviewDate: '2026-03-20',
    timeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:00:00.000Z',
    },
    reviewState: 'pending',
  };
}

function createReviewedMemoryFixture(): ReviewedMemory {
  return {
    id: 'reviewed:candidate:2026-03-20:activitywatch-browser:example-com:tasks',
    candidateMemoryId: 'candidate:2026-03-20:activitywatch-browser:example-com:tasks',
    candidateTitle: 'Example Com / tasks',
    candidateSummary: '1 browser event about Example Com / tasks on 2026-03-20.',
    candidateTheme: 'example.com / tasks',
    memoryEventIds: ['browser:aw-event-1'],
    reviewDate: '2026-03-20',
    decision: 'keep',
    reviewedAt: '2026-03-20T10:00:00.000Z',
  };
}

describe('mirrorbrain service contract integration', () => {
  const expectedOpenVikingBaseUrl = getMirrorBrainConfig().openViking.baseUrl;

  it('publishes knowledge and skill artifacts through the service contract', async () => {
    const published: Array<{
      kind: 'knowledge' | 'skill';
      payload: unknown;
    }> = [];

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          syncShellMemory: async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          stop: () => undefined,
        },
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
        publishKnowledge: async (input) => {
          published.push({
            kind: 'knowledge',
            payload: input,
          });

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/knowledge.md',
            rootUri: 'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
          };
        },
        publishSkill: async (input) => {
          published.push({
            kind: 'skill',
            payload: input,
          });

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/skill-draft.md',
            uri: 'viking://resources/mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
          };
        },
      },
    );

    await api.publishKnowledge({
      id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
      draftState: 'draft',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
    });
    await api.publishSkillDraft({
      id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    });

    expect(published).toEqual([
      {
        kind: 'knowledge',
        payload: {
          baseUrl: expectedOpenVikingBaseUrl,
          workspaceDir: '/tmp/mirrorbrain-workspace',
          artifact: {
            id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
            draftState: 'draft',
            sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
          },
        },
      },
      {
        kind: 'skill',
        payload: {
          baseUrl: expectedOpenVikingBaseUrl,
          workspaceDir: '/tmp/mirrorbrain-workspace',
          artifact: {
            id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
            approvalState: 'draft',
            workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
            executionSafetyMetadata: {
              requiresConfirmation: true,
            },
          },
        },
      },
    ]);
  });

  it('generates and publishes artifacts from reviewed memories through the service contract', async () => {
    const generated: Array<{
      kind: 'knowledge' | 'skill';
      payload: unknown;
    }> = [];
    const reviewedMemories = [createReviewedMemoryFixture()];

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          syncShellMemory: async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          stop: () => undefined,
        },
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
        generateKnowledge: () => ({
          id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
          draftState: 'draft',
          sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
        }),
        generateSkillDraft: () => ({
          id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
          approvalState: 'draft',
          workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        }),
        publishKnowledge: async (input) => {
          generated.push({
            kind: 'knowledge',
            payload: input,
          });

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/knowledge.md',
            rootUri: 'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
          };
        },
        publishSkill: async (input) => {
          generated.push({
            kind: 'skill',
            payload: input,
          });

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/skill-draft.md',
            uri: 'viking://resources/mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
          };
        },
      },
    );

    await api.generateKnowledgeFromReviewedMemories(reviewedMemories);
    await api.generateSkillDraftFromReviewedMemories(reviewedMemories);

    expect(generated).toEqual([
      {
        kind: 'knowledge',
        payload: {
          baseUrl: expectedOpenVikingBaseUrl,
          workspaceDir: '/tmp/mirrorbrain-workspace',
          artifact: {
            id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
            draftState: 'draft',
            sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
          },
        },
      },
      {
        kind: 'skill',
        payload: {
          baseUrl: expectedOpenVikingBaseUrl,
          workspaceDir: '/tmp/mirrorbrain-workspace',
          artifact: {
            id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
            approvalState: 'draft',
            workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
            executionSafetyMetadata: {
              requiresConfirmation: true,
            },
          },
        },
      },
    ]);
  });

  it('reviews candidate memories through the service contract', async () => {
    const published: ReviewedMemory[] = [];

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          syncShellMemory: async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          stop: () => undefined,
        },
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
        publishReviewedMemory: async (input) => {
          published.push(input.artifact);

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/reviewed.json',
            rootUri:
              'viking://resources/mirrorbrain/reviewed-memories/reviewed:candidate:browser:aw-event-1.json',
          };
        },
      },
    );

    await expect(
      api.reviewCandidateMemory(
        {
          id: 'candidate:2026-03-20:activitywatch-browser:example-com:tasks',
          memoryEventIds: ['browser:aw-event-1'],
          title: 'Example Com / tasks',
          summary: '1 browser event about Example Com / tasks on 2026-03-20.',
          theme: 'example.com / tasks',
          reviewDate: '2026-03-20',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
          },
          reviewState: 'pending',
        },
        {
          decision: 'keep',
          reviewedAt: '2026-03-20T10:00:00.000Z',
        },
      ),
    ).resolves.toEqual(createReviewedMemoryFixture());
    expect(published).toEqual([createReviewedMemoryFixture()]);
  });

  it('creates daily candidate memories from imported memory through the service contract', async () => {
    const published: CandidateMemory[] = [];
    const memoryEvents = [
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
    ];

    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          syncShellMemory: async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          stop: () => undefined,
        },
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => memoryEvents,
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
        publishCandidateMemory: async (input) => {
          published.push(input.artifact);

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/candidate.json',
            rootUri:
              'viking://resources/mirrorbrain/candidate-memories/candidate:browser:aw-event-1.json',
          };
        },
      },
    );

    await expect(
      api.createDailyCandidateMemories('2026-03-20'),
    ).resolves.toEqual([createCandidateMemoryFixture()]);
    expect(published).toEqual([createCandidateMemoryFixture()]);
  });

  it('returns candidate review suggestions without promoting candidates', async () => {
    const candidate = createCandidateMemoryFixture();
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: async () => ({
            sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          syncShellMemory: async () => ({
            sourceKey: 'shell-history:/tmp/.zsh_history',
            strategy: 'incremental' as const,
            importedCount: 0,
            lastSyncedAt: '2026-03-20T10:00:00.000Z',
          }),
          stop: () => undefined,
        },
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listKnowledge: async () => [],
        listSkillDrafts: async () => [],
      },
    );

    await expect(
      api.suggestCandidateReviews([candidate]),
    ).resolves.toEqual([
      {
        candidateMemoryId: candidate.id,
        recommendation: 'review',
        confidenceScore: 0.55,
        priorityScore: 1,
        rationale:
          'This daily stream has limited evidence and should stay in human review.',
      },
    ]);
  });
});
