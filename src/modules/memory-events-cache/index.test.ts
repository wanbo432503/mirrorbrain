import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

import type { MemoryEvent } from '../../shared/types/index.js';
import {
  loadMemoryEventsCache,
  saveMemoryEventsCache,
  initializeCacheFromOpenViking,
  updateCacheWithNewEvents,
  getEventsFromCache,
  type MemoryEventsCache,
} from './index.js';

async function createTempWorkspace(): Promise<string> {
  const tempDir = join(tmpdir(), `mirrorbrain-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  return tempDir;
}

async function cleanupTempWorkspace(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}

function createTestMemoryEvent(id: string, timestamp: string, url?: string): MemoryEvent {
  return {
    id,
    sourceType: 'activitywatch-browser',
    sourceRef: id,
    timestamp,
    authorizationScopeId: 'test-scope',
    content: {
      url: url ?? `https://example.com/${id}`,
      title: `Test Event ${id}`,
      accessTimes: [timestamp],
      latestAccessedAt: timestamp,
    },
    captureMetadata: {
      upstreamSource: 'test-source',
      checkpoint: timestamp,
    },
  };
}

function createLedgerMemoryEvent(input: {
  id: string;
  sourceKind: string;
  sourceInstanceId: string;
  timestamp: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: input.sourceKind,
    sourceRef: `${input.sourceKind}:${input.sourceInstanceId}:${input.id}`,
    timestamp: input.timestamp,
    authorizationScopeId: 'scope-source-ledger',
    content: {
      title: `Ledger Event ${input.id}`,
      summary: `Summary for ${input.id}`,
      contentKind: `${input.sourceKind}-event`,
      sourceSpecific: {},
    },
    captureMetadata: {
      upstreamSource: `source-ledger:${input.sourceKind}`,
      checkpoint: `ledgers/2026-05-12/${input.sourceKind}.jsonl:1`,
    },
  };
}

function createLedgerBrowserMemoryEvent(input: {
  id: string;
  timestamp: string;
  title?: string;
  url: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: 'browser',
    sourceRef: `browser:chrome-main:${input.id}`,
    timestamp: input.timestamp,
    authorizationScopeId: 'scope-source-ledger',
    content: {
      title: input.title ?? `Browser Event ${input.id}`,
      summary: `${input.title ?? input.id} ${input.url}`,
      contentKind: 'browser-page',
      entities: [
        {
          kind: 'url',
          label: input.url,
          ref: input.url,
        },
      ],
      sourceSpecific: {
        id: input.id,
        url: input.url,
        pageContent: `${input.title ?? input.id} ${input.url}`,
      },
    },
    captureMetadata: {
      upstreamSource: 'source-ledger:browser',
      checkpoint: `ledgers/2026-05-12/browser.jsonl:1`,
    },
  };
}

describe('memory-events-cache', () => {
  let tempWorkspace: string;

  beforeEach(async () => {
    tempWorkspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await cleanupTempWorkspace(tempWorkspace);
  });

  describe('loadMemoryEventsCache', () => {
    it('should return null when cache file does not exist', async () => {
      const result = await loadMemoryEventsCache(tempWorkspace);
      expect(result).toBeNull();
    });

    it('should return null when cache file has invalid structure', async () => {
      const cacheDir = join(tempWorkspace, 'mirrorbrain', 'cache');
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, 'memory-events-cache.json'), JSON.stringify({ invalid: true }));

      const result = await loadMemoryEventsCache(tempWorkspace);
      expect(result).toBeNull();
    });

    it('should return null when cache file is empty or corrupt', async () => {
      const cacheDir = join(tempWorkspace, 'mirrorbrain', 'cache');
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, 'memory-events-cache.json'), '');

      const result = await loadMemoryEventsCache(tempWorkspace);
      expect(result).toBeNull();
    });

    it('should return cache when file exists with valid structure', async () => {
      const cache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T10:00:00Z',
        total: 2,
        events: [
          createTestMemoryEvent('event-1', '2026-04-16T09:00:00Z'),
          createTestMemoryEvent('event-2', '2026-04-16T08:00:00Z'),
        ],
        lastSyncSummary: {},
      };

      await saveMemoryEventsCache(tempWorkspace, cache);
      const result = await loadMemoryEventsCache(tempWorkspace);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.total).toBe(2);
      expect(result?.events.length).toBe(2);
    });
  });

  describe('saveMemoryEventsCache', () => {
    it('should create cache directory and file', async () => {
      const cache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T10:00:00Z',
        total: 1,
        events: [createTestMemoryEvent('event-1', '2026-04-16T09:00:00Z')],
        lastSyncSummary: {},
      };

      await saveMemoryEventsCache(tempWorkspace, cache);

      const cacheFilePath = join(tempWorkspace, 'mirrorbrain', 'cache', 'memory-events-cache.json');
      const content = await readFile(cacheFilePath, 'utf8');
      const parsed = JSON.parse(content) as MemoryEventsCache;

      expect(parsed.version).toBe(1);
      expect(parsed.total).toBe(1);
    });
  });

  describe('getEventsFromCache', () => {
    it('should return paginated events from cache', async () => {
      const cache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T10:00:00Z',
        total: 25,
        events: Array.from({ length: 25 }, (_, i) =>
          createTestMemoryEvent(`event-${i}`, `2026-04-16T${String(9 - i).padStart(2, '0')}:00:00Z`)
        ),
        lastSyncSummary: {},
      };

      const result = getEventsFromCache(cache, 1, 10);

      expect(result.events.length).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
    });

    it('should clamp page to valid range', async () => {
      const cache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T10:00:00Z',
        total: 5,
        events: Array.from({ length: 5 }, (_, i) =>
          createTestMemoryEvent(`event-${i}`, `2026-04-16T${String(9 - i).padStart(2, '0')}:00:00Z`)
        ),
        lastSyncSummary: {},
      };

      const result = getEventsFromCache(cache, 10, 10);

      expect(result.events.length).toBe(5);
      expect(result.totalPages).toBe(1);
    });

    it('should return empty events for page beyond total', async () => {
      const cache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T10:00:00Z',
        total: 0,
        events: [],
        lastSyncSummary: {},
      };

      const result = getEventsFromCache(cache, 1, 10);

      expect(result.events.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });

    it('should filter events by Phase 4 source instance before paginating', async () => {
      const cache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-05-12T10:00:00Z',
        total: 3,
        events: [
          createLedgerMemoryEvent({
            id: 'event-browser-new',
            sourceKind: 'browser',
            sourceInstanceId: 'chrome-main',
            timestamp: '2026-05-12T10:00:00.000Z',
          }),
          createLedgerMemoryEvent({
            id: 'event-shell',
            sourceKind: 'shell',
            sourceInstanceId: 'iterm-main',
            timestamp: '2026-05-12T09:00:00.000Z',
          }),
          createLedgerMemoryEvent({
            id: 'event-browser-old',
            sourceKind: 'browser',
            sourceInstanceId: 'chrome-main',
            timestamp: '2026-05-12T08:00:00.000Z',
          }),
        ],
        lastSyncSummary: {},
      };

      const result = getEventsFromCache(cache, 1, 10, {
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      });

      expect(result.events.map((event) => event.id)).toEqual([
        'event-browser-new',
        'event-browser-old',
      ]);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('initializeCacheFromOpenViking', () => {
    it('should initialize cache from workspace filesystem when workspace has events', async () => {
      // Create memory events in workspace filesystem
      const memoryEventsDir = join(tempWorkspace, 'mirrorbrain', 'memory-events');
      await mkdir(memoryEventsDir, { recursive: true });

      const event1 = createTestMemoryEvent('browser:101', '2026-04-16T09:00:00Z');
      const event2 = createTestMemoryEvent('browser:102', '2026-04-16T08:00:00Z');

      await writeFile(join(memoryEventsDir, 'browser:101.json'), JSON.stringify(event1));
      await writeFile(join(memoryEventsDir, 'browser:102.json'), JSON.stringify(event2));

      // Initialize cache (should read from workspace filesystem, not empty OpenViking)
      const mockBaseUrl = 'http://localhost:8080-unreachable';
      const cache = await initializeCacheFromOpenViking(tempWorkspace, mockBaseUrl);

      expect(cache.total).toBe(2);
      expect(cache.events.length).toBe(2);
      expect(cache.events[0].id).toBe('browser:101');
      expect(cache.events[1].id).toBe('browser:102');
    });

    it('should prefer workspace filesystem over OpenViking even when OpenViking has no events', async () => {
      // This mimics the user's bug: workspace has 4132 events, OpenViking has 0
      const memoryEventsDir = join(tempWorkspace, 'mirrorbrain', 'memory-events');
      await mkdir(memoryEventsDir, { recursive: true });

      const event = createTestMemoryEvent('browser:existing', '2026-04-16T09:00:00Z');
      await writeFile(join(memoryEventsDir, 'browser:existing.json'), JSON.stringify(event));

      // Mock OpenViking to return empty (simulating the bug scenario)
      const mockListOpenViking = vi.fn(async () => []);
      const mockListWorkspace = vi.fn(async () => [event]);

      const cache = await initializeCacheFromOpenViking(
        tempWorkspace,
        'http://localhost:8080',
        {
          listWorkspaceMemoryEvents: mockListWorkspace,
          listOpenVikingMemoryEvents: mockListOpenViking,
        },
      );

      // Cache should use workspace data, not OpenViking's empty result
      expect(cache.total).toBe(1);
      expect(cache.events.length).toBe(1);
      expect(mockListWorkspace).toHaveBeenCalled();
      expect(mockListOpenViking).not.toHaveBeenCalled(); // Shouldn't call OpenViking if workspace has data
    });

    it('should filter blacklisted browser pages and deduplicate source-ledger browser URLs', async () => {
      const docsOld = createLedgerBrowserMemoryEvent({
        id: 'ledger:browser:docs-old',
        timestamp: '2026-05-12T08:00:00.000Z',
        title: 'Docs Page Old',
        url: 'https://docs.example.com/guide',
      });
      const docsNew = createLedgerBrowserMemoryEvent({
        id: 'ledger:browser:docs-new',
        timestamp: '2026-05-12T09:00:00.000Z',
        title: 'Docs Page New',
        url: 'https://docs.example.com/guide',
      });
      const localhost = createLedgerBrowserMemoryEvent({
        id: 'ledger:browser:localhost',
        timestamp: '2026-05-12T10:00:00.000Z',
        url: 'http://localhost:3007/',
      });
      const loopback = createLedgerBrowserMemoryEvent({
        id: 'ledger:browser:loopback',
        timestamp: '2026-05-12T10:01:00.000Z',
        url: 'http://127.0.0.1:5600/#/settings',
      });
      const anyAddress = createLedgerBrowserMemoryEvent({
        id: 'ledger:browser:any-address',
        timestamp: '2026-05-12T10:02:00.000Z',
        url: 'http://0.0.0.0:3007/',
      });
      const chromeSettings = createLedgerBrowserMemoryEvent({
        id: 'ledger:browser:chrome-settings',
        timestamp: '2026-05-12T10:03:00.000Z',
        url: 'chrome://settings/',
      });

      const cache = await initializeCacheFromOpenViking(
        tempWorkspace,
        'http://localhost:8080',
        {
          listWorkspaceMemoryEvents: async () => [
            docsOld,
            docsNew,
            localhost,
            loopback,
            anyAddress,
            chromeSettings,
          ],
          listOpenVikingMemoryEvents: vi.fn(async () => []),
        },
      );

      expect(cache.events.map((event) => event.id)).toEqual([
        'ledger:browser:docs-new',
      ]);
      expect(cache.total).toBe(1);
      expect(cache.events[0].content).toMatchObject({
        title: 'Docs Page New',
        latestAccessedAt: '2026-05-12T09:00:00.000Z',
      });
      expect((cache.events[0].content as { accessTimes?: string[] }).accessTimes).toEqual([
        '2026-05-12T09:00:00.000Z',
        '2026-05-12T08:00:00.000Z',
      ]);
    });
  });

  describe('updateCacheWithNewEvents', () => {
    it('should merge new events with existing cache', async () => {
      const existingCache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T08:00:00Z',
        total: 1,
        events: [createTestMemoryEvent('event-1', '2026-04-16T09:00:00Z')],
        lastSyncSummary: {
          browser: {
            lastSyncedAt: '2026-04-16T08:00:00Z',
            importedCount: 1,
          },
        },
      };

      await saveMemoryEventsCache(tempWorkspace, existingCache);

      const newEvents = [createTestMemoryEvent('event-2', '2026-04-16T10:00:00Z')];

      const result = await updateCacheWithNewEvents(
        tempWorkspace,
        'http://localhost:8080',
        newEvents,
        'browser'
      );

      expect(result.total).toBe(2);
      expect(result.events.length).toBe(2);
      expect(result.events[0].id).toBe('event-2');
      expect(result.events[1].id).toBe('event-1');
    });

    it('should deduplicate events by id', async () => {
      const existingCache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T08:00:00Z',
        total: 1,
        events: [createTestMemoryEvent('event-1', '2026-04-16T09:00:00Z')],
        lastSyncSummary: {},
      };

      await saveMemoryEventsCache(tempWorkspace, existingCache);

      const newEvents = [createTestMemoryEvent('event-1', '2026-04-16T10:00:00Z')];

      const result = await updateCacheWithNewEvents(
        tempWorkspace,
        'http://localhost:8080',
        newEvents,
        'browser'
      );

      expect(result.total).toBe(1);
      expect(result.events.length).toBe(1);
    });

    it('should merge browser events with same URL', async () => {
      const existingCache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-04-16T08:00:00Z',
        total: 1,
        events: [
          createTestMemoryEvent('event-1', '2026-04-16T09:00:00Z', 'https://example.com/page1'),
        ],
        lastSyncSummary: {},
      };

      await saveMemoryEventsCache(tempWorkspace, existingCache);

      const newEvents = [
        createTestMemoryEvent('event-2', '2026-04-16T10:00:00Z', 'https://example.com/page1'),
      ];

      const result = await updateCacheWithNewEvents(
        tempWorkspace,
        'http://localhost:8080',
        newEvents,
        'browser'
      );

      expect(result.total).toBe(1);
      expect((result.events[0].content as { accessTimes: string[] }).accessTimes.length).toBe(2);
    });

    it('should filter blacklisted source-ledger browser events before merging new events', async () => {
      const existingCache: MemoryEventsCache = {
        version: 1,
        updatedAt: '2026-05-12T08:00:00Z',
        total: 0,
        events: [],
        lastSyncSummary: {},
      };

      await saveMemoryEventsCache(tempWorkspace, existingCache);

      const result = await updateCacheWithNewEvents(
        tempWorkspace,
        'http://localhost:8080',
        [
          createLedgerBrowserMemoryEvent({
            id: 'ledger:browser:useful-old',
            timestamp: '2026-05-12T08:00:00.000Z',
            title: 'Useful Docs Old',
            url: 'https://docs.example.com/reference',
          }),
          createLedgerBrowserMemoryEvent({
            id: 'ledger:browser:useful-new',
            timestamp: '2026-05-12T09:00:00.000Z',
            title: 'Useful Docs New',
            url: 'https://docs.example.com/reference',
          }),
          createLedgerBrowserMemoryEvent({
            id: 'ledger:browser:chrome',
            timestamp: '2026-05-12T10:00:00.000Z',
            url: 'chrome://extensions/',
          }),
        ],
        'browser'
      );

      expect(result.events.map((event) => event.id)).toEqual([
        'ledger:browser:useful-new',
      ]);
      expect(result.total).toBe(1);
    });
  });
});
