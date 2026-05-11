// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import KnowledgePanel from './KnowledgePanel'
import type { KnowledgeArtifact, KnowledgeGraphSnapshot } from '../../types/index'

afterEach(() => {
  cleanup()
})

const olderKnowledge: KnowledgeArtifact = {
  id: 'knowledge-old',
  draftState: 'published',
  artifactType: 'topic-knowledge',
  topicKey: 'old',
  title: 'Older knowledge',
  summary: 'Older summary',
  body: '## Older heading\n\nOlder body with [[knowledge-new]] reference.',
  sourceReviewedMemoryIds: ['reviewed:old'],
  relatedKnowledgeIds: ['knowledge-new'],
  tags: ['legacy', 'ops'],
  updatedAt: '2026-04-20T10:00:00.000Z',
}

const newerKnowledge: KnowledgeArtifact = {
  id: 'knowledge-new',
  draftState: 'published',
  artifactType: 'topic-knowledge',
  topicKey: 'new',
  title: 'Newer knowledge',
  summary: 'Newer summary',
  body: '## Newer heading\n\nNewer body',
  sourceReviewedMemoryIds: ['reviewed:new'],
  updatedAt: '2026-04-29T10:00:00.000Z',
}

const mergeCandidate: KnowledgeArtifact = {
  id: 'topic-merge-candidate:new:knowledge-new:knowledge-old',
  draftState: 'draft',
  artifactType: 'topic-merge-candidate',
  topicKey: 'new',
  title: 'Merge candidate: Newer knowledge',
  summary: 'Suggested merge with similar knowledge: Older knowledge.',
  body: '## Merge Suggestion\n\nMerge newer and older knowledge.',
  sourceReviewedMemoryIds: ['reviewed:new', 'reviewed:old'],
  derivedFromKnowledgeIds: ['knowledge-new', 'knowledge-old'],
  updatedAt: '2026-04-30T10:00:00.000Z',
}

const versionedKnowledgeArtifacts: KnowledgeArtifact[] = [
  {
    id: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v4',
    draftState: 'published',
    artifactType: 'topic-knowledge',
    topicKey: 'llm-wiki-ai-native-knowledge-management',
    title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v4)',
    summary: 'Latest summary',
    body: 'Latest body',
    sourceReviewedMemoryIds: ['reviewed:v4'],
    version: 4,
    isCurrentBest: true,
    supersedesKnowledgeId: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v3',
    updatedAt: '2026-05-11T10:00:00.000Z',
  },
  {
    id: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v3',
    draftState: 'published',
    artifactType: 'topic-knowledge',
    topicKey: 'llm-wiki-ai-native-knowledge-management',
    title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v3)',
    summary: 'Older summary',
    body: 'Older body',
    sourceReviewedMemoryIds: ['reviewed:v3'],
    version: 3,
    isCurrentBest: false,
    supersedesKnowledgeId: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v2',
    updatedAt: '2026-05-10T10:00:00.000Z',
  },
  {
    id: 'topic-knowledge:llm-wiki-ai-native-memory-building:v2',
    draftState: 'published',
    artifactType: 'topic-knowledge',
    topicKey: 'llm-wiki-ai-native-memory-building',
    title: 'LLM Wiki 与 AI 原生公司记忆构建模式 (v2)',
    summary: 'Memory building summary',
    body: 'Memory building body',
    sourceReviewedMemoryIds: ['reviewed:v2'],
    version: 2,
    isCurrentBest: true,
    supersedesKnowledgeId: null,
    updatedAt: '2026-05-09T10:00:00.000Z',
  },
  {
    id: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v1',
    draftState: 'published',
    artifactType: 'topic-knowledge',
    topicKey: 'llm-wiki-ai-native-knowledge-management',
    title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v1)',
    summary: 'Oldest summary',
    body: 'Oldest body',
    sourceReviewedMemoryIds: ['reviewed:v1'],
    version: 1,
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt: '2026-05-08T10:00:00.000Z',
  },
]

const versionedGraph: KnowledgeGraphSnapshot = {
  generatedAt: '2026-05-11T10:00:00.000Z',
  stats: {
    topics: 2,
    knowledgeArtifacts: 4,
    wikilinkReferences: 0,
    similarityRelations: 0,
  },
  nodes: [
    {
      id: 'topic:llm-wiki-ai-native-knowledge-management',
      type: 'topic',
      label: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v4)',
      topicKey: 'llm-wiki-ai-native-knowledge-management',
      properties: {
        artifactId: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v4',
        title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v4)',
      },
    },
    {
      id: 'artifact:topic-knowledge:llm-wiki-ai-native-knowledge-management:v4',
      type: 'knowledge-artifact',
      label: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v4)',
      topicKey: 'llm-wiki-ai-native-knowledge-management',
      properties: {
        artifactId: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v4',
        title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v4)',
      },
    },
    {
      id: 'artifact:topic-knowledge:llm-wiki-ai-native-knowledge-management:v3',
      type: 'knowledge-artifact',
      label: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v3)',
      topicKey: 'llm-wiki-ai-native-knowledge-management',
      properties: {
        artifactId: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v3',
        title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v3)',
      },
    },
    {
      id: 'topic:llm-wiki-ai-native-memory-building',
      type: 'topic',
      label: 'LLM Wiki 与 AI 原生公司记忆构建模式 (v2)',
      topicKey: 'llm-wiki-ai-native-memory-building',
      properties: {
        artifactId: 'topic-knowledge:llm-wiki-ai-native-memory-building:v2',
        title: 'LLM Wiki 与 AI 原生公司记忆构建模式 (v2)',
      },
    },
    {
      id: 'artifact:topic-knowledge:llm-wiki-ai-native-memory-building:v2',
      type: 'knowledge-artifact',
      label: 'LLM Wiki 与 AI 原生公司记忆构建模式 (v2)',
      topicKey: 'llm-wiki-ai-native-memory-building',
      properties: {
        artifactId: 'topic-knowledge:llm-wiki-ai-native-memory-building:v2',
        title: 'LLM Wiki 与 AI 原生公司记忆构建模式 (v2)',
      },
    },
    {
      id: 'artifact:topic-knowledge:llm-wiki-ai-native-knowledge-management:v1',
      type: 'knowledge-artifact',
      label: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v1)',
      topicKey: 'llm-wiki-ai-native-knowledge-management',
      properties: {
        artifactId: 'topic-knowledge:llm-wiki-ai-native-knowledge-management:v1',
        title: 'LLM Wiki 与 AI 原生公司的知识管理模式 (v1)',
      },
    },
  ],
  edges: [
    {
      id: 'contains:v4',
      type: 'CONTAINS',
      source: 'topic:llm-wiki-ai-native-knowledge-management',
      target: 'artifact:topic-knowledge:llm-wiki-ai-native-knowledge-management:v4',
      label: 'contains',
      properties: {},
    },
    {
      id: 'contains:v3',
      type: 'CONTAINS',
      source: 'topic:llm-wiki-ai-native-knowledge-management',
      target: 'artifact:topic-knowledge:llm-wiki-ai-native-knowledge-management:v3',
      label: 'contains',
      properties: {},
    },
    {
      id: 'contains:v2',
      type: 'CONTAINS',
      source: 'topic:llm-wiki-ai-native-memory-building',
      target: 'artifact:topic-knowledge:llm-wiki-ai-native-memory-building:v2',
      label: 'contains',
      properties: {},
    },
    {
      id: 'contains:v1',
      type: 'CONTAINS',
      source: 'topic:llm-wiki-ai-native-knowledge-management',
      target: 'artifact:topic-knowledge:llm-wiki-ai-native-knowledge-management:v1',
      label: 'contains',
      properties: {},
    },
  ],
}

const graph: KnowledgeGraphSnapshot = {
  generatedAt: '2026-04-29T10:00:00.000Z',
  stats: {
    topics: 2,
    knowledgeArtifacts: 2,
    wikilinkReferences: 0,
    similarityRelations: 1,
  },
  nodes: [
    {
      id: 'knowledge-artifact:knowledge-new',
      type: 'knowledge-artifact',
      label: 'Newer knowledge',
      topicKey: 'new',
      properties: {
        artifactId: 'knowledge-new',
        title: 'Newer knowledge',
      },
    },
    {
      id: 'knowledge-artifact:knowledge-old',
      type: 'knowledge-artifact',
      label: 'Older knowledge',
      topicKey: 'old',
      properties: {
        artifactId: 'knowledge-old',
        title: 'Older knowledge',
      },
    },
  ],
  edges: [
    {
      id: 'similar:new-old',
      type: 'SIMILAR',
      source: 'knowledge-artifact:knowledge-new',
      target: 'knowledge-artifact:knowledge-old',
      label: 'Similar',
      properties: { similarity: 0.82 },
    },
  ],
}

describe('KnowledgePanel', () => {
  it('shows approved knowledge in the left list and defaults the detail to the newest item', () => {
    render(
      <KnowledgePanel
        knowledgeArtifacts={[olderKnowledge, newerKnowledge, { ...newerKnowledge, id: 'draft', draftState: 'draft' }]}
        knowledgeGraph={graph}
        onDeleteKnowledgeArtifact={vi.fn()}
      />
    )

    const historyPanel = screen.getByTestId('knowledge-history-panel')
    const items = within(historyPanel).getAllByTestId('knowledge-list-item')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Newer knowledge')
    expect(items[1].textContent).toContain('Older knowledge')

    const detailPanel = screen.getByTestId('knowledge-detail-panel')
    expect(within(detailPanel).getByText('Newer body')).not.toBeNull()

    fireEvent.click(within(historyPanel).getByRole('button', { name: /Older knowledge/ }))
    expect(within(detailPanel).getByText(/Older body/)).not.toBeNull()
  })

  it('renders knowledge timestamps in the user timezone instead of raw UTC ISO strings', () => {
    render(
      <KnowledgePanel
        knowledgeArtifacts={[newerKnowledge]}
        knowledgeGraph={graph}
        onDeleteKnowledgeArtifact={vi.fn()}
      />
    )

    expect(screen.queryByText('2026-04-29T10:00:00.000Z')).toBeNull()
    expect(screen.getAllByText(/2026-04-29 18:00/).length).toBeGreaterThan(0)
  })

  it('renders the selected knowledge detail as a markdown document with context metadata', () => {
    render(
      <KnowledgePanel
        knowledgeArtifacts={[olderKnowledge, newerKnowledge]}
        knowledgeGraph={graph}
        onDeleteKnowledgeArtifact={vi.fn()}
      />
    )

    const historyPanel = screen.getByTestId('knowledge-history-panel')
    fireEvent.click(within(historyPanel).getByRole('button', { name: /Older knowledge/ }))

    const detailPanel = screen.getByTestId('knowledge-detail-panel')
    expect(within(detailPanel).getByRole('heading', { name: 'Older heading' })).not.toBeNull()
    expect(within(detailPanel).getByRole('link', { name: 'knowledge-new' })).not.toBeNull()
    expect(within(detailPanel).getByText('legacy')).not.toBeNull()
    expect(within(detailPanel).getByText('ops')).not.toBeNull()
    expect(within(detailPanel).getByRole('button', { name: 'knowledge-new' })).not.toBeNull()
  })

  it('keeps the left knowledge list stable while graph mode switches the right panel from global to focused graph', () => {
    render(
      <KnowledgePanel
        knowledgeArtifacts={[olderKnowledge, newerKnowledge]}
        knowledgeGraph={graph}
        onDeleteKnowledgeArtifact={vi.fn()}
      />
    )

    const historyPanel = screen.getByTestId('knowledge-history-panel')
    fireEvent.click(within(historyPanel).getByRole('tab', { name: 'Graph' }))

    expect(within(historyPanel).getAllByTestId('knowledge-list-item')).toHaveLength(2)
    const graphPanel = screen.getByTestId('knowledge-graph-panel')
    expect(within(graphPanel).getByText('Global Knowledge Graph')).not.toBeNull()
    expect(within(graphPanel).getByTestId('knowledge-graph-canvas')).not.toBeNull()
    expect(within(graphPanel).getAllByTestId('knowledge-graph-node')).toHaveLength(2)
    expect(within(graphPanel).getByTestId('knowledge-graph-edge')).not.toBeNull()

    fireEvent.click(within(historyPanel).getByRole('button', { name: /Older knowledge/ }))
    expect(within(graphPanel).getByText('Focused Knowledge Graph')).not.toBeNull()
    expect(within(graphPanel).getByText(/Centered on Older knowledge/)).not.toBeNull()
    expect(within(graphPanel).getByText('SIMILAR')).not.toBeNull()
  })

  it('shows merge candidates and lets the user approve one', () => {
    const onApproveKnowledgeCandidate = vi.fn()

    render(
      <KnowledgePanel
        knowledgeArtifacts={[olderKnowledge, newerKnowledge, mergeCandidate]}
        knowledgeGraph={graph}
        onApproveKnowledgeCandidate={onApproveKnowledgeCandidate}
      />
    )

    expect(screen.getByText('Merge Suggestions')).not.toBeNull()
    fireEvent.click(screen.getByText('Merge candidate: Newer knowledge'))
    fireEvent.click(screen.getByText('Approve Merge'))

    expect(onApproveKnowledgeCandidate).toHaveBeenCalledWith(mergeCandidate)
  })

  it('hides superseded versions from the knowledge list and graph', () => {
    render(
      <KnowledgePanel
        knowledgeArtifacts={versionedKnowledgeArtifacts}
        knowledgeGraph={versionedGraph}
        onDeleteKnowledgeArtifact={vi.fn()}
      />
    )

    const historyPanel = screen.getByTestId('knowledge-history-panel')
    const items = within(historyPanel).getAllByTestId('knowledge-list-item')
    expect(items).toHaveLength(2)
    expect(within(historyPanel).queryByText('LLM Wiki 与 AI 原生公司的知识管理模式 (v3)')).toBeNull()
    expect(within(historyPanel).queryByText('LLM Wiki 与 AI 原生公司的知识管理模式 (v1)')).toBeNull()
    expect(within(historyPanel).getByText('LLM Wiki 与 AI 原生公司的知识管理模式 (v4)')).not.toBeNull()
    expect(within(historyPanel).getByText('LLM Wiki 与 AI 原生公司记忆构建模式 (v2)')).not.toBeNull()

    fireEvent.click(within(historyPanel).getByRole('tab', { name: 'Graph' }))

    const graphPanel = screen.getByTestId('knowledge-graph-panel')
    expect(within(graphPanel).getAllByTestId('knowledge-graph-node')).toHaveLength(4)
    expect(within(graphPanel).queryByText('LLM Wiki 与 AI 原生公司的知识管理模式 (v3)')).toBeNull()
    expect(within(graphPanel).queryByText('LLM Wiki 与 AI 原生公司的知识管理模式 (v1)')).toBeNull()
    expect(within(graphPanel).getAllByText('LLM Wiki 与 AI 原生公司的知识管理模式 (v4)').length).toBeGreaterThan(0)
  })
})
