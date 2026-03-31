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
          draftState: 'draft',
          sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
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
          decision: 'keep',
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
      decision: 'keep',
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
              '- draftState: draft',
              '',
              '## Source Reviewed Memories',
              '- reviewed:candidate:browser:aw-event-1',
            ].join('\n'),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );

    expect(result).toEqual([
      {
        id: 'knowledge-draft:reviewed:candidate:browser:aw-event-1',
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:aw-event-1'],
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
        draftState: 'draft',
        sourceReviewedMemoryIds: ['reviewed:candidate:browser:101'],
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
});
