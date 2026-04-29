import { useEffect, useMemo, useState } from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import TextArea from '../forms/TextArea'
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
  return [...artifacts].sort(
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
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
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
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
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
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <p className="font-body text-sm font-semibold text-slate-900">{title}</p>
                    <p className="font-body text-sm text-slate-700 mt-1">{summary}</p>
                    {timestamp && (
                      <p className="font-heading text-[11px] font-semibold uppercase text-slate-500 mt-2">
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
              <ArtifactDetail artifact={selectedArtifact} notes={selectedNotes} />
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <TextArea
                id="artifact-edit-message"
                label="Artifact Edit Message"
                value={editMessage}
                onChange={(event) => setEditMessage(event.target.value)}
                rows={4}
                placeholder="Describe how this artifact should change..."
              />
              <Button
                variant="primary"
                onClick={handleApplyMessage}
                disabled={editMessage.trim().length === 0}
              >
                Apply Message
              </Button>
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
}: {
  artifact: SelectedArtifact
  notes: string[]
}) {
  if (artifact.kind === 'knowledge') {
    const knowledge = artifact.artifact
    return (
      <div className="space-y-4">
        <div>
          <p className="font-heading text-xs font-semibold uppercase text-slate-500">
            Knowledge Detail
          </p>
          <h3 className="font-heading text-xl font-bold text-slate-900 mt-1">
            {knowledge.title ?? 'Untitled Knowledge'}
          </h3>
        </div>
        <p className="font-body text-sm text-slate-700">{knowledge.summary ?? 'No summary'}</p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="whitespace-pre-wrap font-body text-sm text-slate-800">
            {knowledge.body ?? 'No body content'}
          </p>
        </div>
        <ArtifactMetadata
          items={[
            `State: ${knowledge.draftState}`,
            `Sources: ${knowledge.sourceReviewedMemoryIds.length}`,
            knowledge.updatedAt ? `Updated: ${knowledge.updatedAt}` : null,
          ]}
        />
        <ConversationNotes notes={notes} />
      </div>
    )
  }

  const skill = artifact.artifact
  return (
    <div className="space-y-4">
      <div>
        <p className="font-heading text-xs font-semibold uppercase text-slate-500">
          Skill Detail
        </p>
        <h3 className="font-heading text-xl font-bold text-slate-900 mt-1">{skill.id}</h3>
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
        <p className="font-heading text-xs font-semibold uppercase text-slate-500 mb-2">
          Workflow Evidence
        </p>
        <div className="space-y-2">
          {skill.workflowEvidenceRefs.length === 0 ? (
            <p className="font-body text-sm text-slate-500">No evidence refs attached.</p>
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

function ArtifactMetadata({ items }: { items: Array<string | null> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.filter(Boolean).map((item) => (
        <span
          key={item}
          className="rounded-md bg-slate-100 px-2 py-1 font-heading text-[11px] font-semibold uppercase text-slate-600"
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
      <p className="font-heading text-xs font-semibold uppercase text-slate-500">
        Conversation Updates
      </p>
      {notes.map((note, index) => (
        <p
          key={`${note}-${index}`}
          className="rounded-lg border border-teal-100 bg-teal-50 p-3 font-body text-sm text-slate-800"
        >
          {note}
        </p>
      ))}
    </div>
  )
}
