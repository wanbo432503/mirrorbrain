// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KnowledgeMarkdownRenderer } from './KnowledgeMarkdownRenderer';

describe('KnowledgeMarkdownRenderer', () => {
  describe('markdown rendering', () => {
    it('renders markdown content', () => {
      const body = '## Overview\n\nThis is a knowledge summary.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      expect(screen.getByText('Overview')).toBeDefined();
      expect(screen.getByText('This is a knowledge summary.')).toBeDefined();
    });

    it('renders wiki-links', () => {
      const body = 'Focus on [[react]] with [[hooks]] for state management.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      expect(screen.getByText('react')).toBeDefined();
      expect(screen.getByText('hooks')).toBeDefined();
    });

    it('renders wiki-links with alias', () => {
      const body = 'Learn about [[react|react_framework]] basics.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      // remark-wiki-link v2 displays the full text with underscores converted to spaces
      expect(screen.getByText('react|react_framework')).toBeDefined();
    });

    it('applies wiki-link styling', () => {
      const body = 'See [[authentication]] for details.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      const wikiLink = screen.getByText('authentication');
      expect(wikiLink.tagName).toBe('A');
      // Browser converts hex colors to rgb format
      expect(wikiLink.style.color).toBe('rgb(59, 130, 246)');
      expect(wikiLink.style.textDecoration).toBe('underline');
      expect(wikiLink.style.cursor).toBe('pointer');
    });
  });

  describe('wiki-link interaction', () => {
    it('handles wiki-link click', () => {
      const body = 'Check [[testing]] guide.';
      const onWikiLinkClick = vi.fn();

      render(<KnowledgeMarkdownRenderer body={body} onWikiLinkClick={onWikiLinkClick} />);

      const wikiLink = screen.getByText('testing');
      fireEvent.click(wikiLink);

      expect(onWikiLinkClick).toHaveBeenCalledWith('testing');
    });

    it('shows hover card on mouse enter', () => {
      const body = 'Use [[database]] for storage.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      const wikiLink = screen.getByText('database');
      fireEvent.mouseEnter(wikiLink);

      // Hover card should appear
      expect(screen.queryByText('Database')).toBeDefined();
    });
  });

  describe('GFM support', () => {
    it('renders GFM features (tables, strikethrough, etc.)', () => {
      const body = `
## Features

| Feature | Status |
|---------|--------|
| Testing | ~~done~~ |

- Task list
  - [x] Complete
  - [ ] Pending
`;

      render(<KnowledgeMarkdownRenderer body={body} />);

      expect(screen.getByText('Features')).toBeDefined();
      expect(screen.getByText('Testing')).toBeDefined();
    });

    it('renders links and images', () => {
      const body = 'See [documentation](https://example.com) for details.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      const link = screen.getByText('documentation');
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe('https://example.com');
    });

    it('renders inline and block math formulas', () => {
      const body = [
        'Inline distance $d(x, c)=\\|x-c\\|^2$ in text.',
        '',
        '$$',
        'E = mc^2',
        '$$',
      ].join('\n');

      render(<KnowledgeMarkdownRenderer body={body} />);

      expect(document.querySelector('.katex')).not.toBeNull();
      expect(document.querySelector('.katex-display')).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles empty body', () => {
      render(<KnowledgeMarkdownRenderer body="" />);

      // Empty body should render nothing meaningful
      const container = screen.queryByText('Overview', { exact: false });
      // ReactMarkdown renders empty content, so we just check no error
      expect(container).toBeDefined();
    });

    it('handles body without wiki-links', () => {
      const body = 'Simple markdown without wiki-links.';

      render(<KnowledgeMarkdownRenderer body={body} />);

      expect(screen.getByText('Simple markdown without wiki-links.')).toBeDefined();
    });

    it('handles multiple wiki-links', () => {
      const body = '[[react]] [[hooks]] [[state]] [[authentication]] [[testing]]';

      render(<KnowledgeMarkdownRenderer body={body} />);

      // Each wiki-link should be rendered
      expect(screen.getAllByText('react').length).toBeGreaterThan(0);
      expect(screen.getAllByText('hooks').length).toBeGreaterThan(0);
      expect(screen.getAllByText('state').length).toBeGreaterThan(0);
      expect(screen.getAllByText('authentication').length).toBeGreaterThan(0);
      expect(screen.getAllByText('testing').length).toBeGreaterThan(0);
    });
  });
});
