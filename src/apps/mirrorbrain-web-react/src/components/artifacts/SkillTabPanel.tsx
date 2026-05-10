import { useMemo } from 'react'
import SkillPanel from './SkillPanel'
import { createMirrorBrainBrowserApi } from '../../api/client'
import { useArtifacts } from '../../hooks/useArtifacts'

export default function SkillTabPanel() {
  const api = useMemo(() => createMirrorBrainBrowserApi(window.location.origin), [])
  const {
    skillArtifacts,
    feedback,
    isDeletingSkill,
    deleteSkillArtifact,
  } = useArtifacts(api)

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

      <SkillPanel
        skillArtifacts={skillArtifacts}
        onDeleteSkillArtifact={deleteSkillArtifact}
        isDeletingSkillArtifact={isDeletingSkill}
      />
    </div>
  )
}
