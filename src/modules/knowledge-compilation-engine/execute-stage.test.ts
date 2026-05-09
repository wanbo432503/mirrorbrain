import { describe, it, expect } from 'vitest';
import {
  runExecuteStage,
  generateKnowledgeTitle,
  generateKnowledgeSummary,
  generateKnowledgeBody,
  formatWikiLink,
} from './execute-stage.js';
import type { ReviewedMemory } from '../../shared/types/index.js';
import type { DiscoveryResult } from './discovery-stage.js';

function createReviewedMemory(input: {
  id: string;
  candidateTitle: string;
  candidateSummary: string;
  reviewedAt: string;
}): ReviewedMemory {
  return {
    id: input.id,
    candidateMemoryId: `candidate-${input.id}`,
    candidateTitle: input.candidateTitle,
    candidateSummary: input.candidateSummary,
    candidateTheme: 'work-activity',
    memoryEventIds: [],
    reviewDate: '2026-01-01T10:00:00Z',
    decision: 'keep',
    reviewedAt: input.reviewedAt,
  };
}

function createDiscoveryResult(input: {
  primaryTopic?: string;
  supportingThemes?: string[];
  tags?: string[];
  discoveryInsights?: string[];
  patterns?: string[];
}): DiscoveryResult {
  return {
    primaryTopic: input.primaryTopic,
    supportingThemes: input.supportingThemes ?? [],
    tags: input.tags ?? [],
    discoveryInsights: input.discoveryInsights ?? [],
    patterns: input.patterns ?? [],
  };
}

describe('execute-stage', () => {
  describe('formatWikiLink', () => {
    it('formats wiki-link syntax for topic key', () => {
      const wikiLink = formatWikiLink('react-hooks');

      expect(wikiLink).toBe('[[react-hooks]]');
    });

    it('handles empty topic key', () => {
      const wikiLink = formatWikiLink('');

      expect(wikiLink).toBe('');
    });
  });

  describe('generateKnowledgeTitle', () => {
    it('generates title from primary topic and supporting themes', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'authentication',
        supportingThemes: ['jwt', 'security'],
      });

      const title = generateKnowledgeTitle(discovery);

      expect(title.includes('authentication')).toBe(true);
    });

    it('handles discovery without primary topic', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: undefined,
      });

      const title = generateKnowledgeTitle(discovery);

      expect(title.length).toBeGreaterThan(0);
    });
  });

  describe('generateKnowledgeSummary', () => {
    it('generates summary from discovery insights', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'testing',
        supportingThemes: ['unit', 'integration'],
        discoveryInsights: ['Primary focus: testing', 'Supporting themes: unit, integration'],
      });

      const summary = generateKnowledgeSummary(discovery);

      expect(summary.includes('testing')).toBe(true);
      expect(summary.includes('unit')).toBe(true);
    });

    it('handles discovery without insights', () => {
      const discovery = createDiscoveryResult({
        discoveryInsights: [],
      });

      const summary = generateKnowledgeSummary(discovery);

      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('generateKnowledgeBody', () => {
    it('generates knowledge body with wiki-links', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'react',
        supportingThemes: ['hooks', 'state'],
      });

      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'React hooks implementation',
          candidateSummary: 'Implemented state management using React hooks',
          reviewedAt: '2026-01-01T10:00:00Z',
        }),
      ];

      const body = generateKnowledgeBody(discovery, memories);

      expect(body.includes('[[react]]')).toBe(true);
      expect(body.includes('[[hooks]]')).toBe(true);
    });

    it('includes structured sections', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'authentication',
      });

      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'Auth setup',
          candidateSummary: 'JWT authentication',
          reviewedAt: '2026-01-01T10:00:00Z',
        }),
      ];

      const body = generateKnowledgeBody(discovery, memories);

      expect(body.includes('##')).toBe(true); // Markdown headers
    });

    it('handles empty memories', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'testing',
      });

      const body = generateKnowledgeBody(discovery, []);

      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe('runExecuteStage', () => {
    it('generates knowledge artifact from discovery and memories', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'api',
        supportingThemes: ['rest', 'authentication'],
        tags: ['api', 'rest', 'authentication', 'endpoints'],
      });

      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'API development',
          candidateSummary: 'Built RESTful API endpoints',
          reviewedAt: '2026-01-01T10:00:00Z',
        }),
        createReviewedMemory({
          id: 'r2',
          candidateTitle: 'API authentication',
          candidateSummary: 'Added authentication to API',
          reviewedAt: '2026-01-01T11:00:00Z',
        }),
      ];

      const result = runExecuteStage(discovery, memories);

      expect(result.title).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.sourceReviewedMemoryIds).toContain('r1');
      expect(result.sourceReviewedMemoryIds).toContain('r2');
    });

    it('includes compilation metadata', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'testing',
        discoveryInsights: ['Primary focus: testing'],
      });

      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'Testing setup',
          candidateSummary: 'Unit tests',
          reviewedAt: '2026-01-01T10:00:00Z',
        }),
      ];

      const result = runExecuteStage(discovery, memories);

      expect(result.compilationMetadata).toBeDefined();
      expect(result.compilationMetadata?.generationMethod).toBe('two-stage-compilation');
      expect(result.compilationMetadata?.discoveryInsights.length).toBeGreaterThan(0);
    });

    it('calculates time range from memories', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'database',
      });

      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'Database setup',
          candidateSummary: 'PostgreSQL',
          reviewedAt: '2026-01-01T09:00:00Z',
        }),
        createReviewedMemory({
          id: 'r2',
          candidateTitle: 'Database optimization',
          candidateSummary: 'Query optimization',
          reviewedAt: '2026-01-01T15:00:00Z',
        }),
      ];

      const result = runExecuteStage(discovery, memories);

      expect(result.timeRange).toBeDefined();
      expect(result.timeRange.startAt).toBe('2026-01-01T09:00:00Z');
      expect(result.timeRange.endAt).toBe('2026-01-01T15:00:00Z');
    });

    it('handles empty memories', () => {
      const discovery = createDiscoveryResult({
        primaryTopic: 'general',
      });

      const result = runExecuteStage(discovery, []);

      expect(result.title).toBeDefined();
      expect(result.sourceReviewedMemoryIds.length).toBe(0);
    });

    it('generates unique tags', () => {
      const discovery = createDiscoveryResult({
        tags: ['react', 'hooks', 'react', 'hooks', 'state'],
      });

      const memories = [];

      const result = runExecuteStage(discovery, memories);

      expect(result.tags.filter((t) => t === 'react').length).toBe(1);
      expect(result.tags.filter((t) => t === 'hooks').length).toBe(1);
    });
  });
});