import { describe, expect, it } from 'vitest';

import { createMirrorBrainService } from '../../src/apps/mirrorbrain-service/index.js';
import { getMirrorBrainConfig } from '../../src/shared/config/index.js';
import type {
  CandidateMemory,
  ReviewedMemory,
} from '../../src/shared/types/index.js';

describe('mirrorbrain service contract integration', () => {
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
          stop: () => undefined,
        },
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        queryMemory: async () => [],
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
          baseUrl: 'http://127.0.0.1:8080',
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
          baseUrl: 'http://127.0.0.1:8080',
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
    const reviewedMemories = [
      {
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep' as const,
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
          stop: () => undefined,
        },
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        queryMemory: async () => [],
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
          baseUrl: 'http://127.0.0.1:8080',
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
          baseUrl: 'http://127.0.0.1:8080',
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
          stop: () => undefined,
        },
      },
      {
        queryMemory: async () => [],
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
          id: 'candidate:browser:aw-event-1',
          memoryEventIds: ['browser:aw-event-1'],
          reviewState: 'pending',
        },
        {
          decision: 'keep',
        },
      ),
    ).resolves.toEqual({
      id: 'reviewed:candidate:browser:aw-event-1',
      candidateMemoryId: 'candidate:browser:aw-event-1',
      decision: 'keep',
    });
    expect(published).toEqual([
      {
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep',
      },
    ]);
  });

  it('creates candidate memories from raw memory events through the service contract', async () => {
    const published: CandidateMemory[] = [];

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
          stop: () => undefined,
        },
      },
      {
        queryMemory: async () => [],
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
      api.createCandidateMemory([
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
      ]),
    ).resolves.toEqual({
      id: 'candidate:browser:aw-event-1',
      memoryEventIds: ['browser:aw-event-1'],
      reviewState: 'pending',
    });
    expect(published).toEqual([
      {
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewState: 'pending',
      },
    ]);
  });
});
