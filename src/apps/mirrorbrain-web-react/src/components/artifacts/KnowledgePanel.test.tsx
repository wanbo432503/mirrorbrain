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
  body: 'Older body',
  sourceReviewedMemoryIds: ['reviewed:old'],
  updatedAt: '2026-04-20T10:00:00.000Z',
}

const newerKnowledge: KnowledgeArtifact = {
  id: 'knowledge-new',
  draftState: 'published',
  artifactType: 'topic-knowledge',
  topicKey: 'new',
  title: 'Newer knowledge',
  summary: 'Newer summary',
  body: 'Newer body',
  sourceReviewedMemoryIds: ['reviewed:new'],
  updatedAt: '2026-04-29T10:00:00.000Z',
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
    expect(within(detailPanel).getByText('Older body')).not.toBeNull()
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

    fireEvent.click(within(historyPanel).getByRole('button', { name: /Older knowledge/ }))
    expect(within(graphPanel).getByText('Focused Knowledge Graph')).not.toBeNull()
    expect(within(graphPanel).getByText(/Centered on Older knowledge/)).not.toBeNull()
  })
})
