import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createMirrorBrainResourceTarget,
  ingestCandidateMemoryToOpenViking,
  createOpenVikingMemoryEventRecord,
  ingestKnowledgeArtifactToOpenViking,
  ingestMemoryEventToOpenViking,
  ingestReviewedMemoryToOpenViking,
  listMirrorBrainCandidateMemoriesFromOpenViking,
  ingestSkillArtifactToOpenViking,
  listMirrorBrainKnowledgeArtifactsFromOpenViking,
  listMirrorBrainMemoryEventsFromOpenViking,
  listMirrorBrainReviewedMemoriesFromOpenViking,
  listMirrorBrainSkillArtifactsFromOpenViking,
} from './index.js';

describe('openviking store adapter', () => {
  it('encodes mirrorbrain logical namespaces into flat OpenViking resource targets', () => {
    expect(
      createMirrorBrainResourceTarget('memory-events', 'browser:aw-event-1.json'),
    ).toBe(
      'viking://resources/mirrorbrain-memory-events-browser-aw-event-1.json',
    );
    expect(
      createMirrorBrainResourceTarget(
        'candidate-memories',
        'candidate:browser:aw-event-1.json',
      ),
    ).toBe(
      'viking://resources/mirrorbrain-candidate-memories-candidate-browser-aw-event-1.json',
    );
  });

  it('creates a stable memory event record with ingestion metadata', () => {
    expect(
      createOpenVikingMemoryEventRecord({
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
      }),
    ).toEqual({
      recordType: 'memory-event',
      recordId: 'browser:aw-event-1',
      payload: {
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
    });
  });

  it('imports a memory event into OpenViking through the resources API', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-openviking-'));
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    const result = await ingestMemoryEventToOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
        workspaceDir,
        event: {
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
      },
      async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: String(init?.body ?? ''),
        });

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: {
              status: 'success',
              root_uri: 'viking://resources/mirrorbrain/memory-events/browser:aw-event-1.json',
            },
            time: 0.01,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    const importedPayload = JSON.parse(readFileSync(result.sourcePath, 'utf8'));

    expect(importedPayload).toMatchObject({
      id: 'browser:aw-event-1',
      sourceType: 'activitywatch-browser',
    });
    expect(requests).toEqual([
      {
        url: 'http://127.0.0.1:1933/api/v1/resources',
        method: 'POST',
        body: JSON.stringify({
          path: result.sourcePath,
          target:
            'viking://resources/mirrorbrain-memory-events-browser-aw-event-1.json',
          reason: 'MirrorBrain imported browser memory event',
          wait: false,
        }),
      },
    ]);
    expect(result.rootUri).toBe(
      'viking://resources/mirrorbrain/memory-events/browser:aw-event-1.json',
    );
  });

  it('imports a knowledge draft into OpenViking through the resources API', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-openviking-'));
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    const result = await ingestKnowledgeArtifactToOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
        workspaceDir,
        artifact: {
          id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
          artifactType: 'daily-review-draft',
          draftState: 'draft',
          topicKey: 'example-com-tasks',
          title: 'Example Com / tasks',
          summary: '1 reviewed memory about Example Com / tasks from 2026-03-20.',
          body: '- Example Com / tasks: 1 browser event about Example Com / tasks on 2026-03-20.',
          sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
          derivedFromKnowledgeIds: [],
          version: 1,
          isCurrentBest: false,
          supersedesKnowledgeId: null,
          updatedAt: '2026-03-20T10:00:00.000Z',
          reviewedAt: '2026-03-20T10:00:00.000Z',
          recencyLabel: '2026-03-20',
          provenanceRefs: [
            {
              kind: 'reviewed-memory',
              id: 'reviewed:candidate:browser:aw-event-1',
            },
          ],
        },
      },
      async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: String(init?.body ?? ''),
        });

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: {
              status: 'success',
              root_uri: 'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
            },
            time: 0.01,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    const importedPayload = readFileSync(result.sourcePath, 'utf8');

    expect(importedPayload).toContain(
      '# knowledge-draft:reviewed:candidate:browser:aw-event-1',
    );
    expect(importedPayload).toContain('- artifactType: daily-review-draft');
    expect(importedPayload).toContain('- title: Example Com / tasks');
    expect(importedPayload).toContain('- version: 1');
    expect(importedPayload).toContain('- isCurrentBest: false');
    expect(importedPayload).toContain('## Derived Knowledge Artifacts');
    expect(importedPayload).toContain('## Provenance Refs');
    expect(requests).toEqual([
      {
        url: 'http://127.0.0.1:1933/api/v1/resources',
        method: 'POST',
        body: JSON.stringify({
          path: result.sourcePath,
          target:
            'viking://resources/mirrorbrain-knowledge-knowledge-draft-reviewed-candidate-browser-aw-event-1.md',
          reason: 'MirrorBrain imported knowledge draft',
          wait: false,
        }),
      },
    ]);
    expect(result.rootUri).toBe(
      'viking://resources/mirrorbrain/knowledge/knowledge-draft:reviewed:candidate:browser:aw-event-1.md',
    );
  });

  it('imports a candidate memory into OpenViking through the resources API', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-openviking-'));
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    const result = await ingestCandidateMemoryToOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
        workspaceDir,
        artifact: {
          id: 'candidate:browser:aw-event-1',
          memoryEventIds: ['browser:aw-event-1'],
          title: 'Example Com / tasks',
          summary: '1 browser event about Example Com / tasks on 2026-03-20.',
          theme: 'example.com / tasks',
          reviewDate: '2026-03-20',
          timeRange: {
            startAt: '2026-03-20T08:00:00.000Z',
            endAt: '2026-03-20T08:00:00.000Z',
          },
          reviewState: 'pending',
        },
      },
      async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: String(init?.body ?? ''),
        });

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: {
              status: 'success',
              root_uri: 'viking://resources/mirrorbrain/candidate-memories/candidate:browser:aw-event-1.json',
            },
            time: 0.01,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    const importedPayload = JSON.parse(readFileSync(result.sourcePath, 'utf8'));

    expect(importedPayload).toEqual({
      id: 'candidate:browser:aw-event-1',
      memoryEventIds: ['browser:aw-event-1'],
      title: 'Example Com / tasks',
      summary: '1 browser event about Example Com / tasks on 2026-03-20.',
      theme: 'example.com / tasks',
      reviewDate: '2026-03-20',
      timeRange: {
        startAt: '2026-03-20T08:00:00.000Z',
        endAt: '2026-03-20T08:00:00.000Z',
      },
      reviewState: 'pending',
    });
    expect(requests).toEqual([
      {
        url: 'http://127.0.0.1:1933/api/v1/resources',
        method: 'POST',
        body: JSON.stringify({
          path: result.sourcePath,
          target:
            'viking://resources/mirrorbrain-candidate-memories-candidate-browser-aw-event-1.json',
          reason: 'MirrorBrain imported candidate memory',
          wait: false,
        }),
      },
    ]);
    expect(result.rootUri).toBe(
      'viking://resources/mirrorbrain/candidate-memories/candidate:browser:aw-event-1.json',
    );
  });

  it('imports a reviewed memory into OpenViking through the resources API', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-openviking-'));
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    const result = await ingestReviewedMemoryToOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
        workspaceDir,
        artifact: {
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
      },
      async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: String(init?.body ?? ''),
        });

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: {
              status: 'success',
              root_uri: 'viking://resources/mirrorbrain/reviewed-memories/reviewed:candidate:browser:aw-event-1.json',
            },
            time: 0.01,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    const importedPayload = JSON.parse(readFileSync(result.sourcePath, 'utf8'));

    expect(importedPayload).toEqual({
      id: 'reviewed:candidate:browser:aw-event-1',
      candidateMemoryId: 'candidate:browser:aw-event-1',
      candidateTitle: 'Example Com / tasks',
      candidateSummary: '1 browser event about Example Com / tasks on 2026-03-20.',
      candidateTheme: 'example.com / tasks',
      memoryEventIds: ['browser:aw-event-1'],
      reviewDate: '2026-03-20',
      decision: 'keep',
      reviewedAt: '2026-03-20T10:00:00.000Z',
    });
    expect(requests).toEqual([
      {
        url: 'http://127.0.0.1:1933/api/v1/resources',
        method: 'POST',
        body: JSON.stringify({
          path: result.sourcePath,
          target:
            'viking://resources/mirrorbrain-reviewed-memories-reviewed-candidate-browser-aw-event-1.json',
          reason: 'MirrorBrain imported reviewed memory',
          wait: false,
        }),
      },
    ]);
    expect(result.rootUri).toBe(
      'viking://resources/mirrorbrain/reviewed-memories/reviewed:candidate:browser:aw-event-1.json',
    );
  });

  it('imports a skill draft into OpenViking through the resources API', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-openviking-'));
    const requests: Array<{
      url: string;
      method: string;
      body: string;
    }> = [];

    const result = await ingestSkillArtifactToOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
        workspaceDir,
        artifact: {
          id: 'skill-draft:reviewed:candidate:browser:aw-event-1',
          approvalState: 'draft',
          workflowEvidenceRefs: ['reviewed:candidate:browser:aw-event-1'],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        },
      },
      async (input, init) => {
        requests.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: String(init?.body ?? ''),
        });

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: {
              status: 'success',
              root_uri:
                'viking://resources/mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
            },
            time: 0.01,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      },
    );

    expect(requests).toEqual([
      {
        url: 'http://127.0.0.1:1933/api/v1/resources',
        method: 'POST',
        body: JSON.stringify({
          path: result.sourcePath,
          target:
            'viking://resources/mirrorbrain-skill-drafts-skill-draft-reviewed-candidate-browser-aw-event-1.md',
          reason: 'MirrorBrain imported skill draft',
          wait: false,
        }),
      },
    ]);
    expect(result.uri).toBe(
      'viking://resources/mirrorbrain/skill-drafts/skill-draft:reviewed:candidate:browser:aw-event-1.md',
    );
  });

  it('lists memory events from OpenViking resources', async () => {
    const requests: string[] = [];

    const result = await listMirrorBrainMemoryEventsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        requests.push(String(input));

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'mirrorbrain-memory-events-browser-aw-event-1',
                  uri: 'viking://resources/mirrorbrain-memory-events-browser-aw-event-1',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-memory-events-browser-aw-event-1&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser-aw-event-1.json',
                  uri: 'viking://resources/mirrorbrain-memory-events-browser-aw-event-1/browser-aw-event-1.json',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify({
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
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(requests).toEqual([
      'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original',
      'http://127.0.0.1:1933/api/v1/search/glob',
      'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-memory-events-browser-aw-event-1&output=original',
      'http://127.0.0.1:1933/api/v1/content/read?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-memory-events-browser-aw-event-1%2Fbrowser-aw-event-1.json',
    ]);
    expect(result).toEqual([
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

  it('recombines multi-part OpenViking memory resources before parsing JSON', async () => {
    const result = await listMirrorBrainMemoryEventsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser1368',
                  uri: 'viking://resources/browser1368',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fbrowser1368&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser1368_2.md',
                  uri: 'viking://resources/browser1368/browser1368_2.md',
                  isDir: false,
                },
                {
                  name: 'browser1368_1.md',
                  uri: 'viking://resources/browser1368/browser1368_1.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/content/read?uri=viking%3A%2F%2Fresources%2Fbrowser1368%2Fbrowser1368_1.md'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result:
                '{\n  "id": "browser:1368",\n  "sourceType": "activitywatch-browser",\n  "sourceRef": 1368,\n  "timestamp": "2026-03-20T07:56:25.354000+00:00",\n  "authorizationScopeId": "scope-browser",\n  "content": {\n    "url": "https://example.com/very-long-page",\n    "title": "A title that forces OpenViking to split resource bodies across fragments because it is long enough to overflow the first chunk',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result:
              '"\n  },\n  "captureMetadata": {\n    "upstreamSource": "activitywatch",\n    "checkpoint": "2026-03-20T07:56:25.354000+00:00"\n  }\n}',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'browser:1368',
        sourceType: 'activitywatch-browser',
        sourceRef: 1368,
        timestamp: '2026-03-20T07:56:25.354000+00:00',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://example.com/very-long-page',
          title:
            'A title that forces OpenViking to split resource bodies across fragments because it is long enough to overflow the first chunk',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T07:56:25.354000+00:00',
        },
      },
    ]);
  });

  it('can recover legacy flat browser resources by parsing payload shape from the root resource list', async () => {
    const result = await listMirrorBrainMemoryEventsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser503',
                  uri: 'viking://resources/browser503',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fbrowser503&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser503.md',
                  uri: 'viking://resources/browser503/browser503.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify({
              id: 'browser:503',
              sourceType: 'activitywatch-browser',
              sourceRef: '503',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                title: 'Legacy Resource',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'browser:503',
        sourceType: 'activitywatch-browser',
        sourceRef: '503',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          title: 'Legacy Resource',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      },
    ]);
  });

  it('deduplicates memory events when legacy and prefixed OpenViking resources contain the same event id', async () => {
    const result = await listMirrorBrainMemoryEventsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser503',
                  uri: 'viking://resources/browser503',
                  isDir: true,
                },
                {
                  name: 'mirrorbrain-memory-events-browser-503',
                  uri: 'viking://resources/mirrorbrain-memory-events-browser-503',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fbrowser503&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser503.md',
                  uri: 'viking://resources/browser503/browser503.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-memory-events-browser-503&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser-503.json',
                  uri: 'viking://resources/mirrorbrain-memory-events-browser-503/browser-503.json',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify({
              id: 'browser:503',
              sourceType: 'activitywatch-browser',
              sourceRef: '503',
              timestamp: '2026-03-20T08:00:00.000Z',
              authorizationScopeId: 'scope-browser',
              content: {
                title: 'Duplicated Resource',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-20T08:00:00.000Z',
              },
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'browser:503',
        sourceType: 'activitywatch-browser',
        sourceRef: '503',
        timestamp: '2026-03-20T08:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          title: 'Duplicated Resource',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-20T08:00:00.000Z',
        },
      },
    ]);
  });

  it('deduplicates browser memory events with duplicate page content even when ids differ', async () => {
    const result = await listMirrorBrainMemoryEventsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser6330',
                  uri: 'viking://resources/browser6330',
                  isDir: true,
                },
                {
                  name: 'browser6331',
                  uri: 'viking://resources/browser6331',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (String(input).includes('fs/ls?uri=viking%3A%2F%2Fresources%2Fbrowser6330')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser6330.md',
                  uri: 'viking://resources/browser6330/browser6330.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fbrowser6331&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser6331.md',
                  uri: 'viking://resources/browser6331/browser6331.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const duplicatedPayload =
          String(input).includes('browser6330')
            ? {
                id: 'browser:6330',
                sourceType: 'activitywatch-browser',
                sourceRef: '6330',
                timestamp: '2026-03-31T11:31:35.460000+00:00',
                authorizationScopeId: 'scope-browser',
                content: {
                  url: 'https://github.com/wanbo432503/mirrorbrain',
                  title: 'wanbo432503/mirrorbrain',
                },
                captureMetadata: {
                  upstreamSource: 'activitywatch',
                  checkpoint: '2026-03-31T11:31:35.460000+00:00',
                },
              }
            : {
                id: 'browser:6331',
                sourceType: 'activitywatch-browser',
                sourceRef: '6331',
                timestamp: '2026-03-31T11:31:35.461000+00:00',
                authorizationScopeId: 'scope-browser',
                content: {
                  url: 'https://github.com/wanbo432503/mirrorbrain',
                  title: 'wanbo432503/mirrorbrain',
                },
                captureMetadata: {
                  upstreamSource: 'activitywatch',
                  checkpoint: '2026-03-31T11:31:35.461000+00:00',
                },
              };

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify(duplicatedPayload),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'browser:6331',
        sourceType: 'activitywatch-browser',
        sourceRef: '6331',
        timestamp: '2026-03-31T11:31:35.461000+00:00',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://github.com/wanbo432503/mirrorbrain',
          title: 'wanbo432503/mirrorbrain',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-31T11:31:35.461000+00:00',
        },
      },
    ]);
  });

  it('uses OpenViking glob search so newer browser resources beyond the first ls page are returned', async () => {
    const requests: string[] = [];

    const result = await listMirrorBrainMemoryEventsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input, init) => {
        requests.push(`${init?.method ?? 'GET'} ${String(input)}`);

        if (
          String(input) ===
            'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original' &&
          (init?.method === undefined || init?.method === 'GET')
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser4559',
                  uri: 'viking://resources/browser4559',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input).includes('/api/v1/fs/ls?') &&
          String(input).includes('browser4559')
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) === 'http://127.0.0.1:1933/api/v1/search/glob' &&
          init?.method === 'POST'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: {
                matches: [
                  'viking://resources/browser6330',
                  'viking://resources/browser6330/browser6330.md',
                ],
                count: 2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input).includes('/api/v1/fs/ls?') &&
          String(input).includes('browser6330')
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'browser6330.md',
                  uri: 'viking://resources/browser6330/browser6330.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify({
              id: 'browser:6330',
              sourceType: 'activitywatch-browser',
              sourceRef: '6330',
              timestamp: '2026-03-31T11:31:35.460000+00:00',
              authorizationScopeId: 'scope-browser',
              content: {
                url: 'https://github.com/wanbo432503/mirrorbrain',
                title: 'wanbo432503/mirrorbrain',
              },
              captureMetadata: {
                upstreamSource: 'activitywatch',
                checkpoint: '2026-03-31T11:31:35.460000+00:00',
              },
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(requests).toContain('POST http://127.0.0.1:1933/api/v1/search/glob');
    expect(result).toEqual([
      {
        id: 'browser:6330',
        sourceType: 'activitywatch-browser',
        sourceRef: '6330',
        timestamp: '2026-03-31T11:31:35.460000+00:00',
        authorizationScopeId: 'scope-browser',
        content: {
          url: 'https://github.com/wanbo432503/mirrorbrain',
          title: 'wanbo432503/mirrorbrain',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-03-31T11:31:35.460000+00:00',
        },
      },
    ]);
  });


  it('lists knowledge artifacts from OpenViking resources', async () => {
    const result = await listMirrorBrainKnowledgeArtifactsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
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
          String(input) ===
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

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: [
              '# knowledge-draft:reviewed:candidate:browser:aw-event-1',
              '',
              '- artifactType: daily-review-draft',
              '- draftState: draft',
              '- topicKey: example-com-tasks',
              '- title: Example Com / tasks',
              '- summary: 1 reviewed memory about Example Com / tasks from 2026-03-20.',
              '- version: 1',
              '- isCurrentBest: false',
              '- supersedesKnowledgeId: ',
              '- updatedAt: 2026-03-20T10:00:00.000Z',
              '- reviewedAt: 2026-03-20T10:00:00.000Z',
              '- recencyLabel: 2026-03-20',
              '',
              '## Body',
              '- Example Com / tasks: 1 browser event about Example Com / tasks on 2026-03-20.',
              '',
              '## Source Reviewed Memories',
              '- reviewed:candidate:browser:aw-event-1',
              '',
              '## Derived Knowledge Artifacts',
              '',
              '## Provenance Refs',
              '- reviewed-memory:reviewed:candidate:browser:aw-event-1',
            ].join('\n'),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        artifactType: 'daily-review-draft',
        draftState: 'draft',
        topicKey: 'example-com-tasks',
        title: 'Example Com / tasks',
        summary: '1 reviewed memory about Example Com / tasks from 2026-03-20.',
        body: '- Example Com / tasks: 1 browser event about Example Com / tasks on 2026-03-20.',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: '2026-03-20T10:00:00.000Z',
        reviewedAt: '2026-03-20T10:00:00.000Z',
        recencyLabel: '2026-03-20',
        provenanceRefs: [
          {
            kind: 'reviewed-memory',
            id: 'reviewed:candidate:browser:aw-event-1',
          },
        ],
      },
    ]);
  });

  it('lists knowledge artifacts from sanitized OpenViking resource names', async () => {
    const result = await listMirrorBrainKnowledgeArtifactsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'knowledge-draftreviewedcandidatebrowser101',
                  uri: 'viking://resources/knowledge-draftreviewedcandidatebrowser101',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fknowledge-draftreviewedcandidatebrowser101&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'knowledge-draftreviewedcandidatebrowser101.md',
                  uri: 'viking://resources/knowledge-draftreviewedcandidatebrowser101/knowledge-draftreviewedcandidatebrowser101.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: [
              '# knowledge-draft:reviewed:candidate:browser:101',
              '',
              '- draftState: draft',
              '',
              '## Source Reviewed Memories',
              '- reviewed:candidate:browser:101',
            ].join('\n'),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'knowledge-draft:reviewed:candidate:browser:101',
        artifactType: 'daily-review-draft',
        draftState: 'draft',
        topicKey: null,
        title: 'knowledge-draft:reviewed:candidate:browser:101',
        summary: '',
        body: '',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:101'],
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: undefined,
        reviewedAt: null,
        recencyLabel: '',
        provenanceRefs: [],
      },
    ]);
  });

  it('lists candidate memories from OpenViking resources', async () => {
    const result = await listMirrorBrainCandidateMemoriesFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'mirrorbrain-candidate-memories-candidate-browser-aw-event-1',
                  uri: 'viking://resources/mirrorbrain-candidate-memories-candidate-browser-aw-event-1',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-candidate-memories-candidate-browser-aw-event-1&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'candidate.json',
                  uri: 'viking://resources/mirrorbrain-candidate-memories-candidate-browser-aw-event-1/candidate.json',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify({
              id: 'candidate:browser:aw-event-1',
              memoryEventIds: ['browser:aw-event-1'],
              reviewState: 'pending',
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'candidate:browser:aw-event-1',
        memoryEventIds: ['browser:aw-event-1'],
        reviewState: 'pending',
      },
    ]);
  });

  it('lists reviewed memories from OpenViking resources', async () => {
    const result = await listMirrorBrainReviewedMemoriesFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'mirrorbrain-reviewed-memories-reviewed-candidate-browser-aw-event-1',
                  uri: 'viking://resources/mirrorbrain-reviewed-memories-reviewed-candidate-browser-aw-event-1',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-reviewed-memories-reviewed-candidate-browser-aw-event-1&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'reviewed.json',
                  uri: 'viking://resources/mirrorbrain-reviewed-memories-reviewed-candidate-browser-aw-event-1/reviewed.json',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: JSON.stringify({
              id: 'reviewed:candidate:browser:aw-event-1',
              candidateMemoryId: 'candidate:browser:aw-event-1',
              decision: 'keep',
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'reviewed:candidate:browser:aw-event-1',
        candidateMemoryId: 'candidate:browser:aw-event-1',
        decision: 'keep',
      },
    ]);
  });

  it('lists skill artifacts from MirrorBrain skill draft resources', async () => {
    const result = await listMirrorBrainSkillArtifactsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'mirrorbrain-skill-drafts-skill-draft-reviewed-candidate-browser-aw-event-1',
                  uri: 'viking://resources/mirrorbrain-skill-drafts-skill-draft-reviewed-candidate-browser-aw-event-1',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fmirrorbrain-skill-drafts-skill-draft-reviewed-candidate-browser-aw-event-1&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'skill-draft-reviewed-candidate-browser-aw-event-1.md',
                  uri: 'viking://resources/mirrorbrain-skill-drafts-skill-draft-reviewed-candidate-browser-aw-event-1/skill-draft-reviewed-candidate-browser-aw-event-1.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: [
              '# skill-draft:reviewed:candidate:browser:aw-event-1',
              '',
              '- approvalState: draft',
              '- requiresConfirmation: true',
              '',
              '## Workflow Evidence',
              '- reviewed:candidate:browser:aw-event-1',
            ].join('\n'),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
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

  it('lists skill artifacts from sanitized OpenViking resource names', async () => {
    const result = await listMirrorBrainSkillArtifactsFromOpenViking(
      {
        baseUrl: 'http://127.0.0.1:1933',
      },
      async (input) => {
        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2F&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'skill-draftreviewedcandidatebrowser101',
                  uri: 'viking://resources/skill-draftreviewedcandidatebrowser101',
                  isDir: true,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (
          String(input) ===
          'http://127.0.0.1:1933/api/v1/fs/ls?uri=viking%3A%2F%2Fresources%2Fskill-draftreviewedcandidatebrowser101&output=original'
        ) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              result: [
                {
                  name: 'skill-draftreviewedcandidatebrowser101.md',
                  uri: 'viking://resources/skill-draftreviewedcandidatebrowser101/skill-draftreviewedcandidatebrowser101.md',
                  isDir: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'ok',
            result: [
              '# skill-draft:reviewed:candidate:browser:101',
              '',
              '- approvalState: draft',
              '- requiresConfirmation: true',
              '',
              '## Workflow Evidence',
              '- reviewed:candidate:browser:101',
            ].join('\n'),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'skill-draft:reviewed:candidate:browser:101',
        approvalState: 'draft',
        workflowEvidenceRefs: ['reviewed:candidate:browser:101'],
        executionSafetyMetadata: {
          requiresConfirmation: true,
        },
      },
    ]);
  });

  it('treats missing MirrorBrain OpenViking directories as empty artifact lists', async () => {
    const fetchNotFound = async () =>
      new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

    await expect(
      Promise.all([
        listMirrorBrainMemoryEventsFromOpenViking(
          { baseUrl: 'http://127.0.0.1:1933' },
          fetchNotFound,
        ),
        listMirrorBrainCandidateMemoriesFromOpenViking(
          { baseUrl: 'http://127.0.0.1:1933' },
          fetchNotFound,
        ),
        listMirrorBrainReviewedMemoriesFromOpenViking(
          { baseUrl: 'http://127.0.0.1:1933' },
          fetchNotFound,
        ),
        listMirrorBrainKnowledgeArtifactsFromOpenViking(
          { baseUrl: 'http://127.0.0.1:1933' },
          fetchNotFound,
        ),
        listMirrorBrainSkillArtifactsFromOpenViking(
          { baseUrl: 'http://127.0.0.1:1933' },
          fetchNotFound,
        ),
      ]),
    ).resolves.toEqual([[], [], [], [], []]);
  });

});
