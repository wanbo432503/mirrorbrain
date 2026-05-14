import { useCallback, useEffect, useMemo, useState } from 'react'

import type { MirrorBrainWebAppApi } from '../../api/client'
import { KnowledgeMarkdownRenderer } from '../artifacts/KnowledgeMarkdownRenderer'
import type {
  AnalysisWindowPreset,
  KnowledgeArticle,
  KnowledgeArticleTree,
  WorkSessionCandidate,
  WorkSessionAnalysisResult,
} from '../../types'
import {
  buildWorkSessionPreviewTree,
  type WorkSessionPreviewKnowledgeNode,
  type WorkSessionPreviewProjectNode,
  type WorkSessionPreviewTopicNode,
} from './work-session-preview-tree'

interface WorkSessionAnalysisPanelProps {
  api: MirrorBrainWebAppApi
  mode?: 'preview' | 'published'
  active?: boolean
}

const ANALYSIS_WINDOWS: Array<{
  label: string
  preset: AnalysisWindowPreset
}> = [
  { label: 'Last 6h', preset: 'last-6-hours' },
  { label: 'Last 24h', preset: 'last-24-hours' },
  { label: 'Last 7d', preset: 'last-7-days' },
]

function formatWindow(result: WorkSessionAnalysisResult): string {
  return `${result.analysisWindow.startAt} to ${result.analysisWindow.endAt}`
}

function formatVersionCount(count: number): string {
  return count === 1 ? '1 version' : `${count} versions`
}

function TreeChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-5 w-5 shrink-0 place-items-center rounded border border-slate-200 bg-canvas text-inkMuted transition-transform duration-150 ${
        expanded ? 'rotate-90' : ''
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="M6 4l4 4-4 4" />
      </svg>
    </span>
  )
}

export default function WorkSessionAnalysisPanel({
  api,
  mode = 'preview',
  active = true,
}: WorkSessionAnalysisPanelProps) {
  const isPreviewMode = mode === 'preview'
  const [analysis, setAnalysis] = useState<WorkSessionAnalysisResult | null>(null)
  const [runningPreset, setRunningPreset] = useState<AnalysisWindowPreset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publishedTree, setPublishedTree] = useState<KnowledgeArticleTree>({
    projects: [],
  })
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null)
  const [generatingCandidateId, setGeneratingCandidateId] = useState<string | null>(null)
  const [publishingCandidateId, setPublishingCandidateId] = useState<string | null>(null)
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null)
  const [revisingArticleId, setRevisingArticleId] = useState<string | null>(null)
  const [revisionInstruction, setRevisionInstruction] = useState('')
  const [selectedPublishedArticleId, setSelectedPublishedArticleId] = useState<string | null>(null)
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set())
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(() => new Set())
  const [generatedKnowledgeByCandidateId, setGeneratedKnowledgeByCandidateId] =
    useState<Record<string, WorkSessionPreviewKnowledgeNode>>({})
  const [removedPreviewCandidateIds, setRemovedPreviewCandidateIds] = useState<
    Set<string>
  >(() => new Set())
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const activePreviewCandidates = useMemo(
    () =>
      (analysis?.candidates ?? []).filter(
        (candidate) => !removedPreviewCandidateIds.has(candidate.id),
      ),
    [analysis, removedPreviewCandidateIds],
  )
  const previewTree = useMemo(
    () => buildWorkSessionPreviewTree(activePreviewCandidates),
    [activePreviewCandidates],
  )
  const previewTopicItems = useMemo(
    () =>
      previewTree.projects.flatMap((project) =>
        project.topics.map((topic) => ({
          project,
          topic,
          knowledge: generatedKnowledgeByCandidateId[topic.candidate.id],
        })),
      ),
    [generatedKnowledgeByCandidateId, previewTree],
  )
  const publishedArticleItems = useMemo(
    () =>
      publishedTree.projects.flatMap((projectNode) =>
        projectNode.topics.flatMap((topicNode) =>
          topicNode.articles.map((articleNode) => ({
            projectNode,
            topicNode,
            articleNode,
            article:
              articleNode.currentBestArticle ??
              articleNode.history.find((article) => article.isCurrentBest) ??
              articleNode.history[0] ??
              null,
          })),
        ),
      ),
    [publishedTree],
  )
  const selectedPublishedItem = useMemo(() => {
    if (publishedArticleItems.length === 0) {
      return null
    }

    return (
      publishedArticleItems.find(
        (item) => item.articleNode.articleId === selectedPublishedArticleId,
      ) ?? publishedArticleItems[0]
    )
  }, [publishedArticleItems, selectedPublishedArticleId])

  const loadPublishedTree = useCallback(async () => {
    try {
      setPublishedTree(await api.listKnowledgeArticleTree())
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to load published knowledge tree.',
      )
    }
  }, [api])

  useEffect(() => {
    if (active) {
      void loadPublishedTree()
    }
  }, [active, loadPublishedTree])

  useEffect(() => {
    const firstItem = publishedArticleItems[0]

    if (firstItem === undefined) {
      setSelectedPublishedArticleId(null)
      return
    }

    setSelectedPublishedArticleId((current) =>
      current !== null &&
      publishedArticleItems.some((item) => item.articleNode.articleId === current)
        ? current
        : firstItem.articleNode.articleId,
    )
    setExpandedProjectIds((current) => {
      if (current.has(firstItem.projectNode.project.id)) {
        return current
      }

      const next = new Set(current)
      next.add(firstItem.projectNode.project.id)
      return next
    })
    setExpandedTopicIds((current) => {
      if (current.has(firstItem.topicNode.topic.id)) {
        return current
      }

      const next = new Set(current)
      next.add(firstItem.topicNode.topic.id)
      return next
    })
  }, [publishedArticleItems])

  const runAnalysis = async (preset: AnalysisWindowPreset) => {
    setRunningPreset(preset)
    setError(null)
    setActionFeedback(null)

    try {
      const result = await api.analyzeWorkSessions(preset)
      setAnalysis(result)
      setProjectNames({})
      setGeneratedKnowledgeByCandidateId({})
      setRemovedPreviewCandidateIds(new Set())
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to analyze work sessions.'
      )
    } finally {
      setRunningPreset(null)
    }
  }

  const discardCandidate = async (candidate: WorkSessionCandidate) => {
    setReviewingCandidateId(candidate.id)
    setError(null)
    setActionFeedback(null)

    try {
      await api.reviewWorkSessionCandidate(candidate, {
        decision: 'discard',
        reviewedBy: 'mirrorbrain-web',
        title: candidate.title,
        summary: candidate.summary,
      })

      setRemovedPreviewCandidateIds((current) => {
        const next = new Set(current)
        next.add(candidate.id)
        return next
      })
      setActionFeedback('Discarded work session.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to review work session.'
      )
    } finally {
      setReviewingCandidateId(null)
    }
  }

  const publishPreviewKnowledge = async (
    project: WorkSessionPreviewProjectNode,
    topic: WorkSessionPreviewTopicNode,
    knowledge: WorkSessionPreviewKnowledgeNode,
  ) => {
    const candidate = knowledge.candidate
    setPublishingCandidateId(candidate.id)
    setError(null)
    setActionFeedback(null)

    try {
      const projectName = projectNames[candidate.id]?.trim() || project.projectName
      const topicName = topic.topicName
      const reviewResult = await api.reviewWorkSessionCandidate(candidate, {
        decision: 'keep',
        reviewedBy: 'mirrorbrain-web',
        title: knowledge.title,
        summary: knowledge.summary,
        projectAssignment: {
          kind: 'confirmed-new-project',
          name: projectName,
        },
      })
      const draft = await api.generateKnowledgeArticleDraft({
        reviewedWorkSessionIds: [reviewResult.reviewedWorkSession.id],
        title: knowledge.title,
        summary: knowledge.summary,
        body: knowledge.body,
        topicProposal: {
          kind: 'new-topic',
          name: topicName,
        },
        articleOperationProposal: {
          kind: 'create-new-article',
        },
      })

      await api.publishKnowledgeArticleDraft({
        draft,
        publishedBy: 'mirrorbrain-web',
        topicAssignment: {
          kind: 'confirmed-new-topic',
          name: topicName,
        },
      })

      setPublishedTree(await api.listKnowledgeArticleTree())
      setRemovedPreviewCandidateIds((current) => {
        const next = new Set(current)
        next.add(candidate.id)
        return next
      })
      setActionFeedback('Published preview knowledge.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to publish preview knowledge.'
      )
    } finally {
      setPublishingCandidateId(null)
    }
  }

  const generatePreviewKnowledge = async (topic: WorkSessionPreviewTopicNode) => {
    setGeneratingCandidateId(topic.candidate.id)
    setError(null)
    setActionFeedback(null)

    try {
      const preview = await api.generateKnowledgeArticlePreview({
        candidate: topic.candidate,
        topicName: topic.topicName,
      })

      setGeneratedKnowledgeByCandidateId((current) => ({
        ...current,
        [topic.candidate.id]: {
          ...preview,
          candidate: topic.candidate,
        },
      }))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to generate preview knowledge.'
      )
    } finally {
      setGeneratingCandidateId(null)
    }
  }

  const deletePublishedKnowledge = async (articleId: string) => {
    setDeletingArticleId(articleId)
    setError(null)
    setActionFeedback(null)

    try {
      await api.deleteKnowledgeArticle(articleId)
      setPublishedTree(await api.listKnowledgeArticleTree())
      setActionFeedback('Deleted published knowledge.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to delete published knowledge.',
      )
    } finally {
      setDeletingArticleId(null)
    }
  }

  const revisePublishedKnowledge = async (article: KnowledgeArticle) => {
    const instruction = revisionInstruction.trim()

    if (instruction.length === 0) {
      return
    }

    setRevisingArticleId(article.articleId)
    setError(null)
    setActionFeedback(null)

    try {
      await api.reviseKnowledgeArticle({
        projectId: article.projectId,
        topicId: article.topicId,
        articleId: article.articleId,
        instruction,
        revisedBy: 'mirrorbrain-web',
      })
      setPublishedTree(await api.listKnowledgeArticleTree())
      setRevisionInstruction('')
      setActionFeedback('Revised published knowledge.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to revise published knowledge.',
      )
    } finally {
      setRevisingArticleId(null)
    }
  }

  const toggleProject = (projectId: string) => {
    setExpandedProjectIds((current) => {
      const next = new Set(current)

      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }

      return next
    })
  }

  const toggleTopic = (topicId: string) => {
    setExpandedTopicIds((current) => {
      const next = new Set(current)

      if (next.has(topicId)) {
        next.delete(topicId)
      } else {
        next.add(topicId)
      }

      return next
    })
  }

  const renderPreviewTree = () => {
    if (previewTree.projects.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-inkMuted">
          Run an analysis window to generate preview knowledge.
        </p>
      )
    }

    return (
      <div className="grid gap-sm">
        {previewTree.projects.map((project) => (
          <div key={project.projectKey} className="grid gap-xs">
            <div className="text-sm font-semibold text-ink">{project.projectName}</div>
            {project.topics.map((topic) => (
              <div key={topic.topicKey} className="ml-3 grid gap-xs border-l border-slate-200 pl-3">
                <div className="text-sm font-medium text-ink">{topic.topicName}</div>
                {generatedKnowledgeByCandidateId[topic.candidate.id] ? (
                  <button
                    type="button"
                    className="min-w-0 rounded border border-slate-200 bg-canvas px-3 py-2 text-left text-sm text-ink transition-colors hover:border-primary"
                  >
                    <span className="block break-words font-medium">
                      {generatedKnowledgeByCandidateId[topic.candidate.id].title}
                    </span>
                    <span className="mt-1 block text-xs text-inkMuted">
                      generated knowledge ·{' '}
                      {generatedKnowledgeByCandidateId[topic.candidate.id].knowledgeType}
                    </span>
                  </button>
                ) : (
                  <span className="rounded border border-dashed border-slate-200 px-3 py-2 text-xs text-inkMuted">
                    Knowledge not generated
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const renderPublishedTree = () => {
    if (publishedTree.projects.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-inkMuted">
          No published knowledge articles yet.
        </p>
      )
    }

    return (
      <div className="grid gap-sm">
        {publishedTree.projects.map((projectNode) => (
          <div key={projectNode.project.id} className="grid gap-xs">
            <button
              type="button"
              aria-expanded={expandedProjectIds.has(projectNode.project.id)}
              onClick={() => toggleProject(projectNode.project.id)}
              className="flex min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-sm font-semibold text-ink transition-colors hover:bg-slate-100"
            >
              <TreeChevron expanded={expandedProjectIds.has(projectNode.project.id)} />
              <span className="min-w-0 flex-1 truncate">{projectNode.project.name}</span>
              <span className="shrink-0 text-xs font-normal text-inkMuted">
                {projectNode.topics.length}
              </span>
            </button>

            {expandedProjectIds.has(projectNode.project.id) &&
              projectNode.topics.map((topicNode) => (
                <div
                  key={topicNode.topic.id}
                  className="ml-3 grid gap-xs border-l border-slate-200 pl-3"
                >
                  <button
                    type="button"
                    aria-expanded={expandedTopicIds.has(topicNode.topic.id)}
                    onClick={() => toggleTopic(topicNode.topic.id)}
                    className="flex min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-sm font-medium text-ink transition-colors hover:bg-slate-100"
                  >
                    <TreeChevron expanded={expandedTopicIds.has(topicNode.topic.id)} />
                    <span className="min-w-0 flex-1 truncate">{topicNode.topic.name}</span>
                    <span className="shrink-0 text-xs font-normal text-inkMuted">
                      {topicNode.articles.length}
                    </span>
                  </button>

                  {expandedTopicIds.has(topicNode.topic.id) &&
                    topicNode.articles.map((articleNode) => {
                      const selected =
                        selectedPublishedItem?.articleNode.articleId === articleNode.articleId

                      return (
                        <button
                          key={articleNode.articleId}
                          type="button"
                          data-testid="published-tree-knowledge-item"
                          onClick={() => setSelectedPublishedArticleId(articleNode.articleId)}
                          className={`min-w-0 rounded border px-3 py-2 text-left text-sm text-ink transition-colors ${
                            selected
                              ? 'border-primary bg-canvas'
                              : 'border-slate-200 bg-slate-50 hover:border-primary hover:bg-canvas'
                          }`}
                        >
                          <span className="block truncate font-medium">{articleNode.title}</span>
                        </button>
                      )
                    })}
                </div>
              ))}
          </div>
        ))}
      </div>
    )
  }

  const renderPublishedKnowledgePanel = () => {
    if (publishedArticleItems.length === 0) {
      return (
        <div
          data-testid="published-knowledge-panel"
          className="rounded border border-slate-200 px-4 py-8 text-center text-sm text-inkMuted"
        >
          No published knowledge articles yet.
        </div>
      )
    }

    if (selectedPublishedItem === null) {
      return null
    }

    const { projectNode, topicNode, articleNode, article } = selectedPublishedItem

    return (
      <article
        data-testid="published-knowledge-panel"
        className="flex h-full min-h-0 flex-col rounded border border-slate-200 bg-canvas"
      >
        <div className="flex flex-wrap items-start justify-between gap-sm border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="break-words font-heading text-lg font-semibold text-ink">
              {articleNode.title}
            </h3>
            <p className="mt-1 text-sm text-inkMuted">
              {projectNode.project.name} / {topicNode.topic.name}
            </p>
            {article && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-inkMuted">
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">
                  Version {article.version}
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">
                  {formatVersionCount(articleNode.history.length)}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={`Delete published knowledge ${articleNode.title}`}
            className="h-8 rounded border border-red-200 px-3 text-sm font-medium text-red-700 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
            disabled={deletingArticleId !== null || revisingArticleId !== null}
            onClick={() => void deletePublishedKnowledge(articleNode.articleId)}
          >
            {deletingArticleId === articleNode.articleId ? 'Deleting' : 'Delete'}
          </button>
        </div>

        {article ? (
          <>
            <div className="min-h-[32vh] flex-1 overflow-y-auto bg-slate-50 px-4 py-4 text-sm leading-6 text-ink">
              <KnowledgeMarkdownRenderer body={article.body} knowledgeId={article.id} />
            </div>
            <form
              className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-canvas px-3 py-2"
              onSubmit={(event) => {
                event.preventDefault()
                void revisePublishedKnowledge(article)
              }}
            >
              <input
                id="published-knowledge-revision-instruction"
                aria-label="Revision Request"
                value={revisionInstruction}
                onChange={(event) => setRevisionInstruction(event.target.value)}
                placeholder="Tell MirrorBrain how this knowledge article should change..."
                className="h-9 min-w-0 flex-1 rounded border border-slate-300 bg-canvas px-3 font-body text-sm text-ink outline-none transition-colors placeholder:text-inkMuted-48 focus:border-primary focus:ring-2 focus:ring-primary-focus focus:ring-offset-1"
              />
              <button
                type="submit"
                className="h-9 shrink-0 rounded border border-primary bg-primary px-4 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                disabled={
                  revisionInstruction.trim().length === 0 ||
                  revisingArticleId !== null ||
                  deletingArticleId !== null
                }
              >
                {revisingArticleId === article.articleId ? 'Revising' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="m-4 rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-inkMuted">
            Published article content is not available in the current tree response.
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-md px-md pb-md">
      <header className="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">
            {isPreviewMode ? 'Preview' : 'Published'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-inkMuted">
            {isPreviewMode
              ? 'Work-session windows generate preview knowledge for project and topic review.'
              : 'Published knowledge organized by project and topic.'}
          </p>
        </div>

        {isPreviewMode && (
          <div className="grid grid-cols-3 gap-xs">
            {ANALYSIS_WINDOWS.map((window) => (
              <button
                key={window.preset}
                type="button"
                className="h-9 min-w-20 rounded border border-slate-300 px-3 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-60"
                disabled={runningPreset !== null}
                onClick={() => void runAnalysis(window.preset)}
              >
                {runningPreset === window.preset ? 'Running' : window.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionFeedback && (
        <div
          role="status"
          className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {actionFeedback}
        </div>
      )}

      {isPreviewMode && analysis && (
        <div className="flex flex-wrap items-center gap-sm text-xs text-inkMuted">
          <span className="rounded border border-slate-200 px-2 py-1">
            {formatWindow(analysis)}
          </span>
          <span className="rounded border border-slate-200 px-2 py-1">
            {activePreviewCandidates.length} candidates
          </span>
          <span className="rounded border border-slate-200 px-2 py-1">
            {analysis.excludedMemoryEventIds.length} excluded
          </span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,280px)_minmax(0,1fr)] gap-md">
        <aside
          data-testid="work-session-tree-rail"
          className="min-h-0 overflow-y-auto border-r border-slate-200 pr-md"
        >
          {isPreviewMode ? renderPreviewTree() : renderPublishedTree()}
        </aside>

        <div
          className={
            isPreviewMode
              ? 'min-h-0 flex-1 overflow-y-auto'
              : 'min-h-0 flex-1 overflow-hidden'
          }
        >
          {isPreviewMode && !analysis && (
            <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-inkMuted">
              Select an analysis window to generate pending work-session candidates.
            </div>
          )}

          {isPreviewMode && analysis && activePreviewCandidates.length === 0 && (
            <div className="rounded border border-slate-200 px-4 py-8 text-center text-sm text-inkMuted">
              No work-session candidates found in this window.
            </div>
          )}

          {!isPreviewMode && renderPublishedKnowledgePanel()}

          {isPreviewMode && analysis && previewTopicItems.length > 0 && (
            <div className="grid gap-sm">
              {previewTopicItems.map(({ project, topic, knowledge }) => (
                <article
                  key={topic.candidate.id}
                  className="min-w-0 rounded border border-slate-200 bg-canvas px-4 py-3"
                >
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-heading text-base font-semibold text-ink">
                      {topic.topicName}
                    </h3>
                    {knowledge === undefined && (
                      <p className="mt-1 break-words text-sm text-inkMuted">
                        {topic.candidate.summary}
                      </p>
                    )}
                    {knowledge ? (
                      <div
                        data-testid="preview-knowledge-body"
                        className="mt-3 max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-ink"
                      >
                        {knowledge.body}
                      </div>
                    ) : (
                      <div className="mt-3 rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-inkMuted">
                        Knowledge has not been generated for this topic.
                      </div>
                    )}
                  </div>
                  <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                    {topic.candidate.reviewState}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-sm border-t border-slate-200 pt-3">
                  <label className="grid gap-1 text-sm text-inkMuted">
                    <span>Project name</span>
                    <input
                      aria-label={`Project name for ${topic.topicName}`}
                      className="h-9 w-56 rounded border border-slate-300 px-3 text-sm text-ink focus:border-primary focus:outline-none"
                      value={projectNames[topic.candidate.id] ?? project.projectName}
                      onChange={(event) =>
                        setProjectNames((current) => ({
                          ...current,
                          [topic.candidate.id]: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <button
                    type="button"
                    aria-label={`Generate knowledge for ${topic.topicName}`}
                    className="h-9 rounded border border-primary bg-primary px-3 text-sm font-medium text-white disabled:opacity-60"
                    disabled={
                      knowledge !== undefined || generatingCandidateId !== null
                    }
                    onClick={() => {
                      void generatePreviewKnowledge(topic)
                    }}
                  >
                    {generatingCandidateId === topic.candidate.id
                      ? 'Generating'
                      : knowledge === undefined
                        ? 'Generate'
                        : 'Generated'}
                  </button>
                  {knowledge && (
                    <button
                      type="button"
                      className="h-9 rounded border border-primary bg-primary px-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                      disabled={reviewingCandidateId !== null || publishingCandidateId !== null}
                      onClick={() => void publishPreviewKnowledge(project, topic, knowledge)}
                    >
                      {publishingCandidateId === knowledge.candidateId ? 'Publishing' : 'Publish'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="h-9 rounded border border-slate-300 px-3 text-sm font-medium text-ink transition-colors hover:border-red-400 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
                    disabled={reviewingCandidateId !== null || publishingCandidateId !== null}
                    onClick={() => void discardCandidate(topic.candidate)}
                  >
                    Discard
                  </button>
                </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
