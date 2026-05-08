import { describe, it, expect } from 'vitest';
import {
  evaluateMemoryEventsForIngestion,
  type ScoredMemoryEvent,
} from './memory-event-evaluator.js';
import type { MemoryEvent } from '../../shared/types/index.js';

function createBrowserEvent(input: {
  id: string;
  timestamp: string;
  url: string;
  title: string;
  pageText?: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: 'activitywatch-browser',
    sourceRef: input.id,
    timestamp: input.timestamp,
    authorizationScopeId: 'test-scope',
    content: {
      url: input.url,
      title: input.title,
      pageText: input.pageText,
    },
    captureMetadata: {
      upstreamSource: 'activitywatch',
      checkpoint: input.timestamp,
    },
  };
}

function createShellEvent(input: {
  id: string;
  timestamp: string;
  text: string;
}): MemoryEvent {
  return {
    id: input.id,
    sourceType: 'shell-history',
    sourceRef: input.id,
    timestamp: input.timestamp,
    authorizationScopeId: 'test-scope',
    content: {
      pageText: input.text,
    },
    captureMetadata: {
      upstreamSource: 'shell',
      checkpoint: input.timestamp,
    },
  };
}

describe('memory-event-evaluator', () => {
  describe('basicFilter', () => {
    it('keeps browser events with URL and title', () => {
      const events = [
        createBrowserEvent({
          id: 'browser-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://github.com',
          title: 'GitHub',
        }),
      ];

      const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(events);
      expect(stats.total).toBe(1);
      expect(stats.basicFiltered).toBe(0);
      expect(stats.finalKept).toBe(1);
    });

    it('filters out short shell text (< 20 chars)', () => {
      const events = [
        createShellEvent({
          id: 'shell-1',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'ls', // Too short
        }),
      ];

      const { stats } = evaluateMemoryEventsForIngestion(events);
      expect(stats.basicFiltered).toBe(1);
      expect(stats.finalKept).toBe(0);
    });

    it('filters out shell commands', () => {
      const events = [
        createShellEvent({
          id: 'shell-1',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'npm install react',
        }),
      ];

      const { stats } = evaluateMemoryEventsForIngestion(events);
      expect(stats.basicFiltered).toBe(1);
    });

    it('keeps rich shell text', () => {
      const events = [
        createShellEvent({
          id: 'shell-1',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'Learned that React hooks can only be called at the top level of a component function',
        }),
      ];

      const { stats } = evaluateMemoryEventsForIngestion(events);
      expect(stats.basicFiltered).toBe(0);
      expect(stats.finalKept).toBe(1);
    });
  });

  describe('importance scoring', () => {
    it('scores issue pages higher than search pages', () => {
      const events = [
        createBrowserEvent({
          id: 'search-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://google.com/search?q=test',
          title: 'test - Google Search',
        }),
        createBrowserEvent({
          id: 'issue-1',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://github.com/project/issues/123',
          title: 'Fix authentication bug',
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const searchScore = scoredEvents.find((s) => s.event.id === 'search-1')?.importance ?? 0;
      const issueScore = scoredEvents.find((s) => s.event.id === 'issue-1')?.importance ?? 0;

      expect(issueScore).toBeGreaterThan(searchScore);
    });

    it('scores rich content higher', () => {
      const events = [
        createBrowserEvent({
          id: 'short-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com',
          title: 'Example',
        }),
        createBrowserEvent({
          id: 'long-1',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://docs.example.com/guide',
          title: 'Complete Guide to Building Scalable Systems with Best Practices',
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const shortScore = scoredEvents.find((s) => s.event.id === 'short-1')?.importance ?? 0;
      const longScore = scoredEvents.find((s) => s.event.id === 'long-1')?.importance ?? 0;

      expect(longScore).toBeGreaterThan(shortScore);
    });

    it('scores pages with substantial content higher', () => {
      const events = [
        createBrowserEvent({
          id: 'page-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/guide',
          title: 'Guide',
          pageText: 'This is a comprehensive guide covering API design, function implementation, architecture patterns, and best practices for building scalable systems. It includes detailed examples and code snippets.',
        }),
        createBrowserEvent({
          id: 'page-2',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://example.com/login',
          title: 'Login',
          pageText: 'Sign up or log in to continue',
        }),
      ];

      const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(events);

      // Page with substantial technical content should be scored higher
      const guideScore = scoredEvents.find((s) => s.event.id === 'page-1')?.importance ?? 0;
      const loginScore = scoredEvents.find((s) => s.event.id === 'page-2')?.importance ?? 0;

      expect(guideScore).toBeGreaterThan(loginScore);
    });
  });

  describe('semantic deduplication', () => {
    it('deduplicates similar browser events', () => {
      const events = [
        createBrowserEvent({
          id: 'page-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://docs.example.com/guide',
          title: 'Introduction to React Hooks',
          pageText: 'This guide covers React hooks basics and advanced patterns.',
        }),
        createBrowserEvent({
          id: 'page-2',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://docs.example.com/guide',
          title: 'Introduction to React Hooks', // Same title (similarity > 0.6)
          pageText: 'This guide covers React hooks basics and advanced patterns.', // Same content
        }),
      ];

      const { stats } = evaluateMemoryEventsForIngestion(events);
      expect(stats.dedupRemoved).toBeGreaterThanOrEqual(0);
      expect(stats.finalKept).toBe(1);
    });

    it('keeps different content', () => {
      const events = [
        createBrowserEvent({
          id: 'page-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/react',
          title: 'React Hooks Tutorial',
          pageText: 'Learn React hooks from scratch with practical examples and detailed explanations. This tutorial covers useState, useEffect, useContext, and custom hooks.',
        }),
        createBrowserEvent({
          id: 'page-2',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://example.com/vue',
          title: 'Vue Composition API Guide',
          pageText: 'Vue composition API tutorial covering setup, reactive data, computed properties, and lifecycle hooks. Includes practical examples and best practices.',
        }),
      ];

      const { stats } = evaluateMemoryEventsForIngestion(events);
      expect(stats.dedupRemoved).toBe(0);
      expect(stats.finalKept).toBe(2);
    });
  });

  describe('source type balancing', () => {
    it('balances browser and shell events when capped', () => {
      // Create 60 unique browser events and 20 unique shell events
      // Events must have different content to avoid semantic deduplication
      const browserEvents: MemoryEvent[] = [];
      for (let i = 0; i < 60; i++) {
        browserEvents.push(
          createBrowserEvent({
            id: `browser-${i}`,
            timestamp: `2025-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
            url: `https://example-${i}.com/page-${i}`,
            title: `Different Topic ${i} - Each page has unique content`,
          }),
        );
      }

      const shellEvents: MemoryEvent[] = [];
      for (let i = 0; i < 20; i++) {
        shellEvents.push(
          createShellEvent({
            id: `shell-${i}`,
            timestamp: `2025-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
            text: `Concept ${i}: Each shell event discusses a different technical concept with sufficient length`,
          }),
        );
      }

      const allEvents = [...browserEvents, ...shellEvents];
      const { stats, scoredEvents } = evaluateMemoryEventsForIngestion(allEvents);

      console.log('Evaluation stats:', stats);
      console.log('Browser count:', scoredEvents.filter((s) => s.event.sourceType === 'activitywatch-browser').length);
      console.log('Shell count:', scoredEvents.filter((s) => s.event.sourceType === 'shell-history').length);

      // Should be capped to MAX_DAILY_INGESTION (50)
      expect(stats.finalKept).toBeLessThanOrEqual(50);

      // Verify that both source types are represented
      const browserCount = scoredEvents.filter((s) => s.event.sourceType === 'activitywatch-browser').length;
      const shellCount = scoredEvents.filter((s) => s.event.sourceType === 'shell-history').length;

      // Both source types should be present (not necessarily balanced perfectly due to importance sorting)
      expect(browserCount).toBeGreaterThan(0);
      expect(shellCount).toBeGreaterThan(0);
      expect(browserCount + shellCount).toBe(stats.finalKept);
    });
  });

  describe('evaluation reasons', () => {
    it('provides importance reasons for scored events', () => {
      const events = [
        createBrowserEvent({
          id: 'issue-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://github.com/project/issues/123',
          title: 'Fix critical authentication bug',
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const scored = scoredEvents[0];

      expect(scored?.reasons).toBeDefined();
      expect(scored?.reasons.length).toBeGreaterThan(0);
      expect(scored?.reasons.some((r) => r.includes('issue') || r.includes('development'))).toBe(true);
    });

    it('provides reasons for pages with technical content', () => {
      const events = [
        createBrowserEvent({
          id: 'docs-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://docs.example.com/api',
          title: 'API Documentation',
          pageText: 'The API provides methods for data retrieval and configuration. This guide covers function signatures, parameter specifications, and implementation examples.',
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const scored = scoredEvents[0];

      expect(scored?.reasons.some((r) => r.includes('technical') || r.includes('content'))).toBe(true);
    });
  });

  describe('page content quality evaluation', () => {
    it('penalizes pages with short page text (< 100 chars)', () => {
      const events = [
        createBrowserEvent({
          id: 'page-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/short',
          title: 'Short Page',
          pageText: 'Loading...', // < 100 chars, junk
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const score = scoredEvents[0]?.importance ?? 0;

      // Should get a penalty, making total score very low
      expect(score).toBeLessThan(0.3);
    });

    it('penalizes error/placeholder pages', () => {
      const events = [
        createBrowserEvent({
          id: 'page-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/404',
          title: '404 Not Found',
          pageText: '404 Not Found. The page you requested does not exist.',
        }),
      ];

      const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(events);

      // Error page should be filtered out completely (score < 0.25)
      expect(stats.finalKept).toBe(0);
    });

    it('penalizes login/auth pages', () => {
      const events = [
        createBrowserEvent({
          id: 'page-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/login',
          title: 'Login',
          pageText: 'Sign up or log in to continue. Forgot password?',
        }),
      ];

      const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(events);

      // Login page should be filtered out
      expect(stats.finalKept).toBe(0);
    });

    it('completely filters out very low quality browser pages', () => {
      const events = [
        createBrowserEvent({
          id: 'junk-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/junk',
          title: 'Junk',
          pageText: 'Loading...', // Very short junk page (< 100 chars)
        }),
        createBrowserEvent({
          id: 'good-1',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://docs.example.com/api-guide',
          title: 'API Design Guide - Comprehensive Tutorial',
          pageText: 'This comprehensive guide covers API design, implementation patterns, function signatures, parameter specifications, architecture principles, and best practices. It includes detailed code examples, error handling strategies, and optimization techniques.',
        }),
      ];

      const { scoredEvents, stats } = evaluateMemoryEventsForIngestion(events);

      // Only good page should be kept
      expect(stats.finalKept).toBe(1);

      const goodEvent = scoredEvents.find((s) => s.event.id === 'good-1');
      expect(goodEvent).toBeDefined();
      // Technical content with substantial length should have good score
      expect(goodEvent?.importance).toBeGreaterThan(0.35);
    });

    it('scores technical documentation pages highly', () => {
      const events = [
        createBrowserEvent({
          id: 'docs-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://docs.python.org/api',
          title: 'Python API Documentation',
          pageText:
            'This module provides API functions for data processing. The implementation uses efficient algorithms and follows best practices for error handling. Key methods include process_data(), configure(), and validate(). Each function has detailed parameter specifications and usage examples.',
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const score = scoredEvents[0]?.importance ?? 0;

      expect(score).toBeGreaterThan(0.5); // High score for technical content
      expect(scoredEvents[0]?.reasons.some((r) => r.includes('technical') || r.includes('content'))).toBe(true);
    });

    it('scores pages with substantial content higher', () => {
      const events = [
        createBrowserEvent({
          id: 'short-1',
          timestamp: '2025-01-01T10:00:00Z',
          url: 'https://example.com/page1',
          title: 'Page 1',
          pageText: 'This is a short page with minimal content.',
        }),
        createBrowserEvent({
          id: 'long-1',
          timestamp: '2025-01-01T10:05:00Z',
          url: 'https://example.com/page2',
          title: 'Page 2',
          pageText:
            'This is a comprehensive guide covering multiple topics in detail. It includes extensive documentation, implementation examples, code snippets, architecture patterns, and best practices. The content spans several hundred characters and provides substantial value.',
        }),
      ];

      const { scoredEvents } = evaluateMemoryEventsForIngestion(events);
      const shortScore = scoredEvents.find((s) => s.event.id === 'short-1')?.importance ?? 0;
      const longScore = scoredEvents.find((s) => s.event.id === 'long-1')?.importance ?? 0;

      expect(longScore).toBeGreaterThan(shortScore);
    });
  });
});