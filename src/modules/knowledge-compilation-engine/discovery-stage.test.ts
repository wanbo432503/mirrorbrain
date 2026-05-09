import { describe, it, expect } from 'vitest';
import {
  runDiscoveryStage,
  identifyPrimaryTopic,
  identifySupportingThemes,
  extractPatternsFromMemories,
} from './discovery-stage.js';
import type { ReviewedMemory } from '../../shared/types/index.js';

function createReviewedMemory(input: {
  id: string;
  candidateTitle: string;
  candidateSummary: string;
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
    reviewedAt: '2026-01-01T11:00:00Z',
  };
}

describe('discovery-stage', () => {
  describe('identifyPrimaryTopic', () => {
    it('identifies most frequent tag as primary topic', () => {
      const tags = ['react', 'hooks', 'state', 'hooks', 'hooks', 'state'];

      const primaryTopic = identifyPrimaryTopic(tags);

      // 'hooks' appears 3 times → primary topic
      expect(primaryTopic).toBe('hooks');
    });

    it('handles empty tags', () => {
      const primaryTopic = identifyPrimaryTopic([]);

      expect(primaryTopic).toBeUndefined();
    });

    it('handles single tag', () => {
      const primaryTopic = identifyPrimaryTopic(['authentication']);

      expect(primaryTopic).toBe('authentication');
    });
  });

  describe('identifySupportingThemes', () => {
    it('identifies secondary themes from tags', () => {
      const tags = ['react', 'hooks', 'state', 'hooks', 'hooks', 'state', 'authentication'];

      const supportingThemes = identifySupportingThemes(tags, 'hooks');

      // 'hooks' is primary, secondary themes: 'state' (2), 'react' (1), 'authentication' (1)
      expect(supportingThemes).toContain('state');
      expect(supportingThemes).toContain('react');
      expect(supportingThemes).toContain('authentication');
      expect(supportingThemes).not.toContain('hooks');
    });

    it('limits number of supporting themes', () => {
      const tags = ['react', 'hooks', 'state', 'api', 'testing', 'database', 'authentication', 'deployment'];

      const supportingThemes = identifySupportingThemes(tags, 'hooks', { maxThemes: 3 });

      expect(supportingThemes.length).toBeLessThanOrEqual(3);
    });

    it('handles empty tags', () => {
      const supportingThemes = identifySupportingThemes([], 'hooks');

      expect(supportingThemes.length).toBe(0);
    });
  });

  describe('extractPatternsFromMemories', () => {
    it('extracts reusable patterns from reviewed memories', () => {
      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'Implemented authentication with JWT',
          candidateSummary: 'Set up JWT-based authentication system with token refresh',
        }),
        createReviewedMemory({
          id: 'r2',
          candidateTitle: 'Added authentication to API endpoints',
          candidateSummary: 'Protected API routes with authentication middleware',
        }),
      ];

      const patterns = extractPatternsFromMemories(memories);

      // Pattern: authentication appears multiple times
      expect(patterns.some((p) => p.includes('authentication'))).toBe(true);
    });

    it('handles empty memories list', () => {
      const patterns = extractPatternsFromMemories([]);

      expect(patterns.length).toBe(0);
    });

    it('detects workflow patterns', () => {
      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'Testing React components',
          candidateSummary: 'Unit testing for React components using Jest and test patterns',
        }),
        createReviewedMemory({
          id: 'r2',
          candidateTitle: 'Integration testing workflow',
          candidateSummary: 'End-to-end testing workflow for React application',
        }),
      ];

      const patterns = extractPatternsFromMemories(memories);

      // Pattern: testing workflow detected
      expect(patterns.some((p) => p.includes('testing'))).toBe(true);
    });
  });

  describe('runDiscoveryStage', () => {
    it('analyzes reviewed memories and generates discovery insights', () => {
      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'React hooks implementation',
          candidateSummary: 'Implemented state management using React hooks in functional components',
        }),
        createReviewedMemory({
          id: 'r2',
          candidateTitle: 'Testing React components',
          candidateSummary: 'Added unit tests for React components with hooks',
        }),
      ];

      const result = runDiscoveryStage(memories);

      expect(result.primaryTopic).toBeDefined();
      expect(result.supportingThemes).toBeDefined();
      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.discoveryInsights.length).toBeGreaterThan(0);
      expect(result.patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('extracts tags from all memories', () => {
      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'Authentication setup',
          candidateSummary: 'JWT authentication implementation',
        }),
        createReviewedMemory({
          id: 'r2',
          candidateTitle: 'Database integration',
          candidateSummary: 'PostgreSQL database connection setup',
        }),
      ];

      const result = runDiscoveryStage(memories);

      // Should extract tags from both titles and summaries
      expect(result.tags.some((t) => t.includes('authentication'))).toBe(true);
      expect(result.tags.some((t) => t.includes('database'))).toBe(true);
    });

    it('handles empty memories list', () => {
      const result = runDiscoveryStage([]);

      expect(result.tags.length).toBe(0);
      expect(result.primaryTopic).toBeUndefined();
      expect(result.supportingThemes.length).toBe(0);
    });

    it('generates structured discovery output', () => {
      const memories = [
        createReviewedMemory({
          id: 'r1',
          candidateTitle: 'API development',
          candidateSummary: 'Built RESTful API endpoints with authentication',
        }),
      ];

      const result = runDiscoveryStage(memories);

      expect(result).toHaveProperty('primaryTopic');
      expect(result).toHaveProperty('supportingThemes');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('discoveryInsights');
      expect(result).toHaveProperty('patterns');
    });
  });
});