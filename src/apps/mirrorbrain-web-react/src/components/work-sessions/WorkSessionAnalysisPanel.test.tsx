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
  it('runs a manual analysis window and renders pending work-session candidates without standalone keep action', async () => {
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
      generateKnowledgeArticleDraft: vi.fn(),
      publishKnowledgeArticleDraft: vi.fn(),
      listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))

    await waitFor(() => {
      expect(api.analyzeWorkSessions).toHaveBeenCalledWith('last-6-hours')
    })
    expect(await screen.findAllByText('Phase 4 design')).toHaveLength(2)
    expect(screen.getAllByText('mirrorbrain').length).toBeGreaterThan(0)
    expect(screen.getByText('1 excluded')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Keep as project' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Generate knowledge for Phase 4 design' }))
    expect(await screen.findByRole('button', { name: 'Publish' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Keep as project' })).toBeNull()
    expect(api.reviewWorkSessionCandidate).not.toHaveBeenCalled()
    expect(api.generateKnowledgeArticleDraft).not.toHaveBeenCalled()
    expect(api.publishKnowledgeArticleDraft).not.toHaveBeenCalled()
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
    expect(within(treeRail).getByText('Knowledge not generated')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Generate knowledge for Source ledger' }),
    ).not.toBeNull()

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
      projectId: 'project:custom-research',
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
    const expectedPreviewBody = [
      '## Systematic knowledge',
      '',
      candidate.summary,
      '',
      '## References',
      '',
      '- [1] Source ledger (browser; memory event: browser-1)',
      '- [2] Run tests (shell; memory event: shell-1)',
    ].join('\n')
    const draft = {
      id: 'knowledge-article-draft:source-ledger',
      draftState: 'draft' as const,
      projectId: 'project:custom-research',
      title: candidate.title,
      summary: candidate.summary,
      body: expectedPreviewBody,
      topicProposal: { kind: 'new-topic' as const, name: 'Source ledger' },
      articleOperationProposal: { kind: 'create-new-article' as const },
      sourceReviewedWorkSessionIds: [reviewedWorkSession.id],
      sourceMemoryEventIds: candidate.memoryEventIds,
      provenanceRefs: [{ kind: 'reviewed-work-session' as const, id: reviewedWorkSession.id }],
      generatedAt: '2026-05-12T12:10:00.000Z',
    }
    const publishedArticle = {
      id: 'knowledge-article:source-ledger:v1',
      articleId: 'article:source-ledger',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:project-mirrorbrain:source-ledger',
      title: candidate.title,
      summary: candidate.summary,
      body: draft.body,
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: [reviewedWorkSession.id],
      sourceMemoryEventIds: candidate.memoryEventIds,
      provenanceRefs: draft.provenanceRefs,
      publishState: 'published' as const,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'mirrorbrain-web',
    }
    const publishedTree = {
      projects: [
        {
          project: {
            id: 'project:custom-research',
            name: 'Custom Research',
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
                  currentBestArticle: publishedArticle,
                  history: [publishedArticle],
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
          id: 'project:custom-research',
          name: 'Custom Research',
          status: 'active' as const,
          createdAt: '2026-05-12T12:05:00.000Z',
          updatedAt: '2026-05-12T12:05:00.000Z',
        },
      })),
      generateKnowledgeArticleDraft: vi.fn(async () => draft),
      publishKnowledgeArticleDraft: vi.fn(async () => ({
        article: publishedArticle,
      })),
      listKnowledgeArticleTree: vi
        .fn()
        .mockResolvedValueOnce({ projects: [] })
        .mockResolvedValueOnce(publishedTree),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()

    await user.click(
      await screen.findByRole('button', {
        name: 'Generate knowledge for Source ledger',
      }),
    )
    const knowledgeBody = await screen.findByTestId('preview-knowledge-body')
    expect(knowledgeBody.className).toContain('overflow-y-auto')
    expect(knowledgeBody.textContent).toContain('## Systematic knowledge')
    expect(knowledgeBody.textContent).toContain('## References')
    expect(knowledgeBody.textContent).toContain('Source ledger')
    expect(knowledgeBody.textContent).toContain('Run tests')
    expect(screen.queryByText('Associated memory events')).toBeNull()
    expect(screen.queryByText('Project')).toBeNull()
    expect(screen.queryByText('Topic')).toBeNull()
    expect(screen.queryByText('Sources')).toBeNull()
    expect(screen.queryByText('Provenance')).toBeNull()
    await user.clear(screen.getByLabelText('Project name for Source ledger'))
    await user.type(screen.getByLabelText('Project name for Source ledger'), 'Custom Research')
    await user.click(await screen.findByRole('button', { name: 'Publish' }))

    expect(api.reviewWorkSessionCandidate).toHaveBeenCalledWith(candidate, {
      decision: 'keep',
      reviewedBy: 'mirrorbrain-web',
      title: candidate.title,
      summary: candidate.summary,
      projectAssignment: {
        kind: 'confirmed-new-project',
        name: 'Custom Research',
      },
    })
    expect(api.generateKnowledgeArticleDraft).toHaveBeenCalledWith({
      reviewedWorkSessionIds: [reviewedWorkSession.id],
      title: candidate.title,
      summary: candidate.summary,
      body: expectedPreviewBody,
      topicProposal: { kind: 'new-topic', name: 'Source ledger' },
      articleOperationProposal: { kind: 'create-new-article' },
    })
    expect(api.publishKnowledgeArticleDraft).toHaveBeenCalledWith({
      draft,
      publishedBy: 'mirrorbrain-web',
      topicAssignment: { kind: 'confirmed-new-topic', name: 'Source ledger' },
    })

    const treeRail = screen.getByTestId('work-session-tree-rail')
    expect(within(treeRail).getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(within(treeRail).getByRole('tab', { name: 'Published' }).getAttribute('aria-selected')).toBe(
      'false',
    )
    expect(await screen.findByText('Published preview knowledge.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(within(treeRail).queryByText('Source ledger architecture')).toBeNull()
    expect(screen.queryByTestId('published-knowledge-panel')).toBeNull()

    await user.click(within(treeRail).getByRole('tab', { name: 'Published' }))
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain(
      'Source ledger architecture',
    )
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain(
      'Custom Research / Source ledger',
    )
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain(
      expectedPreviewBody,
    )
  })

  it('deletes published knowledge from the Published panel and refreshes the tree', async () => {
    const publishedArticle = {
      id: 'knowledge-article:source-ledger:v1',
      articleId: 'article:project-mirrorbrain:topic-source-ledger:source-ledger',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:project-mirrorbrain:source-ledger',
      title: 'Source ledger architecture',
      summary: 'How source ledgers feed memory.',
      body: 'Source ledgers are the acquisition boundary.',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:source-ledger'],
      sourceMemoryEventIds: ['browser-1'],
      provenanceRefs: [],
      publishState: 'published' as const,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'mirrorbrain-web',
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
                  articleId: publishedArticle.articleId,
                  title: publishedArticle.title,
                  currentBestArticle: publishedArticle,
                  history: [publishedArticle],
                },
              ],
            },
          ],
        },
      ],
    }
    const api = {
      analyzeWorkSessions: vi.fn(),
      reviewWorkSessionCandidate: vi.fn(),
      generateKnowledgeArticleDraft: vi.fn(),
      publishKnowledgeArticleDraft: vi.fn(),
      deleteKnowledgeArticle: vi.fn(async () => undefined),
      listKnowledgeArticleTree: vi
        .fn()
        .mockResolvedValueOnce(publishedTree)
        .mockResolvedValueOnce({ projects: [] }),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    const treeRail = await screen.findByTestId('work-session-tree-rail')
    await user.click(within(treeRail).getByRole('tab', { name: 'Published' }))
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain(
      'Source ledger architecture',
    )

    await user.click(
      screen.getByRole('button', { name: 'Delete published knowledge Source ledger architecture' }),
    )

    expect(api.deleteKnowledgeArticle).toHaveBeenCalledWith(publishedArticle.articleId)
    expect(await screen.findByText('Deleted published knowledge.')).not.toBeNull()
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain(
      'No published knowledge articles yet.',
    )
    expect(within(treeRail).queryByText('Source ledger architecture')).toBeNull()
  })

  it('discards a preview work-session candidate and removes it from preview', async () => {
    const candidate = {
      id: 'work-session-candidate:discard-me',
      projectHint: 'mirrorbrain',
      title: 'Disposable candidate',
      summary: 'This candidate should be removed from preview.',
      memoryEventIds: ['browser-1'],
      sourceTypes: ['browser'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: ['Disposable topic'],
      reviewState: 'pending' as const,
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
        reviewedWorkSession: {
          id: 'reviewed-work-session:discard-me',
          candidateId: candidate.id,
          projectId: null,
          title: candidate.title,
          summary: candidate.summary,
          memoryEventIds: candidate.memoryEventIds,
          sourceTypes: candidate.sourceTypes,
          timeRange: candidate.timeRange,
          relationHints: candidate.relationHints,
          reviewState: 'discarded' as const,
          reviewedAt: '2026-05-12T12:05:00.000Z',
          reviewedBy: 'mirrorbrain-web',
        },
      })),
      listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))
    expect(await screen.findAllByText('Disposable topic')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(api.reviewWorkSessionCandidate).toHaveBeenCalledWith(candidate, {
      decision: 'discard',
      reviewedBy: 'mirrorbrain-web',
      title: candidate.title,
      summary: candidate.summary,
    })
    expect(await screen.findByText('Discarded work session.')).not.toBeNull()
    expect(screen.queryByText('Disposable topic')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })
})
