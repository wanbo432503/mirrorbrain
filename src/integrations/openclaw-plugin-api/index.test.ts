import { describe, expect, it } from 'vitest';

import {
  listKnowledge,
  listSkillDrafts,
  queryMemory,
} from './index.js';

describe('openclaw plugin api', () => {
  it('returns theme-level memory retrieval results from OpenViking memory events', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
          query: 'What did I work on yesterday?',
          timeRange: {
            startAt: '2026-03-20T00:00:00.000Z',
            endAt: '2026-03-20T23:59:59.999Z',
          },
          sourceTypes: ['browser'],
        },
        {
          listMemoryEvents: async () => [
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
        },
      ),
    ).resolves.toEqual({
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
  });

  it('returns knowledge drafts from OpenViking', async () => {
    await expect(
      listKnowledge(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listKnowledgeArtifacts: async () => [
            {
              id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
              draftState: 'draft',
              sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
            },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
      },
    ]);
  });

  it('returns skill drafts from OpenViking', async () => {
    await expect(
      listSkillDrafts(
        {
          baseUrl: 'http://127.0.0.1:1933',
        },
        {
          listSkillArtifacts: async () => [
            {
              id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
              approvalState: 'draft',
              workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
              executionSafetyMetadata: {
                requiresConfirmation: true,
              },
            },
          ],
        },
      ),
    ).resolves.toEqual([
      {
        id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    ]);
  });
});
