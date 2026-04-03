import { describe, expect, it } from 'vitest';

import { listMirrorBrainKnowledgeArtifactsFromOpenViking } from './index.js';

describe('openviking store phase 3 knowledge current-best resolution', () => {
  it('prefers the latest updated knowledge artifact when duplicate ids exist', async () => {
    const olderMarkdown = [
      '# topic-knowledge:example-com-tasks:v1',
      '',
      '- artifactType: topic-knowledge',
      '- draftState: published',
      '- topicKey: example-com-tasks',
      '- title: Example Com / tasks',
      '- summary: Earlier summary.',
      '- version: 1',
      '- isCurrentBest: true',
      '- supersedesKnowledgeId: ',
      '- updatedAt: 2026-03-20T10:00:00.000Z',
      '- reviewedAt: 2026-03-20T10:00:00.000Z',
      '- recencyLabel: 2026-03-20',
      '',
      '## Body',
      'Earlier body.',
      '',
      '## Source Reviewed Memories',
      '- reviewed:candidate:older',
      '',
      '## Derived Knowledge Artifacts',
      '- knowledge-draft:older',
      '',
      '## Provenance Refs',
      '- reviewed-memory:reviewed:candidate:older',
    ].join('\n');
    const newerMarkdown = olderMarkdown.replace('- isCurrentBest: true', '- isCurrentBest: false').replace('2026-03-20T10:00:00.000Z', '2026-03-21T09:00:00.000Z');

    const artifacts = await listMirrorBrainKnowledgeArtifactsFromOpenViking(
      { baseUrl: 'http://127.0.0.1:1933' },
      async (input) => {
        const url = String(input);
        if (url.includes('/api/v1/content/read')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: url.includes('v1-old/knowledge.md')
                ? olderMarkdown
                : newerMarkdown,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.endsWith('/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original')) {
          return new Response(JSON.stringify({
            status: 'ok',
            result: [
              { name: 'mirrorbrain-knowledge-topic-knowledge-example-com-tasks-v1-old', uri: 'viking://resources/mirrorbrain-knowledge-topic-knowledge-example-com-tasks-v1-old', isDir: true },
              { name: 'mirrorbrain-knowledge-topic-knowledge-example-com-tasks-v1-new', uri: 'viking://resources/mirrorbrain-knowledge-topic-knowledge-example-com-tasks-v1-new', isDir: true },
            ],
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('v1-old')) {
          return new Response(JSON.stringify({ status: 'ok', result: [{ name: 'knowledge.md', uri: 'viking://resources/mirrorbrain-knowledge-topic-knowledge-example-com-tasks-v1-old/knowledge.md', isDir: false }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.includes('v1-new')) {
          return new Response(JSON.stringify({ status: 'ok', result: [{ name: 'knowledge.md', uri: 'viking://resources/mirrorbrain-knowledge-topic-knowledge-example-com-tasks-v1-new/knowledge.md', isDir: false }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ status: 'ok', result: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    );

    expect(artifacts).toEqual([
      expect.objectContaining({
        id: 'topic-knowledge:example-com-tasks:v1',
        isCurrentBest: false,
        updatedAt: '2026-03-21T09:00:00.000Z',
      }),
    ]);
  });
});
