import { mkdtempSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMirrorBrainConfig } from '../../shared/config/index.js';
import { ValidationError } from '../mirrorbrain-service/errors.js';
import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  KnowledgeArtifact,
  MemoryQueryResult,
  MemoryEvent,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';
import type { SourceAuditEvent } from '../../modules/source-ledger-importer/index.js';
import { startMirrorBrainHttpServer } from './index.js';

function createCandidateMemoryFixture(input: {
  id: string;
  memoryEventIds: string[];
}): CandidateMemory {
  return {
    id: input.id,
    memoryEventIds: input.memoryEventIds,
    title: 'Docs Example Com / guides',
    summary: `${input.memoryEventIds.length} browser events about Docs Example Com / guides on 2026-03-20.`,
    theme: 'docs.example.com / guides',
    reviewDate: '2026-03-20',
    timeRange: {
      startAt: '2026-03-20T08:00:00.000Z',
      endAt: '2026-03-20T08:15:00.000Z',
    },
    sourceRefs: input.memoryEventIds.map((memoryEventId, index) => ({
      id: memoryEventId,
      sourceType: 'activitywatch-browser',
      timestamp: `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      title: `Source ${index + 1}`,
      url: `https://example.com/${memoryEventId}`,
    })),
    reviewState: 'pending',
  };
}

function createReviewedMemoryFixture(): ReviewedMemory {
  return {
    id: 'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    candidateMemoryId:
      'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
    candidateTitle: 'Docs Example Com / guides',
    candidateSummary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
    candidateTheme: 'docs.example.com / guides',
    memoryEventIds: ['browser:aw-event-1'],
    reviewDate: '2026-03-20',
    decision: 'keep',
    reviewedAt: '2026-03-20T10:00:00.000Z',
  };
}

describe('mirrorbrain http server', () => {
  const servers: Array<{ stop(): Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();

      if (server) {
        await server.stop();
      }
    }
  });

  it('serves health and read endpoints through the local HTTP API', async () => {
    const listMemoryEvents = vi.fn(async () => ({
      items: [
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
      ] as MemoryEvent[],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    }));
    const listKnowledge = vi.fn(async (): Promise<KnowledgeArtifact[]> => [
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        artifactType: 'daily-review-draft',
        draftState: 'draft',
        topicKey: null,
        title: 'Example Tasks',
        summary: 'Daily review draft for Example Tasks.',
        body: '- Example Tasks\n\n1 reviewed memory item included.',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: '2026-03-20T10:00:00.000Z',
        reviewedAt: '2026-03-20T10:00:00.000Z',
        recencyLabel: 'reviewed on 2026-03-20',
        provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed:candidate:browser:aw-event-1' }],
      },
    ]);
    const listSkillDrafts = vi.fn(async (): Promise<SkillArtifact[]> => [
      {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
        updatedAt: '2026-03-20T10:00:00.000Z',
        reviewedAt: null,
      },
    ]);
    const syncBrowserMemory = vi.fn(async () => ({
      sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
      strategy: 'incremental' as const,
      importedCount: 1,
      lastSyncedAt: '2026-03-20T09:00:00.000Z',
    }));
    const syncShellMemory = vi.fn(async () => ({
      sourceKey: 'shell-history:/tmp/.zsh_history',
      strategy: 'incremental' as const,
      importedCount: 2,
      lastSyncedAt: '2026-03-20T09:05:00.000Z',
    }));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents,
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge,
      listSkillDrafts,
      syncBrowserMemory,
      syncShellMemory,
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const healthResponse = await fetch(`${server.origin}/health`);
    const healthBody = await healthResponse.json();
    const memoryResponse = await fetch(`${server.origin}/memory`);
    const memoryBody = await memoryResponse.json();
    const filteredMemoryResponse = await fetch(
      `${server.origin}/memory?page=1&pageSize=5&sourceKind=browser&sourceInstanceId=chrome-main`,
    );
    const filteredMemoryBody = await filteredMemoryResponse.json();
    const knowledgeResponse = await fetch(`${server.origin}/knowledge`);
    const knowledgeBody = await knowledgeResponse.json();
    const skillsResponse = await fetch(`${server.origin}/skills`);
    const skillsBody = await skillsResponse.json();
    const syncResponse = await fetch(`${server.origin}/sync/browser`, {
      method: 'POST',
    });
    const syncBody = await syncResponse.json();
    const shellSyncResponse = await fetch(`${server.origin}/sync/shell`, {
      method: 'POST',
    });
    const shellSyncBody = await shellSyncResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthBody).toEqual({
      status: 'running',
      config: getMirrorBrainConfig(),
    });
    expect(memoryResponse.status).toBe(200);
    expect(memoryBody).toEqual({
      items: [
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
      ],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    });
    expect(filteredMemoryResponse.status).toBe(200);
    expect(filteredMemoryBody.items).toHaveLength(1);
    expect(listMemoryEvents).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 5,
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
    });
    expect(knowledgeResponse.status).toBe(200);
    expect(knowledgeBody).toEqual({
      items: [
        {
          id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
          artifactType: 'daily-review-draft',
          draftState: 'draft',
          topicKey: null,
          title: 'Example Tasks',
          summary: 'Daily review draft for Example Tasks.',
          body: '- Example Tasks\n\n1 reviewed memory item included.',
          sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
          derivedFromKnowledgeIds: [],
          version: 1,
          isCurrentBest: false,
          supersedesKnowledgeId: null,
          updatedAt: '2026-03-20T10:00:00.000Z',
          reviewedAt: '2026-03-20T10:00:00.000Z',
          recencyLabel: 'reviewed on 2026-03-20',
          provenanceRefs: [
            {
              kind: 'reviewed-memory',
              id: 'reviewed:candidate:browser:aw-event-1',
            },
          ],
        },
      ],
    });
    expect(skillsResponse.status).toBe(200);
    expect(skillsBody).toEqual({
      items: [
        {
          id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
          approvalState: 'draft',
          workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
          updatedAt: '2026-03-20T10:00:00.000Z',
          reviewedAt: null,
        },
      ],
    });
    expect(syncResponse.status).toBe(202);
    expect(syncBody).toEqual({
      sync: {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental',
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      },
    });
    expect(shellSyncResponse.status).toBe(202);
    expect(shellSyncBody).toEqual({
      sync: {
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental',
        importedCount: 2,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
      },
    });
  });

  it('exposes Phase 4 source import, audit, and status endpoints', async () => {
    const auditEvent: SourceAuditEvent = {
      id: 'source-audit:entry-1',
      eventType: 'entry-imported',
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      lineNumber: 1,
      occurredAt: '2026-05-12T10:31:00.000Z',
      severity: 'info',
      message: 'Imported browser ledger entry.',
    };
    const importSourceLedgers = vi.fn(async () => ({
      importedCount: 1,
      skippedCount: 0,
      scannedLedgerCount: 1,
      changedLedgerCount: 1,
      ledgerResults: [
        {
          ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
          importedCount: 1,
          skippedCount: 0,
          checkpoint: {
            ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
            nextLineNumber: 2,
            updatedAt: '2026-05-12T10:31:00.000Z',
          },
        },
      ],
    }));
    const listSourceAuditEvents = vi.fn(async () => [auditEvent]);
    const listSourceInstanceSummaries = vi.fn(async () => [
      {
        sourceKind: 'browser' as const,
        sourceInstanceId: 'chrome-main',
        lifecycleStatus: 'enabled' as const,
        recorderStatus: 'unknown' as const,
        importedCount: 1,
        skippedCount: 0,
        checkpointSummary: 'ledgers/2026-05-12/browser.jsonl next line 2',
      },
    ]);
    const updateSourceInstanceConfig = vi.fn(async () => ({
      sourceKind: 'browser' as const,
      sourceInstanceId: 'chrome-main',
      enabled: false,
      updatedAt: '2026-05-12T11:00:00.000Z',
      updatedBy: 'mirrorbrain-web',
    }));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      listMemoryEvents: vi.fn(),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
      importSourceLedgers,
      listSourceAuditEvents,
      listSourceInstanceSummaries,
      updateSourceInstanceConfig,
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const importResponse = await fetch(`${server.origin}/sources/import`, {
      method: 'POST',
    });
    const importBody = await importResponse.json();
    const auditResponse = await fetch(`${server.origin}/sources/audit?sourceKind=browser`);
    const auditBody = await auditResponse.json();
    const statusResponse = await fetch(`${server.origin}/sources/status`);
    const statusBody = await statusResponse.json();
    const configResponse = await fetch(`${server.origin}/sources/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedBy: 'mirrorbrain-web',
      }),
    });
    const configBody = await configResponse.json();

    expect(importResponse.status).toBe(202);
    expect(importBody).toEqual({
      import: {
        importedCount: 1,
        skippedCount: 0,
        scannedLedgerCount: 1,
        changedLedgerCount: 1,
        ledgerResults: [
          {
            ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
            importedCount: 1,
            skippedCount: 0,
            checkpoint: {
              ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
              nextLineNumber: 2,
              updatedAt: '2026-05-12T10:31:00.000Z',
            },
          },
        ],
      },
    });
    expect(auditResponse.status).toBe(200);
    expect(auditBody).toEqual({
      items: [auditEvent],
    });
    expect(statusResponse.status).toBe(200);
    expect(statusBody).toEqual({
      items: [
        {
          sourceKind: 'browser',
          sourceInstanceId: 'chrome-main',
          lifecycleStatus: 'enabled',
          recorderStatus: 'unknown',
          importedCount: 1,
          skippedCount: 0,
          checkpointSummary: 'ledgers/2026-05-12/browser.jsonl next line 2',
        },
      ],
    });
    expect(configResponse.status).toBe(200);
    expect(configBody).toEqual({
      config: {
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedAt: '2026-05-12T11:00:00.000Z',
        updatedBy: 'mirrorbrain-web',
      },
    });
    expect(updateSourceInstanceConfig).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: false,
      updatedBy: 'mirrorbrain-web',
    });
    expect(listSourceAuditEvents).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: undefined,
    });
  });

  it('POST /work-sessions/analyze runs a manual Phase 4 analysis window', async () => {
    const analyzeWorkSessions = vi.fn(async () => ({
      analysisWindow: {
        preset: 'last-6-hours' as const,
        startAt: '2026-05-12T06:00:00.000Z',
        endAt: '2026-05-12T12:00:00.000Z',
      },
      generatedAt: '2026-05-12T12:00:00.000Z',
      candidates: [
        {
          id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
          projectHint: 'mirrorbrain',
          title: 'mirrorbrain work session',
          summary: 'Imported source ledgers.',
          memoryEventIds: ['browser-1', 'shell-1'],
          sourceTypes: ['browser', 'shell'],
          timeRange: {
            startAt: '2026-05-12T10:00:00.000Z',
            endAt: '2026-05-12T10:30:00.000Z',
          },
          relationHints: ['Phase 4 design', 'Run tests'],
          reviewState: 'pending' as const,
        },
      ],
      excludedMemoryEventIds: [],
    }));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      listMemoryEvents: vi.fn(),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
      analyzeWorkSessions,
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const response = await fetch(`${server.origin}/work-sessions/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preset: 'last-6-hours' }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(analyzeWorkSessions).toHaveBeenCalledWith({
      preset: 'last-6-hours',
    });
    expect(body).toEqual({
      analysis: {
        analysisWindow: {
          preset: 'last-6-hours',
          startAt: '2026-05-12T06:00:00.000Z',
          endAt: '2026-05-12T12:00:00.000Z',
        },
        generatedAt: '2026-05-12T12:00:00.000Z',
        candidates: [
          {
            id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
            projectHint: 'mirrorbrain',
            title: 'mirrorbrain work session',
            summary: 'Imported source ledgers.',
            memoryEventIds: ['browser-1', 'shell-1'],
            sourceTypes: ['browser', 'shell'],
            timeRange: {
              startAt: '2026-05-12T10:00:00.000Z',
              endAt: '2026-05-12T10:30:00.000Z',
            },
            relationHints: ['Phase 4 design', 'Run tests'],
            reviewState: 'pending',
          },
        ],
        excludedMemoryEventIds: [],
      },
    });
  });

  it('POST /work-sessions/reviews records explicit project-assigned review', async () => {
    const reviewWorkSessionCandidate = vi.fn(async () => ({
      project: {
        id: 'project:mirrorbrain',
        name: 'MirrorBrain',
        status: 'active' as const,
        createdAt: '2026-05-12T12:05:00.000Z',
        updatedAt: '2026-05-12T12:05:00.000Z',
      },
      reviewedWorkSession: {
        id: 'reviewed-work-session:work-session-candidate:mirrorbrain',
        candidateId: 'work-session-candidate:mirrorbrain',
        projectId: 'project:mirrorbrain',
        title: 'mirrorbrain work session',
        summary: 'Imported source ledgers.',
        memoryEventIds: ['browser-1', 'shell-1'],
        sourceTypes: ['browser', 'shell'],
        timeRange: {
          startAt: '2026-05-12T10:00:00.000Z',
          endAt: '2026-05-12T10:30:00.000Z',
        },
        relationHints: ['Phase 4 design'],
        reviewState: 'reviewed' as const,
        reviewedAt: '2026-05-12T12:05:00.000Z',
        reviewedBy: 'user',
      },
    }));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      listMemoryEvents: vi.fn(),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
      reviewWorkSessionCandidate,
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const candidate = {
      id: 'work-session-candidate:mirrorbrain',
      projectHint: 'mirrorbrain',
      title: 'mirrorbrain work session',
      summary: 'Imported source ledgers.',
      memoryEventIds: ['browser-1', 'shell-1'],
      sourceTypes: ['browser', 'shell'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: ['Phase 4 design'],
      reviewState: 'pending',
    };
    const review = {
      decision: 'keep',
      reviewedBy: 'user',
      projectAssignment: {
        kind: 'confirmed-new-project',
        name: 'MirrorBrain',
      },
    };
    const response = await fetch(`${server.origin}/work-sessions/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidate, review }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(reviewWorkSessionCandidate).toHaveBeenCalledWith(candidate, review);
    expect(body).toMatchObject({
      project: {
        id: 'project:mirrorbrain',
      },
      reviewedWorkSession: {
        projectId: 'project:mirrorbrain',
        reviewState: 'reviewed',
      },
    });
  });

  it('serializes minimal valid knowledge artifacts without requiring optional topic fields', async () => {
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
      },
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      listMemoryEvents: vi.fn(async () => []),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async (): Promise<KnowledgeArtifact[]> => [
        {
          id: 'knowledge-draft:minimal',
          draftState: 'draft',
          sourceReviewedMemoryIds: ['reviewed:minimal'],
          tags: ['release'],
          relatedKnowledgeIds: ['topic-knowledge:release-process'],
          compilationMetadata: {
            discoveryInsights: ['The release process repeats weekly.'],
            generationMethod: 'two-stage-compilation',
            discoveryStageCompletedAt: '2026-05-11T09:00:00.000Z',
            executeStageCompletedAt: '2026-05-11T09:05:00.000Z',
          },
        },
      ]),
      listSkillDrafts: vi.fn(async () => []),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
    };
    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const response = await fetch(`${server.origin}/knowledge`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: [
        {
          id: 'knowledge-draft:minimal',
          draftState: 'draft',
          sourceReviewedMemoryIds: ['reviewed:minimal'],
          tags: ['release'],
          relatedKnowledgeIds: ['topic-knowledge:release-process'],
          compilationMetadata: {
            discoveryInsights: ['The release process repeats weekly.'],
            generationMethod: 'two-stage-compilation',
            discoveryStageCompletedAt: '2026-05-11T09:00:00.000Z',
            executeStageCompletedAt: '2026-05-11T09:05:00.000Z',
          },
        },
      ],
    });
  });

  it('publishes edited knowledge and skill drafts through save endpoints', async () => {
    const publishKnowledge = vi.fn(async (input) => input);
    const publishSkillDraft = vi.fn(async (input) => input);
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge,
      publishSkillDraft,
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const knowledgeArtifact = {
      id: 'knowledge-draft:1',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: null,
      title: 'Edited title',
      summary: 'Edited summary',
      body: 'Edited body',
      sourceReviewedMemoryIds: ['reviewed:1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      reviewedAt: null,
      recencyLabel: 'today',
      provenanceRefs: [],
    };
    const skillArtifact = {
      id: 'skill-draft:1',
      approvalState: 'approved',
      workflowEvidenceRefs: ['reviewed:1', 'reviewed:2'],
      executionSafetyMetadata: {
        requiresConfirmation: false,
      },
    };

    const knowledgeResponse = await fetch(`${server.origin}/knowledge`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artifact: knowledgeArtifact,
      }),
    });
    const skillResponse = await fetch(`${server.origin}/skills`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artifact: skillArtifact,
      }),
    });

    expect(knowledgeResponse.status).toBe(201);
    expect(skillResponse.status).toBe(201);
    expect(publishKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'knowledge-draft:1',
        title: 'Edited title',
        summary: 'Edited summary',
        body: 'Edited body',
        draftState: 'draft',
      }),
    );
    expect(publishSkillDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'skill-draft:1',
        approvalState: 'approved',
        workflowEvidenceRefs: ['reviewed:1', 'reviewed:2'],
        executionSafetyMetadata: {
          requiresConfirmation: false,
        },
      }),
    );
  });

  it('serves theme-level memory retrieval results through a query endpoint', async () => {
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        items: [
          {
            id: 'memory-result:activitywatch-browser-example-tasks',
            theme: 'Example Tasks',
            title: 'Example Tasks',
            summary:
              '1 matching memory event about Example Tasks during the requested time range.',
            timeRange: {
              startAt: '2026-03-20T08:00:00.000Z',
              endAt: '2026-03-20T08:00:00.000Z',
            },
            sourceRefs: [
              {
                id: 'browser:aw-event-1',
                sourceType: 'activitywatch-browser',
                sourceRef: 'aw-event-1',
                timestamp: '2026-03-20T08:00:00.000Z',
              },
            ],
          },
        ],
      })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const response = await fetch(`${server.origin}/memory/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What did I work on yesterday?',
        timeRange: {
          startAt: '2026-03-20T00:00:00.000Z',
          endAt: '2026-03-20T23:59:59.999Z',
        },
        sourceTypes: ['browser'],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      items: [
        {
          id: 'memory-result:activitywatch-browser-example-tasks',
          theme: 'Example Tasks',
          title: 'Example Tasks',
          summary:
            '1 matching memory event about Example Tasks during the requested time range.',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
          },
          sourceRefs: [
            {
              id: 'browser:aw-event-1',
              sourceType: 'activitywatch-browser',
              sourceRef: 'aw-event-1',
              timestamp: '2026-03-20T08:00:00.000Z',
            },
          ],
        },
      ],
    });
    expect(service.queryMemory).toHaveBeenCalledWith({
      query: 'What did I work on yesterday?',
      timeRange: {
        startAt: '2026-03-20T00:00:00.000Z',
        endAt: '2026-03-20T23:59:59.999Z',
      },
      sourceTypes: ['browser'],
    });
  });

  it('serves candidate review and artifact generation endpoints through the local HTTP API', async () => {
    const createDailyCandidateMemories = vi.fn(
      async (_reviewDate: string): Promise<CandidateMemory[]> => [
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
        }),
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
          memoryEventIds: ['browser:aw-event-2'],
        }),
      ],
    );
    const suggestCandidateReviews = vi.fn(
      async (_candidates: CandidateMemory[]): Promise<CandidateReviewSuggestion[]> => [
        {
          candidateMemoryId:
            'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          recommendation: 'keep',
          confidenceScore: 0.8,
          keepScore: 86,
          primarySourceCount: 1,
          supportingSourceCount: 1,
          evidenceSummary: 'Built from 1 primary page and 1 supporting page.',
          priorityScore: 2,
          rationale:
            'This daily stream has repeated activity and is a strong keep candidate.',
          supportingReasons: [
            'Visited multiple related pages about the same task.',
            'Spent enough time on the task to justify keeping it.',
          ],
        },
      ],
    );
    const reviewCandidateMemory = vi.fn(
      async (
        candidate: CandidateMemory,
        _review: {
          decision: ReviewedMemory['decision'];
          reviewedAt: string;
        },
      ): Promise<ReviewedMemory> => createReviewedMemoryFixture(),
    );
    const generateKnowledgeFromReviewedMemories = vi.fn(
      async (reviewedMemories: ReviewedMemory[]): Promise<KnowledgeArtifact> => ({
        id: `knowledge-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
        artifactType: 'daily-review-draft',
        draftState: 'draft',
        topicKey: null,
        title: reviewedMemories[0]?.candidateTitle ?? 'Daily Review Draft',
        summary: `Daily review draft for ${reviewedMemories[0]?.candidateTitle ?? 'reviewed memory'}.`,
        body: `- ${reviewedMemories[0]?.candidateTitle ?? 'Reviewed memory'}\n\n${reviewedMemories.length} reviewed memory item${reviewedMemories.length === 1 ? '' : 's'} included.`,
        sourceReviewedMemoryIds: reviewedMemories.map((memory) => memory.id),
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: reviewedMemories[0]?.reviewedAt,
        reviewedAt: reviewedMemories[0]?.reviewedAt ?? null,
        recencyLabel: `reviewed on ${reviewedMemories[0]?.reviewDate ?? ''}`.trim(),
        provenanceRefs: reviewedMemories.map((memory) => ({ kind: 'reviewed-memory', id: memory.id })),
      }),
    );
    const generateSkillDraftFromReviewedMemories = vi.fn(
      async (reviewedMemories: ReviewedMemory[]): Promise<SkillArtifact> => ({
        id: `skill-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
        approvalState: 'draft',
        workflowEvidenceRefs: reviewedMemories.map((memory) => memory.id),
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      }),
    );
    const undoCandidateReview = vi.fn(async () => undefined);
    const deleteCandidateMemory = vi.fn(async () => undefined);
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories,
      suggestCandidateReviews,
      reviewCandidateMemory,
      undoCandidateReview,
      deleteCandidateMemory,
      generateKnowledgeFromReviewedMemories,
      generateSkillDraftFromReviewedMemories,
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const candidateResponse = await fetch(`${server.origin}/candidate-memories/daily`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewDate: '2026-03-20',
        reviewTimeZone: 'Asia/Shanghai',
      }),
    });
    const candidateBody = await candidateResponse.json();

    const suggestionResponse = await fetch(
      `${server.origin}/candidate-reviews/suggestions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          candidates: candidateBody.candidates,
        }),
      },
    );
    const suggestionBody = await suggestionResponse.json();

    const reviewResponse = await fetch(`${server.origin}/reviewed-memories`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        candidate: candidateBody.candidates[0],
        review: {
          decision: 'keep',
          reviewedAt: '2026-03-20T10:00:00.000Z',
        },
      }),
    });
    const reviewBody = await reviewResponse.json();
    const knowledgeResponse = await fetch(`${server.origin}/knowledge/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewedMemories: [createReviewedMemoryFixture()],
      }),
    });
    const knowledgeBody = await knowledgeResponse.json();
    const skillResponse = await fetch(`${server.origin}/skills/generate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        reviewedMemories: [createReviewedMemoryFixture()],
      }),
    });
    const skillBody = await skillResponse.json();

    expect(candidateResponse.status).toBe(201);
    expect(candidateBody).toEqual({
      candidates: [
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
        }),
        createCandidateMemoryFixture({
          id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
          memoryEventIds: ['browser:aw-event-2'],
        }),
      ],
    });
    expect(createDailyCandidateMemories).toHaveBeenCalledWith(
      '2026-03-20',
      'Asia/Shanghai',
    );
    expect(suggestionResponse.status).toBe(200);
    expect(suggestionBody).toEqual({
      suggestions: [
        {
          candidateMemoryId:
            'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          recommendation: 'keep',
          confidenceScore: 0.8,
          keepScore: 86,
          primarySourceCount: 1,
          supportingSourceCount: 1,
          evidenceSummary: 'Built from 1 primary page and 1 supporting page.',
          priorityScore: 2,
          rationale:
            'This daily stream has repeated activity and is a strong keep candidate.',
          supportingReasons: [
            'Visited multiple related pages about the same task.',
            'Spent enough time on the task to justify keeping it.',
          ],
        },
      ],
    });
    expect(reviewResponse.status).toBe(201);
    expect(reviewBody).toEqual({
      reviewedMemory: createReviewedMemoryFixture(),
    });
    expect(knowledgeResponse.status).toBe(201);
    expect(knowledgeBody).toEqual({
      artifact: {
        id: 'knowledge-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        artifactType: 'daily-review-draft',
        draftState: 'draft',
        topicKey: null,
        title: 'Docs Example Com / guides',
        summary: 'Daily review draft for Docs Example Com / guides.',
        body: '- Docs Example Com / guides\n\n1 reviewed memory item included.',
        sourceReviewedMemoryIds: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: '2026-03-20T10:00:00.000Z',
        reviewedAt: '2026-03-20T10:00:00.000Z',
        recencyLabel: 'reviewed on 2026-03-20',
        provenanceRefs: [
          {
            kind: 'reviewed-memory',
            id: 'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          },
        ],
      },
    });
    expect(skillResponse.status).toBe(201);
    expect(skillBody).toEqual({
      artifact: {
        id: 'skill-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        approvalState: 'draft',
        workflowEvidenceRefs: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    });
  });

  it('passes the current draft snapshot to the knowledge approval service', async () => {
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
    const publishedArtifact: KnowledgeArtifact = {
      ...draft,
      id: 'knowledge:topic:vitest-testing:v1',
      artifactType: 'topic-knowledge',
      draftState: 'published',
      isCurrentBest: true,
    };
    const approveKnowledgeDraft = vi.fn(
      async (
        _draftId: string,
        _draftSnapshot?: KnowledgeArtifact,
      ): Promise<{
        publishedArtifact: KnowledgeArtifact;
        assignedTopic: { topicKey: string; title: string };
      }> => ({
        publishedArtifact,
        assignedTopic: {
          topicKey: 'vitest-testing',
          title: 'Vitest setup and debugging',
        },
      }),
    );
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      regenerateKnowledgeDraft: vi.fn(),
      approveKnowledgeDraft,
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const response = await fetch(`${server.origin}/knowledge/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        draftId: draft.id,
        draft,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      publishedArtifact,
      assignedTopic: {
        topicKey: 'vitest-testing',
        title: 'Vitest setup and debugging',
      },
    });
    expect(approveKnowledgeDraft).toHaveBeenCalledWith(draft.id, draft);
  });

  it('serves the standalone UI shell and static assets when a static directory is configured', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-http-static-'));

    writeFileSync(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body><h1>MirrorBrain UI</h1></body></html>',
    );
    writeFileSync(join(staticDir, 'styles.css'), 'body { color: black; }');
    writeFileSync(join(staticDir, 'main.js'), 'console.log("mirrorbrain");');

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
      staticDir,
    });
    servers.push(server);

    const indexResponse = await fetch(`${server.origin}/`);
    const stylesResponse = await fetch(`${server.origin}/styles.css`);
    const mainResponse = await fetch(`${server.origin}/main.js`);

    expect(indexResponse.status).toBe(200);
    expect(await indexResponse.text()).toContain('MirrorBrain UI');
    expect(stylesResponse.status).toBe(200);
    expect(await stylesResponse.text()).toContain('color: black');
    expect(mainResponse.status).toBe(200);
    expect(await mainResponse.text()).toContain('mirrorbrain');
  });

  it('serves OpenAPI schema and Swagger UI docs for the local HTTP API', async () => {
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
    });
    servers.push(server);

    const docsResponse = await fetch(`${server.origin}/docs`);
    const schemaResponse = await fetch(`${server.origin}/openapi.json`);
    const schemaBody = await schemaResponse.json();

    expect(docsResponse.status).toBe(200);
    expect(await docsResponse.text()).toContain('Swagger UI');
    expect(schemaResponse.status).toBe(200);
    expect(schemaBody.openapi).toBe('3.0.3');
    expect(schemaBody.paths['/health']).toBeDefined();
    expect(schemaBody.paths['/sync/browser']).toBeDefined();
    expect(schemaBody.paths['/candidate-memories/daily']).toBeDefined();
    expect(schemaBody.paths['/candidate-reviews/suggestions']).toBeDefined();
  });

  it('hides static asset routes from the OpenAPI schema', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-http-static-'));

    writeFileSync(
      join(staticDir, 'index.html'),
      '<!doctype html><html><body><h1>MirrorBrain UI</h1></body></html>',
    );
    writeFileSync(join(staticDir, 'styles.css'), 'body { color: black; }');
    writeFileSync(join(staticDir, 'main.js'), 'console.log("mirrorbrain");');

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:00:00.000Z',
      })),
      syncShellMemory: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T10:05:00.000Z',
      })),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({
      service,
      port: 0,
      staticDir,
    });
    servers.push(server);

    const schemaResponse = await fetch(`${server.origin}/openapi.json`);
    const schemaBody = await schemaResponse.json();

    expect(schemaResponse.status).toBe(200);
    expect(schemaBody.paths['/']).toBeUndefined();
    expect(schemaBody.paths['/styles.css']).toBeUndefined();
    expect(schemaBody.paths['/main.js']).toBeUndefined();
    expect(schemaBody.paths['/health']).toBeDefined();
  });

  it('DELETE /reviewed-memories/:id should delete reviewed memory file', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));

    // Setup: create a reviewed memory file
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate:test-1',
      candidateMemoryId: 'candidate:test-1',
      candidateTitle: 'Test Candidate',
      candidateSummary: 'Test summary',
      candidateTheme: 'test',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-28',
      decision: 'keep',
      reviewedAt: new Date().toISOString(),
    };

    const reviewedDir = join(workspaceDir, 'mirrorbrain', 'reviewed-memories');
    await mkdir(reviewedDir, { recursive: true });
    await writeFile(
      join(reviewedDir, `${reviewedMemory.id}.json`),
      JSON.stringify(reviewedMemory, null, 2)
    );

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(async (reviewedMemoryId: string) => {
        // Validate ID format
        if (!reviewedMemoryId.startsWith('reviewed:candidate:')) {
          throw new ValidationError('Invalid reviewed memory ID format: must start with reviewed:candidate:');
        }
        // Delete the file
        const filePath = join(reviewedDir, `${reviewedMemoryId}.json`);
        try {
          await rm(filePath, { force: true });
        } catch (error) {
          // Ignore errors - operation is idempotent
        }
      }),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    // Delete the reviewed memory
    const response = await fetch(`${server.origin}/reviewed-memories/${reviewedMemory.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);

    // Verify file is deleted
    const filePath = join(reviewedDir, `${reviewedMemory.id}.json`);
    await expect(access(filePath)).rejects.toThrow();

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('DELETE /reviewed-memories/:id should return 400 for invalid reviewed memory ID format', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(async (reviewedMemoryId: string) => {
        if (!reviewedMemoryId.startsWith('reviewed:candidate:')) {
          throw new ValidationError('Invalid reviewed memory ID format: must start with reviewed:candidate:');
        }
      }),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    const response = await fetch(`${server.origin}/reviewed-memories/invalid-id`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('Invalid reviewed memory ID format');

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('DELETE /reviewed-memories/:id should return 204 when reviewed memory already deleted (idempotent)', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));
    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(async (reviewedMemoryId: string) => {
        // Validate ID format
        if (!reviewedMemoryId.startsWith('reviewed:candidate:')) {
          throw new ValidationError('Invalid reviewed memory ID format: must start with reviewed:candidate:');
        }
        // Try to delete (file doesn't exist, but operation is idempotent)
        const reviewedDir = join(workspaceDir, 'mirrorbrain', 'reviewed-memories');
        const filePath = join(reviewedDir, `${reviewedMemoryId}.json`);
        await rm(filePath, { force: true });
      }),
      deleteCandidateMemory: vi.fn(),
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    // Delete non-existent reviewed memory (file doesn't exist)
    const response = await fetch(`${server.origin}/reviewed-memories/reviewed:candidate:nonexistent`, {
      method: 'DELETE',
    });

    // Should succeed (idempotent operation)
    expect(response.status).toBe(204);

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('DELETE /candidate-memories/:id should return 204 when candidate deleted successfully', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));

    // Setup: create a candidate memory file
    const candidateMemory: CandidateMemory = {
      id: 'candidate:test-delete-1',
      memoryEventIds: ['event-1'],
      title: 'Test Candidate',
      summary: 'Test summary',
      theme: 'test',
      reviewDate: '2026-04-28',
      timeRange: {
        startAt: '2026-04-28T08:00:00.000Z',
        endAt: '2026-04-28T08:15:00.000Z',
      },
      sourceRefs: [{
        id: 'event-1',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-04-28T08:00:00.000Z',
        title: 'Test Source',
        url: 'https://example.com',
      }],
      reviewState: 'pending',
    };

    const candidateDir = join(workspaceDir, 'mirrorbrain', 'candidate-memories');
    await mkdir(candidateDir, { recursive: true });
    const filePath = join(candidateDir, `${candidateMemory.id}.json`);
    await writeFile(filePath, JSON.stringify(candidateMemory, null, 2));

    const deleteCandidateMemory = vi.fn(async (candidateMemoryId: string) => {
      // Validate ID format
      if (!candidateMemoryId.startsWith('candidate:')) {
        throw new ValidationError('Invalid candidate memory ID format: must start with candidate:');
      }
      // Delete the file
      const filePath = join(candidateDir, `${candidateMemoryId}.json`);
      await rm(filePath, { force: true });
    });

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory,
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    // Delete the candidate memory
    const response = await fetch(`${server.origin}/candidate-memories/${candidateMemory.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);

    // Verify file is deleted
    await expect(access(filePath)).rejects.toThrow();

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('DELETE /candidate-memories/:id should return 204 if candidate not found (idempotent)', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));

    const deleteCandidateMemory = vi.fn(async (candidateMemoryId: string) => {
      // Validate ID format
      if (!candidateMemoryId.startsWith('candidate:')) {
        throw new ValidationError('Invalid candidate memory ID format: must start with candidate:');
      }
      // Try to delete (file doesn't exist, but operation is idempotent)
      const candidateDir = join(workspaceDir, 'mirrorbrain', 'candidate-memories');
      const filePath = join(candidateDir, `${candidateMemoryId}.json`);
      await rm(filePath, { force: true });
    });

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory,
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    // Delete non-existent candidate memory
    const response = await fetch(`${server.origin}/candidate-memories/candidate:nonexistent`, {
      method: 'DELETE',
    });

    // Should succeed (idempotent operation)
    expect(response.status).toBe(204);

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('DELETE /candidate-memories/:id should return 400 for invalid ID format', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));

    const deleteCandidateMemory = vi.fn(async (candidateMemoryId: string) => {
      if (!candidateMemoryId.startsWith('candidate:')) {
        throw new ValidationError('Invalid candidate memory ID format: must start with candidate:');
      }
    });

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory,
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    const response = await fetch(`${server.origin}/candidate-memories/invalid-id`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toContain('Invalid candidate memory ID format');

    await rm(workspaceDir, { recursive: true, force: true });
  });

  it('DELETE /knowledge/:id and /skills/:id should forward artifact deletion to the service', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-test-'));
    const deleteKnowledgeArtifact = vi.fn(async () => undefined);
    const deleteSkillArtifact = vi.fn(async () => undefined);

    const service = {
      service: {
        status: 'running' as const,
        config: getMirrorBrainConfig(),
        stop: vi.fn(),
      },
      listMemoryEvents: vi.fn(async () => ({
        items: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      })),
      queryMemory: vi.fn(async (): Promise<MemoryQueryResult> => ({ items: [] })),
      listKnowledge: vi.fn(async () => []),
      listSkillDrafts: vi.fn(async () => []),
      syncBrowserMemory: vi.fn(),
      syncShellMemory: vi.fn(),
      createDailyCandidateMemories: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      deleteCandidateMemory: vi.fn(),
      deleteKnowledgeArtifact,
      deleteSkillArtifact,
      generateKnowledgeFromReviewedMemories: vi.fn(),
      generateSkillDraftFromReviewedMemories: vi.fn(),
      publishKnowledge: vi.fn(),
      publishSkillDraft: vi.fn(),
    };

    const server = await startMirrorBrainHttpServer({ service, workspaceDir, port: 0 });
    servers.push(server);

    const knowledgeResponse = await fetch(
      `${server.origin}/knowledge/knowledge-draft:delete-me`,
      { method: 'DELETE' },
    );
    const skillResponse = await fetch(
      `${server.origin}/skills/skill-draft:delete-me`,
      { method: 'DELETE' },
    );

    expect(knowledgeResponse.status).toBe(204);
    expect(skillResponse.status).toBe(204);
    expect(deleteKnowledgeArtifact).toHaveBeenCalledWith('knowledge-draft:delete-me');
    expect(deleteSkillArtifact).toHaveBeenCalledWith('skill-draft:delete-me');

    await rm(workspaceDir, { recursive: true, force: true });
  });
});
