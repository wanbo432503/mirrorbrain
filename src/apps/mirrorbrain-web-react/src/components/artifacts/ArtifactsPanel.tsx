import HistoryTopics from './HistoryTopics'
import { createMirrorBrainBrowserApi, type MirrorBrainWebAppApi } from '../../api/client'
import { useArtifacts } from '../../hooks/useArtifacts'

export default function ArtifactsPanel() {
  const api: MirrorBrainWebAppApi = createMirrorBrainBrowserApi(window.location.origin)

  const {
    knowledgeArtifacts,
    skillArtifacts,
    knowledgeTopics,
    feedback,
  } = useArtifacts(api)

  return (
    <div>
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-3 p-3 rounded-lg border ${
            feedback.kind === 'success'
              ? 'bg-green-100 border-green-300 text-green-700'
              : feedback.kind === 'error'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-blue-100 border-blue-300 text-blue-700'
          }`}
          role="alert"
        >
          <p className="font-body font-medium text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Directly show HistoryTopics - no subtab navigation needed */}
      <HistoryTopics
        knowledgeTopics={knowledgeTopics}
        knowledgeArtifacts={knowledgeArtifacts}
        skillArtifacts={skillArtifacts}
      />
    </div>
  )
}
