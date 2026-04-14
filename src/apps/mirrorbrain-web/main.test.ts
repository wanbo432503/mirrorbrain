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
      knowledgeTopics: [],
      knowledgeArtifact: {
        id: 'knowledge-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        draftState: 'draft',
        sourceReviewedMemoryIds: [
          'reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
        ],
      },
      knowledgeDraft: null,
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
      skillDraft: null,
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

    expect(html).toContain('Candidate Streams');
    expect(html).toContain('Review Window');
    expect(html).toContain('2026-03-20');
    expect(html).toContain('Events');
    expect(html).toContain('3');
    expect(html).toContain(primaryCandidate.title);
    expect(html).toContain(secondaryCandidate.title);
    expect(html).toContain(primaryCandidate.summary);
    expect(html).toContain('AI Suggestion');
    expect(html).toContain('Recommendation');
    expect(html).toContain('strong keep candidate');
    expect(html).not.toContain('knowledge-draft:reviewed:candidate:2026-03-20:activitywatch-browser:docs-example-com:guides');
  });

  it('renders an editable artifacts workbench for knowledge and skill drafts', () => {
    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents: [],
      candidateMemories: [],
      selectedCandidateId: null,
      candidateReviewSuggestions: [],
      reviewedMemory: createReviewedMemory(
        createCandidateMemory({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
          title: 'Docs Example Com / guides',
          summary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
          theme: 'docs.example.com / guides',
        }),
      ),
      knowledgeTopics: [],
      knowledgeArtifact: {
        id: 'knowledge-draft:1',
        artifactType: 'daily-review-draft',
        draftState: 'draft',
        topicKey: null,
        title: 'Knowledge title',
        summary: 'Knowledge summary',
        body: 'Knowledge body',
        sourceReviewedMemoryIds: ['reviewed:1'],
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        reviewedAt: null,
        recencyLabel: 'today',
        provenanceRefs: [],
      },
      knowledgeDraft: null,
      skillArtifact: {
        id: 'skill-draft:1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
      skillDraft: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'artifacts',
      artifactsSubtab: 'generate-knowledge',
      memoryPage: 1,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    });

    expect(html).toContain('Artifact Studio');
    expect(html).toContain('Knowledge Draft Editor');
    expect(html).toContain('Generate Skill');
    expect(html).toContain('data-action="save-knowledge"');
    expect(html).not.toContain('data-action="save-skill"');
    expect(html).toContain('name="knowledge-title"');
    expect(html).toContain('name="knowledge-body"');
    expect(html).toContain('data-subtab="generate-skill"');
  });

  it('renders artifact subtabs and shows only the active artifact panel', () => {
    const baseState = {
      serviceStatus: 'running' as const,
      memoryEvents: [],
      candidateMemories: [
        createCandidateMemory({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
          title: 'Docs Example Com / guides',
          summary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
          theme: 'docs.example.com / guides',
        }),
      ],
      selectedCandidateId:
        'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
      candidateReviewSuggestions: [],
      reviewedMemory: createReviewedMemory(
        createCandidateMemory({
          id: 'candidate:2026-03-20:activitywatch-browser:docs-example-com:guides',
          memoryEventIds: ['browser:aw-event-1'],
          title: 'Docs Example Com / guides',
          summary: '1 browser event about Docs Example Com / guides on 2026-03-20.',
          theme: 'docs.example.com / guides',
        }),
      ),
      knowledgeTopics: [],
      knowledgeArtifacts: [
        {
          id: 'knowledge-draft:1',
          artifactType: 'daily-review-draft' as const,
          draftState: 'draft' as const,
          topicKey: null,
          title: 'Knowledge title',
          summary: 'Knowledge summary',
          body: 'Knowledge body',
          sourceReviewedMemoryIds: ['reviewed:1'],
          derivedFromKnowledgeIds: [],
          version: 1,
          isCurrentBest: false,
          supersedesKnowledgeId: null,
          reviewedAt: null,
          recencyLabel: 'today',
          provenanceRefs: [],
        },
      ],
      knowledgeArtifact: null,
      knowledgeDraft: null,
      skillArtifacts: [
        {
          id: 'skill-draft:1',
          approvalState: 'draft' as const,
          workflowEvidenceRefs: ['reviewed:1'],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        },
      ],
      skillArtifact: null,
      skillDraft: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'artifacts' as const,
      artifactsSubtab: 'history-topics' as const,
      memoryPage: 1,
      knowledgeHistoryPage: 1,
      skillHistoryPage: 1,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    };

    const historyHtml = renderMirrorBrainWebApp(baseState);
    const knowledgeHtml = renderMirrorBrainWebApp({
      ...baseState,
      artifactsSubtab: 'generate-knowledge',
    });
    const skillHtml = renderMirrorBrainWebApp({
      ...baseState,
      artifactsSubtab: 'generate-skill',
    });

    expect(historyHtml).toContain('data-action="switch-artifacts-subtab"');
    expect(historyHtml).toContain('History Topics');
    expect(historyHtml).toContain('Generated Knowledge');
    expect(historyHtml).toContain('Generated Skills');
    expect(historyHtml).not.toContain('Knowledge Draft Editor');
    expect(knowledgeHtml).toContain('Knowledge Draft Editor');
    expect(knowledgeHtml).not.toContain('Generated Skills');
    expect(skillHtml).toContain('Skill Draft Editor');
    expect(skillHtml).not.toContain('Generated Knowledge');
  });

  it('paginates history topics tables at 5 rows per category', () => {
    const knowledgeArtifacts = Array.from({ length: 6 }, (_, index) => ({
      id: `knowledge-draft:${index + 1}`,
      artifactType: 'daily-review-draft' as const,
      draftState: 'draft' as const,
      topicKey: null,
      title: `Knowledge ${index + 1}`,
      summary: `Summary ${index + 1}`,
      body: `Body ${index + 1}`,
      sourceReviewedMemoryIds: ['reviewed:1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      reviewedAt: null,
      recencyLabel: 'today',
      provenanceRefs: [],
    }));
    const skillArtifacts = Array.from({ length: 6 }, (_, index) => ({
      id: `skill-draft:${index + 1}`,
      approvalState: 'draft' as const,
      workflowEvidenceRefs: ['reviewed:1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    }));

    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents: [],
      candidateMemories: [],
      selectedCandidateId: null,
      candidateReviewSuggestions: [],
      reviewedMemory: null,
      knowledgeTopics: [],
      knowledgeArtifacts,
      knowledgeArtifact: null,
      knowledgeDraft: null,
      skillArtifacts,
      skillArtifact: null,
      skillDraft: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'artifacts',
      artifactsSubtab: 'history-topics',
      memoryPage: 1,
      knowledgeHistoryPage: 2,
      skillHistoryPage: 1,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    });

    expect(html).toContain('Knowledge 6');
    expect(html).not.toContain('Knowledge 1');
    expect(html).toContain('skill-draft:1');
    expect(html).toContain('Page 2 of 2');
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
      knowledgeTopics: [],
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
    expect(html).toContain('data-action="memory-prev-page"');
    expect(html).toContain('data-action="memory-next-page"');
    expect(html).toContain('browser:aw-event-7');
    expect(html).toContain('browser:aw-event-6');
    expect(html).toContain('browser:aw-event-3');
    expect(html).not.toContain('browser:aw-event-8');
  });

  it('renders memory events from newest to oldest in the memory tab', () => {
    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents: [
        createMemoryEvent(
          'browser:aw-event-older',
          'Older Event',
          '2026-03-20T08:00:00.000Z',
        ),
        createMemoryEvent(
          'browser:aw-event-newer',
          'Newer Event',
          '2026-03-20T08:05:00.000Z',
        ),
      ],
      candidateMemories: [],
      selectedCandidateId: null,
      candidateReviewSuggestions: [],
      reviewedMemory: null,
      knowledgeTopics: [],
      knowledgeArtifact: null,
      skillArtifact: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'memory',
      memoryPage: 1,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    });

    expect(html.indexOf('browser:aw-event-newer')).toBeLessThan(
      html.indexOf('browser:aw-event-older'),
    );
  });

  it('renders memory events with source, linked name, and timestamp', () => {
    const html = renderMirrorBrainWebApp({
      serviceStatus: 'running',
      memoryEvents: [
        createMemoryEvent(
          'browser:aw-event-1',
          'MirrorBrain Phase 1 MVP',
          '2026-04-01T01:13:07.592000+00:00',
        ),
      ],
      candidateMemories: [],
      selectedCandidateId: null,
      candidateReviewSuggestions: [],
      reviewedMemory: null,
      knowledgeTopics: [],
      knowledgeArtifact: null,
      skillArtifact: null,
      lastSyncSummary: null,
      feedback: null,
      activeTab: 'memory',
      memoryPage: 1,
      reviewWindowDate: null,
      reviewWindowEventCount: 0,
    });

    expect(html).toContain('activitywatch-browser');
    expect(html).toContain(
      '<a href="https://example.com/browser:aw-event-1" target="_blank" rel="noreferrer">MirrorBrain Phase 1 MVP</a>',
    );
    expect(html).toContain('Apr 1');
  });

  it('shows only the actions that belong to the active tab', () => {
    const baseState = {
      serviceStatus: 'running' as const,
      memoryEvents: [] as MemoryEvent[],
      candidateMemories: [] as CandidateMemory[],
      selectedCandidateId: null,
      candidateReviewSuggestions: [] as CandidateReviewSuggestion[],
      reviewedMemory: null,
      knowledgeTopics: [],
      knowledgeArtifact: null,
      knowledgeDraft: null,
      skillArtifact: null,
      skillDraft: null,
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
    expect(memoryHtml).toContain('data-action="sync-shell"');
    expect(reviewHtml).toContain('data-action="create-candidate"');
    expect(reviewHtml).toContain('data-action="keep-candidate"');
    expect(reviewHtml).toContain('data-action="discard-candidate"');
    expect(artifactsHtml).toContain('data-action="switch-artifacts-subtab"');
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
        listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => [] as SkillArtifact[]),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 2,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      })),
      syncShell: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
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
    expect(app.state.reviewWindowEventCount).toBe(3);
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

  it('syncs shell memory and refreshes the memory list', async () => {
    const referenceNow = '2026-03-20T10:00:00.000Z';
    const refreshedEvents: MemoryEvent[] = [
      createMemoryEvent(
        'shell:shell-history:1',
        'git status',
        '2026-03-20T09:05:00.000Z',
      ),
    ];
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory: vi
        .fn<() => Promise<MemoryEvent[]>>()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(refreshedEvents),
      listKnowledge: vi.fn(async () => [] as KnowledgeArtifact[]),
        listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => [] as SkillArtifact[]),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      })),
      syncShell: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
      })),
      createDailyCandidates: vi.fn(async () => [] as CandidateMemory[]),
      suggestCandidateReviews: vi.fn(async () => [] as CandidateReviewSuggestion[]),
      reviewCandidateMemory: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => referenceNow,
    });

    await app.load();
    await app.syncShellMemory();

    expect(api.syncShell).toHaveBeenCalledTimes(1);
    expect(app.state.memoryEvents).toEqual(refreshedEvents);
    expect(app.state.activeTab).toBe('memory');
    expect(app.state.feedback).toEqual({
      kind: 'success',
      message: 'Shell sync completed: 1 events imported.',
    });
  });

  it('reloads memory events after browser sync so url-compressed browser state stays authoritative', async () => {
    const existingEvent = createMemoryEvent(
      'browser:existing',
      'Existing Event',
      '2026-03-20T08:00:00.000Z',
    );
    const importedEvent = createMemoryEvent(
      'browser:imported',
      'Imported Event',
      '2026-03-20T09:00:00.000Z',
    );
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory: vi
        .fn<() => Promise<MemoryEvent[]>>()
        .mockResolvedValueOnce([existingEvent])
        .mockResolvedValueOnce([importedEvent, existingEvent]),
      listKnowledge: vi.fn(async () => []),
      listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => []),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
        importedEvents: [importedEvent],
      })),
      syncShell: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
        importedEvents: [],
      })),
      createDailyCandidates: vi.fn(async () => []),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => '2026-03-20T10:00:00.000Z',
    });

    await app.load();
    await app.syncBrowserMemory();

    expect(app.state.memoryEvents).toEqual([importedEvent, existingEvent]);
    expect(api.listMemory).toHaveBeenCalledTimes(2);
  });

  it('reloads the full memory list after browser sync when the sync response is only a preview', async () => {
    const importedPreviewEvents: MemoryEvent[] = Array.from({ length: 50 }, (_, index) =>
      createMemoryEvent(
        `browser:preview-${index + 1}`,
        `Preview Event ${index + 1}`,
        `2026-03-20T${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00.000Z`,
      ),
    );
    const fullMemoryEvents: MemoryEvent[] = [
      createMemoryEvent(
        'browser:older',
        'Older Event',
        '2026-03-15T08:00:00.000Z',
      ),
      ...importedPreviewEvents,
    ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const listMemory = vi
      .fn<() => Promise<MemoryEvent[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(fullMemoryEvents);
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory,
      listKnowledge: vi.fn(async () => []),
      listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => []),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'initial-backfill' as const,
        importedCount: 75,
        lastSyncedAt: '2026-03-20T09:49:00.000Z',
        importedEvents: importedPreviewEvents,
      })),
      syncShell: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T09:50:00.000Z',
        importedEvents: [],
      })),
      createDailyCandidates: vi.fn(async () => []),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => '2026-03-20T10:00:00.000Z',
    });

    await app.load();
    await app.syncBrowserMemory();

    expect(app.state.memoryEvents).toEqual(fullMemoryEvents);
    expect(listMemory).toHaveBeenCalledTimes(2);
  });

  it('allows editing and saving knowledge and skill drafts from the artifacts tab', async () => {
    const savedKnowledge: KnowledgeArtifact[] = [];
    const savedSkills: SkillArtifact[] = [];
    const knowledgeArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:1',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: null,
      title: 'Original title',
      summary: 'Original summary',
      body: 'Original body',
      sourceReviewedMemoryIds: ['reviewed:1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      reviewedAt: null,
      recencyLabel: 'today',
      provenanceRefs: [],
    };
    const skillArtifact: SkillArtifact = {
      id: 'skill-draft:1',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed:1'],
      executionSafetyMetadata: {
        requiresConfirmation: true,
      },
    };
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory: vi.fn(async () => []),
      listKnowledge: vi.fn(async () => [knowledgeArtifact]),
      listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => [skillArtifact]),
      syncBrowser: vi.fn(),
      syncShell: vi.fn(),
      createDailyCandidates: vi.fn(async () => []),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      generateKnowledge: vi.fn(async () => knowledgeArtifact),
      generateSkill: vi.fn(async () => skillArtifact),
      saveKnowledgeArtifact: vi.fn(async (artifact: KnowledgeArtifact) => {
        savedKnowledge.push(artifact);
        return artifact;
      }),
      saveSkillArtifact: vi.fn(async (artifact: SkillArtifact) => {
        savedSkills.push(artifact);
        return artifact;
      }),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => '2026-03-20T10:00:00.000Z',
    });

    await app.load();
    app.updateKnowledgeDraft({
      title: 'Edited title',
      summary: 'Edited summary',
      body: 'Edited body',
    });
    app.updateSkillDraft({
      approvalState: 'approved',
      workflowEvidenceRefs: ['reviewed:1', 'reviewed:2'],
      requiresConfirmation: false,
    });

    await app.saveKnowledgeDraft();
    await app.saveSkillDraft();

    expect(savedKnowledge[0]).toMatchObject({
      title: 'Edited title',
      summary: 'Edited summary',
      body: 'Edited body',
    });
    expect(savedSkills[0]).toMatchObject({
      approvalState: 'approved',
      workflowEvidenceRefs: ['reviewed:1', 'reviewed:2'],
      executionSafetyMetadata: {
        requiresConfirmation: false,
      },
    });
  });

  it('keeps memory state valid when the initial memory load fails', async () => {
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory: vi.fn(async () => {
        throw new Error('fetch failed');
      }),
      listKnowledge: vi.fn(async () => []),
      listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => []),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
        importedEvents: [
          createMemoryEvent(
            'browser:imported',
            'Imported Event',
            '2026-03-20T09:00:00.000Z',
          ),
        ],
      })),
      syncShell: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
        importedEvents: [],
      })),
      createDailyCandidates: vi.fn(async () => []),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => '2026-03-20T10:00:00.000Z',
    });

    await app.load();

    expect(app.state.memoryEvents).toEqual([]);
    expect(app.state.feedback).toEqual({
      kind: 'error',
      message: 'fetch failed',
    });

    await app.syncBrowserMemory();
    app.setActiveTab('review');
    app.setActiveTab('memory');

    expect(app.state.memoryEvents).toEqual([
      createMemoryEvent(
        'browser:imported',
        'Imported Event',
        '2026-03-20T09:00:00.000Z',
      ),
    ]);
    expect(app.state.activeTab).toBe('memory');
  });

  it('creates candidates even when the current memory tab state does not contain yesterday events', async () => {
    const referenceNow = '2026-04-13T10:00:00.000Z';
    const candidates = [
      createCandidateMemory({
        id: 'candidate:2026-04-12:activitywatch-browser:example-com:tasks',
        memoryEventIds: ['browser:aw-event-1'],
        title: 'Example Com / tasks',
        summary: '1 browser event about Example Com / tasks on 2026-04-12.',
        theme: 'example.com / tasks',
        reviewDate: '2026-04-12',
      }),
    ];
    const api = {
      getHealth: vi.fn(async () => ({
        status: 'running' as const,
      })),
      listMemory: vi.fn(async () => [
        createMemoryEvent(
          'browser:today-only',
          'Today Event',
          '2026-04-13T09:00:00.000Z',
        ),
      ]),
      listKnowledge: vi.fn(async () => []),
      listKnowledgeTopics: vi.fn(async () => []),
      listSkills: vi.fn(async () => []),
      syncBrowser: vi.fn(async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-04-13T09:00:00.000Z',
        importedEvents: [],
      })),
      syncShell: vi.fn(async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-04-13T09:05:00.000Z',
        importedEvents: [],
      })),
      createDailyCandidates: vi.fn(async () => candidates),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    };

    const app = createMirrorBrainWebApp({
      api,
      now: () => referenceNow,
    });

    await app.load();
    await app.createDailyCandidates();

    expect(api.createDailyCandidates).toHaveBeenCalledWith(
      '2026-04-12',
      'Asia/Shanghai',
    );
    expect(app.state.candidateMemories).toEqual(candidates);
    expect(app.state.activeTab).toBe('review');
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
        listKnowledgeTopics: vi.fn(async () => []),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        syncShell: vi.fn(),
        createDailyCandidates: vi.fn(async () => {
          throw new Error('No memory events found for review date 2026-03-19.');
        }),
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
        listKnowledgeTopics: vi.fn(async () => []),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        syncShell: vi.fn(),
        createDailyCandidates: vi.fn(async () => {
          throw new Error('No memory events found for review date 2026-03-19.');
        }),
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
      message: 'No memory events found for review date 2026-03-19.',
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
        listKnowledgeTopics: vi.fn(async () => []),
        listSkills: vi.fn(async () => [] as SkillArtifact[]),
        syncBrowser: vi.fn(),
        syncShell: vi.fn(),
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
