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
  });
});
