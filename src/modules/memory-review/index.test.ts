import { describe, expect, it } from 'vitest';

import {
  createCandidateMemory,
  reviewCandidateMemory,
} from './index.js';

describe('memory review', () => {
  it('groups related memory events into a candidate memory', () => {
    const candidate = createCandidateMemory([
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
      {
        id: 'browser:aw-event-2',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-2',
        timestamp: '2026-03-20T08:05:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/tasks/2',
          title: 'Example Tasks 2',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:05:00.000Z',
        },
      },
    ]);

    expect(candidate).toMatchObject({
      id: 'candidate:browser:aw-event-1',
      memoryEventIds: ['browser:aw-event-1', 'browser:aw-event-2'],
      reviewState: 'pending',
    });
  });

  it('keeps candidate and reviewed states distinct', () => {
    const candidate = createCandidateMemory([
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
    ]);

    const reviewed = reviewCandidateMemory(candidate, {
      decision: 'keep',
    });

    expect(candidate.reviewState).toBe('pending');
    expect(reviewed).toMatchObject({
      id: 'reviewed:candidate:browser:aw-event-1',
      candidateMemoryId: 'candidate:browser:aw-event-1',
      decision: 'keep',
    });
  });
});
