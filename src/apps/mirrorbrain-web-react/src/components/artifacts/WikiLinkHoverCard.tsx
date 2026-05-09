import React from 'react';

interface WikiLinkHoverCardProps {
  knowledgeId: string;
  title?: string;
  summary?: string;
  tags?: string[];
  relationStrength?: number;
  position: { x: number; y: number };
}

/**
 * WikiLinkHoverCard
 *
 * Displays preview information when hovering over wiki-links
 * Shows title, summary, tags, and optionally relation strength
 */
export function WikiLinkHoverCard({
  knowledgeId,
  title,
  summary,
  tags,
  relationStrength,
  position,
}: WikiLinkHoverCardProps): React.ReactElement {
  const truncatedSummary = summary
    ? summary.length > 150
      ? `${summary.substring(0, 150)}...`
      : summary
    : 'No summary available';

  return (
    <div
      className="wiki-link-hover-card"
      style={{
        position: 'fixed',
        left: `${position.x + 10}px`,
        top: `${position.y + 10}px`,
        maxWidth: '300px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
      }}
    >
      <div className="hover-card-header" style={{ marginBottom: '8px' }}>
        <h3
          className="hover-card-title"
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '4px',
          }}
        >
          {title || knowledgeId}
        </h3>

        {relationStrength !== undefined && (
          <div
            className="relation-strength-badge"
            style={{
              fontSize: '12px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
              marginTop: '4px',
            }}
          >
            Similarity: {relationStrength.toFixed(2)}
          </div>
        )}
      </div>

      <div
        className="hover-card-summary"
        style={{
          fontSize: '13px',
          color: '#4b5563',
          lineHeight: '1.5',
          marginBottom: '8px',
        }}
      >
        {truncatedSummary}
      </div>

      {tags && tags.length > 0 && (
        <div className="hover-card-tags" style={{ marginTop: '8px' }}>
          {tags.slice(0, 5).map((tag, index) => (
            <span
              key={index}
              className="hover-card-tag"
              style={{
                fontSize: '11px',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                padding: '2px 8px',
                borderRadius: '4px',
                marginRight: '4px',
                display: 'inline-block',
                marginBottom: '4px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}