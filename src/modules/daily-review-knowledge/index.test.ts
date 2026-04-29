import { describe, expect, it } from 'vitest';

import { createKnowledgeDraft } from './index.js';
import type { ReviewedMemory } from '../../shared/types/index.js';

describe('daily review knowledge', () => {
  it('creates a knowledge draft from reviewed memory only', () => {
    expect(
      createKnowledgeDraft({
        reviewedMemories: [
          {
            id: 'reviewed:candidate:browser:aw-event-1',
            candidateMemoryId: 'candidate:browser:aw-event-1',
            candidateTitle: 'Example Com / tasks',
            candidateSummary: '1 browser event about Example Com / tasks on 2026-03-20.',
            candidateTheme: 'example.com / tasks',
            memoryEventIds: ['browser:aw-event-1'],
            reviewDate: '2026-03-20',
            decision: 'keep',
            reviewedAt: '2026-03-20T10:00:00.000Z',
          },
        ],
      }),
    ).toMatchObject({
      id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'example-com-tasks',
      title: 'Example Com / tasks',
      summary: '1 reviewed memory about Example Com / tasks from 2026-03-20.',
      body: '- Example Com / tasks: 1 browser event about Example Com / tasks on 2026-03-20.',
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      derivedFromKnowledgeIds: [],
      reviewedAt: '2026-03-20T10:00:00.000Z',
      recencyLabel: '2026-03-20',
      sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      provenanceRefs: [
        {
          kind: 'reviewed-memory',
          id: 'reviewed:candidate:browser:aw-event-1',
        },
      ],
    });
  });

  it('uses sourceRefs to list primary sources in knowledge body', () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate:test',
      candidateMemoryId: 'candidate:test',
      candidateTitle: 'GitHub issue review workflow',
      candidateSummary: 'Reviewed GitHub issue and related documentation.',
      candidateTheme: 'github / review',
      candidateSourceRefs: [
        {
          id: 'event-1',
          sourceType: 'browser',
          timestamp: '2026-04-14T10:00:00Z',
          title: 'Fix authentication bug - Issue #123',
          url: 'https://github.com/repo/issues/123',
          role: 'issue',
          contribution: 'primary',
        },
        {
          id: 'event-2',
          sourceType: 'browser',
          timestamp: '2026-04-14T10:05:00Z',
          title: 'Authentication docs',
          url: 'https://docs.example.com/auth',
          role: 'docs',
          contribution: 'supporting',
        },
      ],
      candidateFormationReasons: [
        'Grouped by shared task tokens: authentication, bug, fix',
        'Issue page is primary, docs page is supporting',
      ],
      memoryEventIds: ['event-1', 'event-2'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-14T12:00:00Z',
    };

    const knowledgeDraft = createKnowledgeDraft({
      reviewedMemories: [reviewedMemory],
    });

    expect(knowledgeDraft.title).toBe('GitHub issue review workflow');
    expect(knowledgeDraft.topicKey).toBe('github-review');
    expect(knowledgeDraft.body).toContain('Primary sources:');
    expect(knowledgeDraft.body).toContain('Fix authentication bug - Issue #123');
    expect(knowledgeDraft.body).toContain('https://github.com/repo/issues/123');
    expect(knowledgeDraft.body).toContain('Supporting sources:');
    expect(knowledgeDraft.body).toContain('Authentication docs');
    expect(knowledgeDraft.body).toContain('https://docs.example.com/auth');
    expect(knowledgeDraft.body).toContain('Why this task was captured:');
    expect(knowledgeDraft.body).toContain(
      'Grouped by shared task tokens: authentication, bug, fix',
    );
  });

  it('includes formation reasons to explain why the task matters', () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate:test',
      candidateMemoryId: 'candidate:test',
      candidateTitle: 'API integration debugging',
      candidateSummary: 'Debugged API integration issues.',
      candidateTheme: 'api / debugging',
      candidateFormationReasons: [
        'Multi-host task: api.example.com and localhost:3000',
        'Debugging role detected from localhost URLs',
        'Sustained activity over 45 minutes',
      ],
      memoryEventIds: ['event-1', 'event-2', 'event-3'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-14T12:00:00Z',
    };

    const knowledgeDraft = createKnowledgeDraft({
      reviewedMemories: [reviewedMemory],
    });

    expect(knowledgeDraft.body).toContain('Why this task was captured:');
    expect(knowledgeDraft.body).toContain('Multi-host task');
    expect(knowledgeDraft.body).toContain('Debugging role detected');
    expect(knowledgeDraft.body).toContain('Sustained activity');
  });

  it('calculates time range from candidate when available', () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate:test',
      candidateMemoryId: 'candidate:test',
      candidateTitle: 'Feature implementation',
      candidateSummary: 'Implemented new feature.',
      candidateTheme: 'feature',
      candidateTimeRange: {
        startAt: '2026-04-14T09:00:00Z',
        endAt: '2026-04-14T10:30:00Z',
      },
      memoryEventIds: ['event-1', 'event-2'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-14T12:00:00Z',
    };

    const knowledgeDraft = createKnowledgeDraft({
      reviewedMemories: [reviewedMemory],
    });

    // Time range is formatted in local timezone, so we just check the format
    expect(knowledgeDraft.body).toContain('Time range:');
    expect(knowledgeDraft.body).toContain('Duration: 90 minutes');
  });
});
