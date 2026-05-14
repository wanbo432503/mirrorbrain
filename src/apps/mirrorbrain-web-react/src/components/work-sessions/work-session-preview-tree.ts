import type { WorkSessionCandidate } from '../../types'

export type WorkSessionPreviewKnowledgeType =
  | 'systematic-knowledge'
  | 'workflow'
  | 'news'

export interface WorkSessionPreviewKnowledgeNode {
  candidateId: string
  title: string
  summary: string
  body: string
  knowledgeType: WorkSessionPreviewKnowledgeType
  sourceTypes: string[]
  memoryEventCount: number
  candidate: WorkSessionCandidate
}

export interface WorkSessionPreviewTopicNode {
  topicKey: string
  topicName: string
  sourceTypes: string[]
  memoryEventCount: number
  candidate: WorkSessionCandidate
}

export interface WorkSessionPreviewProjectNode {
  projectKey: string
  projectName: string
  topics: WorkSessionPreviewTopicNode[]
}

export interface WorkSessionPreviewTree {
  projects: WorkSessionPreviewProjectNode[]
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')

  return slug.length > 0 ? slug : 'untitled'
}

function getTopicName(candidate: WorkSessionCandidate): string {
  return candidate.relationHints[0]?.trim() || candidate.title
}

function isSourceLikeProjectHint(value: string): boolean {
  const normalized = value.trim().toLowerCase()

  if (normalized.length === 0 || normalized === 'unassigned') {
    return true
  }

  return (
    normalized.includes('.') ||
    normalized === 'browser' ||
    normalized === 'shell' ||
    normalized === 'files' ||
    normalized === 'screenshot' ||
    normalized === 'audio'
  )
}

function getProjectGroupKey(candidate: WorkSessionCandidate): string {
  const projectHint = candidate.projectHint.trim() || 'unassigned'

  return isSourceLikeProjectHint(projectHint) ? projectHint.toLowerCase() : projectHint
}

function getCandidateText(candidate: WorkSessionCandidate): string {
  return [
    candidate.title,
    candidate.summary,
    candidate.projectHint,
    ...candidate.relationHints,
  ].join(' ')
}

function deriveProjectName(candidates: WorkSessionCandidate[]): string {
  const explicitProjectHint = candidates
    .map((candidate) => candidate.projectHint.trim())
    .find((projectHint) => projectHint.length > 0 && !isSourceLikeProjectHint(projectHint))

  if (explicitProjectHint !== undefined) {
    return explicitProjectHint
  }

  const text = candidates.map(getCandidateText).join(' ').toLowerCase()

  if (/\b(ai|artificial intelligence)\b/u.test(text) && /\bagents?\b/u.test(text)) {
    return 'AI agents research'
  }

  if (text.includes('聚类')) {
    return '聚类算法研究'
  }

  const fallbackTopic = getTopicName(candidates[0]).trim()
  return fallbackTopic.length > 0 ? fallbackTopic : 'unassigned'
}

function deriveKnowledgeType(candidate: WorkSessionCandidate): WorkSessionPreviewKnowledgeType {
  const text = getCandidateText(candidate).toLowerCase()

  if (
    /(\bworkflow\b|\bprocess\b|\bsteps?\b|\bhow to\b|\bdebug\b|\bfix\b|流程|步骤|排查|修复)/u.test(
      text,
    )
  ) {
    return 'workflow'
  }

  if (/(\bnews\b|\brelease\b|\bannounced\b|\bupdate\b|新闻|资讯|发布|更新)/u.test(text)) {
    return 'news'
  }

  return 'systematic-knowledge'
}

function buildKnowledgeBody(
  candidate: WorkSessionCandidate,
  knowledgeType: WorkSessionPreviewKnowledgeType,
): string {
  const headingByType: Record<WorkSessionPreviewKnowledgeType, string> = {
    'systematic-knowledge': 'Systematic knowledge',
    workflow: 'Workflow',
    news: 'News brief',
  }
  const evidenceItems = candidate.evidenceItems ?? []
  const evidenceSynthesis = evidenceItems
    .filter((item) => item.excerpt.trim().length > 0)
    .map((item) => `- ${item.title}: ${item.excerpt}`)
    .join('\n')
  const referenceLabels =
    candidate.relationHints.length > 0 ? candidate.relationHints : candidate.memoryEventIds
  const references = candidate.memoryEventIds
    .map((memoryEventId, index) => {
      const evidenceItem = evidenceItems.find((item) => item.memoryEventId === memoryEventId)
      const label = evidenceItem?.title ?? referenceLabels[index] ?? memoryEventId
      const sourceType =
        evidenceItem?.sourceType ?? candidate.sourceTypes[index] ?? candidate.sourceTypes[0] ?? 'memory'
      const urlSuffix = evidenceItem?.url !== undefined ? `; ${evidenceItem.url}` : ''

      return `- [${index + 1}] ${label} (${sourceType}; memory event: ${memoryEventId}${urlSuffix})`
    })
    .join('\n')

  return [
    `## ${headingByType[knowledgeType]}`,
    candidate.summary,
    evidenceSynthesis.length > 0
      ? `## Supporting evidence synthesis\n\n${evidenceSynthesis}`
      : '',
    references.length > 0 ? `## References\n\n${references}` : '',
  ]
    .filter((section) => section.length > 0)
    .join('\n\n')
}

export function generateWorkSessionPreviewKnowledge(
  topic: WorkSessionPreviewTopicNode,
): WorkSessionPreviewKnowledgeNode {
  const { candidate } = topic
  const knowledgeType = deriveKnowledgeType(candidate)

  return {
    candidateId: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    body: buildKnowledgeBody(candidate, knowledgeType),
    knowledgeType,
    sourceTypes: candidate.sourceTypes,
    memoryEventCount: candidate.memoryEventIds.length,
    candidate,
  }
}

export function buildWorkSessionPreviewTree(
  candidates: WorkSessionCandidate[],
): WorkSessionPreviewTree {
  const projects = new Map<string, WorkSessionPreviewProjectNode>()
  const projectGroups = new Map<string, WorkSessionCandidate[]>()

  for (const candidate of candidates) {
    const groupKey = getProjectGroupKey(candidate)
    const projectCandidates = projectGroups.get(groupKey)

    if (projectCandidates === undefined) {
      projectGroups.set(groupKey, [candidate])
    } else {
      projectCandidates.push(candidate)
    }
  }

  for (const projectCandidates of projectGroups.values()) {
    const projectName = deriveProjectName(projectCandidates)
    const projectKey = slugify(projectName)
    let project = projects.get(projectKey)

    if (project === undefined) {
      project = {
        projectKey,
        projectName,
        topics: [],
      }
      projects.set(projectKey, project)
    }

    for (const candidate of projectCandidates) {
      const topicName = getTopicName(candidate)
      const topicKey = slugify(topicName)
      const topic = {
        topicKey,
        topicName,
        sourceTypes: candidate.sourceTypes,
        memoryEventCount: candidate.memoryEventIds.length,
        candidate,
      }
      project.topics.push(topic)
    }
  }

  return {
    projects: Array.from(projects.values())
      .sort((left, right) => left.projectName.localeCompare(right.projectName))
      .map((project) => ({
        ...project,
        topics: project.topics
          .sort((left, right) => left.topicName.localeCompare(right.topicName))
          .map((topic) => ({ ...topic })),
      })),
  }
}
