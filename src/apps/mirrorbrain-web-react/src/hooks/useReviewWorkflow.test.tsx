// @vitest-environment jsdom
import { useEffect, useRef } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MirrorBrainProvider, useMirrorBrain } from '../contexts/MirrorBrainContext'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { CandidateMemory, ReviewedMemory } from '../types/index'
import { useReviewWorkflow } from './useReviewWorkflow'

const candidate: CandidateMemory = {
  id: 'candidate:review-tab-knowledge',
  memoryEventIds: ['event-1'],
  title: 'Review tab knowledge generation',
  summary: 'Kept candidate should be available for knowledge generation.',
  theme: 'knowledge-generation',
  reviewDate: '2026-05-10',
  timeRange: {
    startAt: '2026-05-10T10:00:00.000Z',
    endAt: '2026-05-10T10:30:00.000Z',
  },
  reviewState: 'pending',
}

const reviewedMemory: ReviewedMemory = {
  id: 'reviewed:candidate:review-tab-knowledge',
  candidateMemoryId: candidate.id,
  candidateTitle: candidate.title,
  candidateSummary: candidate.summary,
  candidateTheme: candidate.theme,
  memoryEventIds: candidate.memoryEventIds,
  reviewDate: candidate.reviewDate,
  decision: 'keep',
  reviewedAt: '2026-05-10T11:00:00.000Z',
}

function SeedCandidates({ children }: { children: React.ReactNode }) {
  const { dispatch } = useMirrorBrain()
  const hasSeeded = useRef(false)

  useEffect(() => {
    if (hasSeeded.current) {
      return
    }

    hasSeeded.current = true
    dispatch({ type: 'SET_CANDIDATES', payload: [candidate] })
  }, [dispatch])

  return <>{children}</>
}

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MirrorBrainProvider>
        <SeedCandidates>{children}</SeedCandidates>
      </MirrorBrainProvider>
    )
  }
}

describe('useReviewWorkflow', () => {
  it('counts unique candidate URLs for the review window instead of repeated browser events', async () => {
    const candidates: CandidateMemory[] = [
      {
        ...candidate,
        id: 'candidate:repeated-tabs',
        memoryEventIds: ['event-1', 'event-2', 'event-3', 'event-4', 'event-5'],
        sourceRefs: [
          {
            id: 'event-1',
            sourceType: 'activitywatch-browser',
            timestamp: '2026-05-10T10:00:00.000Z',
            url: 'https://example.com/docs',
          },
          {
            id: 'event-2',
            sourceType: 'activitywatch-browser',
            timestamp: '2026-05-10T10:01:00.000Z',
            url: 'https://example.com/docs',
          },
          {
            id: 'event-3',
            sourceType: 'activitywatch-browser',
            timestamp: '2026-05-10T10:02:00.000Z',
            url: 'https://example.com/spec',
          },
          {
            id: 'event-4',
            sourceType: 'activitywatch-browser',
            timestamp: '2026-05-10T10:03:00.000Z',
            url: 'https://example.com/spec',
          },
          {
            id: 'event-5',
            sourceType: 'activitywatch-browser',
            timestamp: '2026-05-10T10:04:00.000Z',
            url: 'https://example.com/spec',
          },
        ],
      },
    ]
    const api: MirrorBrainWebAppApi = {
      getHealth: vi.fn(),
      listMemory: vi.fn(),
      listKnowledge: vi.fn(),
      listKnowledgeTopics: vi.fn(),
      listSkills: vi.fn(),
      listCandidateMemoriesByDate: vi.fn(async () => candidates),
      syncBrowser: vi.fn(),
      syncShell: vi.fn(),
      createDailyCandidates: vi.fn(),
      suggestCandidateReviews: vi.fn(async () => []),
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    } as unknown as MirrorBrainWebAppApi

    const { result } = renderHook(() => useReviewWorkflow(api), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.createDailyCandidates('2026-05-10')
    })

    expect(result.current.reviewWindowEventCount).toBe(2)
  })

  it('reviews a candidate when selection and keep happen in the same user action', async () => {
    const api: MirrorBrainWebAppApi = {
      getHealth: vi.fn(),
      listMemory: vi.fn(),
      listKnowledge: vi.fn(),
      listKnowledgeTopics: vi.fn(),
      listSkills: vi.fn(),
      syncBrowser: vi.fn(),
      syncShell: vi.fn(),
      createDailyCandidates: vi.fn(),
      suggestCandidateReviews: vi.fn(),
      reviewCandidateMemory: vi.fn(async () => reviewedMemory),
      undoCandidateReview: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(),
    } as unknown as MirrorBrainWebAppApi

    const { result } = renderHook(() => useReviewWorkflow(api), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      result.current.selectCandidate(candidate.id)
      await result.current.reviewCandidateMemory('keep', candidate.id)
    })

    expect(api.reviewCandidateMemory).toHaveBeenCalledWith(
      candidate,
      expect.objectContaining({ decision: 'keep' })
    )
  })
})
