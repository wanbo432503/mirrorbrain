// @vitest-environment jsdom
import { useEffect, useRef } from 'react'
import { cleanup, renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MirrorBrainProvider } from '../contexts/MirrorBrainContext'
import { useMirrorBrain } from '../contexts/MirrorBrainContext'
import { useArtifacts } from './useArtifacts'
import type { MirrorBrainWebAppApi } from '../api/client'
import type { KnowledgeArtifact, ReviewedMemory, SkillArtifact } from '../types/index'

function SeedState({
  knowledgeArtifacts = [],
  skillArtifacts = [],
  children,
}: {
  knowledgeArtifacts?: KnowledgeArtifact[]
  skillArtifacts?: SkillArtifact[]
  children: React.ReactNode
}) {
  const { dispatch } = useMirrorBrain()
  const hasSeeded = useRef(false)

  useEffect(() => {
    if (hasSeeded.current) {
      return
    }

    hasSeeded.current = true

    if (knowledgeArtifacts.length > 0) {
      dispatch({ type: 'LOAD_KNOWLEDGE', payload: knowledgeArtifacts })
    }

    if (skillArtifacts.length > 0) {
      dispatch({ type: 'LOAD_SKILLS', payload: skillArtifacts })
    }
  }, [dispatch, knowledgeArtifacts, skillArtifacts])

  return <>{children}</>
}

function createWrapper(options: {
  knowledgeArtifacts?: KnowledgeArtifact[]
  skillArtifacts?: SkillArtifact[]
} = {}) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MirrorBrainProvider>
        <SeedState
          knowledgeArtifacts={options.knowledgeArtifacts}
          skillArtifacts={options.skillArtifacts}
        >
          {children}
        </SeedState>
      </MirrorBrainProvider>
    )
  }
}

describe('useArtifacts', () => {
  afterEach(() => {
    cleanup()
  })

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

  it('keeps generated knowledge available when the follow-up save fails', async () => {
    const reviewedMemories: ReviewedMemory[] = [
      {
        id: 'reviewed-save-failed',
        candidateMemoryId: 'candidate-save-failed',
        candidateTitle: 'Candidate title',
        candidateSummary: 'Candidate summary',
        candidateTheme: 'theme',
        memoryEventIds: ['event-save-failed'],
        reviewDate: '2026-05-10',
        decision: 'keep',
        reviewedAt: '2026-05-10T10:00:00.000Z',
      },
    ]

    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-draft:reviewed-save-failed',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Generated title',
      summary: 'Generated summary',
      body: 'Generated body',
      sourceReviewedMemoryIds: ['reviewed-save-failed'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-05-10T10:00:00.000Z',
      reviewedAt: '2026-05-10T09:00:00.000Z',
      recencyLabel: '2026-05-10',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-save-failed' }],
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
      saveKnowledgeArtifact: vi.fn(async () => {
        throw new Error('OpenViking save failed')
      }),
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
    expect(returnedArtifact).toEqual(generatedArtifact)
    expect(result.current.knowledgeArtifacts).toEqual([generatedArtifact])
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

  it('keeps already loaded knowledge artifacts when generating a new one', async () => {
    const existingKnowledge: KnowledgeArtifact = {
      id: 'knowledge-existing',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Existing knowledge',
      summary: 'Existing summary',
      body: 'Existing body',
      sourceReviewedMemoryIds: ['reviewed-existing'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-28T10:00:00.000Z',
      reviewedAt: '2026-04-28T09:00:00.000Z',
      recencyLabel: '2026-04-28',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-existing' }],
    }
    const generatedArtifact: KnowledgeArtifact = {
      id: 'knowledge-new',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'New knowledge',
      summary: 'New summary',
      body: 'New body',
      sourceReviewedMemoryIds: ['reviewed-new'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-29T10:00:00.000Z',
      reviewedAt: '2026-04-29T09:00:00.000Z',
      recencyLabel: '2026-04-29',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-new' }],
    }
    const savedArtifact: KnowledgeArtifact = {
      ...generatedArtifact,
      updatedAt: '2026-04-29T10:05:00.000Z',
    }
    const reviewedMemories: ReviewedMemory[] = [
      {
        id: 'reviewed-new',
        candidateMemoryId: 'candidate-new',
        candidateTitle: 'Candidate title',
        candidateSummary: 'Candidate summary',
        candidateTheme: 'theme',
        memoryEventIds: ['event-new'],
        reviewDate: '2026-04-29',
        decision: 'keep',
        reviewedAt: '2026-04-29T10:00:00.000Z',
      },
    ]

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

    const wrapper = createWrapper({ knowledgeArtifacts: [existingKnowledge] })
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    await act(async () => {
      await result.current.generateKnowledge(reviewedMemories)
    })

    expect(result.current.knowledgeArtifacts).toEqual([existingKnowledge, savedArtifact])
  })

  it('keeps already loaded skill artifacts when generating a new one', async () => {
    const existingSkill: SkillArtifact = {
      id: 'skill-existing',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed-existing'],
      executionSafetyMetadata: { requiresConfirmation: true },
      updatedAt: '2026-04-28T10:00:00.000Z',
    }
    const generatedArtifact: SkillArtifact = {
      id: 'skill-new',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed-new'],
      executionSafetyMetadata: { requiresConfirmation: true },
      updatedAt: '2026-04-29T10:00:00.000Z',
    }
    const savedArtifact: SkillArtifact = {
      ...generatedArtifact,
      updatedAt: '2026-04-29T10:05:00.000Z',
    }
    const reviewedMemories: ReviewedMemory[] = [
      {
        id: 'reviewed-new',
        candidateMemoryId: 'candidate-new',
        candidateTitle: 'Candidate title',
        candidateSummary: 'Candidate summary',
        candidateTheme: 'theme',
        memoryEventIds: ['event-new'],
        reviewDate: '2026-04-29',
        decision: 'keep',
        reviewedAt: '2026-04-29T10:00:00.000Z',
      },
    ]

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

    const wrapper = createWrapper({ skillArtifacts: [existingSkill] })
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    await act(async () => {
      await result.current.generateSkill(reviewedMemories)
    })

    expect(result.current.skillArtifacts).toEqual([existingSkill, savedArtifact])
  })

  it('deletes persisted knowledge and removes it from shared state', async () => {
    const existingKnowledge: KnowledgeArtifact = {
      id: 'knowledge-existing',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Existing knowledge',
      summary: 'Existing summary',
      body: 'Existing body',
      sourceReviewedMemoryIds: ['reviewed-existing'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-28T10:00:00.000Z',
      reviewedAt: '2026-04-28T09:00:00.000Z',
      recencyLabel: '2026-04-28',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-existing' }],
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
      generateSkill: vi.fn(),
      deleteKnowledgeArtifact: vi.fn(async () => undefined),
    } as unknown as MirrorBrainWebAppApi

    const wrapper = createWrapper({ knowledgeArtifacts: [existingKnowledge] })
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    await act(async () => {
      await result.current.deleteKnowledgeArtifact(existingKnowledge.id)
    })

    expect(api.deleteKnowledgeArtifact).toHaveBeenCalledWith(existingKnowledge.id)
    expect(result.current.knowledgeArtifacts).toEqual([])
  })

  it('deletes persisted skill and removes it from shared state', async () => {
    const existingSkill: SkillArtifact = {
      id: 'skill-existing',
      approvalState: 'draft',
      workflowEvidenceRefs: ['reviewed-existing'],
      executionSafetyMetadata: { requiresConfirmation: true },
      updatedAt: '2026-04-28T10:00:00.000Z',
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
      generateSkill: vi.fn(),
      deleteSkillArtifact: vi.fn(async () => undefined),
    } as unknown as MirrorBrainWebAppApi

    const wrapper = createWrapper({ skillArtifacts: [existingSkill] })
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    await act(async () => {
      await result.current.deleteSkillArtifact(existingSkill.id)
    })

    expect(api.deleteSkillArtifact).toHaveBeenCalledWith(existingSkill.id)
    expect(result.current.skillArtifacts).toEqual([])
  })

  it('replaces the approved knowledge draft with the published artifact in shared state', async () => {
    const draft: KnowledgeArtifact = {
      id: 'knowledge-draft:shared-lineage',
      draftState: 'draft',
      artifactType: 'daily-review-draft',
      title: 'Shared lineage knowledge',
      summary: 'Draft summary',
      body: 'Draft body',
      sourceReviewedMemoryIds: ['reviewed-shared'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-28T10:00:00.000Z',
      reviewedAt: '2026-04-28T09:00:00.000Z',
      recencyLabel: '2026-04-28',
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-shared' }],
    }
    const otherDraft: KnowledgeArtifact = {
      ...draft,
      id: 'knowledge-draft:other',
      title: 'Other draft',
      sourceReviewedMemoryIds: ['reviewed-other'],
      provenanceRefs: [{ kind: 'reviewed-memory', id: 'reviewed-other' }],
    }
    const publishedArtifact: KnowledgeArtifact = {
      ...draft,
      id: 'topic-knowledge:shared-lineage:v1',
      draftState: 'published',
      artifactType: 'topic-knowledge',
      title: 'Shared lineage knowledge',
      summary: 'Published summary',
      body: 'Published body',
      isCurrentBest: true,
      updatedAt: '2026-04-29T10:00:00.000Z',
      reviewedAt: '2026-04-29T09:00:00.000Z',
      recencyLabel: '2026-04-29',
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
      generateSkill: vi.fn(),
      approveKnowledge: vi.fn(async () => ({
        publishedArtifact,
        assignedTopic: { topicKey: 'shared-lineage', title: 'Shared lineage knowledge' },
      })),
    } as unknown as MirrorBrainWebAppApi

    const wrapper = createWrapper({ knowledgeArtifacts: [draft, otherDraft] })
    const { result } = renderHook(() => useArtifacts(api), { wrapper })

    await act(async () => {
      await result.current.approveKnowledge(draft)
    })

    expect(api.approveKnowledge).toHaveBeenCalledWith(draft)
    expect(result.current.knowledgeArtifacts).toEqual([otherDraft, publishedArtifact])
  })
})
