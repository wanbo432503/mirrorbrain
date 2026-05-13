import type { WorkSessionCandidate } from '../../types'

export interface WorkSessionPreviewKnowledgeNode {
  candidateId: string
  title: string
  summary: string
  sourceTypes: string[]
  memoryEventCount: number
  candidate: WorkSessionCandidate
}

export interface WorkSessionPreviewTopicNode {
  topicKey: string
  topicName: string
  knowledge: WorkSessionPreviewKnowledgeNode[]
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

export function buildWorkSessionPreviewTree(
  candidates: WorkSessionCandidate[],
): WorkSessionPreviewTree {
  const projects = new Map<string, WorkSessionPreviewProjectNode>()

  for (const candidate of candidates) {
    const projectName = candidate.projectHint.trim() || 'unassigned'
    const projectKey = slugify(projectName)
    const topicName = getTopicName(candidate)
    const topicKey = slugify(topicName)
    let project = projects.get(projectKey)

    if (project === undefined) {
      project = {
        projectKey,
        projectName,
        topics: [],
      }
      projects.set(projectKey, project)
    }

    let topic = project.topics.find((item) => item.topicKey === topicKey)
    if (topic === undefined) {
      topic = {
        topicKey,
        topicName,
        knowledge: [],
      }
      project.topics.push(topic)
    }

    topic.knowledge.push({
      candidateId: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      sourceTypes: candidate.sourceTypes,
      memoryEventCount: candidate.memoryEventIds.length,
      candidate,
    })
  }

  return {
    projects: Array.from(projects.values())
      .sort((left, right) => left.projectName.localeCompare(right.projectName))
      .map((project) => ({
        ...project,
        topics: project.topics
          .sort((left, right) => left.topicName.localeCompare(right.topicName))
          .map((topic) => ({
            ...topic,
            knowledge: topic.knowledge.sort((left, right) =>
              left.title.localeCompare(right.title),
            ),
          })),
      })),
  }
}
