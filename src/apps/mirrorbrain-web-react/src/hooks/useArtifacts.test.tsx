// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MirrorBrainProvider } from '../contexts/MirrorBrainContext'
import { useArtifacts } from './useArtifacts'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { KnowledgeArtifact, ReviewedMemory, SkillArtifact } from '../types/index'

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MirrorBrainProvider>{children}</MirrorBrainProvider>
  }
}

describe('useArtifacts', () => {
  it('persists generated knowledge and stores the saved artifact in shared state', async () => {
    const reviewedMemories: ReviewedMemory[] = [
      {
        id: 'reviewed-1',
        candidateMemoryId: 'candidate-1',
        candidateTitle: 'Candidate title',
        candidateSummary: 'Candidate summary',
        candidateTheme: 'theme',
        memoryEventIds: ['event-1'],
        reviewDate: '2026-04-29',
        decision: 'keep',
        reviewedAt: '2026-04-29T10:00:00.000Z',
      },
    ]

    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed-1',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Generated title',
      summary: 'Generated summary',
      body: 'Generated body',
      sourceReviewedMemoryIds: ['reviewed-1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-29T10:00:00.000Z',
      reviewedAt: '2026-04-29T09:00:00.000Z',
      recencyLabel: '2026-04-29',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-1' }],
    }
    const savedArtifact: KnowledgeArtifact = {
      ...generatedArtifact,
      updatedAt: '2026-04-29T10:05:00.000Z',
    }

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
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      generateKnowledge: vi.fn(async () => generatedArtifact),
      generateSkill: vi.fn(),
      saveKnowledgeArtifact: vi.fn(async () => savedArtifact),
      saveSkillArtifact: vi.fn(),
    } as unknown as MirrorBrainWebAppApi

    const wrapper = createWrapper()
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    let returnedArtifact: KnowledgeArtifact | null = null

    await act(async () => {
      returnedArtifact = await result.current.generateKnowledge(reviewedMemories)
    })

    expect(api.generateKnowledge).toHaveBeenCalledWith(reviewedMemories)
    expect(api.saveKnowledgeArtifact).toHaveBeenCalledWith(generatedArtifact)
    expect(returnedArtifact).toEqual(savedArtifact)
    expect(result.current.knowledgeArtifacts).toEqual([savedArtifact])
  })

  it('persists generated skill and stores the saved artifact in shared state', async () => {
    const reviewedMemories: ReviewedMemory[] = [
      {
        id: 'reviewed-2',
        candidateMemoryId: 'candidate-2',
        candidateTitle: 'Skill candidate',
        candidateSummary: 'Skill summary',
        candidateTheme: 'theme',
        memoryEventIds: ['event-2'],
        reviewDate: '2026-04-29',
        decision: 'keep',
        reviewedAt: '2026-04-29T10:00:00.000Z',
      },
    ]

    const generatedArtifact: SkillArtifact = {
      id: 'skill-draft:reviewed-2',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed-2'],
      executionSafetyMetadata: { requiresConfirmation: true },
      updatedAt: '2026-04-29T10:00:00.000Z',
    }
    const savedArtifact: SkillArtifact = {
      ...generatedArtifact,
      updatedAt: '2026-04-29T10:05:00.000Z',
    }

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
      reviewCandidateMemory: vi.fn(),
      undoCandidateReview: vi.fn(),
      generateKnowledge: vi.fn(),
      generateSkill: vi.fn(async () => generatedArtifact),
      saveKnowledgeArtifact: vi.fn(),
      saveSkillArtifact: vi.fn(async () => savedArtifact),
    } as unknown as MirrorBrainWebAppApi

    const wrapper = createWrapper()
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    let returnedArtifact: SkillArtifact | null = null

    await act(async () => {
      returnedArtifact = await result.current.generateSkill(reviewedMemories)
    })

    expect(api.generateSkill).toHaveBeenCalledWith(reviewedMemories)
    expect(api.saveSkillArtifact).toHaveBeenCalledWith(generatedArtifact)
    expect(returnedArtifact).toEqual(savedArtifact)
    expect(result.current.skillArtifacts).toEqual([savedArtifact])
  })
})
