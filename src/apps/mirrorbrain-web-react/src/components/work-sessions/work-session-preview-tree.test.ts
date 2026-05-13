import { describe, expect, it } from 'vitest'

import type { WorkSessionCandidate } from '../../types'
import { buildWorkSessionPreviewTree } from './work-session-preview-tree'

describe('buildWorkSessionPreviewTree', () => {
  it('groups pending work-session candidates into project, topic, and preview knowledge nodes', () => {
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
              knowledge: [
                {
                  candidateId: 'work-session-candidate:memory-ui',
                  title: 'Memory source UI',
                  summary: 'Adjusted source labels and ledger formats.',
                  sourceTypes: ['browser'],
                  memoryEventCount: 1,
                  candidate: candidates[1],
                },
              ],
            },
            {
              topicKey: 'source-ledger',
              topicName: 'Source ledger',
              knowledge: [
                {
                  candidateId: 'work-session-candidate:source-ledger',
                  title: 'Source ledger architecture',
                  summary: 'Imported ledgers and tested source status.',
                  sourceTypes: ['browser', 'shell'],
                  memoryEventCount: 2,
                  candidate: candidates[0],
                },
              ],
            },
          ],
        },
      ],
    })
  })
})
