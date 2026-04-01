import { describe, expect, it, vi } from 'vitest';

import type {
  CandidateMemory,
  CandidateReviewSuggestion,
  KnowledgeArtifact,
  MemoryEvent,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';
import { createMirrorBrainWebApp, renderMirrorBrainWebApp } from './main.js';

function createMemoryEvent(id: string, title: string, timestamp: string): MemoryEvent {
  return {
    id,
    sourceType: 'activitywatch-browser',
    sourceRef: id.replace('browser:', ''),
    timestamp,
    authorizationScopeId: 'scope-browser',
    content: {
      title,
      url: `https://example.com/${id}`,
    },
    captureMetadata: {
      upstreamSource: 'activitywatch',
      checkpoint: timestamp,
    },
  };
}

function createCandidateMemory(input: {
  id: string;
  memoryEventIds: string[];
  title: string;
  summary: string;
  theme: string;
  reviewDate?: string;
}): CandidateMemory {
  return {
    id: input.id,
    memoryEventIds: input.memoryEventIds,
    title: input.title,
    summary: input.summary,
    theme: input.theme,
    reviewDate: input.reviewDate ?? '2026-03-20',
    timeRange: {
      startAt: `${input.reviewDate ?? '2026-03-20'}T08:00:00.000Z`,
      endAt: `${input.reviewDate ?? '2026-03-20'}T08:15:00.000Z`,
    },
    reviewState: 'pending',
  };
}

function createReviewedMemory(candidate: CandidateMemory): ReviewedMemory {
  return {
    id: `reviewed:${candidate.id}`,
    candidateMemoryId: candidate.id,
    candidateTitle: candidate.title,
    candidateSummary: candidate.summary,
    candidateTheme: candidate.theme,
    memoryEventIds: candidate.memoryEventIds,
    reviewDate: candidate.reviewDate,
    decision: 'keep',
    reviewedAt: '2026-03-20T10:00:00.000Z',
  };
}

function getPreviousCalendarDate(referenceIso: string): string {
  const referenceDate = new Date(referenceIso);
  referenceDate.setUTCDate(referenceDate.getUTCDate() - 1);
  return referenceDate.toISOString().slice(0, 10);
}

describe('mirrorbrain web app', () => {
  it('renders review tab with multiple daily candidate streams, review window details, and AI suggestions', () => {
    const primaryCandidate = createCandidateMemory({
      id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
      memoryEventIds: ['browser:aw-event-1', 'browser:aw-event-2'],
      title: 'Docs Example Com / guides',
      summary: '2 browser events about Docs Example Com / guides on 2026-03-20.',
      theme: 'docs.example.com / guides',
    });
    const secondaryCandidate = createCandidateMemory({
      id: 'candidate:2026-03-20:activitywatch-browser:github-com:example',
      memoryEventIds: ['browser:aw-event-3'],
      title: 'Github Com / example',
      summary: '1 browser event about Github Com / example on 2026-03-20.',
      theme: 'github.com / example',
    });

    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents: [createMemoryEvent('browser:aw-event-1', 'Example Tasks', '2026-03-20T08:00:00.000Z')],
      candidateMemories: [primaryCandidate, secondaryCandidate],
      selectedCandidateId: primaryCandidate.id,
      candidateReviewSuggestions: [
        {
          candidateMemoryId: primaryCandidate.id,
          recommendation: 'keep',
          confidenceScore: 0.8,
          priorityScore: 2,
          rationale:
            'This daily stream has repeated activity and is a strong keep candidate.',
        },
      ],
      reviewedMemory: createReviewedMemory(primaryCandidate),
      knowledgeArtifact: {
        id: 'knowledge-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        draftState: 'draft',
        sourceReviewedMemoryIds: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
      },
      skillArtifact: {
        id: 'skill-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        approvalState: 'draft',
        workflowEvidenceRefs: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
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
        message: 'Generated 2 daily candidates for 2026-03-20.',
      },
      activeTab: 'review',
      memoryPage: 1,
      reviewWindowDate: '2026-03-20',
      reviewWindowEventCount: 3,
    });

    expect(html).toContain('Daily Candidate Streams');
    expect(html).toContain('Review Window');
    expect(html).toContain('2026-03-20 00:00:00 to 2026-03-20 23:59:59');
    expect(html).toContain('Matched Memory Events');
    expect(html).toContain('3');
    expect(html).toContain(primaryCandidate.title);
    expect(html).toContain(secondaryCandidate.title);
    expect(html).toContain(primaryCandidate.summary);
    expect(html).toContain('AI Review Suggestion');
    expect(html).toContain('Recommendation');
    expect(html).toContain('strong keep candidate');
    expect(html).not.toContain('knowledge-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides');
  });

  it('renders memory pagination with 5 events per page', () => {
    const memoryEvents = Array.from({ length: 12 }, (_, index) =>
      createMemoryEvent(
        `browser:aw-event-${index + 1}`,
        `Example ${index + 1}`,
        `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      ),
    );

    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents,
      candidateMemories: [],
      selectedCandidateId: null,
      candidateReviewSuggestions: [],
      reviewedMemory: null,
      knowledgeArtifact: null,
      skillArtifact: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'memory',
      memoryPage: 2,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    });

    expect(html).toContain('Page 2 of 3');
    expect(html).toContain('data-action="memory-first-page"');
    expect(html).toContain('data-action="memory-last-page"');
    expect(html).toContain('browser:aw-event-6');
    expect(html).toContain('browser:aw-event-10');
    expect(html).not.toContain('browser:aw-event-5');
  });

  it('shows only the actions that belong to the active tab', () => {
    const baseState = {
      serviceStatus: 'running' as const,
      memoryEvents: [] as MemoryEvent[],
      candidateMemories: [] as CandidateMemory[],
      selectedCandidateId: null,
      candidateReviewSuggestions: [] as CandidateReviewSuggestion[],
      reviewedMemory: null,
      knowledgeArtifact: null,
      skillArtifact: null,
      lastSyncSummary: null,
      feedback: null,
      memoryPage: 1,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    };

    const memoryHtml = renderMirrorBrainWebApp({
      ...baseState,
      activeTab: 'memory',
    });
    const reviewHtml = renderMirrorBrainWebApp({
      ...baseState,
      activeTab: 'review',
    });
    const artifactsHtml = renderMirrorBrainWebApp({
      ...baseState,
      activeTab: 'artifacts',
    });

    expect(memoryHtml).toContain('data-action="sync-browser"');
    expect(reviewHtml).toContain('data-action="create-candidate"');
    expect(reviewHtml).toContain('data-action="keep-candidate"');
    expect(reviewHtml).toContain('data-action="discard-candidate"');
    expect(artifactsHtml).toContain('data-action="generate-knowledge"');
    expect(artifactsHtml).toContain('data-action="generate-skill"');
  });

  it('loads, creates yesterday candidates, reviews the selected candidate, and generates artifacts', async () => {
    const referenceNow = '2026-03-20T10:00:00.000Z';
    const expectedReviewDate = getPreviousCalendarDate(referenceNow);
    const memoryEvents: MemoryEvent[] = [
      createMemoryEvent(
        'browser:aw-event-1',
        'Example Tasks',
        `${expectedReviewDate}T08:00:00.000Z`,
      ),
      createMemoryEvent(
        'browser:aw-event-2',
        'Example API',
        `${expectedReviewDate}T08:15:00.000Z`,
      ),
    ];
    const candidates = [
      createCandidateMemory({
        id: `candidate:${expectedReviewDate}:activitywatch-browser:docs-example-com:guides`,
        memoryEventIds: ['browser:aw-event-1', 'browser:aw-event-2'],
        title: 'Docs Example Com / guides',
        summary: `2 browser events about Docs Example Com / guides on ${expectedReviewDate}.`,
        theme: 'docs.example.com / guides',
        reviewDate: expectedReviewDate,
      }),
      createCandidateMemory({
        id: `candidate:${expectedReviewDate}:activitywatch-browser:github-com:example`,
        memoryEventIds: ['browser:aw-event-3'],
        title: 'Github Com / example',
        summary: `1 browser event about Github Com / example on ${expectedReviewDate}.`,
        theme: 'github.com / example',
        reviewDate: expectedReviewDate,
      }),
    ];
    const reviewedMemory = createReviewedMemory(candidates[1]);
    const knowledgeArtifact: KnowledgeArtifact = {
      id: `knowledge-draft:${reviewedMemory.id}`,
      draftState: 'draft',
      sourceReviewedMemoryIds: [reviewedMemory.id],
    };
    const skillArtifact: SkillArtifact = {
      id: `skill-draft:${reviewedMemory.id}`,
      approvalState: 'draft',
      workflowEvidenceRefs: [reviewedMemory.id],
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
        importedCount: 2,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      })),
      createDailyCandidates: vi.fn(async () => candidates),
      suggestCandidateReviews: vi.fn(async () => [
        {
          candidateMemoryId: candidates[1].id,
          recommendation: 'review' as const,
          confidenceScore: 0.55,
          priorityScore: 1,
          rationale:
            'This daily stream has limited evidence and should stay in human review.',
        },
      ]),
      reviewCandidateMemory: vi.fn(async () => reviewedMemory),
      generateKnowledge: vi.fn(async () => knowledgeArtifact),
      generateSkill: vi.fn(async () => skillArtifact),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => referenceNow,
    });

    await app.load();
    await app.syncBrowserMemory();
    await app.createDailyCandidates();
    app.selectCandidate(candidates[1].id);
    await app.reviewSelectedCandidate('keep');
    await app.generateKnowledge();
    await app.generateSkill();

    expect(app.state.serviceStatus).toBe('running');
    expect(app.state.memoryEvents).toEqual(memoryEvents);
    expect(app.state.activeTab).toBe('artifacts');
    expect(app.state.candidateMemories).toEqual(candidates);
    expect(app.state.selectedCandidateId).toBe(candidates[1].id);
    expect(app.state.reviewWindowDate).toBe(expectedReviewDate);
    expect(app.state.reviewWindowEventCount).toBe(2);
    expect(app.state.candidateReviewSuggestions).toEqual([
      {
        candidateMemoryId: candidates[1].id,
        recommendation: 'review',
        confidenceScore: 0.55,
        priorityScore: 1,
        rationale:
          'This daily stream has limited evidence and should stay in human review.',
      },
    ]);
    expect(app.state.reviewedMemory).toEqual(reviewedMemory);
    expect(app.state.knowledgeArtifact).toEqual(knowledgeArtifact);
    expect(app.state.skillArtifact).toEqual(skillArtifact);
    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: `Skill generated: ${skillArtifact.id}`,
    });
    expect(api.createDailyCandidates).toHaveBeenCalledWith(
      expectedReviewDate,
      'Asia/Shanghai',
    );
    expect(api.suggestCandidateReviews).toHaveBeenCalledWith(candidates);
    expect(api.reviewCandidateMemory).toHaveBeenCalledWith(candidates[1], {
      decision: 'keep',
      reviewedAt: '2026-03-20T10:00:00.000Z',
    });
  });

  it('tracks active tab selection and memory pagination in the controller state', async () => {
    const memoryEvents: MemoryEvent[] = Array.from({ length: 25 }, (_, index) =>
      createMemoryEvent(
        `browser:aw-event-${index + 1}`,
        `Example ${index + 1}`,
        `2026-03-20T08:${String(index).padStart(2, '0')}:00.000Z`,
      ),
    );

    const app = createMirrorBrainWebApp({
      api: {
        getHealth: vi.fn(async () => ({
          status: 'running' as const,
        })),
        listMemory: vi.fn(async () => memoryEvents),
        listKnowledge: vi.fn(async () => [] as KnowledgeArtifact[]),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        createDailyCandidates: vi.fn(),
        suggestCandidateReviews: vi.fn(),
        reviewCandidateMemory: vi.fn(),
        generateKnowledge: vi.fn(),
        generateSkill: vi.fn(),
      },
      now: () => '2026-03-20T10:00:00.000Z',
    });

    await app.load();
    app.setActiveTab('review');
    app.goToNextMemoryPage();
    app.goToLastMemoryPage();

    expect(app.state.activeTab).toBe('review');
    expect(app.state.memoryPage).toBe(5);

    app.goToFirstMemoryPage();

    expect(app.state.memoryPage).toBe(1);
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
        createDailyCandidates: vi.fn(),
        suggestCandidateReviews: vi.fn(),
        reviewCandidateMemory: vi.fn(),
        generateKnowledge: vi.fn(),
        generateSkill: vi.fn(),
      },
      now: () => '2026-03-20T10:00:00.000Z',
    });

    await app.load();
    await app.createDailyCandidates();
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'No memory events are available for yesterday\'s candidate review.',
    });

    await app.reviewSelectedCandidate('keep');
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'Select a candidate before reviewing it.',
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

  it('uses the local yesterday review day instead of the UTC date when generating daily candidates', async () => {
    const referenceNow = '2026-03-31T16:30:00.000Z';
    const expectedReviewDate = '2026-03-31';
    const memoryEvents: MemoryEvent[] = [
      createMemoryEvent(
        'browser:morning-1',
        'Morning Work',
        '2026-03-30T16:35:00.000Z',
      ),
    ];
    const candidates = [
      createCandidateMemory({
        id: `candidate:${expectedReviewDate}:activitywatch-browser:example-com:browser-morning-1`,
        memoryEventIds: ['browser:morning-1'],
        title: 'Example Com / browser-morning-1',
        summary: `1 browser event about Example Com / browser-morning-1 on ${expectedReviewDate}.`,
        theme: 'example.com / browser-morning-1',
        reviewDate: expectedReviewDate,
      }),
    ];
    const createDailyCandidates = vi.fn(async () => candidates);

    const app = createMirrorBrainWebApp({
      api: {
        getHealth: vi.fn(async () => ({
          status: 'running' as const,
        })),
        listMemory: vi.fn(async () => memoryEvents),
        listKnowledge: vi.fn(async () => [] as KnowledgeArtifact[]),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        createDailyCandidates,
        suggestCandidateReviews: vi.fn(async () => []),
        reviewCandidateMemory: vi.fn(),
        generateKnowledge: vi.fn(),
        generateSkill: vi.fn(),
      },
      now: () => referenceNow,
      timeZone: 'Asia/Shanghai',
    });

    await app.load();
    await app.createDailyCandidates();

    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: `Generated 1 daily candidates for ${expectedReviewDate}.`,
    });
    expect(app.state.selectedCandidateId).toBe(candidates[0].id);
    expect(app.state.candidateMemories).toEqual(candidates);
    expect(app.state.activeTab).toBe('review');
    expect(app.state.memoryEvents).toEqual(memoryEvents);
    expect(app.state.candidateReviewSuggestions).toEqual([]);
    expect(app.state.reviewWindowDate).toBe(expectedReviewDate);
    expect(app.state.reviewWindowEventCount).toBe(1);
    expect(createDailyCandidates).toHaveBeenCalledWith(
      expectedReviewDate,
      'Asia/Shanghai',
    );
  });
});
