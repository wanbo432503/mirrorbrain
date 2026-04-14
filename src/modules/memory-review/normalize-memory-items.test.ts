import { describe, expect, it } from 'vitest';

import { normalizeRawEvents } from './normalize-memory-items.js';
import type { MemoryEvent } from '../../shared/types/index.js';

function createBrowserMemoryEvent(input: {
  id: string;
  timestamp: string;
  url: string;
  title?: string;
  pageTitle?: string;
  pageText?: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: 'activitywatch-browser',
    sourceRef: `aw-event-${input.id}`,
    timestamp: input.timestamp,
    authorizationScopeId: 'scope-browser',
    content: {
      url: input.url,
      title: input.title ?? 'Untitled Page',
      pageTitle: input.pageTitle,
      pageText: input.pageText,
    },
    captureMetadata: {
      upstreamSource: 'activitywatch',
      checkpoint: input.timestamp,
    },
  };
}

describe('normalize memory items', () => {
  it('groups events by URL and preserves all timestamps', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/tasks',
        title: 'Tasks Dashboard',
      }),
      createBrowserMemoryEvent({
        id: 'event-2',
        timestamp: '2026-04-14T09:15:00Z',
        url: 'https://example.com/tasks',
        title: 'Tasks Dashboard',
      }),
      createBrowserMemoryEvent({
        id: 'event-3',
        timestamp: '2026-04-14T09:30:00Z',
        url: 'https://example.com/tasks',
        title: 'Tasks Dashboard Updated',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].url).toBe('https://example.com/tasks');
    expect(normalized[0].title).toBe('Tasks Dashboard Updated'); // Most recent
    expect(normalized[0].firstVisitTime).toBe('2026-04-14T09:00:00Z');
    expect(normalized[0].lastVisitTime).toBe('2026-04-14T09:30:00Z');
    expect(normalized[0].accessTimes).toEqual([
      '2026-04-14T09:00:00Z',
      '2026-04-14T09:15:00Z',
      '2026-04-14T09:30:00Z',
    ]);
    expect(normalized[0].sourceEventIds).toEqual(['event-1', 'event-2', 'event-3']);
  });

  it('creates separate items for different URLs', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://github.com/repo/issues/123',
        title: 'Fix bug #123',
      }),
      createBrowserMemoryEvent({
        id: 'event-2',
        timestamp: '2026-04-14T09:10:00Z',
        url: 'https://docs.example.com/api',
        title: 'API Reference',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].url).toBe('https://github.com/repo/issues/123');
    expect(normalized[1].url).toBe('https://docs.example.com/api');
  });

  it('extracts host from URL correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com:8080/path',
        title: 'Test',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].host).toBe('example.com:8080');
  });

  it('classifies GitHub issue pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://github.com/repo/issues/123',
        title: 'Fix authentication bug',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('issue');
  });

  it('classifies GitHub pull request pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://github.com/repo/pull/456',
        title: 'Add new feature',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('pull-request');
  });

  it('classifies GitHub repository pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://github.com/repo',
        title: 'Repository Overview',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('repository');
  });

  it('classifies search pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://google.com/search?q=authentication',
        title: 'authentication - Google Search',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('search');
  });

  it('classifies documentation pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://docs.example.com/guide/authentication',
        title: 'Authentication Guide',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('docs');
  });

  it('classifies localhost debugging pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'http://localhost:3000/debug',
        title: 'Debug Dashboard',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('debug');
  });

  it('classifies chat/collaboration pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://slack.com/team/messages',
        title: 'Team Chat',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('chat');
  });

  it('classifies reference/API pages correctly', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://api.example.com/reference/auth',
        title: 'Auth API Reference',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('reference');
  });

  it('defaults to web for generic pages', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/page',
        title: 'Generic Page',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].role).toBe('web');
  });

  it('preserves pageTitle and pageText metadata', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://docs.example.com/guide',
        title: 'Guide Title',
        pageTitle: 'Guide Page Title',
        pageText: 'Guide content with authentication steps.',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].pageTitle).toBe('Guide Page Title');
    expect(normalized[0].pageText).toBe('Guide content with authentication steps.');
  });

  it('uses most recent event metadata for grouped URLs', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/page',
        title: 'Old Title',
        pageText: 'Old content',
      }),
      createBrowserMemoryEvent({
        id: 'event-2',
        timestamp: '2026-04-14T09:30:00Z',
        url: 'https://example.com/page',
        title: 'New Title',
        pageText: 'New content',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].title).toBe('New Title');
    expect(normalized[0].pageText).toBe('New content');
    expect(normalized[0].sourceEventIds).toEqual(['event-1', 'event-2']);
  });

  it('skips events without URLs', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/page',
        title: 'Valid Page',
      }),
      {
        id: 'shell-event-1',
        sourceType: 'shell-history',
        sourceRef: 'shell-1',
        timestamp: '2026-04-14T09:10:00Z',
        authorizationScopeId: 'scope-shell',
        content: {
          cwd: '/home/user',
          command: 'git status',
        },
        captureMetadata: {
          upstreamSource: 'shell-history',
          checkpoint: '2026-04-14T09:10:00Z',
        },
      },
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].url).toBe('https://example.com/page');
  });

  it('handles events with missing or invalid URLs gracefully', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/page',
        title: 'Valid Page',
      }),
      {
        id: 'invalid-event',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-invalid',
        timestamp: '2026-04-14T09:10:00Z',
        authorizationScopeId: 'scope-browser',
        content: {},
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-04-14T09:10:00Z',
        },
      },
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized).toHaveLength(1);
  });

  it('creates unique normalized item IDs based on URL', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/page',
        title: 'Test',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].id).toBe('normalized-url:https://example.com/page');
  });

  it('preserves sourceType from original events', () => {
    const events = [
      createBrowserMemoryEvent({
        id: 'event-1',
        timestamp: '2026-04-14T09:00:00Z',
        url: 'https://example.com/page',
        title: 'Test',
      }),
    ];

    const normalized = normalizeRawEvents(events);

    expect(normalized[0].sourceType).toBe('activitywatch-browser');
  });
});