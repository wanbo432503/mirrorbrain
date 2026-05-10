import { useMemo, useState } from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import Input from '../forms/Input'
import { SkillArtifactDetail } from './ArtifactDetail'
import { sortSkillArtifactsByNewest } from './artifact-sorting'
import { formatUserDateTime } from '../../shared/user-time'
import type { SkillArtifact } from '../../types/index'

interface SkillPanelProps {
  skillArtifacts: SkillArtifact[]
  onDeleteSkillArtifact?: (artifactId: string) => Promise<void> | void
  isDeletingSkillArtifact?: boolean
}

export default function SkillPanel({
  skillArtifacts,
  onDeleteSkillArtifact,
  isDeletingSkillArtifact = false,
}: SkillPanelProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState('')
  const [conversationNotes, setConversationNotes] = useState<Record<string, string[]>>({})

  const sortedSkills = useMemo(
    () => sortSkillArtifactsByNewest(skillArtifacts),
    [skillArtifacts]
  )
  const selectedSkill =
    sortedSkills.find((artifact) => artifact.id === selectedSkillId) ?? sortedSkills[0]
  const selectedNotes = selectedSkill ? conversationNotes[selectedSkill.id] ?? [] : []

  function handleApplyMessage() {
    const message = editMessage.trim()
    if (!selectedSkill || message.length === 0) {
      return
    }

    setConversationNotes((current) => ({
      ...current,
      [selectedSkill.id]: [...(current[selectedSkill.id] ?? []), message],
    }))
    setEditMessage('')
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-full min-h-0 overflow-y-auto" data-testid="skill-history-panel">
        {sortedSkills.length === 0 ? (
          <EmptyState
            message="No skills yet"
            description="Generated skill artifacts will appear here newest first."
          />
        ) : (
          <div className="space-y-2">
            {sortedSkills.map((artifact) => {
              const selected = artifact.id === selectedSkill?.id
              const timestamp = artifact.updatedAt ?? artifact.reviewedAt

              return (
                <button
                  key={artifact.id}
                  type="button"
                  data-testid="skill-list-item"
                  onClick={() => setSelectedSkillId(artifact.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-canvas'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <p className="font-body text-sm font-semibold text-ink">{artifact.id}</p>
                  <p className="mt-1 font-body text-sm text-slate-700">
                    Approval: {artifact.approvalState}
                  </p>
                  {timestamp && (
                    <p className="mt-2 font-heading text-[11px] font-semibold uppercase text-inkMuted-48">
                      {formatUserDateTime(timestamp)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="h-full min-h-0" data-testid="skill-detail-panel">
        {selectedSkill ? (
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <SkillArtifactDetail
                artifact={selectedSkill}
                notes={selectedNotes}
                onDelete={
                  onDeleteSkillArtifact
                    ? () => onDeleteSkillArtifact(selectedSkill.id)
                    : undefined
                }
                isDeleting={isDeletingSkillArtifact}
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div data-testid="skill-edit-message-row" className="flex w-full items-end gap-3">
                <div data-testid="skill-edit-message-field" className="min-w-0 flex-1">
                  <Input
                    id="skill-edit-message"
                    label="Skill Edit Message"
                    value={editMessage}
                    onChange={(event) => setEditMessage(event.target.value)}
                    className="h-10 w-full"
                    placeholder="Describe how this skill should change..."
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
          <EmptyState message="Select a skill" description="Skill details will appear here." />
        )}
      </Card>
    </div>
  )
}
