import { useEffect, useMemo, useState } from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import Input from '../forms/Input'
import type { KnowledgeArtifact, SkillArtifact } from '../../types/index'

interface HistoryTopicsProps {
  knowledgeTopics: Array<{
    topicKey: string
    title: string
    summary: string
    currentBestKnowledgeId: string
    updatedAt?: string
    recencyLabel: string
  }>
  knowledgeArtifacts: KnowledgeArtifact[]
  skillArtifacts: SkillArtifact[]
  onDeleteKnowledgeArtifact?: (artifactId: string) => Promise<void> | void
  onDeleteSkillArtifact?: (artifactId: string) => Promise<void> | void
  isDeletingKnowledgeArtifact?: boolean
  isDeletingSkillArtifact?: boolean
}

type ArtifactSubtab = 'knowledge' | 'skill'
type SelectedArtifact =
  | { kind: 'knowledge'; artifact: KnowledgeArtifact }
  | { kind: 'skill'; artifact: SkillArtifact }

function getKnowledgeTimelineTimestamp(artifact: KnowledgeArtifact): number {
  const timestamp = artifact.updatedAt ?? artifact.reviewedAt ?? ''
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

function getSkillTimelineTimestamp(artifact: SkillArtifact): number {
  const timestamp = artifact.updatedAt ?? artifact.reviewedAt ?? ''
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

export function sortKnowledgeArtifactsByNewest(
  artifacts: KnowledgeArtifact[]
): KnowledgeArtifact[] {
  return artifacts
    .filter((artifact) => artifact.draftState === 'published')
    .sort(
      (left, right) => getKnowledgeTimelineTimestamp(right) - getKnowledgeTimelineTimestamp(left)
    )
}

export function sortSkillArtifactsByNewest(artifacts: SkillArtifact[]): SkillArtifact[] {
  return [...artifacts].sort(
    (left, right) => getSkillTimelineTimestamp(right) - getSkillTimelineTimestamp(left)
  )
}

export default function HistoryTopics({
  knowledgeArtifacts,
  skillArtifacts,
  onDeleteKnowledgeArtifact,
  onDeleteSkillArtifact,
  isDeletingKnowledgeArtifact = false,
  isDeletingSkillArtifact = false,
}: HistoryTopicsProps) {
  const [activeSubtab, setActiveSubtab] = useState<ArtifactSubtab>('knowledge')
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState('')
  const [conversationNotes, setConversationNotes] = useState<Record<string, string[]>>({})

  const sortedKnowledge = useMemo(
    () => sortKnowledgeArtifactsByNewest(knowledgeArtifacts),
    [knowledgeArtifacts]
  )
  const sortedSkills = useMemo(
    () => sortSkillArtifactsByNewest(skillArtifacts),
    [skillArtifacts]
  )

  const visibleItems = activeSubtab === 'knowledge' ? sortedKnowledge : sortedSkills
  const selectedArtifact: SelectedArtifact | null = useMemo(() => {
    if (activeSubtab === 'knowledge') {
      const artifact =
        sortedKnowledge.find((item) => item.id === selectedArtifactId) ?? sortedKnowledge[0]
      return artifact ? { kind: 'knowledge', artifact } : null
    }

    const artifact = sortedSkills.find((item) => item.id === selectedArtifactId) ?? sortedSkills[0]
    return artifact ? { kind: 'skill', artifact } : null
  }, [activeSubtab, selectedArtifactId, sortedKnowledge, sortedSkills])

  useEffect(() => {
    const firstItem = visibleItems[0]
    setSelectedArtifactId(firstItem?.id ?? null)
    setEditMessage('')
  }, [activeSubtab, visibleItems])

  const selectedKey = selectedArtifact
    ? `${selectedArtifact.kind}:${selectedArtifact.artifact.id}`
    : null
  const selectedNotes = selectedKey ? conversationNotes[selectedKey] ?? [] : []

  function handleApplyMessage() {
    const message = editMessage.trim()
    if (!selectedKey || message.length === 0) {
      return
    }

    setConversationNotes((current) => ({
      ...current,
      [selectedKey]: [...(current[selectedKey] ?? []), message],
    }))
    setEditMessage('')
  }

  async function handleDeleteSelectedArtifact() {
    if (!selectedArtifact) {
      return
    }

    if (selectedArtifact.kind === 'knowledge') {
      await onDeleteKnowledgeArtifact?.(selectedArtifact.artifact.id)
      return
    }

    await onDeleteSkillArtifact?.(selectedArtifact.artifact.id)
  }

  const deleteButtonLabel =
    selectedArtifact?.kind === 'knowledge' ? 'Delete Knowledge' : 'Delete Skill'
  const isDeletingSelectedArtifact =
    selectedArtifact?.kind === 'knowledge'
      ? isDeletingKnowledgeArtifact
      : isDeletingSkillArtifact

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-[680px] overflow-y-auto" data-testid="artifact-history-panel">
        <div className="space-y-4">
          <div role="tablist" aria-label="Artifact type" className="flex border-b border-slate-200">
            <button
              role="tab"
              aria-selected={activeSubtab === 'knowledge'}
              onClick={() => setActiveSubtab('knowledge')}
              className={`px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px ${
                activeSubtab === 'knowledge'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-inkMuted-80 hover:text-ink'
              }`}
            >
              Knowledge
            </button>
            <button
              role="tab"
              aria-selected={activeSubtab === 'skill'}
              onClick={() => setActiveSubtab('skill')}
              className={`px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px ${
                activeSubtab === 'skill'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-inkMuted-80 hover:text-ink'
              }`}
            >
              Skill
            </button>
          </div>

          {visibleItems.length === 0 ? (
            <EmptyState
              message={activeSubtab === 'knowledge' ? 'No knowledge yet' : 'No skills yet'}
              description="Generated artifacts will appear here newest first."
            />
          ) : (
            <div className="space-y-2">
              {visibleItems.map((item) => {
                const selected = item.id === selectedArtifactId
                const isKnowledge = activeSubtab === 'knowledge'
                const title = isKnowledge
                  ? (item as KnowledgeArtifact).title ?? 'Untitled Knowledge'
                  : item.id
                const summary = isKnowledge
                  ? (item as KnowledgeArtifact).summary ?? 'No summary'
                  : `Approval: ${(item as SkillArtifact).approvalState}`
                const timestamp = isKnowledge
                  ? (item as KnowledgeArtifact).updatedAt ?? (item as KnowledgeArtifact).reviewedAt
                  : (item as SkillArtifact).updatedAt ?? (item as SkillArtifact).reviewedAt

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid="artifact-list-item"
                    onClick={() => setSelectedArtifactId(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-canvas'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <p className="font-body text-sm font-semibold text-ink">{title}</p>
                    <p className="font-body text-sm text-slate-700 mt-1">{summary}</p>
                    {timestamp && (
                      <p className="font-heading text-[11px] font-semibold uppercase text-inkMuted-48 mt-2">
                        {timestamp}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="h-[680px]" data-testid="artifact-detail-panel">
        {selectedArtifact ? (
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <ArtifactDetail
                artifact={selectedArtifact}
                notes={selectedNotes}
                onDelete={handleDeleteSelectedArtifact}
                deleteButtonLabel={deleteButtonLabel}
                isDeleting={isDeletingSelectedArtifact}
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div data-testid="artifact-edit-message-row" className="flex w-full items-end gap-3">
                <div data-testid="artifact-edit-message-field" className="min-w-0 flex-1">
                  <Input
                    id="artifact-edit-message"
                    label="Artifact Edit Message"
                    value={editMessage}
                    onChange={(event) => setEditMessage(event.target.value)}
                    className="h-10 w-full"
                    placeholder="Describe how this artifact should change..."
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleApplyMessage}
                  disabled={editMessage.trim().length === 0}
                  className="shrink-0"
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            message="Select an artifact"
            description="Knowledge and skill details will appear here."
          />
        )}
      </Card>
    </div>
  )
}

function ArtifactDetail({
  artifact,
  notes,
  onDelete,
  deleteButtonLabel,
  isDeleting,
}: {
  artifact: SelectedArtifact
  notes: string[]
  onDelete: () => Promise<void>
  deleteButtonLabel: string
  isDeleting: boolean
}) {
  if (artifact.kind === 'knowledge') {
    const knowledge = artifact.artifact
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
              Knowledge Detail
            </p>
            <h3 className="font-heading text-xl font-bold text-ink mt-1">
              {knowledge.title ?? 'Untitled Knowledge'}
            </h3>
          </div>
          <Button variant="ghost" onClick={() => void onDelete()} loading={isDeleting}>
            {deleteButtonLabel}
          </Button>
        </div>
        <KnowledgeField label="Summary" value={knowledge.summary ?? 'No summary'} />
        <KnowledgeField label="Body" value={knowledge.body ?? 'No body'} preserveWhitespace />
        <ArtifactMetadata
          items={[
            `Id: ${knowledge.id}`,
            knowledge.artifactType ? `Type: ${knowledge.artifactType}` : null,
            `State: ${knowledge.draftState}`,
            knowledge.topicKey ? `Topic: ${knowledge.topicKey}` : null,
            knowledge.version !== undefined ? `Version: ${knowledge.version}` : null,
            knowledge.isCurrentBest !== undefined
              ? `Current best: ${knowledge.isCurrentBest ? 'yes' : 'no'}`
              : null,
            knowledge.supersedesKnowledgeId
              ? `Supersedes: ${knowledge.supersedesKnowledgeId}`
              : null,
            `Sources: ${knowledge.sourceReviewedMemoryIds.length}`,
            `Derived: ${knowledge.derivedFromKnowledgeIds?.length ?? 0}`,
            knowledge.updatedAt ? `Updated: ${knowledge.updatedAt}` : null,
            knowledge.reviewedAt ? `Reviewed: ${knowledge.reviewedAt}` : null,
            knowledge.recencyLabel ? `Recency: ${knowledge.recencyLabel}` : null,
          ]}
        />
        <KnowledgeRefs
          label="Reviewed Memory Sources"
          refs={knowledge.sourceReviewedMemoryIds}
          emptyMessage="No reviewed memory sources attached."
        />
        <KnowledgeRefs
          label="Derived Knowledge"
          refs={knowledge.derivedFromKnowledgeIds ?? []}
          emptyMessage="No derived knowledge refs attached."
        />
        <KnowledgeRefs
          label="Provenance"
          refs={(knowledge.provenanceRefs ?? []).map((ref) => `${ref.kind}: ${ref.id}`)}
          emptyMessage="No provenance refs attached."
        />
        <ConversationNotes notes={notes} />
      </div>
    )
  }

  const skill = artifact.artifact
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
            Skill Detail
          </p>
          <h3 className="font-heading text-xl font-bold text-ink mt-1">{skill.id}</h3>
        </div>
        <Button variant="ghost" onClick={() => void onDelete()} loading={isDeleting}>
          {deleteButtonLabel}
        </Button>
      </div>
      <ArtifactMetadata
        items={[
          `Approval: ${skill.approvalState}`,
          `Requires confirmation: ${
            skill.executionSafetyMetadata.requiresConfirmation ? 'yes' : 'no'
          }`,
          skill.updatedAt ? `Updated: ${skill.updatedAt}` : null,
        ]}
      />
      <div>
        <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48 mb-2">
          Workflow Evidence
        </p>
        <div className="space-y-2">
          {skill.workflowEvidenceRefs.length === 0 ? (
            <p className="font-body text-sm text-inkMuted-48">No evidence refs attached.</p>
          ) : (
            skill.workflowEvidenceRefs.map((ref) => (
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
