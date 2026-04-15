import { describe, expect, it } from 'vitest'
import { mirrorBrainReducer, initialState } from '../contexts/MirrorBrainContext'
import type { ReviewedMemory, CandidateMemory } from '../types/index'

describe('MirrorBrainContext reducer', () => {
  it('adds a reviewed memory to the reviewedMemories array', () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-1',
      candidateMemoryId: 'candidate-1',
      candidateTitle: 'Test Candidate',
      candidateSummary: 'Test summary',
      candidateTheme: 'work',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-15T10:00:00Z',
    }

    const newState = mirrorBrainReducer(initialState, {
      type: 'ADD_REVIEWED_MEMORY',
      payload: reviewedMemory,
    })

    expect(newState.reviewedMemories).toHaveLength(1)
    expect(newState.reviewedMemories[0]).toEqual(reviewedMemory)
  })

  it('removes a candidate from candidateMemories array', () => {
    const candidate: CandidateMemory = {
      id: 'candidate-1',
      memoryEventIds: ['event-1'],
      title: 'Test Candidate',
      summary: 'Test summary',
      theme: 'work',
      reviewDate: '2026-04-14',
      timeRange: {
        startAt: '2026-04-14T10:00:00Z',
        endAt: '2026-04-14T11:00:00Z',
      },
      reviewState: 'pending',
    }

    const stateWithCandidate = {
      ...initialState,
      candidateMemories: [candidate],
    }

    const newState = mirrorBrainReducer(stateWithCandidate, {
      type: 'REMOVE_CANDIDATE',
      payload: 'candidate-1',
    })

    expect(newState.candidateMemories).toHaveLength(0)
  })

  it('does not remove other candidates when removing one', () => {
    const candidate1: CandidateMemory = {
      id: 'candidate-1',
      memoryEventIds: ['event-1'],
      title: 'Candidate 1',
      summary: 'Summary 1',
      theme: 'work',
      reviewDate: '2026-04-14',
      timeRange: {
        startAt: '2026-04-14T10:00:00Z',
        endAt: '2026-04-14T11:00:00Z',
      },
      reviewState: 'pending',
    }

    const candidate2: CandidateMemory = {
      id: 'candidate-2',
      memoryEventIds: ['event-2'],
      title: 'Candidate 2',
      summary: 'Summary 2',
      theme: 'research',
      reviewDate: '2026-04-14',
      timeRange: {
        startAt: '2026-04-14T12:00:00Z',
        endAt: '2026-04-14T13:00:00Z',
      },
      reviewState: 'pending',
    }

    const stateWithCandidates = {
      ...initialState,
      candidateMemories: [candidate1, candidate2],
    }

    const newState = mirrorBrainReducer(stateWithCandidates, {
      type: 'REMOVE_CANDIDATE',
      payload: 'candidate-1',
    })

    expect(newState.candidateMemories).toHaveLength(1)
    expect(newState.candidateMemories[0].id).toBe('candidate-2')
  })
})