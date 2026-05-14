import Button from '../common/Button'
import { formatUserDateTime } from '../../shared/user-time'
import type { SkillArtifact } from '../../types/index'

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
          artifact.updatedAt ? `Updated: ${formatUserDateTime(artifact.updatedAt)}` : null,
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

function ArtifactMetadata({ items }: { items: Array<string | null> }) {
  const visibleItems = items.filter((item): item is string => item !== null)

  return (
    <div className="grid gap-2 rounded-lg border border-hairline bg-slate-50 p-3 md:grid-cols-2">
      {visibleItems.map((item) => (
        <p key={item} className="font-body text-xs text-inkMuted-80">
          {item}
        </p>
      ))}
    </div>
  )
}

function ConversationNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) {
    return null
  }

  return (
    <div>
      <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48 mb-2">
        Edit Conversation
      </p>
      <div className="space-y-2">
        {notes.map((note, index) => (
          <p key={`${note}-${index}`} className="rounded-lg bg-blue-50 px-3 py-2 font-body text-sm text-blue-900">
            {note}
          </p>
        ))}
      </div>
    </div>
  )
}
