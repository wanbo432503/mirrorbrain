// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MirrorBrainWebAppApi } from '../../api/client'
import type { WorkSessionCandidate } from '../../types'
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
            evidenceItems: [
              {
                memoryEventId: 'browser-1',
                sourceType: 'browser',
                title: 'Phase 4 design',
                url: 'https://docs.example.test/phase-4',
                excerpt: 'Phase 4 design context.',
              },
              {
                memoryEventId: 'shell-1',
                sourceType: 'file-activity',
                title: 'Run tests',
                filePath: '/tmp/mirrorbrain/test.log',
                excerpt: 'Ran source tests.',
              },
            ],
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
      generateKnowledgeArticlePreview: vi.fn(async ({ candidate }: { candidate: WorkSessionCandidate }) => ({
        candidateId: candidate.id,
        title: candidate.title,
        summary: candidate.summary,
        body: '# Phase 4 design\n\n## Core insight\nGenerated preview knowledge.',
        knowledgeType: 'systematic-knowledge' as const,
        sourceTypes: candidate.sourceTypes,
        memoryEventCount: candidate.memoryEventIds.length,
      })),
      generateKnowledgeArticleDraft: vi.fn(),
      publishKnowledgeArticleDraft: vi.fn(),
      listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} mode="preview" />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))

    await waitFor(() => {
      expect(api.analyzeWorkSessions).toHaveBeenCalledWith('last-6-hours')
    })
    expect(await screen.findAllByText('Phase 4 design')).toHaveLength(2)
    expect(screen.getByText('Run tests')).not.toBeNull()
    expect(screen.getByText('browser')).not.toBeNull()
    expect(screen.getByText('files')).not.toBeNull()
    expect(screen.queryByText('Imported source ledgers and ran source tests.')).toBeNull()
    expect(screen.getByDisplayValue('mirrorbrain')).not.toBeNull()
    expect(screen.getByText('1 excluded')).not.toBeNull()
    expect(screen.getByTestId('preview-candidate-list').className).toContain('overflow-y-auto')
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Keep as project' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Generate knowledge for Phase 4 design' }))
    expect(await screen.findByRole('button', { name: 'Publish' })).not.toBeNull()
    expect(screen.queryByText('Run tests')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Keep as project' })).toBeNull()
    expect(api.reviewWorkSessionCandidate).not.toHaveBeenCalled()
    expect(api.generateKnowledgeArticleDraft).not.toHaveBeenCalled()
    expect(api.publishKnowledgeArticleDraft).not.toHaveBeenCalled()
  })

  it('deduplicates preview memory events and expands them five at a time', async () => {
    const candidate: WorkSessionCandidate = {
      id: 'work-session-candidate:dedupe',
      projectHint: 'research',
      title: 'Deduped topic',
      summary: 'Repeated evidence should be compact.',
      memoryEventIds: ['event-1', 'event-dup', 'event-2', 'event-3', 'event-4', 'event-5', 'event-6'],
      sourceTypes: ['browser'],
      timeRange: {
        startAt: '2026-05-12T10:00:00.000Z',
        endAt: '2026-05-12T10:30:00.000Z',
      },
      relationHints: [],
      evidenceItems: [
        {
          memoryEventId: 'event-1',
          sourceType: 'browser',
          title: 'Repeated paper',
          excerpt: 'First copy.',
        },
        {
          memoryEventId: 'event-dup',
          sourceType: 'browser',
          title: 'Repeated paper',
          excerpt: 'Duplicate copy.',
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          memoryEventId: `event-${index + 2}`,
          sourceType: 'browser',
          title: `Unique event ${index + 2}`,
          excerpt: `Unique excerpt ${index + 2}.`,
        })),
      ],
      reviewState: 'pending',
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
      listKnowledgeArticleTree: vi.fn(async () => ({ projects: [] })),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} mode="preview" />)

    await user.click(screen.getByRole('button', { name: 'Last 6h' }))

    expect(await screen.findAllByText('Repeated paper')).toHaveLength(1)
    expect(screen.getByText('Unique event 5')).not.toBeNull()
    expect(screen.queryByText('Unique event 6')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Show 5 more memory events/ }))

    expect(screen.getByText('Unique event 6')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Show 5 more memory events/ })).toBeNull()
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

    expect(screen.queryByTestId('work-session-tree-rail')).toBeNull()
    expect(screen.getAllByText('Source ledger').length).toBeGreaterThan(0)
    expect(screen.getByText('Knowledge has not been generated for this topic.')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Generate knowledge for Source ledger' }),
    ).not.toBeNull()

    cleanup()
    render(<WorkSessionAnalysisPanel api={api} mode="published" />)
    const publishedTreeRail = await screen.findByTestId('work-session-tree-rail')

    expect(within(publishedTreeRail).getByText('MirrorBrain')).not.toBeNull()
    expect(within(publishedTreeRail).getByText('Published source ledger')).not.toBeNull()
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
    const expectedPreviewBody = '# Source ledger architecture\n\n## Core insight\nLLM synthesized source ledger knowledge.'
    const previewKnowledge = {
      candidateId: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      body: expectedPreviewBody,
      knowledgeType: 'systematic-knowledge' as const,
      sourceTypes: candidate.sourceTypes,
      memoryEventCount: candidate.memoryEventIds.length,
      candidate,
    }
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
      generateKnowledgeArticlePreview: vi.fn(async () => previewKnowledge),
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
    expect(knowledgeBody.textContent).toContain('## Core insight')
    expect(knowledgeBody.textContent).toContain('LLM synthesized source ledger knowledge.')
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
    expect(api.generateKnowledgeArticlePreview).toHaveBeenCalledWith({
      candidate,
      topicName: 'Source ledger',
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
      autoResolvePublishDecision: true,
    })

    expect(await screen.findByText('Published preview knowledge.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByTestId('work-session-tree-rail')).toBeNull()
    expect(screen.queryByText('Source ledger architecture')).toBeNull()
    expect(screen.queryByTestId('published-knowledge-panel')).toBeNull()
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

    render(<WorkSessionAnalysisPanel api={api} mode="published" />)

    const treeRail = await screen.findByTestId('work-session-tree-rail')
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

  it('renders Published as a collapsible project topic knowledge tree and opens the clicked article', async () => {
    const firstArticle = {
      id: 'knowledge-article:alpha:v1',
      articleId: 'article:alpha',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:project-mirrorbrain:source-ledger',
      title: 'Alpha article',
      summary: 'Alpha summary.',
      body: '# Alpha article\n\nAlpha body.',
      version: 1,
      isCurrentBest: true,
      supersedesArticleId: null,
      sourceReviewedWorkSessionIds: ['reviewed-work-session:alpha'],
      sourceMemoryEventIds: ['browser-1'],
      provenanceRefs: [],
      publishState: 'published' as const,
      publishedAt: '2026-05-12T12:20:00.000Z',
      publishedBy: 'mirrorbrain-web',
    }
    const secondArticle = {
      ...firstArticle,
      id: 'knowledge-article:beta:v1',
      articleId: 'article:beta',
      title: 'Beta article',
      summary: 'Beta summary.',
      body: '# Beta article\n\nBeta body.',
      sourceReviewedWorkSessionIds: ['reviewed-work-session:beta'],
    }
    const api = {
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
                  createdAt: '2026-05-12T12:20:00.000Z',
                  updatedAt: '2026-05-12T12:20:00.000Z',
                },
                articles: [
                  {
                    articleId: firstArticle.articleId,
                    title: firstArticle.title,
                    currentBestArticle: firstArticle,
                    history: [firstArticle],
                  },
                  {
                    articleId: secondArticle.articleId,
                    title: secondArticle.title,
                    currentBestArticle: secondArticle,
                    history: [secondArticle],
                  },
                ],
              },
            ],
          },
        ],
      })),
      deleteKnowledgeArticle: vi.fn(),
      reviseKnowledgeArticle: vi.fn(),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} mode="published" />)

    const treeRail = await screen.findByTestId('work-session-tree-rail')
    expect(
      within(treeRail)
        .getByRole('button', { name: /MirrorBrain/ })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    expect(
      within(treeRail)
        .getByRole('button', { name: /Source ledger/ })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain('Alpha body.')
    expect(within(treeRail).queryByText(/version/i)).toBeNull()
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain('Version 1')
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain('1 version')

    await user.click(within(treeRail).getByRole('button', { name: /Beta article/ }))

    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain('Beta body.')
    expect(screen.getByTestId('published-knowledge-panel').textContent).not.toContain('Alpha body.')

    await user.click(within(treeRail).getByRole('button', { name: /Source ledger/ }))
    expect(within(treeRail).queryByRole('button', { name: /Beta article/ })).toBeNull()
  })

  it('sends revision feedback for the selected published article and refreshes the article body', async () => {
    const publishedArticle = {
      id: 'knowledge-article:source-ledger:v1',
      articleId: 'article:source-ledger',
      projectId: 'project:mirrorbrain',
      topicId: 'topic:project-mirrorbrain:source-ledger',
      title: 'Source ledger architecture',
      summary: 'How source ledgers feed memory.',
      body: '# Source ledger architecture\n\nOriginal body.',
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
    const revisedArticle = {
      ...publishedArticle,
      id: 'knowledge-article:source-ledger:v2',
      body: '# Source ledger architecture\n\nRevised body.',
      version: 2,
      supersedesArticleId: publishedArticle.id,
      publishedAt: '2026-05-12T12:30:00.000Z',
    }
    const originalTree = {
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
    const revisedTree = {
      projects: [
        {
          ...originalTree.projects[0],
          topics: [
            {
              ...originalTree.projects[0].topics[0],
              articles: [
                {
                  articleId: revisedArticle.articleId,
                  title: revisedArticle.title,
                  currentBestArticle: revisedArticle,
                  history: [revisedArticle, { ...publishedArticle, isCurrentBest: false }],
                },
              ],
            },
          ],
        },
      ],
    }
    const api = {
      listKnowledgeArticleTree: vi
        .fn()
        .mockResolvedValueOnce(originalTree)
        .mockResolvedValueOnce(revisedTree),
      reviseKnowledgeArticle: vi.fn(async () => ({
        article: revisedArticle,
        supersededArticle: { ...publishedArticle, isCurrentBest: false },
      })),
      deleteKnowledgeArticle: vi.fn(),
    } as unknown as MirrorBrainWebAppApi
    const user = userEvent.setup()

    render(<WorkSessionAnalysisPanel api={api} mode="published" />)

    expect(await screen.findByText('Original body.')).not.toBeNull()
    await user.type(screen.getByLabelText('Revision Request'), 'Make the conclusion sharper.')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(api.reviseKnowledgeArticle).toHaveBeenCalledWith({
      projectId: publishedArticle.projectId,
      topicId: publishedArticle.topicId,
      articleId: publishedArticle.articleId,
      instruction: 'Make the conclusion sharper.',
      revisedBy: 'mirrorbrain-web',
    })
    expect(await screen.findByText('Revised published knowledge.')).not.toBeNull()
    expect(screen.getByTestId('published-knowledge-panel').textContent).toContain('Revised body.')
    expect((screen.getByLabelText('Revision Request') as HTMLInputElement).value).toBe('')
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
