import { describe, it, expect } from 'vitest';
import { extractTags, isBlacklistedTag, isGenericTag } from './tag-extraction.js';

describe('tag-extraction', () => {
  describe('isBlacklistedTag', () => {
    it('blacklists generic meta-level terms', () => {
      const blacklistedTags = [
        'system',
        'approach',
        'method',
        'process',
        'concept',
        'idea',
        'thing',
        'item',
        'aspect',
        'factor',
        'element',
        'part',
        // 'component', 'feature', 'function' - NOT blacklisted, specific in programming
        'activity',
        'action',
        'task',
        'work',
        'issue',
      ];

      for (const tag of blacklistedTags) {
        expect(isBlacklistedTag(tag)).toBe(true);
      }
    });

    it('accepts specific technical nouns', () => {
      const validTags = [
        'react',
        'authentication',
        'database',
        'api',
        'typescript',
        'docker',
        'kubernetes',
        'git',
        'testing',
        'deployment',
      ];

      for (const tag of validTags) {
        expect(isBlacklistedTag(tag)).toBe(false);
      }
    });

    it('blacklists vague nouns', () => {
      expect(isBlacklistedTag('stuff')).toBe(true);
      expect(isBlacklistedTag('object')).toBe(true);
      expect(isBlacklistedTag('data')).toBe(true);
      expect(isBlacklistedTag('value')).toBe(true);
      expect(isBlacklistedTag('result')).toBe(true);
    });
  });

  describe('isGenericTag', () => {
    it('detects generic programming terms', () => {
      expect(isGenericTag('code')).toBe(true);
      expect(isGenericTag('programming')).toBe(true);
      expect(isGenericTag('development')).toBe(true);
      expect(isGenericTag('software')).toBe(true);
      expect(isGenericTag('technology')).toBe(true);
    });

    it('accepts specific domain nouns', () => {
      expect(isGenericTag('react')).toBe(false);
      expect(isGenericTag('postgresql')).toBe(false);
      expect(isGenericTag('graphql')).toBe(false);
      expect(isGenericTag('redux')).toBe(false);
    });
  });

  describe('extractTags', () => {
    it('extracts specific nouns from text', () => {
      const text = 'Learned about React hooks and state management in functional components';

      const tags = extractTags(text);

      expect(tags).toContain('react');
      expect(tags).toContain('hooks');
      expect(tags).toContain('state');
      expect(tags).toContain('components');
    });

    it('filters out generic tags', () => {
      const text = 'The system approach uses a method for processing data and managing tasks';

      const tags = extractTags(text);

      // All these are blacklisted generic terms
      expect(tags).not.toContain('system');
      expect(tags).not.toContain('approach');
      expect(tags).not.toContain('method');
      expect(tags).not.toContain('data');
      expect(tags).not.toContain('tasks');
    });

    it('extracts technical nouns from code-related text', () => {
      const text = 'Implemented authentication using JWT tokens with PostgreSQL database';

      const tags = extractTags(text);

      expect(tags).toContain('authentication');
      expect(tags).toContain('jwt');
      expect(tags).toContain('tokens');
      expect(tags).toContain('postgresql');
      expect(tags).toContain('database');
    });

    it('normalizes tags to lowercase', () => {
      const text = 'React and TypeScript integration with Docker';

      const tags = extractTags(text);

      expect(tags).toContain('react');
      expect(tags).toContain('typescript');
      expect(tags).toContain('docker');
      expect(tags.every((tag) => tag === tag.toLowerCase())).toBe(true);
    });

    it('removes duplicate tags', () => {
      const text = 'React React React hooks hooks';

      const tags = extractTags(text);

      expect(tags.filter((tag) => tag === 'react').length).toBe(1);
      expect(tags.filter((tag) => tag === 'hooks').length).toBe(1);
    });

    it('handles empty text', () => {
      const tags = extractTags('');

      expect(tags.length).toBe(0);
    });

    it('handles text with no valid tags', () => {
      const text = 'The approach was to use a method for this activity';

      const tags = extractTags(text);

      expect(tags.length).toBe(0);
    });

    it('extracts multi-word technical terms as single tags', () => {
      const text = 'API design pattern and testing strategy';

      const tags = extractTags(text);

      // Should extract 'api', 'design', 'pattern', 'testing', 'strategy'
      expect(tags).toContain('api');
      expect(tags).toContain('testing');
    });

    it('filters out common English words', () => {
      const text = 'This is a simple example about the concept';

      const tags = extractTags(text);

      // 'this', 'is', 'a', 'the' are common words, should be filtered
      expect(tags).not.toContain('this');
      expect(tags).not.toContain('is');
      expect(tags).not.toContain('a');
      expect(tags).not.toContain('the');
    });

    it('preserves hyphenated technical terms', () => {
      const text = 'CI/CD pipeline and git-workflow';

      const tags = extractTags(text);

      expect(tags).toContain('ci/cd');
      expect(tags).toContain('pipeline');
      expect(tags.some((tag) => tag.includes('git'))).toBe(true);
    });
  });
});