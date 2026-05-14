import { describe, expect, it } from 'vitest';

import { createMirrorBrainService } from '../../src/apps/mirrorbrain-service/index.js';
import { getMirrorBrainConfig } from '../../src/shared/config/index.js';
import type {
  CandidateMemory,
  ReviewedMemory,
} from '../../src/shared/types/index.js';

function createCandidateMemoryFixture(): CandidateMemory {
  return {
    id: 'candidate:2026-03-20:activitywatch-browser:tasks',
    memoryEventIds: ['browser:aw-event-1'],
    title: 'Work on Tasks',
    summary: 'Worked on Tasks over about 1 minutes.',
    theme: 'tasks',
    formationReasons: ['Started from web evidence on Tasks.'],
    compressedSourceCount: 0,
    discardReasons: undefined,
    discardedSourceRefs: undefined,
    reviewDate: '2026-03-20',
    timeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:00:00.000Z',
    },
    sourceRefs: [
      {
        id: 'browser:aw-event-1',
        contribution: 'primary',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-03-20T08:00:00.000Z',
        title: 'Example Tasks',
        url: 'https://example.com/tasks',
        role: 'web',
      },
    ],
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
    candidateSourceRefs: undefined,
    candidateFormationReasons: undefined,
    candidateTimeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:00:00.000Z',
    },
    memoryEventIds: ['browser:aw-event-1'],
    reviewDate: '2026-03-20',
    decision: 'keep',
    reviewedAt: '2026-03-20T10:00:00.000Z',
  };
}

function createRuntimeService() {
  return {
    status: 'running' as const,
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
  };
}

describe('mirrorbrain service contract integration', () => {
  it('publishes skill artifacts through the service contract', async () => {
    const published: unknown[] = [];

    const api = createMirrorBrainService(
      {
        service: createRuntimeService(),
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listSkillDrafts: async () => [],
        publishSkill: async (input) => {
          published.push(input);

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/skill-draft.md',
            uri: 'qmd://mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
          };
        },
      },
    );

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
    ]);
  });

  it('generates and publishes skill artifacts from reviewed memories through the service contract', async () => {
    const generated: unknown[] = [];
    const reviewedMemories = [createReviewedMemoryFixture()];

    const api = createMirrorBrainService(
      {
        service: createRuntimeService(),
        workspaceDir: '/tmp/mirrorbrain-workspace',
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listSkillDrafts: async () => [],
        generateSkillDraft: () => ({
          id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
          approvalState: 'draft',
          workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        }),
        publishSkill: async (input) => {
          generated.push(input);

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/skill-draft.md',
            uri: 'qmd://mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
          };
        },
      },
    );

    await api.generateSkillDraftFromReviewedMemories(reviewedMemories);

    expect(generated).toEqual([
      {
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
    ]);
  });

  it('reviews candidate memories through the service contract', async () => {
    const published: ReviewedMemory[] = [];

    const api = createMirrorBrainService(
      {
        service: createRuntimeService(),
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listSkillDrafts: async () => [],
        publishReviewedMemory: async (input) => {
          published.push(input.artifact);

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/reviewed.json',
            rootUri:
              'qmd://mirrorbrain/reviewed-memories/reviewed:candidate:browser:aw-event-1.json',
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
        service: createRuntimeService(),
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => memoryEvents,
        listRawWorkspaceMemoryEvents: async () => memoryEvents,
        listSkillDrafts: async () => [],
        publishCandidateMemory: async (input) => {
          published.push(input.artifact);

          return {
            sourcePath: '/tmp/mirrorbrain-workspace/candidate.json',
            rootUri:
              'qmd://mirrorbrain/candidate-memories/candidate:browser:aw-event-1.json',
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
        service: createRuntimeService(),
      },
      {
        queryMemory: async () => ({ items: [] }),
        listMemoryEvents: async () => [],
        listSkillDrafts: async () => [],
      },
    );

    await expect(
      api.suggestCandidateReviews([candidate]),
    ).resolves.toEqual([
      {
        candidateMemoryId: candidate.id,
        recommendation: 'discard',
        confidenceScore: 0.74,
        keepScore: 26,
        primarySourceCount: 1,
        supportingSourceCount: 0,
        evidenceSummary: 'Built from 1 primary page and 0 supporting pages.',
        priorityScore: 1,
        rationale:
          'Brief activity on Tasks. Short duration suggests quick reference or navigation.',
        supportingReasons: [
          'Short duration suggests quick reference or navigation.',
        ],
      },
    ]);
  });
});
