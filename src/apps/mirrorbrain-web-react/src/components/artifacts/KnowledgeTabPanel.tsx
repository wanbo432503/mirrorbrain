import { useEffect, useMemo, useState } from 'react'
import KnowledgePanel from './KnowledgePanel'
import { createMirrorBrainBrowserApi } from '../../api/client'
import { useArtifacts } from '../../hooks/useArtifacts'
import type { KnowledgeGraphSnapshot } from '../../types/index'

export default function KnowledgeTabPanel() {
  const api = useMemo(() => createMirrorBrainBrowserApi(window.location.origin), [])
  const {
    knowledgeArtifacts,
    feedback,
    isDeletingKnowledge,
    isApprovingKnowledge,
    approveKnowledge,
    deleteKnowledgeArtifact,
  } = useArtifacts(api)
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphSnapshot | null>(null)

  useEffect(() => {
    let active = true

    async function loadKnowledgeGraph() {
      if (!api.getKnowledgeGraph) {
        return
      }

      try {
        const graph = await api.getKnowledgeGraph()
        if (active) {
          setKnowledgeGraph(graph)
        }
      } catch (error) {
        console.error('Failed to load knowledge graph', error)
      }
    }

    void loadKnowledgeGraph()

    return () => {
      active = false
    }
  }, [api])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {feedback && (
        <div
          className={`mb-3 rounded-lg border p-3 ${
            feedback.kind === 'success'
              ? 'border-green-300 bg-green-100 text-green-700'
              : feedback.kind === 'error'
              ? 'border-red-300 bg-red-100 text-red-700'
              : 'border-blue-300 bg-blue-100 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body text-sm font-medium">{feedback.message}</p>
        </div>
      )}

      <KnowledgePanel
        knowledgeArtifacts={knowledgeArtifacts}
        knowledgeGraph={knowledgeGraph}
        onDeleteKnowledgeArtifact={deleteKnowledgeArtifact}
        isDeletingKnowledgeArtifact={isDeletingKnowledge}
        onApproveKnowledgeCandidate={async (artifact) => {
          await approveKnowledge(artifact)
        }}
        isApprovingKnowledgeCandidate={isApprovingKnowledge}
      />
    </div>
  )
}
