import Button from '../common/Button'
import { KnowledgeMarkdownRenderer } from './KnowledgeMarkdownRenderer'
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
      <div className="rounded-2xl border border-hairline bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
            Knowledge Body
          </p>
          {artifact.topicKey && (
            <span className="rounded-pill bg-canvas px-3 py-1 font-heading text-[11px] font-semibold uppercase text-inkMuted-80">
              {artifact.topicKey}
            </span>
          )}
        </div>
        <KnowledgeMarkdownRenderer body={artifact.body ?? 'No body'} knowledgeId={artifact.id} />
      </div>
      <KnowledgeContext artifact={artifact} />
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

function KnowledgeContext({ artifact }: { artifact: KnowledgeArtifact }) {
  const tags = artifact.tags ?? []
  const relatedKnowledgeIds = artifact.relatedKnowledgeIds ?? []

  if (tags.length === 0 && relatedKnowledgeIds.length === 0 && !artifact.compilationMetadata) {
    return null
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-hairline bg-canvas p-4 md:grid-cols-3">
      <div className="md:col-span-1">
        <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
          Tags
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <span className="font-body text-sm text-inkMuted-48">No tags indexed.</span>
          ) : (
            tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-hairline bg-slate-50 px-3 py-1 font-body text-sm text-slate-700"
              >
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
          Related Knowledge
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {relatedKnowledgeIds.length === 0 ? (
            <span className="font-body text-sm text-inkMuted-48">No direct relations indexed.</span>
          ) : (
            relatedKnowledgeIds.map((relatedId) => (
              <button
                key={relatedId}
                type="button"
                className="rounded-lg border border-hairline bg-slate-50 px-3 py-2 text-left font-body text-sm text-primary hover:border-primary"
              >
                {relatedId}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
          Document Context
        </p>
        <dl className="mt-2 space-y-2">
          <div>
            <dt className="font-heading text-[11px] font-semibold uppercase text-inkMuted-48">
              Artifact Type
            </dt>
            <dd className="font-body text-sm text-ink">{artifact.artifactType ?? 'knowledge'}</dd>
          </div>
          <div>
            <dt className="font-heading text-[11px] font-semibold uppercase text-inkMuted-48">
              Compilation
            </dt>
            <dd className="font-body text-sm text-ink">
              {artifact.compilationMetadata?.generationMethod ?? 'standard-review'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
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
