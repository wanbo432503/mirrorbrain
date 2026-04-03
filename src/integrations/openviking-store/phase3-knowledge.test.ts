import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ingestKnowledgeArtifactToOpenViking,
  listMirrorBrainKnowledgeArtifactsFromOpenViking,
} from './index.js';

describe('openviking store phase 3 knowledge artifacts', () => {
  it('round-trips a phase-3 daily-review knowledge draft with topic metadata', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-phase3-knowledge-'));

    const result = await ingestKnowledgeArtifactToOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
        workspaceDir,
        artifact: {
          artifactType: 'daily-review-draft',
          id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
          draftState: 'draft',
          topicKey: 'example-com-tasks',
          title: 'Example Com / tasks',
          summary: 'Daily review draft for Example Com / tasks.',
          body: '- Example Com / tasks\n\n1 reviewed memory item included.',
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
      },
      async () =>
        new Response(
          JSON.stringify({
            status: 'ok',
            result: {
              status: 'success',
              root_uri: 'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const markdown = readFileSync(result.sourcePath, 'utf8');

    expect(markdown).toContain('- artifactType: daily-review-draft');
    expect(markdown).toContain('- topicKey: example-com-tasks');
    expect(markdown).toContain('- version: 1');
    expect(markdown).toContain('- isCurrentBest: false');
    expect(markdown).toContain('## Body');
    expect(markdown).toContain('## Provenance');

    const listed = await listMirrorBrainKnowledgeArtifactsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        const url = String(input);

        if (
          url ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'mirrorbrain-knowledge-knowledge-draft-reviewed-candidate-browser-aw-event-1',
                  uri: 'viking://resources/mirrorbrain-knowledge-knowledge-draft-reviewed-candidate-browser-aw-event-1',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          url ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-knowledge-knowledge-draft-reviewed-candidate-browser-aw-event-1&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'knowledge.md',
                  uri: 'viking://resources/mirrorbrain-knowledge-knowledge-draft-reviewed-candidate-browser-aw-event-1/knowledge.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(JSON.stringify({ status: 'ok', result: markdown }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );

    expect(listed).toEqual([
      {
        artifactType: 'daily-review-draft',
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        topicKey: 'example-com-tasks',
        title: 'Example Com / tasks',
        summary: 'Daily review draft for Example Com / tasks.',
        body: '- Example Com / tasks\n\n1 reviewed memory item included.',
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
    ]);
  });
});
