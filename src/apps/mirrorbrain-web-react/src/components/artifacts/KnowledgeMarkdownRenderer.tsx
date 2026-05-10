import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkWikiLink from 'remark-wiki-link';
import { WikiLinkHoverCard } from './WikiLinkHoverCard';

interface KnowledgeMarkdownRendererProps {
  body: string;
  knowledgeId?: string;
  onWikiLinkClick?: (targetId: string) => void;
}

/**
 * KnowledgeMarkdownRenderer
 *
 * Renders knowledge body markdown with wiki-link support
 * - Parses [[topic-key]] syntax using remark-wiki-link
 * - Clickable wiki-links for navigation
 * - Hover previews showing related knowledge info
 */
export function KnowledgeMarkdownRenderer({
  body,
  onWikiLinkClick,
}: KnowledgeMarkdownRendererProps): React.ReactElement {
  const [hoverCard, setHoverCard] = useState<{
    targetId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Mock knowledge data for hover preview (would be fetched from API in real app)
  const mockKnowledgeData: Record<
    string,
    { title?: string; summary?: string; tags?: string[] }
  > = {
    react: {
      title: 'React Development',
      summary:
        'Knowledge about React component development, hooks, and state management patterns.',
      tags: ['react', 'hooks', 'components', 'state'],
    },
    hooks: {
      title: 'React Hooks',
      summary:
        'Functional component state management using useState, useEffect, and custom hooks.',
      tags: ['hooks', 'react', 'state', 'effect'],
    },
    authentication: {
      title: 'Authentication',
      summary: 'JWT-based authentication system with token refresh and middleware.',
      tags: ['authentication', 'jwt', 'security', 'tokens'],
    },
    testing: {
      title: 'Testing',
      summary: 'Unit testing, integration testing, and end-to-end testing patterns.',
      tags: ['testing', 'unit', 'integration', 'e2e'],
    },
    database: {
      title: 'Database',
      summary: 'PostgreSQL database integration, connection management, and query optimization.',
      tags: ['database', 'postgresql', 'queries', 'optimization'],
    },
  };

  // Custom wiki-link component
  const WikiLinkComponent = ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }): React.ReactElement => {
    const targetId = href || '';

    const handleClick = (event: React.MouseEvent): void => {
      event.preventDefault();

      if (onWikiLinkClick) {
        onWikiLinkClick(targetId);
      }
    };

    const handleMouseEnter = (event: React.MouseEvent): void => {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setHoverCard({
        targetId,
        position: { x: rect.left, y: rect.bottom },
      });
    };

    const handleMouseLeave = (): void => {
      setHoverCard(null);
    };

    return (
      <a
        href={href}
        className="wiki-link"
        style={{
          color: '#3b82f6',
          textDecoration: 'underline',
          cursor: 'pointer',
          backgroundColor: hoverCard?.targetId === targetId ? '#eff6ff' : 'transparent',
          padding: '2px 4px',
          borderRadius: '2px',
        }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </a>
    );
  };

  return (
    <div className="knowledge-markdown-renderer">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [
            remarkWikiLink,
            {
              hrefTemplate: (permalink: string) => permalink,
            },
          ],
        ]}
        components={{
          a: WikiLinkComponent,
        }}
      >
        {body}
      </ReactMarkdown>

      {hoverCard && (
        <WikiLinkHoverCard
          knowledgeId={hoverCard.targetId}
          title={mockKnowledgeData[hoverCard.targetId]?.title}
          summary={mockKnowledgeData[hoverCard.targetId]?.summary}
          tags={mockKnowledgeData[hoverCard.targetId]?.tags}
          position={hoverCard.position}
        />
      )}
    </div>
  );
}
