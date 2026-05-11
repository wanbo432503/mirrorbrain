import { useMemo, useState } from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import Input from '../forms/Input'
import KnowledgeGraphPanel from './KnowledgeGraphPanel'
import { KnowledgeArtifactDetail } from './ArtifactDetail'
import {
  selectCurrentBestKnowledgeArtifacts,
  sortKnowledgeArtifactsByNewest,
} from './artifact-sorting'
import { formatUserDateTime } from '../../shared/user-time'
import type { KnowledgeArtifact, KnowledgeGraphSnapshot } from '../../types/index'

type KnowledgeViewMode = 'list' | 'graph'

interface KnowledgePanelProps {
  knowledgeArtifacts: KnowledgeArtifact[]
  knowledgeGraph?: KnowledgeGraphSnapshot | null
  onDeleteKnowledgeArtifact?: (artifactId: string) => Promise<void> | void
  isDeletingKnowledgeArtifact?: boolean
  onApproveKnowledgeCandidate?: (artifact: KnowledgeArtifact) => Promise<void> | void
  isApprovingKnowledgeCandidate?: boolean
}

const EMPTY_GRAPH: KnowledgeGraphSnapshot = {
  generatedAt: '',
  stats: {
    topics: 0,
    knowledgeArtifacts: 0,
    wikilinkReferences: 0,
    similarityRelations: 0,
  },
  nodes: [],
  edges: [],
}

export default function KnowledgePanel({
  knowledgeArtifacts,
  knowledgeGraph,
  onDeleteKnowledgeArtifact,
  isDeletingKnowledgeArtifact = false,
  onApproveKnowledgeCandidate,
  isApprovingKnowledgeCandidate = false,
}: KnowledgePanelProps) {
  const [activeMode, setActiveMode] = useState<KnowledgeViewMode>('list')
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null)
  const [editMessage, setEditMessage] = useState('')
  const [conversationNotes, setConversationNotes] = useState<Record<string, string[]>>({})

  const approvedKnowledge = useMemo(
    () => sortKnowledgeArtifactsByNewest(selectCurrentBestKnowledgeArtifacts(knowledgeArtifacts)),
    [knowledgeArtifacts]
  )
  const mergeCandidates = useMemo(
    () =>
      knowledgeArtifacts
        .filter((artifact) => artifact.artifactType === 'topic-merge-candidate')
        .sort(
          (left, right) =>
            getKnowledgeTimestamp(right) - getKnowledgeTimestamp(left)
        ),
    [knowledgeArtifacts]
  )
  const selectedMergeCandidate = mergeCandidates.find(
    (artifact) => artifact.id === selectedKnowledgeId
  )
  const selectedKnowledge =
    approvedKnowledge.find((artifact) => artifact.id === selectedKnowledgeId) ??
    (activeMode === 'list' ? approvedKnowledge[0] : null)
  const selectedArtifact = selectedMergeCandidate ?? selectedKnowledge
  const selectedNotes = selectedArtifact ? conversationNotes[selectedArtifact.id] ?? [] : []
  const filteredGraph = useMemo(
    () => filterKnowledgeGraph(knowledgeGraph ?? EMPTY_GRAPH, approvedKnowledge),
    [approvedKnowledge, knowledgeGraph]
  )

  function handleModeChange(mode: KnowledgeViewMode) {
    setActiveMode(mode)
    setEditMessage('')
    if (mode === 'graph') {
      setSelectedKnowledgeId(null)
    }
  }

  function handleApplyMessage() {
    const message = editMessage.trim()
    if (!selectedArtifact || message.length === 0) {
      return
    }

    setConversationNotes((current) => ({
      ...current,
      [selectedArtifact.id]: [...(current[selectedArtifact.id] ?? []), message],
    }))
    setEditMessage('')
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card
        className="flex h-full min-h-0 flex-col overflow-hidden"
        data-testid="knowledge-history-panel"
      >
        <div
          role="tablist"
          aria-label="Knowledge view mode"
          className="mb-4 flex shrink-0 border-b border-slate-200"
        >
          {(['list', 'graph'] as const).map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={activeMode === mode}
              onClick={() => handleModeChange(mode)}
              className={`-mb-px border-b-2 px-4 py-2 font-heading text-xs font-semibold uppercase tracking-wide ${
                activeMode === mode
                  ? 'border-primary text-primary'
                  : 'border-transparent text-inkMuted-80 hover:text-ink'
              }`}
            >
              {mode === 'list' ? 'List' : 'Graph'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {approvedKnowledge.length === 0 && mergeCandidates.length === 0 ? (
            <EmptyState
              message="No approved knowledge yet"
              description="Published knowledge will appear here newest first."
            />
          ) : (
            <div className="space-y-2">
              {approvedKnowledge.map((artifact) => {
                const selected =
                  activeMode === 'list' && selectedKnowledgeId === null
                    ? artifact.id === selectedKnowledge?.id
                    : artifact.id === selectedKnowledgeId
                const title = artifact.title ?? 'Untitled Knowledge'
                const summary = artifact.summary ?? 'No summary'
                const timestamp = artifact.updatedAt ?? artifact.reviewedAt

                return (
                  <button
                    key={artifact.id}
                    type="button"
                    data-testid="knowledge-list-item"
                    onClick={() => setSelectedKnowledgeId(artifact.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-canvas'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <p className="font-body text-sm font-semibold text-ink">{title}</p>
                    <p className="mt-1 font-body text-sm text-slate-700">{summary}</p>
                    {timestamp && (
                      <p className="mt-2 font-heading text-[11px] font-semibold uppercase text-inkMuted-48">
                        {formatUserDateTime(timestamp)}
                      </p>
                    )}
                  </button>
                )
              })}
              {mergeCandidates.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-2 font-heading text-xs font-semibold uppercase text-inkMuted-48">
                    Merge Suggestions
                  </p>
                  <div className="space-y-2">
                    {mergeCandidates.map((artifact) => {
                      const selected = artifact.id === selectedKnowledgeId
                      const title = artifact.title ?? 'Untitled Merge Candidate'
                      const summary = artifact.summary ?? 'No summary'
                      const timestamp = artifact.updatedAt ?? artifact.reviewedAt

                      return (
                        <button
                          key={artifact.id}
                          type="button"
                          data-testid="knowledge-merge-candidate-item"
                          onClick={() => setSelectedKnowledgeId(artifact.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            selected
                              ? 'border-primary bg-canvas'
                              : 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-white'
                          }`}
                        >
                          <p className="font-body text-sm font-semibold text-ink">{title}</p>
                          <p className="mt-1 font-body text-sm text-slate-700">{summary}</p>
                          {timestamp && (
                            <p className="mt-2 font-heading text-[11px] font-semibold uppercase text-inkMuted-48">
                              {formatUserDateTime(timestamp)}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {activeMode === 'list' ? (
        <Card className="h-full min-h-0" data-testid="knowledge-detail-panel">
          {selectedArtifact ? (
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                {selectedMergeCandidate && onApproveKnowledgeCandidate && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="font-body text-sm text-amber-900">
                      Review this suggested merge before publishing it as topic knowledge.
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => onApproveKnowledgeCandidate(selectedMergeCandidate)}
                      disabled={isApprovingKnowledgeCandidate}
                      className="shrink-0"
                    >
                      Approve Merge
                    </Button>
                  </div>
                )}
                <KnowledgeArtifactDetail
                  artifact={selectedArtifact}
                  notes={selectedNotes}
                  onDelete={
                    onDeleteKnowledgeArtifact
                      ? () => onDeleteKnowledgeArtifact(selectedArtifact.id)
                      : undefined
                  }
                  isDeleting={isDeletingKnowledgeArtifact}
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div data-testid="knowledge-edit-message-row" className="flex w-full items-end gap-3">
                  <div data-testid="knowledge-edit-message-field" className="min-w-0 flex-1">
                    <Input
                      id="knowledge-edit-message"
                      label="Knowledge Edit Message"
                      value={editMessage}
                      onChange={(event) => setEditMessage(event.target.value)}
                      className="h-10 w-full"
                      placeholder="Describe how this knowledge should change..."
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
              message="Select knowledge"
              description="Approved knowledge details will appear here."
            />
          )}
        </Card>
      ) : (
        <Card className="h-full min-h-0 overflow-y-auto" data-testid="knowledge-graph-panel">
          <KnowledgeGraphPanel
            graph={filteredGraph}
            focusArtifactId={selectedKnowledge?.id}
            focusArtifactTitle={selectedKnowledge?.title ?? selectedKnowledge?.id}
          />
        </Card>
      )}
    </div>
  )
}

function getKnowledgeTimestamp(artifact: KnowledgeArtifact): number {
  const timestamp = artifact.updatedAt ?? artifact.reviewedAt ?? ''
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) ? value : 0
}

function filterKnowledgeGraph(
  graph: KnowledgeGraphSnapshot,
  visibleKnowledgeArtifacts: KnowledgeArtifact[],
): KnowledgeGraphSnapshot {
  const visibleArtifactIds = new Set(visibleKnowledgeArtifacts.map((artifact) => artifact.id))
  const visibleTopicKeys = new Set(
    visibleKnowledgeArtifacts
      .map((artifact) => artifact.topicKey)
      .filter((topicKey): topicKey is string => typeof topicKey === 'string' && topicKey.length > 0)
  )
  const nodes = graph.nodes.filter((node) => {
    if (node.type === 'topic') {
      return visibleTopicKeys.has(node.topicKey)
    }

    return visibleArtifactIds.has(node.properties.artifactId ?? '')
  })
  const visibleNodeIds = new Set(nodes.map((node) => node.id))
  const edges = graph.edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  )

  return {
    ...graph,
    stats: {
      topics: nodes.filter((node) => node.type === 'topic').length,
      knowledgeArtifacts: nodes.filter((node) => node.type === 'knowledge-artifact').length,
      wikilinkReferences: edges.filter((edge) => edge.type === 'REFERENCES').length,
      similarityRelations: edges.filter((edge) => edge.type === 'SIMILAR').length,
    },
    nodes,
    edges,
  }
}
