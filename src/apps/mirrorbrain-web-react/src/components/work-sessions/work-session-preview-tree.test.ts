import { describe, expect, it } from 'vitest'

import type { WorkSessionCandidate } from '../../types'
import {
  buildWorkSessionPreviewTree,
  generateWorkSessionPreviewKnowledge,
} from './work-session-preview-tree'

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
              candidate: candidates[1],
            },
            {
              topicKey: 'source-ledger',
              topicName: 'Source ledger',
              sourceTypes: ['browser', 'shell'],
              memoryEventCount: 2,
              candidate: candidates[0],
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
        candidate: expect.objectContaining({ id: 'work-session-candidate:agent-skills' }),
      }),
      expect.objectContaining({
        topicName: 'ai agents evolution',
        candidate: expect.objectContaining({
          id: 'work-session-candidate:ai-agents-evolution',
        }),
      }),
    ])
  })

  it('generates preview knowledge only when a topic is explicitly generated', () => {
    const candidate: WorkSessionCandidate = {
      id: 'work-session-candidate:source-ledger',
      projectHint: 'mirrorbrain',
      title: 'Source ledger',
      summary: 'Imported ledgers, handled bad lines, and tested source status.',
      memoryEventIds: ['browser-1', 'shell-1', 'browser-2'],
      sourceTypes: ['browser', 'shell'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: ['Source ledger'],
      evidenceItems: [
        {
          memoryEventId: 'browser-1',
          sourceType: 'browser',
          title: 'Source ledger design',
          url: 'https://docs.example.com/source-ledger',
          summary: 'Read source-ledger architecture.',
          excerpt:
            'Source ledgers are the acquisition boundary. They preserve source-specific payloads, provenance, and bad-line handling before memory import.',
        },
        {
          memoryEventId: 'shell-1',
          sourceType: 'shell',
          title: 'Run source ledger tests',
          summary: 'Ran Vitest for source-ledger importer.',
          excerpt: 'Ran Vitest for source-ledger importer.',
        },
        {
          memoryEventId: 'browser-2',
          sourceType: 'browser',
          title: 'Source ledger status UI',
          summary: 'Reviewed status UI behavior.',
          excerpt:
            'The source status UI separates operational import state from durable memory retrieval.',
        },
      ],
      reviewState: 'pending',
    }
    const topic = buildWorkSessionPreviewTree([candidate]).projects[0].topics[0]

    expect('knowledge' in topic).toBe(false)
    expect(generateWorkSessionPreviewKnowledge(topic)).toEqual({
      candidateId: 'work-session-candidate:source-ledger',
      title: 'Source ledger',
      summary: 'Imported ledgers, handled bad lines, and tested source status.',
      body: [
        '## Systematic knowledge',
        '',
        'Imported ledgers, handled bad lines, and tested source status.',
        '',
        '## Supporting evidence synthesis',
        '',
        '- Source ledger design: Source ledgers are the acquisition boundary. They preserve source-specific payloads, provenance, and bad-line handling before memory import.',
        '- Run source ledger tests: Ran Vitest for source-ledger importer.',
        '- Source ledger status UI: The source status UI separates operational import state from durable memory retrieval.',
        '',
        '## References',
        '',
        '- [1] Source ledger design (browser; memory event: browser-1; https://docs.example.com/source-ledger)',
        '- [2] Run source ledger tests (shell; memory event: shell-1)',
        '- [3] Source ledger status UI (browser; memory event: browser-2)',
      ].join('\n'),
      knowledgeType: 'systematic-knowledge',
      sourceTypes: ['browser', 'shell'],
      memoryEventCount: 3,
      candidate,
    })
  })
})
