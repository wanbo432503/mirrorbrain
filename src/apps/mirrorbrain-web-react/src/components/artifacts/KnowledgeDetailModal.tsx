import type { KnowledgeArtifact } from '../../types/index'
import { KnowledgeMarkdownRenderer } from './KnowledgeMarkdownRenderer'

interface KnowledgeDetailModalProps {
  knowledge: KnowledgeArtifact | null
  onClose: () => void
  onWikiLinkClick?: (targetId: string) => void
}

export default function KnowledgeDetailModal({
  knowledge,
  onClose,
  onWikiLinkClick,
}: KnowledgeDetailModalProps) {
  if (knowledge === null) {
    return null
  }

  const title = knowledge.title ?? 'Untitled Knowledge'
  const sourceCount = knowledge.sourceReviewedMemoryIds.length
  const relatedCount = knowledge.relatedKnowledgeIds?.length ?? 0
  const tags = knowledge.tags ?? []
  const hasCompilationMetadata = knowledge.compilationMetadata !== undefined

  return (
    <div role="dialog" aria-modal="true" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>

      <section>
        {knowledge.summary && <p>{knowledge.summary}</p>}
        {knowledge.body && (
          <KnowledgeMarkdownRenderer
            body={knowledge.body}
            knowledgeId={knowledge.id}
            onWikiLinkClick={onWikiLinkClick}
          />
        )}
      </section>

      {tags.length > 0 && (
        <section>
          <h3>Tags</h3>
          <div>
            {tags.map((tag, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-block',
                  marginRight: '8px',
                  marginBottom: '4px',
                  padding: '4px 12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#6b7280',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {relatedCount > 0 && (
        <section>
          <h3>Related Knowledge ({relatedCount})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {knowledge.relatedKnowledgeIds?.slice(0, 5).map((relatedId, index) => (
              <li
                key={index}
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onWikiLinkClick) {
                      onWikiLinkClick(relatedId)
                    }
                  }}
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  {relatedId}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl>
        <dt>Version</dt>
        <dd>{knowledge.version ?? 1}</dd>
        <dt>Sources</dt>
        <dd>
          {sourceCount} reviewed {sourceCount === 1 ? 'memory' : 'memories'}
        </dd>
        {hasCompilationMetadata && (
          <>
            <dt>Compilation</dt>
            <dd>Two-stage compilation</dd>
          </>
        )}
      </dl>

      <div>
        <span>{knowledge.draftState === 'published' ? 'Published' : 'Draft'}</span>
        {knowledge.isCurrentBest === true && <span>Current Best</span>}
      </div>
    </div>
  )
}
