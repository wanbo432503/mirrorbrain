import { describe, expect, it } from 'vitest';

import {
  listKnowledge,
  listSkillDrafts,
  queryMemory,
} from './index.js';

describe('openclaw plugin api', () => {
  it('returns memory artifacts from OpenViking', async () => {
    await expect(
      queryMemory(
        {
          baseUrl: 'http://127.0.0.1:1933',
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
    ).resolves.toEqual([
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
