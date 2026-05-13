import { useEffect, useMemo, useState } from 'react'

import type { MirrorBrainWebAppApi } from '../../api/client'
import type {
  AnalysisWindowPreset,
  KnowledgeArticleTree,
  WorkSessionCandidate,
  WorkSessionAnalysisResult,
  WorkSessionReviewResult,
} from '../../types'
import {
  buildWorkSessionPreviewTree,
  generateWorkSessionPreviewKnowledge,
  type WorkSessionPreviewKnowledgeNode,
  type WorkSessionPreviewProjectNode,
  type WorkSessionPreviewTopicNode,
} from './work-session-preview-tree'

interface WorkSessionAnalysisPanelProps {
  api: MirrorBrainWebAppApi
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

type TreeMode = 'preview' | 'published'

export default function WorkSessionAnalysisPanel({
  api,
}: WorkSessionAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<WorkSessionAnalysisResult | null>(null)
  const [runningPreset, setRunningPreset] = useState<AnalysisWindowPreset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTreeMode, setActiveTreeMode] = useState<TreeMode>('preview')
  const [publishedTree, setPublishedTree] = useState<KnowledgeArticleTree>({
    projects: [],
  })
  const [projectNames, setProjectNames] = useState<Record<string, string>>({})
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null)
  const [publishingCandidateId, setPublishingCandidateId] = useState<string | null>(null)
  const [generatedKnowledgeByCandidateId, setGeneratedKnowledgeByCandidateId] =
    useState<Record<string, WorkSessionPreviewKnowledgeNode>>({})
  const [reviewResults, setReviewResults] = useState<
    Record<string, WorkSessionReviewResult>
  >({})
  const previewTree = useMemo(
    () => buildWorkSessionPreviewTree(analysis?.candidates ?? []),
    [analysis],
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

  useEffect(() => {
    let isMounted = true

    api
      .listKnowledgeArticleTree()
      .then((tree) => {
        if (isMounted) {
          setPublishedTree(tree)
        }
      })
      .catch((caughtError) => {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Failed to load published knowledge tree.',
          )
        }
      })

    return () => {
      isMounted = false
    }
  }, [api])

  const runAnalysis = async (preset: AnalysisWindowPreset) => {
    setRunningPreset(preset)
    setError(null)

    try {
      const result = await api.analyzeWorkSessions(preset)
      setAnalysis(result)
      setProjectNames({})
      setGeneratedKnowledgeByCandidateId({})
      setReviewResults({})
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

  const reviewCandidate = async (
    candidate: WorkSessionCandidate,
    decision: 'keep' | 'discard',
    fallbackProjectName?: string,
  ) => {
    setReviewingCandidateId(candidate.id)
    setError(null)

    try {
      const projectName =
        projectNames[candidate.id]?.trim() ||
        fallbackProjectName ||
        candidate.projectHint
      const result = await api.reviewWorkSessionCandidate(candidate, {
        decision,
        reviewedBy: 'mirrorbrain-web',
        title: candidate.title,
        summary: candidate.summary,
        ...(decision === 'keep'
          ? {
              projectAssignment: {
                kind: 'confirmed-new-project' as const,
                name: projectName,
              },
            }
          : {}),
      })

      setReviewResults((current) => ({
        ...current,
        [candidate.id]: result,
      }))
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

      setReviewResults((current) => ({
        ...current,
        [candidate.id]: reviewResult,
      }))
      setPublishedTree(await api.listKnowledgeArticleTree())
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

  const generatePreviewKnowledge = (topic: WorkSessionPreviewTopicNode) => {
    setGeneratedKnowledgeByCandidateId((current) => ({
      ...current,
      [topic.candidate.id]: generateWorkSessionPreviewKnowledge(topic),
    }))
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
            <div className="text-sm font-semibold text-ink">
              {projectNode.project.name}
            </div>
            {projectNode.topics.map((topicNode) => (
              <div key={topicNode.topic.id} className="ml-3 grid gap-xs border-l border-slate-200 pl-3">
                <div className="text-sm font-medium text-ink">{topicNode.topic.name}</div>
                {topicNode.articles.map((articleNode) => (
                  <button
                    key={articleNode.articleId}
                    type="button"
                    className="rounded border border-slate-200 bg-canvas px-3 py-2 text-left text-sm text-ink transition-colors hover:border-primary"
                  >
                    <span className="block font-medium">{articleNode.title}</span>
                    <span className="mt-1 block text-xs text-inkMuted">
                      {articleNode.history.length} versions
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-md px-md pb-md">
      <header className="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">Review</h2>
          <p className="mt-1 max-w-2xl text-sm text-inkMuted">
            Work-session windows generate preview knowledge for project and topic review.
          </p>
        </div>

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
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {analysis && (
        <div className="flex flex-wrap items-center gap-sm text-xs text-inkMuted">
          <span className="rounded border border-slate-200 px-2 py-1">
            {formatWindow(analysis)}
          </span>
          <span className="rounded border border-slate-200 px-2 py-1">
            {analysis.candidates.length} candidates
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
          <div className="mb-3 flex gap-sm border-b border-slate-200" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTreeMode === 'preview'}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTreeMode === 'preview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-inkMuted'
              }`}
              onClick={() => setActiveTreeMode('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTreeMode === 'published'}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTreeMode === 'published'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-inkMuted'
              }`}
              onClick={() => setActiveTreeMode('published')}
            >
              Published
            </button>
          </div>
          {activeTreeMode === 'preview' ? renderPreviewTree() : renderPublishedTree()}
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!analysis && (
            <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-inkMuted">
              Select an analysis window to generate pending work-session candidates.
            </div>
          )}

          {analysis && analysis.candidates.length === 0 && (
            <div className="rounded border border-slate-200 px-4 py-8 text-center text-sm text-inkMuted">
              No work-session candidates found in this window.
            </div>
          )}

          {analysis && previewTopicItems.length > 0 && (
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
                    <p className="mt-1 break-words text-sm text-inkMuted">
                      {topic.candidate.summary}
                    </p>
                    {knowledge ? (
                      <div className="mt-3 whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-ink">
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

                <dl className="mt-3 grid gap-2 text-sm text-inkMuted sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Project</dt>
                    <dd className="font-medium text-ink">{project.projectName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Topic</dt>
                    <dd className="font-medium text-ink">{topic.topicName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Sources</dt>
                    <dd className="font-medium text-ink">
                      {topic.sourceTypes.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-inkMuted-80">Provenance</dt>
                    <dd className="font-medium text-ink">
                      {topic.memoryEventCount}{' '}
                      {topic.memoryEventCount === 1
                        ? 'memory event'
                        : 'memory events'}
                    </dd>
                  </div>
                </dl>

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
                    disabled={knowledge !== undefined}
                    onClick={() => generatePreviewKnowledge(topic)}
                  >
                    {knowledge === undefined ? 'Generate' : 'Generated'}
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded border border-primary bg-primary px-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                    disabled={reviewingCandidateId !== null || publishingCandidateId !== null}
                    onClick={() =>
                      void reviewCandidate(topic.candidate, 'keep', project.projectName)
                    }
                  >
                    {reviewingCandidateId === topic.candidate.id ? 'Saving' : 'Keep as project'}
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
                    onClick={() => void reviewCandidate(topic.candidate, 'discard')}
                  >
                    Discard
                  </button>

                  {reviewResults[topic.candidate.id] && (
                    <span className="text-sm font-medium text-green-700">
                      {reviewResults[topic.candidate.id].reviewedWorkSession.projectId
                        ? `Reviewed into project: ${reviewResults[topic.candidate.id].reviewedWorkSession.projectId}`
                        : 'Discarded work session'}
                    </span>
                  )}
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
