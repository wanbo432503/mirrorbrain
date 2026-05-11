// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import KnowledgeGraphPanel from './KnowledgeGraphPanel'
import type { KnowledgeGraphSnapshot } from '../../types/index'

afterEach(() => {
  cleanup()
})

const topicRelationGraph: KnowledgeGraphSnapshot = {
  generatedAt: '2026-05-11T10:00:00.000Z',
  stats: {
    topics: 2,
    knowledgeArtifacts: 2,
    wikilinkReferences: 1,
    similarityRelations: 0,
  },
  nodes: [
    {
      id: 'topic:mirrorbrain',
      type: 'topic',
      label: 'MirrorBrain',
      topicKey: 'mirrorbrain',
      properties: { artifactId: 'knowledge-mirrorbrain', title: 'MirrorBrain' },
    },
    {
      id: 'artifact:knowledge-mirrorbrain',
      type: 'knowledge-artifact',
      label: 'MirrorBrain knowledge',
      topicKey: 'mirrorbrain',
      properties: { artifactId: 'knowledge-mirrorbrain', title: 'MirrorBrain knowledge' },
    },
    {
      id: 'topic:openclaw',
      type: 'topic',
      label: 'OpenClaw',
      topicKey: 'openclaw',
      properties: { artifactId: 'knowledge-openclaw', title: 'OpenClaw' },
    },
    {
      id: 'artifact:knowledge-openclaw',
      type: 'knowledge-artifact',
      label: 'OpenClaw knowledge',
      topicKey: 'openclaw',
      properties: { artifactId: 'knowledge-openclaw', title: 'OpenClaw knowledge' },
    },
  ],
  edges: [
    {
      id: 'contains:mirrorbrain',
      type: 'CONTAINS',
      source: 'topic:mirrorbrain',
      target: 'artifact:knowledge-mirrorbrain',
      label: 'contains',
      properties: {},
    },
    {
      id: 'contains:openclaw',
      type: 'CONTAINS',
      source: 'topic:openclaw',
      target: 'artifact:knowledge-openclaw',
      label: 'contains',
      properties: {},
    },
    {
      id: 'references:mirrorbrain-openclaw',
      type: 'REFERENCES',
      source: 'topic:mirrorbrain',
      target: 'topic:openclaw',
      label: 'references',
      properties: {},
    },
  ],
}

describe('KnowledgeGraphPanel', () => {
  it('shows a selected knowledge artifact with related topics and artifacts around it', () => {
    render(
      <KnowledgeGraphPanel
        graph={topicRelationGraph}
        focusArtifactId="knowledge-mirrorbrain"
        focusArtifactTitle="MirrorBrain knowledge"
      />
    )

    const canvas = screen.getByTestId('knowledge-graph-canvas')
    expect(within(canvas).getAllByTestId('knowledge-graph-node')).toHaveLength(4)
    expect(within(canvas).getByText('REFERENCES')).not.toBeNull()
    expect(within(canvas).getByText('OpenClaw')).not.toBeNull()
    expect(within(canvas).getByText('OpenClaw knowledge')).not.toBeNull()
  })

  it('lets users drag graph nodes to new positions', () => {
    render(<KnowledgeGraphPanel graph={topicRelationGraph} />)

    const node = screen.getAllByTestId('knowledge-graph-node')[0]
    const circle = node.querySelector('circle') as SVGCircleElement
    const initialX = circle.getAttribute('cx')

    fireEvent.pointerDown(node, { clientX: 360, clientY: 245, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 460, clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })

    expect(circle.getAttribute('cx')).not.toBe(initialX)
  })
})
