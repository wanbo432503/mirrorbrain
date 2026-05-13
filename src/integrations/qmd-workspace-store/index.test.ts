import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import {
  createQmdWorkspaceMemoryEventWriter,
  getQmdWorkspacePaths,
  ingestBrowserPageContentToQmdWorkspace,
  listMirrorBrainMemoryEventsFromQmdWorkspace,
} from './index.js';
import type { MemoryEvent } from '../../shared/types/index.js';

describe('qmd-workspace-store', () => {
  const event: MemoryEvent = {
    id: 'browser:event-1',
    sourceType: 'activitywatch-browser',
    sourceRef: 'https://example.com/qmd',
    timestamp: '2026-05-13T08:00:00.000Z',
    authorizationScopeId: 'scope-browser',
    content: {
      title: 'QMD storage decision',
      summary: 'MirrorBrain uses qmd under the same workspace.',
      url: 'https://example.com/qmd',
      contentKind: 'browser-page',
    },
    captureMetadata: {
      upstreamSource: 'activitywatch',
      checkpoint: 'aw:event-1',
    },
  };

  it('writes memory events as workspace JSON and canonical markdown for qmd indexing', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-qmd-'));
    const writer = createQmdWorkspaceMemoryEventWriter({ workspaceDir });

    await writer.writeMemoryEvent({
      recordType: 'memory-event',
      recordId: event.id,
      payload: event,
    });

    const paths = getQmdWorkspacePaths(workspaceDir);
    const json = JSON.parse(
      await readFile(join(paths.memoryEventsDir, 'browser-event-1.json'), 'utf8'),
    ) as MemoryEvent;
    const markdown = await readFile(
      join(paths.memoryEventsDir, 'browser-event-1.md'),
      'utf8',
    );

    expect(json).toEqual(event);
    expect(markdown).toContain('# QMD storage decision');
    expect(markdown).toContain('mirrorbrainType: memory-event');
    expect(markdown).toContain('id: browser:event-1');
    expect(markdown).toContain('sourceType: activitywatch-browser');
    expect(markdown).toContain('MirrorBrain uses qmd under the same workspace.');
    expect(paths.dbPath).toBe(join(workspaceDir, 'mirrorbrain', 'qmd', 'index.sqlite'));
  });

  it('opens qmd inside mirrorbrain-workspace and maps qmd hits back to MemoryEvent records', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-qmd-'));
    const writer = createQmdWorkspaceMemoryEventWriter({ workspaceDir });
    await writer.writeMemoryEvent({
      recordType: 'memory-event',
      recordId: event.id,
      payload: event,
    });

    const qmdStore = {
      update: vi.fn(async () => ({
        collections: ['memory-events'],
        indexed: 1,
        updated: 0,
        unchanged: 0,
        removed: 0,
        needsEmbedding: 0,
      })),
      searchLex: vi.fn(async () => [
        {
          title: 'QMD storage decision',
          score: 0.95,
          displayPath: 'memory-events/browser-event-1.md',
        },
      ]),
      close: vi.fn(async () => undefined),
    };
    const createStore = vi.fn(async () => qmdStore);

    const results = await listMirrorBrainMemoryEventsFromQmdWorkspace(
      {
        workspaceDir,
        query: 'qmd storage',
      },
      { createStore },
    );

    expect(createStore).toHaveBeenCalledWith({
      dbPath: join(workspaceDir, 'mirrorbrain', 'qmd', 'index.sqlite'),
      config: {
        collections: {
          'memory-events': {
            path: join(workspaceDir, 'mirrorbrain', 'memory-events'),
            pattern: '**/*.md',
          },
          'memory-narratives': {
            path: join(workspaceDir, 'mirrorbrain', 'memory-narratives'),
            pattern: '**/*.md',
          },
          knowledge: {
            path: join(workspaceDir, 'mirrorbrain', 'knowledge'),
            pattern: '**/*.md',
          },
          'skill-drafts': {
            path: join(workspaceDir, 'mirrorbrain', 'skill-drafts'),
            pattern: '**/*.md',
          },
        },
      },
    });
    expect(qmdStore.update).toHaveBeenCalledWith({
      collections: ['memory-events'],
    });
    expect(qmdStore.searchLex).toHaveBeenCalledWith('qmd storage', {
      collection: 'memory-events',
      limit: 20,
    });
    expect(results).toEqual([event]);
    expect(qmdStore.close).toHaveBeenCalledTimes(1);
  });

  it('uses qmd unified structured search before falling back to lexical search', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-qmd-'));
    const writer = createQmdWorkspaceMemoryEventWriter({ workspaceDir });
    await writer.writeMemoryEvent({
      recordType: 'memory-event',
      recordId: event.id,
      payload: event,
    });

    const qmdStore = {
      update: vi.fn(async () => ({
        collections: ['memory-events'],
        indexed: 1,
        updated: 0,
        unchanged: 0,
        removed: 0,
        needsEmbedding: 1,
      })),
      search: vi.fn(async () => [
        {
          title: 'QMD storage decision',
          score: 0.95,
          displayPath: 'memory-events/browser-event-1.md',
        },
      ]),
      searchLex: vi.fn(async () => []),
      close: vi.fn(async () => undefined),
    };
    const createStore = vi.fn(async () => qmdStore);

    const results = await listMirrorBrainMemoryEventsFromQmdWorkspace(
      {
        workspaceDir,
        query: 'where did storage backend change?',
      },
      { createStore },
    );

    expect(qmdStore.search).toHaveBeenCalledWith({
      queries: [{ type: 'lex', query: 'where did storage backend change?' }],
      collection: 'memory-events',
      limit: 20,
      rerank: false,
    });
    expect(qmdStore.searchLex).not.toHaveBeenCalled();
    expect(results).toEqual([event]);
  });

  it('falls back to lexical search when qmd unified search returns no hits', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-qmd-'));
    const writer = createQmdWorkspaceMemoryEventWriter({ workspaceDir });
    await writer.writeMemoryEvent({
      recordType: 'memory-event',
      recordId: event.id,
      payload: event,
    });

    const qmdStore = {
      update: vi.fn(async () => ({
        collections: ['memory-events'],
        indexed: 1,
        updated: 0,
        unchanged: 0,
        removed: 0,
        needsEmbedding: 1,
      })),
      search: vi.fn(async () => []),
      searchLex: vi.fn(async () => [
        {
          title: 'QMD storage decision',
          score: 0.88,
          displayPath: 'memory-events/browser-event-1.md',
        },
      ]),
      close: vi.fn(async () => undefined),
    };
    const createStore = vi.fn(async () => qmdStore);

    const results = await listMirrorBrainMemoryEventsFromQmdWorkspace(
      {
        workspaceDir,
        query: 'qmd storage',
      },
      { createStore },
    );

    expect(qmdStore.search).toHaveBeenCalled();
    expect(qmdStore.searchLex).toHaveBeenCalledWith('qmd storage', {
      collection: 'memory-events',
      limit: 20,
    });
    expect(results).toEqual([event]);
  });

  it('maps qmd collection URIs from real search results back to workspace JSON', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-qmd-'));
    const writer = createQmdWorkspaceMemoryEventWriter({ workspaceDir });
    await writer.writeMemoryEvent({
      recordType: 'memory-event',
      recordId: event.id,
      payload: event,
    });

    const qmdStore = {
      update: vi.fn(async () => ({
        collections: ['memory-events'],
        indexed: 1,
        updated: 0,
        unchanged: 0,
        removed: 0,
        needsEmbedding: 1,
      })),
      search: vi.fn(async () => []),
      searchLex: vi.fn(async () => [
        {
          title: 'QMD storage decision',
          score: 0.88,
          filepath: 'qmd://memory-events/browser-event-1.md',
        },
      ]),
      close: vi.fn(async () => undefined),
    };
    const createStore = vi.fn(async () => qmdStore);

    const results = await listMirrorBrainMemoryEventsFromQmdWorkspace(
      {
        workspaceDir,
        query: 'qmd storage',
      },
      { createStore },
    );

    expect(results).toEqual([event]);
  });

  it('writes shared browser page content into the same qmd workspace', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-qmd-'));

    const result = await ingestBrowserPageContentToQmdWorkspace({
      workspaceDir,
      artifact: {
        id: 'browser-page:url-abc123',
        url: 'https://example.com/qmd',
        title: 'QMD page content',
        text: 'Readable page body for qmd indexing.',
        accessTimes: ['2026-05-13T08:00:00.000Z'],
        latestAccessedAt: '2026-05-13T08:00:00.000Z',
      },
    });

    const markdown = await readFile(result.sourcePath, 'utf8');

    expect(result.rootUri).toBe(
      'qmd://mirrorbrain/browser-page-content/browser-page-url-abc123.md',
    );
    expect(markdown).toContain('# QMD page content');
    expect(markdown).toContain('- url: https://example.com/qmd');
    expect(markdown).toContain('Readable page body for qmd indexing.');
  });
});
