import type { KnowledgeArtifact } from '../../types/index'

interface KnowledgeDetailModalProps {
  knowledge: KnowledgeArtifact | null
  onClose: () => void
}

export default function KnowledgeDetailModal({
  knowledge,
  onClose,
}: KnowledgeDetailModalProps) {
  if (knowledge === null) {
    return null
  }

  const title = knowledge.title ?? 'Untitled Knowledge'
  const sourceCount = knowledge.sourceReviewedMemoryIds.length

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
        {knowledge.body && <div>{knowledge.body}</div>}
      </section>

      <dl>
        <dt>Version</dt>
        <dd>{knowledge.version ?? 1}</dd>
        <dt>Sources</dt>
        <dd>
          {sourceCount} reviewed {sourceCount === 1 ? 'memory' : 'memories'}
        </dd>
      </dl>

      <div>
        <span>{knowledge.draftState === 'published' ? 'Published' : 'Draft'}</span>
        {knowledge.isCurrentBest === true && <span>Current Best</span>}
      </div>
    </div>
  )
}
