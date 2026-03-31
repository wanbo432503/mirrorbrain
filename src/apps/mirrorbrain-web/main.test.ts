import { describe, expect, it, vi } from 'vitest';

import type {
  CandidateMemory,
  KnowledgeArtifact,
  MemoryEvent,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';
import { createMirrorBrainWebApp, renderMirrorBrainWebApp } from './main.js';

describe('mirrorbrain web app', () => {
  it('renders only the active tab and shows explicit review and artifact details', () => {
    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents: [
        {
          id: 'browser:aw-event-1',
          sourceType: 'activitywatch-browser',
          sourceRef: 'aw-event-1',
          timestamp: '2026-03-20T08:00:00.000Z',
          authorizationScopeId: 'scope-browser',
          content: {
            title: 'Example Tasks',
          },
          captureMetadata: {
            upstreamSource: 'activitywatch',
            checkpoint: '2026-03-20T08:00:00.000Z',
          },
        },
      ],
      candidateMemory: {
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewState: 'pending',
      },
      reviewedMemory: {
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep',
      },
      knowledgeArtifact: {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
      skillArtifact: {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
      lastSyncSummary: {
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental',
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      },
      feedback: {
        kind: 'success',
        message: 'Candidate created: candidate:browser:aw-event-1',
      },
      activeTab: 'review',
      memoryPage: 1,
    });

    expect(html).toContain('MirrorBrain Phase 1 MVP');
    expect(html).toContain('Service Status: running');
    expect(html).toContain('data-tab="review"');
    expect(html).toContain('Candidate Memory');
    expect(html).toContain('Reviewed Memory');
    expect(html).toContain('candidate:browser:aw-event-1');
    expect(html).toContain('reviewed:candidate:browser:aw-event-1');
    expect(html).toContain('Decision');
    expect(html).not.toContain('knowledge-draft:reviewed:candidate:browser:aw-event-1');
    expect(html).not.toContain('skill-draft:reviewed:candidate:browser:aw-event-1');
    expect(html).toContain('Memory Event IDs');
    expect(html).toContain('activitywatch-browser:aw-watcher-web-chrome');
    expect(html).toContain('Status: Candidate created: candidate:browser:aw-event-1');
  });

  it('renders memory pagination with 20 events per page', () => {
    const memoryEvents = Array.from({ length: 25 }, (_, index) => ({
      id: `browser:aw-event-${index + 1}`,
      sourceType: 'activitywatch-browser',
      sourceRef: `aw-event-${index + 1}`,
      timestamp: `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      authorizationScopeId: 'scope-browser',
      content: {
        title: `Example ${index + 1}`,
      },
      captureMetadata: {
        upstreamSource: 'activitywatch',
        checkpoint: `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      },
    }));

    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents,
      candidateMemory: null,
      reviewedMemory: null,
      knowledgeArtifact: null,
      skillArtifact: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'memory',
      memoryPage: 2,
    });

    expect(html).toContain('Page 2 of 2');
    expect(html).toContain('browser:aw-event-21');
    expect(html).toContain('browser:aw-event-25');
    expect(html).not.toContain('browser:aw-event-20');
    expect(html).toContain('data-action="memory-prev-page"');
    expect(html).toContain('data-action="memory-next-page"');
  });

  it('loads, syncs, reviews, and generates artifacts through the web app controller', async () => {
    const memoryEvents: MemoryEvent[] = [
      {
        id: 'browser:aw-event-1',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          title: 'Example Tasks',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      },
    ];
    const candidateMemory: CandidateMemory = {
      id: 'candidate:browser:aw-event-1',
      memoryEventIds: ['browser:aw-event-1'],
      reviewState: 'pending',
    };
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate:browser:aw-event-1',
      candidateMemoryId: 'candidate:browser:aw-event-1',
      decision: 'keep',
    };
    const knowledgeArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
      draftState: 'draft',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
    };
    const skillArtifact: SkillArtifact = {
      id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    };
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory: vi.fn(async () => memoryEvents),
      listKnowledge: vi.fn(async () => [] as KnowledgeArtifact[]),
      listSkills: vi.fn(async () => [] as SkillArtifact[]),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      })),
      createCandidateMemory: vi.fn(async () => candidateMemory),
      reviewCandidateMemory: vi.fn(async () => reviewedMemory),
      generateKnowledge: vi.fn(async () => knowledgeArtifact),
      generateSkill: vi.fn(async () => skillArtifact),
    };

    const app = createMirrorBrainWebApp({
      api,
    });

    await app.load();
    await app.syncBrowserMemory();
    await app.createCandidateMemory(['browser:aw-event-1']);
    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: 'Candidate created: candidate:browser:aw-event-1',
    });
    await app.reviewCurrentCandidate('keep');
    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: 'Candidate kept: reviewed:candidate:browser:aw-event-1',
    });
    await app.generateKnowledge();
    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: 'Knowledge generated: knowledge-draft:reviewed:candidate:browser:aw-event-1',
    });
    await app.generateSkill();

    expect(app.state.serviceStatus).toBe('running');
    expect(app.state.memoryEvents).toEqual(memoryEvents);
    expect(app.state.activeTab).toBe('artifacts');
    expect(app.state.memoryPage).toBe(1);
    expect(app.state.candidateMemory).toEqual(candidateMemory);
    expect(app.state.reviewedMemory).toEqual(reviewedMemory);
    expect(app.state.knowledgeArtifact).toEqual(knowledgeArtifact);
    expect(app.state.skillArtifact).toEqual(skillArtifact);
    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: 'Skill generated: skill-draft:reviewed:candidate:browser:aw-event-1',
    });
    expect(api.createCandidateMemory).toHaveBeenCalledWith(memoryEvents);
    expect(api.reviewCandidateMemory).toHaveBeenCalledWith(candidateMemory, {
      decision: 'keep',
    });
    expect(api.generateKnowledge).toHaveBeenCalledWith([reviewedMemory]);
    expect(api.generateSkill).toHaveBeenCalledWith([reviewedMemory]);
  });

  it('tracks active tab selection and memory pagination in the controller state', async () => {
    const memoryEvents: MemoryEvent[] = Array.from({ length: 25 }, (_, index) => ({
      id: `browser:aw-event-${index + 1}`,
      sourceType: 'activitywatch-browser',
      sourceRef: `aw-event-${index + 1}`,
      timestamp: `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      authorizationScopeId: 'scope-browser',
      content: {
        title: `Example ${index + 1}`,
      },
      captureMetadata: {
        upstreamSource: 'activitywatch',
        checkpoint: `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      },
    }));

    const app = createMirrorBrainWebApp({
      api: {
        getHealth: vi.fn(async () => ({
          status: 'running' as const,
        })),
        listMemory: vi.fn(async () => memoryEvents),
        listKnowledge: vi.fn(async () => [] as KnowledgeArtifact[]),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        createCandidateMemory: vi.fn(),
        reviewCandidateMemory: vi.fn(),
        generateKnowledge: vi.fn(),
        generateSkill: vi.fn(),
      },
    });

    await app.load();
    app.setActiveTab('review');
    app.goToNextMemoryPage();

    expect(app.state.activeTab).toBe('review');
    expect(app.state.memoryPage).toBe(2);
  });

  it('reports a visible error state instead of silently ignoring invalid actions', async () => {
    const app = createMirrorBrainWebApp({
      api: {
        getHealth: vi.fn(async () => ({
          status: 'running' as const,
        })),
        listMemory: vi.fn(async () => [] as MemoryEvent[]),
        listKnowledge: vi.fn(async () => [] as KnowledgeArtifact[]),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        createCandidateMemory: vi.fn(),
        reviewCandidateMemory: vi.fn(),
        generateKnowledge: vi.fn(),
        generateSkill: vi.fn(),
      },
    });

    await app.load();
    await app.createCandidateMemory([]);
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'No memory events are available to create a candidate.',
    });

    await app.reviewCurrentCandidate('keep');
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'Create a candidate before reviewing it.',
    });

    await app.generateKnowledge();
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'Keep a reviewed memory before generating knowledge.',
    });

    await app.generateSkill();
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'Keep a reviewed memory before generating a skill draft.',
    });
  });
});
