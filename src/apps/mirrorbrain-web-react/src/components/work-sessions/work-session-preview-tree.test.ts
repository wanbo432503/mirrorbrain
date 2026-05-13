import { describe, expect, it } from 'vitest'

import type { WorkSessionCandidate } from '../../types'
import { buildWorkSessionPreviewTree } from './work-session-preview-tree'

describe('buildWorkSessionPreviewTree', () => {
  it('groups pending work-session candidates into project, topic, and one generated preview knowledge node per topic', () => {
    const candidates: WorkSessionCandidate[] = [
      {
        id: 'work-session-candidate:source-ledger',
        projectHint: 'mirrorbrain',
        title: 'Source ledger architecture',
        summary: 'Imported ledgers and tested source status.',
        memoryEventIds: ['browser-1', 'shell-1'],
        sourceTypes: ['browser', 'shell'],
        timeRange: {
          startAt: '2026-05-12T10:00:00.000Z',
          endAt: '2026-05-12T10:30:00.000Z',
        },
        relationHints: ['Source ledger', 'Phase 4 design'],
        reviewState: 'pending',
      },
      {
        id: 'work-session-candidate:memory-ui',
        projectHint: 'mirrorbrain',
        title: 'Memory source UI',
        summary: 'Adjusted source labels and ledger formats.',
        memoryEventIds: ['browser-2'],
        sourceTypes: ['browser'],
        timeRange: {
          startAt: '2026-05-12T11:00:00.000Z',
          endAt: '2026-05-12T11:30:00.000Z',
        },
        relationHints: ['Memory Sources UI'],
        reviewState: 'pending',
      },
    ]

    expect(buildWorkSessionPreviewTree(candidates)).toEqual({
      projects: [
        {
          projectKey: 'mirrorbrain',
          projectName: 'mirrorbrain',
          topics: [
            {
              topicKey: 'memory-sources-ui',
              topicName: 'Memory Sources UI',
              sourceTypes: ['browser'],
              memoryEventCount: 1,
              knowledge: {
                candidateId: 'work-session-candidate:memory-ui',
                title: 'Memory source UI',
                summary: 'Adjusted source labels and ledger formats.',
                body: '## Systematic knowledge\n\nAdjusted source labels and ledger formats.',
                knowledgeType: 'systematic-knowledge',
                sourceTypes: ['browser'],
                memoryEventCount: 1,
                candidate: candidates[1],
              },
            },
            {
              topicKey: 'source-ledger',
              topicName: 'Source ledger',
              sourceTypes: ['browser', 'shell'],
              memoryEventCount: 2,
              knowledge: {
                candidateId: 'work-session-candidate:source-ledger',
                title: 'Source ledger architecture',
                summary: 'Imported ledgers and tested source status.',
                body: '## Systematic knowledge\n\nImported ledgers and tested source status.',
                knowledgeType: 'systematic-knowledge',
                sourceTypes: ['browser', 'shell'],
                memoryEventCount: 2,
                candidate: candidates[0],
              },
            },
          ],
        },
      ],
    })
  })

  it('turns source-like hints into a task-level project instead of showing the source host as the project', () => {
    const candidates: WorkSessionCandidate[] = [
      {
        id: 'work-session-candidate:ai-agents-evolution',
        projectHint: 'arxiv.org',
        title: 'AI Agents: Evolution, Architecture, and Real-World Applications',
        summary: 'Read a paper about AI agents evolution and architecture.',
        memoryEventIds: ['browser-1'],
        sourceTypes: ['browser'],
        timeRange: {
          startAt: '2026-05-12T10:00:00.000Z',
          endAt: '2026-05-12T10:05:00.000Z',
        },
        relationHints: ['ai agents evolution'],
        reviewState: 'pending',
      },
      {
        id: 'work-session-candidate:agent-skills',
        projectHint: 'arxiv.org',
        title: 'Agent Skills for Large Language Models',
        summary: 'Read a paper about agent skills and acquisition.',
        memoryEventIds: ['browser-2'],
        sourceTypes: ['browser'],
        timeRange: {
          startAt: '2026-05-12T10:10:00.000Z',
          endAt: '2026-05-12T10:15:00.000Z',
        },
        relationHints: ['agent skills for'],
        reviewState: 'pending',
      },
    ]

    const tree = buildWorkSessionPreviewTree(candidates)

    expect(tree.projects).toHaveLength(1)
    expect(tree.projects[0].projectName).toBe('AI agents research')
    expect(tree.projects[0].projectName).not.toBe('arxiv.org')
    expect(tree.projects[0].topics).toEqual([
      expect.objectContaining({
        topicName: 'agent skills for',
        knowledge: expect.objectContaining({
          candidateId: 'work-session-candidate:agent-skills',
          knowledgeType: 'systematic-knowledge',
        }),
      }),
      expect.objectContaining({
        topicName: 'ai agents evolution',
        knowledge: expect.objectContaining({
          candidateId: 'work-session-candidate:ai-agents-evolution',
          knowledgeType: 'systematic-knowledge',
        }),
      }),
    ])
  })
})
