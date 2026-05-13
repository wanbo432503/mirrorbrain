// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MirrorBrainWebAppApi } from '../../api/client'
import WorkSessionAnalysisPanel from './WorkSessionAnalysisPanel'

afterEach(() => {
  cleanup()
})

describe('WorkSessionAnalysisPanel', () => {
  it('runs a manual analysis window and renders pending work-session candidates', async () => {
    const api = {
      analyzeWorkSessions: vi.fn(async () => ({
        analysisWindow: {
          preset: 'last-6-hours' as const,
          startAt: '2026-05-12T06:00:00.000Z',
          endAt: '2026-05-12T12:00:00.000Z',
        },
        generatedAt: '2026-05-12T12:00:00.000Z',
        candidates: [
          {
            id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
            projectHint: 'mirrorbrain',
            title: 'mirrorbrain work session',
            summary: 'Imported source ledgers and ran source tests.',
            memoryEventIds: ['browser-1', 'shell-1'],
            sourceTypes: ['browser', 'shell'],
            timeRange: {
              startAt: '2026-05-12T10:00:00.000Z',
              endAt: '2026-05-12T10:30:00.000Z',
            },
            relationHints: ['Phase 4 design', 'Run tests'],
            reviewState: 'pending' as const,
          },
        ],
        excludedMemoryEventIds: ['old-1'],
      })),
      reviewWorkSessionCandidate: vi.fn(async () => ({
        reviewedWorkSession: {
          id: 'reviewed-work-session:mirrorbrain',
          candidateId: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
          projectId: 'project:mirrorbrain',
          title: 'mirrorbrain work session',
          summary: 'Imported source ledgers and ran source tests.',
          memoryEventIds: ['browser-1', 'shell-1'],
          sourceTypes: ['browser', 'shell'],
          timeRange: {
            startAt: '2026-05-12T10:00:00.000Z',
            endAt: '2026-05-12T10:30:00.000Z',
          },
          relationHints: ['Phase 4 design', 'Run tests'],
          reviewState: 'reviewed',
          reviewedAt: '2026-05-12T12:05:00.000Z',
          reviewedBy: 'mirrorbrain-web',
        },
        project: {
          id: 'project:mirrorbrain',
          name: 'MirrorBrain',
          status: 'active',
          createdAt: '2026-05-12T12:05:00.000Z',
          updatedAt: '2026-05-12T12:05:00.000Z',
        },
      })),
      listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))

    await waitFor(() => {
      expect(api.analyzeWorkSessions).toHaveBeenCalledWith('last-6-hours')
    })
    expect(await screen.findAllByText('mirrorbrain work session')).toHaveLength(2)
    expect(screen.getAllByText('mirrorbrain').length).toBeGreaterThan(0)
    expect(screen.getAllByText('browser, shell').length).toBeGreaterThan(0)
    expect(screen.getByText('2 memory events')).not.toBeNull()
    expect(screen.getByText('1 excluded')).not.toBeNull()

    await user.clear(screen.getByLabelText('Project name for mirrorbrain work session'))
    await user.type(screen.getByLabelText('Project name for mirrorbrain work session'), 'MirrorBrain')
    await user.click(screen.getByRole('button', { name: 'Keep as project' }))

    expect(api.reviewWorkSessionCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z',
      }),
      {
        decision: 'keep',
        reviewedBy: 'mirrorbrain-web',
        title: 'mirrorbrain work session',
        summary: 'Imported source ledgers and ran source tests.',
        projectAssignment: {
          kind: 'confirmed-new-project',
          name: 'MirrorBrain',
        },
      },
    )
    expect(await screen.findByText('Reviewed into project: project:mirrorbrain')).not.toBeNull()
  })

  it('renders preview and published knowledge trees for the merged review flow', async () => {
    const api = {
      analyzeWorkSessions: vi.fn(async () => ({
        analysisWindow: {
          preset: 'last-6-hours' as const,
          startAt: '2026-05-12T06:00:00.000Z',
          endAt: '2026-05-12T12:00:00.000Z',
        },
        generatedAt: '2026-05-12T12:00:00.000Z',
        candidates: [
          {
            id: 'work-session-candidate:source-ledger',
            projectHint: 'mirrorbrain',
            title: 'Source ledger architecture',
            summary: 'Imported source ledgers and ran source tests.',
            memoryEventIds: ['browser-1', 'shell-1'],
            sourceTypes: ['browser', 'shell'],
            timeRange: {
              startAt: '2026-05-12T10:00:00.000Z',
              endAt: '2026-05-12T10:30:00.000Z',
            },
            relationHints: ['Source ledger', 'Run tests'],
            reviewState: 'pending' as const,
          },
        ],
        excludedMemoryEventIds: [],
      })),
      reviewWorkSessionCandidate: vi.fn(),
      listKnowledgeArticleTree: vi.fn(async () => ({
        projects: [
          {
            project: {
              id: 'project:mirrorbrain',
              name: 'MirrorBrain',
              status: 'active' as const,
              createdAt: '2026-05-12T12:00:00.000Z',
              updatedAt: '2026-05-12T12:00:00.000Z',
            },
            topics: [
              {
                topic: {
                  id: 'topic:project-mirrorbrain:source-ledger',
                  projectId: 'project:mirrorbrain',
                  name: 'Source ledger',
                  status: 'active' as const,
                  createdAt: '2026-05-12T12:00:00.000Z',
                  updatedAt: '2026-05-12T12:00:00.000Z',
                },
                articles: [
                  {
                    articleId: 'article:source-ledger',
                    title: 'Published source ledger',
                    currentBestArticle: null,
                    history: [],
                  },
                ],
              },
            ],
          },
        ],
      })),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    await waitFor(() => {
      expect(api.listKnowledgeArticleTree).toHaveBeenCalled()
    })
    await user.click(screen.getByRole('button', { name: 'Last 6h' }))

    const treeRail = await screen.findByTestId('work-session-tree-rail')
    expect(within(treeRail).getByRole('tab', { name: 'Preview' })).not.toBeNull()
    expect(within(treeRail).getByRole('tab', { name: 'Published' })).not.toBeNull()
    expect(within(treeRail).getByText('mirrorbrain')).not.toBeNull()
    expect(within(treeRail).getByText('Source ledger')).not.toBeNull()
    expect(within(treeRail).getByText('Source ledger architecture')).not.toBeNull()

    await user.click(within(treeRail).getByRole('tab', { name: 'Published' }))

    expect(within(treeRail).getByText('MirrorBrain')).not.toBeNull()
    expect(within(treeRail).getByText('Published source ledger')).not.toBeNull()
  })

  it('publishes preview knowledge through review, draft generation, and article publication', async () => {
    const candidate = {
      id: 'work-session-candidate:source-ledger',
      projectHint: 'mirrorbrain',
      title: 'Source ledger architecture',
      summary: 'Imported source ledgers and ran source tests.',
      memoryEventIds: ['browser-1', 'shell-1'],
      sourceTypes: ['browser', 'shell'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: ['Source ledger', 'Run tests'],
      reviewState: 'pending' as const,
    }
    const reviewedWorkSession = {
      id: 'reviewed-work-session:source-ledger',
      candidateId: candidate.id,
      projectId: 'project:mirrorbrain',
      title: candidate.title,
      summary: candidate.summary,
      memoryEventIds: candidate.memoryEventIds,
      sourceTypes: candidate.sourceTypes,
      timeRange: candidate.timeRange,
      relationHints: candidate.relationHints,
      reviewState: 'reviewed' as const,
      reviewedAt: '2026-05-12T12:05:00.000Z',
      reviewedBy: 'mirrorbrain-web',
    }
    const draft = {
      id: 'knowledge-article-draft:source-ledger',
      draftState: 'draft' as const,
      projectId: 'project:mirrorbrain',
      title: candidate.title,
      summary: candidate.summary,
      body: candidate.summary,
      topicProposal: { kind: 'new-topic' as const, name: 'Source ledger' },
      articleOperationProposal: { kind: 'create-new-article' as const },
      sourceReviewedWorkSessionIds: [reviewedWorkSession.id],
      sourceMemoryEventIds: candidate.memoryEventIds,
      provenanceRefs: [{ kind: 'reviewed-work-session' as const, id: reviewedWorkSession.id }],
      generatedAt: '2026-05-12T12:10:00.000Z',
    }
    const publishedTree = {
      projects: [
        {
          project: {
            id: 'project:mirrorbrain',
            name: 'MirrorBrain',
            status: 'active' as const,
            createdAt: '2026-05-12T12:00:00.000Z',
            updatedAt: '2026-05-12T12:00:00.000Z',
          },
          topics: [
            {
              topic: {
                id: 'topic:project-mirrorbrain:source-ledger',
                projectId: 'project:mirrorbrain',
                name: 'Source ledger',
                status: 'active' as const,
                createdAt: '2026-05-12T12:20:00.000Z',
                updatedAt: '2026-05-12T12:20:00.000Z',
              },
              articles: [
                {
                  articleId: 'article:source-ledger',
                  title: 'Source ledger architecture',
                  currentBestArticle: null,
                  history: [],
                },
              ],
            },
          ],
        },
      ],
    }
    const api = {
      analyzeWorkSessions: vi.fn(async () => ({
        analysisWindow: {
          preset: 'last-6-hours' as const,
          startAt: '2026-05-12T06:00:00.000Z',
          endAt: '2026-05-12T12:00:00.000Z',
        },
        generatedAt: '2026-05-12T12:00:00.000Z',
        candidates: [candidate],
        excludedMemoryEventIds: [],
      })),
      reviewWorkSessionCandidate: vi.fn(async () => ({
        reviewedWorkSession,
        project: {
          id: 'project:mirrorbrain',
          name: 'MirrorBrain',
          status: 'active' as const,
          createdAt: '2026-05-12T12:05:00.000Z',
          updatedAt: '2026-05-12T12:05:00.000Z',
        },
      })),
      generateKnowledgeArticleDraft: vi.fn(async () => draft),
      publishKnowledgeArticleDraft: vi.fn(async () => ({
        article: {
          id: 'knowledge-article:source-ledger:v1',
          articleId: 'article:source-ledger',
          projectId: 'project:mirrorbrain',
          topicId: 'topic:project-mirrorbrain:source-ledger',
          title: candidate.title,
          summary: candidate.summary,
          body: candidate.summary,
          version: 1,
          isCurrentBest: true,
          supersedesArticleId: null,
          sourceReviewedWorkSessionIds: [reviewedWorkSession.id],
          sourceMemoryEventIds: candidate.memoryEventIds,
          provenanceRefs: draft.provenanceRefs,
          publishState: 'published' as const,
          publishedAt: '2026-05-12T12:20:00.000Z',
          publishedBy: 'mirrorbrain-web',
        },
      })),
      listKnowledgeArticleTree: vi
        .fn()
        .mockResolvedValueOnce({ projects: [] })
        .mockResolvedValueOnce(publishedTree),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))
    await user.click(await screen.findByRole('button', { name: 'Publish' }))

    expect(api.reviewWorkSessionCandidate).toHaveBeenCalledWith(candidate, {
      decision: 'keep',
      reviewedBy: 'mirrorbrain-web',
      title: candidate.title,
      summary: candidate.summary,
      projectAssignment: {
        kind: 'confirmed-new-project',
        name: 'mirrorbrain',
      },
    })
    expect(api.generateKnowledgeArticleDraft).toHaveBeenCalledWith({
      reviewedWorkSessionIds: [reviewedWorkSession.id],
      title: candidate.title,
      summary: candidate.summary,
      body: candidate.summary,
      topicProposal: { kind: 'new-topic', name: 'Source ledger' },
      articleOperationProposal: { kind: 'create-new-article' },
    })
    expect(api.publishKnowledgeArticleDraft).toHaveBeenCalledWith({
      draft,
      publishedBy: 'mirrorbrain-web',
      topicAssignment: { kind: 'confirmed-new-topic', name: 'Source ledger' },
    })

    const treeRail = screen.getByTestId('work-session-tree-rail')
    await user.click(within(treeRail).getByRole('tab', { name: 'Published' }))
    expect(within(treeRail).getByText('Source ledger architecture')).not.toBeNull()
  })
})
