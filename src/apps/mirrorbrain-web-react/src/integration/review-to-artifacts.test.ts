import { describe, expect, it } from 'vitest'
import { mirrorBrainReducer, initialState } from '../contexts/MirrorBrainContext'
import type { CandidateMemory, KnowledgeArtifact, ReviewedMemory } from '../types/index'

describe('Review to Artifacts integration', () => {
  it('keeps a candidate and makes it available in artifacts', () => {
    const candidate: CandidateMemory = {
      id: 'candidate-1',
      memoryEventIds: ['event-1'],
      title: 'Important Work',
      summary: 'Research on React patterns',
      theme: 'research',
      reviewDate: '2026-04-14',
      timeRange: {
        startAt: '2026-04-14T10:00:00Z',
        endAt: '2026-04-14T11:00:00Z',
      },
      reviewState: 'pending',
    }

    // Setup: load candidates
    let state = mirrorBrainReducer(initialState, {
      type: 'SET_CANDIDATES',
      payload: [candidate],
    })

    expect(state.candidateMemories).toHaveLength(1)

    // Action: review and keep the candidate
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-1',
      candidateMemoryId: 'candidate-1',
      candidateTitle: 'Important Work',
      candidateSummary: 'Research on React patterns',
      candidateTheme: 'research',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-15T10:00:00Z',
    }

    state = mirrorBrainReducer(state, {
      type: 'ADD_REVIEWED_MEMORY',
      payload: reviewedMemory,
    })

    // Verify: candidate is still in list (for reference)
    expect(state.candidateMemories).toHaveLength(1)
    // Verify: reviewed memory is available in global state
    expect(state.reviewedMemories).toHaveLength(1)
    expect(state.reviewedMemories[0].decision).toBe('keep')

    // Simulate ArtifactsPanel filtering: only show kept memories
    const keptMemories = state.reviewedMemories.filter((m) => m.decision === 'keep')
    expect(keptMemories).toHaveLength(1)
    expect(keptMemories[0].candidateTitle).toBe('Important Work')
  })

  it('discards a candidate and removes it from UI', () => {
    const candidate1: CandidateMemory = {
      id: 'candidate-1',
      memoryEventIds: ['event-1'],
      title: 'Important Work',
      summary: 'Research on React patterns',
      theme: 'research',
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
      title: 'Irrelevant Browsing',
      summary: 'Random web surfing',
      theme: 'misc',
      reviewDate: '2026-04-14',
      timeRange: {
        startAt: '2026-04-14T12:00:00Z',
        endAt: '2026-04-14T13:00:00Z',
      },
      reviewState: 'pending',
    }

    // Setup: load candidates
    let state = mirrorBrainReducer(initialState, {
      type: 'SET_CANDIDATES',
      payload: [candidate1, candidate2],
    })

    expect(state.candidateMemories).toHaveLength(2)

    // Action: discard candidate 2
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-2',
      candidateMemoryId: 'candidate-2',
      candidateTitle: 'Irrelevant Browsing',
      candidateSummary: 'Random web surfing',
      candidateTheme: 'misc',
      memoryEventIds: ['event-2'],
      reviewDate: '2026-04-14',
      decision: 'discard',
      reviewedAt: '2026-04-15T10:00:00Z',
    }

    // First add the reviewed memory (record the discard decision)
    state = mirrorBrainReducer(state, {
      type: 'ADD_REVIEWED_MEMORY',
      payload: reviewedMemory,
    })

    // Then remove the candidate from UI
    state = mirrorBrainReducer(state, {
      type: 'REMOVE_CANDIDATE',
      payload: 'candidate-2',
    })

    // Verify: candidate 2 is removed from candidates list
    expect(state.candidateMemories).toHaveLength(1)
    expect(state.candidateMemories[0].id).toBe('candidate-1')

    // Verify: discard decision is recorded but NOT shown in artifacts
    expect(state.reviewedMemories).toHaveLength(1)
    expect(state.reviewedMemories[0].decision).toBe('discard')

    // Simulate ArtifactsPanel filtering: only show kept memories
    const keptMemories = state.reviewedMemories.filter((m) => m.decision === 'keep')
    expect(keptMemories).toHaveLength(0) // Discarded memories not shown in artifacts
  })

  it('keeps generated knowledge draft in shared app state across tab remounts', () => {
    const draft: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed-1',
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'mail-ppt-workshop',
      title: '使用AI生成PPT并处理邮件与研讨会资料',
      summary: '整理 PPT 生成、网易邮箱处理和研讨会资料准备。',
      body: '## 核心结论\n这是一份仍在编辑的知识草稿。',
      sourceReviewedMemoryIds: ['reviewed-1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-28T10:00:00.000Z',
      reviewedAt: '2026-04-28T09:00:00.000Z',
      recencyLabel: '2026-04-28',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-1' }],
    }

    const state = mirrorBrainReducer(initialState, {
      type: 'SET_KNOWLEDGE_DRAFT',
      payload: draft,
    })

    expect(state.knowledgeDraft).toEqual(draft)
  })

  it('undoes a kept candidate and returns it to candidates list', () => {
    const candidate1: CandidateMemory = {
      id: 'candidate-1',
      memoryEventIds: ['event-1'],
      title: 'Important Work',
      summary: 'Research on React patterns',
      theme: 'research',
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
      title: 'Another Task',
      summary: 'Different work',
      theme: 'work',
      reviewDate: '2026-04-14',
      timeRange: {
        startAt: '2026-04-14T12:00:00Z',
        endAt: '2026-04-14T13:00:00Z',
      },
      reviewState: 'pending',
    }

    // Setup: load candidates
    let state = mirrorBrainReducer(initialState, {
      type: 'SET_CANDIDATES',
      payload: [candidate1, candidate2],
    })

    expect(state.candidateMemories).toHaveLength(2)

    // Action: keep candidate 1
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed:candidate-1',
      candidateMemoryId: 'candidate-1',
      candidateTitle: 'Important Work',
      candidateSummary: 'Research on React patterns',
      candidateTheme: 'research',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-14',
      decision: 'keep',
      reviewedAt: '2026-04-15T10:00:00Z',
    }

    state = mirrorBrainReducer(state, {
      type: 'ADD_REVIEWED_MEMORY',
      payload: reviewedMemory,
    })

    // Verify: candidate is kept
    expect(state.reviewedMemories).toHaveLength(1)
    expect(state.reviewedMemories[0].decision).toBe('keep')

    // Action: undo the keep
    state = mirrorBrainReducer(state, {
      type: 'REMOVE_REVIEWED_MEMORY',
      payload: 'reviewed:candidate-1',
    })

    // Verify: reviewed memory is removed
    expect(state.reviewedMemories).toHaveLength(0)

    // Verify: candidate remains in candidates list (ready to be reviewed again)
    expect(state.candidateMemories).toHaveLength(2)
    expect(state.candidateMemories[0].id).toBe('candidate-1')
    expect(state.candidateMemories[1].id).toBe('candidate-2')

    // Note: In the real UI, the candidate would still be filtered out if keptCandidateIds
    // includes it, but the state management test verifies the underlying state behavior
  })
}) 
