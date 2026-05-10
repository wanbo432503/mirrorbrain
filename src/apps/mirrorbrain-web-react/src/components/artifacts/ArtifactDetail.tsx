import Button from '../common/Button'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'

export function KnowledgeArtifactDetail({
  artifact,
  notes = [],
  onDelete,
  isDeleting = false,
}: {
  artifact: KnowledgeArtifact
  notes?: string[]
  onDelete?: () => Promise<void> | void
  isDeleting?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
            Knowledge Detail
          </p>
          <h3 className="font-heading text-xl font-bold text-ink mt-1">
            {artifact.title ?? 'Untitled Knowledge'}
          </h3>
        </div>
        {onDelete && (
          <Button variant="secondary" onClick={() => void onDelete()} loading={isDeleting}>
            Delete Knowledge
          </Button>
        )}
      </div>
      <KnowledgeField label="Summary" value={artifact.summary ?? 'No summary'} />
      <KnowledgeField label="Body" value={artifact.body ?? 'No body'} preserveWhitespace />
      <ArtifactMetadata
        items={[
          `Id: ${artifact.id}`,
          artifact.artifactType ? `Type: ${artifact.artifactType}` : null,
          `State: ${artifact.draftState}`,
          artifact.topicKey ? `Topic: ${artifact.topicKey}` : null,
          artifact.version !== undefined ? `Version: ${artifact.version}` : null,
          artifact.isCurrentBest !== undefined
            ? `Current best: ${artifact.isCurrentBest ? 'yes' : 'no'}`
            : null,
          artifact.supersedesKnowledgeId ? `Supersedes: ${artifact.supersedesKnowledgeId}` : null,
          `Sources: ${artifact.sourceReviewedMemoryIds.length}`,
          `Derived: ${artifact.derivedFromKnowledgeIds?.length ?? 0}`,
          artifact.updatedAt ? `Updated: ${artifact.updatedAt}` : null,
          artifact.reviewedAt ? `Reviewed: ${artifact.reviewedAt}` : null,
          artifact.recencyLabel ? `Recency: ${artifact.recencyLabel}` : null,
        ]}
      />
      <KnowledgeRefs
        label="Reviewed Memory Sources"
        refs={artifact.sourceReviewedMemoryIds}
        emptyMessage="No reviewed memory sources attached."
      />
      <KnowledgeRefs
        label="Derived Knowledge"
        refs={artifact.derivedFromKnowledgeIds ?? []}
        emptyMessage="No derived knowledge refs attached."
      />
      <KnowledgeRefs
        label="Provenance"
        refs={(artifact.provenanceRefs ?? []).map((ref) => `${ref.kind}: ${ref.id}`)}
        emptyMessage="No provenance refs attached."
      />
      <ConversationNotes notes={notes} />
    </div>
  )
}

export function SkillArtifactDetail({
  artifact,
  notes = [],
  onDelete,
  isDeleting = false,
}: {
  artifact: SkillArtifact
  notes?: string[]
  onDelete?: () => Promise<void> | void
  isDeleting?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
            Skill Detail
          </p>
          <h3 className="font-heading text-xl font-bold text-ink mt-1">{artifact.id}</h3>
        </div>
        {onDelete && (
          <Button variant="secondary" onClick={() => void onDelete()} loading={isDeleting}>
            Delete Skill
          </Button>
        )}
      </div>
      <ArtifactMetadata
        items={[
          `Approval: ${artifact.approvalState}`,
          `Requires confirmation: ${
            artifact.executionSafetyMetadata.requiresConfirmation ? 'yes' : 'no'
          }`,
          artifact.updatedAt ? `Updated: ${artifact.updatedAt}` : null,
        ]}
      />
      <div>
        <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48 mb-2">
          Workflow Evidence
        </p>
        <div className="space-y-2">
          {artifact.workflowEvidenceRefs.length === 0 ? (
            <p className="font-body text-sm text-inkMuted-48">No evidence refs attached.</p>
          ) : (
            artifact.workflowEvidenceRefs.map((ref) => (
              <p key={ref} className="rounded-md bg-slate-100 px-3 py-2 font-body text-sm text-slate-700">
                {ref}
              </p>
            ))
          )}
        </div>
      </div>
      <ConversationNotes notes={notes} />
    </div>
  )
}

function KnowledgeField({
  label,
  value,
  preserveWhitespace = false,
}: {
  label: string
  value: string
  preserveWhitespace?: boolean
}) {
  return (
    <div>
      <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48 mb-2">
        {label}
      </p>
      <p
        className={`rounded-lg bg-slate-50 p-3 font-body text-sm text-slate-700 ${
          preserveWhitespace ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function KnowledgeRefs({
  label,
  refs,
  emptyMessage,
}: {
  label: string
  refs: string[]
  emptyMessage: string
}) {
  return (
    <div>
      <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48 mb-2">
        {label}
      </p>
      <div className="space-y-2">
        {refs.length === 0 ? (
          <p className="font-body text-sm text-inkMuted-48">{emptyMessage}</p>
        ) : (
          refs.map((ref) => (
            <p
              key={ref}
              className="rounded-md bg-slate-100 px-3 py-2 font-body text-sm text-slate-700"
            >
              {ref}
            </p>
          ))
        )}
      </div>
    </div>
  )
}

function ArtifactMetadata({ items }: { items: Array<string | null> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.filter(Boolean).map((item) => (
        <span
          key={item}
          className="rounded-md bg-slate-100 px-2 py-1 font-heading text-[11px] font-semibold uppercase text-inkMuted-80"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

function ConversationNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
        Conversation Updates
      </p>
      {notes.map((note, index) => (
        <p
          key={`${note}-${index}`}
          className="rounded-lg border border-dividerSoft bg-canvas p-3 font-body text-sm text-ink"
        >
          {note}
        </p>
      ))}
    </div>
  )
}
