import { useState } from 'react'
import HistoryTable from './HistoryTable'
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

const HISTORY_PAGE_SIZE = 5

export default function HistoryTopics({
  knowledgeTopics,
  knowledgeArtifacts,
  skillArtifacts,
}: HistoryTopicsProps) {
  const [topicsPage, setTopicsPage] = useState(1)
  const [knowledgePage, setKnowledgePage] = useState(1)
  const [skillsPage, setSkillsPage] = useState(1)

  // Transform knowledge topics for table display
  const topicsItems = knowledgeTopics.map((topic) => ({
    id: topic.topicKey,
    primary: topic.title,
    secondary: topic.summary,
    tertiary: topic.recencyLabel,
  }))

  // Transform knowledge artifacts for table display
  const knowledgeItems = knowledgeArtifacts.map((artifact) => ({
    id: artifact.id || 'unknown',
    primary: artifact.title || 'Untitled',
    secondary: artifact.summary || 'No summary',
    tertiary: artifact.draftState,
  }))

  // Transform skill artifacts for table display
  const skillsItems = skillArtifacts.map((artifact) => ({
    id: artifact.id || 'unknown',
    primary: artifact.id || 'Untitled',
    secondary: artifact.approvalState,
    tertiary: `${artifact.workflowEvidenceRefs.length} refs`,
  }))

  return (
    <div className="space-y-6">
      {/* Knowledge Topics Table */}
      <HistoryTable
        title="Knowledge Topics"
        items={topicsItems}
        currentPage={topicsPage}
        totalPages={Math.ceil(knowledgeTopics.length / HISTORY_PAGE_SIZE)}
        onPageChange={setTopicsPage}
      />

      {/* Generated Knowledge Table */}
      <HistoryTable
        title="Generated Knowledge"
        items={knowledgeItems}
        currentPage={knowledgePage}
        totalPages={Math.ceil(knowledgeArtifacts.length / HISTORY_PAGE_SIZE)}
        onPageChange={setKnowledgePage}
      />

      {/* Generated Skills Table */}
      <HistoryTable
        title="Generated Skills"
        items={skillsItems}
        currentPage={skillsPage}
        totalPages={Math.ceil(skillArtifacts.length / HISTORY_PAGE_SIZE)}
        onPageChange={setSkillsPage}
      />
    </div>
  )
}