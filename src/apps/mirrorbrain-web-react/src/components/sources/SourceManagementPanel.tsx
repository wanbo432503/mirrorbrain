import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  createMirrorBrainBrowserApi,
  type PaginatedMemoryEvents,
  type MirrorBrainWebAppApi,
} from '../../api/client'
import type {
  MemoryEvent,
  SourceInstanceSummary,
  SourceLedgerKind,
} from '../../types/index'
import Button from '../common/Button'
import LoadingSpinner from '../common/LoadingSpinner'
import Pagination from '../common/Pagination'
import MemoryPanel from '../memory/MemoryPanel'

type SourceDetailTab = 'Sources' | 'Ledger Format' | 'Settings'

interface SourceManagementPanelProps {
  api?: MirrorBrainWebAppApi
}

const ALL_MAIN_SOURCES_KEY = 'all-main-sources'
const DETAIL_TABS: SourceDetailTab[] = ['Sources', 'Ledger Format', 'Settings']
const SOURCE_HISTORY_PAGE_SIZE = 10

const SOURCE_LEDGER_FORMATS = [
  {
    sourceKind: 'browser',
    title: 'Browser',
    description: 'browser history',
    fileName: 'browser.jsonl',
    example: JSON.stringify(
      {
        schemaVersion: '1',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        occurredAt: '2026-05-12T10:00:00.000Z',
        payload: {
          id: 'page-161',
          title: 'MirrorBrain source ledger design',
          url: 'https://example.com/mirrorbrain/source-ledgers',
          page_content: 'Readable page text captured from an authorized browser source.',
        },
      },
      null,
      2,
    ),
  },
  {
    sourceKind: 'file-activity',
    title: 'Files',
    description: 'file activity',
    fileName: 'file-activity.jsonl',
    example: JSON.stringify(
      {
        schemaVersion: '1',
        sourceKind: 'file-activity',
        sourceInstanceId: 'filesystem-main',
        occurredAt: '2026-05-12T10:10:00.000Z',
        payload: {
          filePath: '/Users/example/Notes/phase4.md',
          fileName: 'phase4.md',
          fileType: 'markdown',
          mimeType: 'text/markdown',
          openedByApp: 'Cursor',
          sizeBytes: 1200,
          modifiedAt: '2026-05-12T10:09:00.000Z',
          contentSummary: 'Phase 4 ledger architecture notes.',
          fullContentRef: 'workspace-file:///Users/example/Notes/phase4.md',
        },
      },
      null,
      2,
    ),
  },
  {
    sourceKind: 'screenshot',
    title: 'Screenshot',
    description: 'screen capture',
    fileName: 'screenshot.jsonl',
    example: JSON.stringify(
      {
        schemaVersion: '1',
        sourceKind: 'screenshot',
        sourceInstanceId: 'desktop-main',
        occurredAt: '2026-05-12T10:11:00.000Z',
        payload: {
          title: 'Architecture diagram',
          appName: 'Preview',
          windowTitle: 'phase4.png',
          imagePath: '/tmp/phase4.png',
          imageRetained: true,
          imageSize: {
            width: 1440,
            height: 900,
          },
          ocrSummary: 'Phase 4 ledgers and importer',
          visionSummary: 'A diagram showing recorders writing ledgers into MirrorBrain.',
        },
      },
      null,
      2,
    ),
  },
  {
    sourceKind: 'audio-recording',
    title: 'Audio',
    description: 'audio recording',
    fileName: 'audio-recording.jsonl',
    example: JSON.stringify(
      {
        schemaVersion: '1',
        sourceKind: 'audio-recording',
        sourceInstanceId: 'recording-main',
        occurredAt: '2026-05-12T10:11:30.000Z',
        payload: {
          title: 'Design discussion recording',
          appName: 'Voice Memos',
          audioPath: '/tmp/phase4.m4a',
          audioRetained: true,
          durationMs: 420000,
          transcriptSummary: 'A recorded discussion about adding source names.',
          transcriptText: 'Optional transcript text.',
          redactionStatus: 'none',
        },
      },
      null,
      2,
    ),
  },
  {
    sourceKind: 'shell',
    title: 'Shell',
    description: 'terminal history',
    fileName: 'shell.jsonl',
    example: JSON.stringify(
      {
        schemaVersion: '1',
        sourceKind: 'shell',
        sourceInstanceId: 'shell-main',
        occurredAt: '2026-05-12T10:12:00.000Z',
        payload: {
          sessionId: 'shell-session-1',
          commandIndex: 7,
          command: 'pnpm test',
          cwd: '/Users/example/Workspace/mirrorbrain',
          exitCode: 0,
          shellType: 'zsh',
          terminalApp: 'Terminal',
          redactionStatus: 'none',
        },
      },
      null,
      2,
    ),
  },
  {
    sourceKind: 'agent',
    title: 'Agent',
    description: 'Sessions',
    fileName: 'agent.jsonl',
    example: JSON.stringify(
      {
        schemaVersion: '1',
        sourceKind: 'agent',
        sourceInstanceId: 'agent-main',
        occurredAt: '2026-05-12T10:13:00.000Z',
        payload: {
          transcriptPath: '/Users/example/.codex/sessions/session.jsonl',
          sessionId: 'codex-1',
          agentIdentity: 'Codex',
          userTask: 'Implement Phase 4 importer',
          messageRange: {
            start: 3,
            end: 42,
          },
          toolCallSummary: 'Read files, edited importer, ran tests.',
          finalResultSummary: 'Importer implemented and verified.',
          redactionStatus: 'none',
          updatedAt: '2026-05-12T10:13:30.000Z',
        },
      },
      null,
      2,
    ),
  },
] as const

const SOURCE_DISPLAY_BY_KEY: Record<string, { name: string; description: string }> = {
  'agent:agent-main': {
    name: 'Agent',
    description: 'Sessions',
  },
  'browser:chrome-main': {
    name: 'Browser',
    description: 'browser history',
  },
  'file-activity:filesystem-main': {
    name: 'Files',
    description: 'file activity',
  },
  'screenshot:desktop-main': {
    name: 'Screenshot',
    description: 'screen capture',
  },
  'audio-recording:recording-main': {
    name: 'Audio',
    description: 'audio recording',
  },
  'shell:shell-main': {
    name: 'Shell',
    description: 'terminal history',
  },
}

function getSourceKey(source: {
  sourceKind: SourceLedgerKind
  sourceInstanceId: string
}): string {
  return `${source.sourceKind}:${source.sourceInstanceId}`
}

function formatSourceKindLabel(sourceKind: SourceLedgerKind): string {
  switch (sourceKind) {
    case 'browser':
      return 'browser history'
    case 'file-activity':
      return 'file activity'
    case 'screenshot':
      return 'screen capture'
    case 'audio-recording':
      return 'audio recording'
    case 'shell':
      return 'terminal history'
    case 'agent':
      return 'Sessions'
  }
}

function formatFallbackSourceName(sourceInstanceId: string): string {
  return sourceInstanceId
    .replace(/-main$/u, '')
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getSourceDisplay(source: {
  sourceKind: SourceLedgerKind
  sourceInstanceId: string
}): { name: string; description: string } {
  return (
    SOURCE_DISPLAY_BY_KEY[getSourceKey(source)] ?? {
      name: formatFallbackSourceName(source.sourceInstanceId),
      description: formatSourceKindLabel(source.sourceKind),
    }
  )
}

export default function SourceManagementPanel({
  api,
}: SourceManagementPanelProps) {
  const defaultApi = useMemo(
    () => createMirrorBrainBrowserApi(window.location.origin),
    [],
  )
  const sourceApi = api ?? defaultApi
  const [sources, setSources] = useState<SourceInstanceSummary[]>([])
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(ALL_MAIN_SOURCES_KEY)
  const [selectedTab, setSelectedTab] = useState<SourceDetailTab>('Sources')
  const [sourceMemoryEvents, setSourceMemoryEvents] = useState<MemoryEvent[]>([])
  const [sourceMemoryPagination, setSourceMemoryPagination] =
    useState<PaginatedMemoryEvents['pagination'] | null>(null)
  const [sourceHistoryPage, setSourceHistoryPage] = useState(1)
  const [isLoadingSourceMemory, setIsLoadingSourceMemory] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const selectedSource =
    selectedSourceKey === ALL_MAIN_SOURCES_KEY
      ? null
      : sources.find((source) => getSourceKey(source) === selectedSourceKey) ?? null

  const loadSources = async () => {
    const loadedSources = await sourceApi.listSourceStatuses()
    setSources(loadedSources)
    setSelectedSourceKey((current) => {
      if (current === ALL_MAIN_SOURCES_KEY) {
        return current
      }

      return loadedSources.some((source) => getSourceKey(source) === current)
        ? current
        : ALL_MAIN_SOURCES_KEY
    })
  }

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const loadedSources = await sourceApi.listSourceStatuses()

        if (!isMounted) {
          return
        }

        setSources(loadedSources)
        setSelectedSourceKey(ALL_MAIN_SOURCES_KEY)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [sourceApi])

  useEffect(() => {
    if (selectedSourceKey === ALL_MAIN_SOURCES_KEY) {
      setSourceMemoryEvents([])
      setSourceMemoryPagination(null)
      setIsLoadingSourceMemory(false)
      return
    }

    if (selectedSource === null) {
      setSourceMemoryEvents([])
      setSourceMemoryPagination(null)
      setIsLoadingSourceMemory(false)
      return
    }

    let isMounted = true

    const loadSourceDetails = async () => {
      setIsLoadingSourceMemory(true)
      const sourceMemory = await sourceApi.listMemory(
        sourceHistoryPage,
        SOURCE_HISTORY_PAGE_SIZE,
        {
          sourceKind: selectedSource.sourceKind,
          sourceInstanceId: selectedSource.sourceInstanceId,
        },
      )

      if (isMounted) {
        setSourceMemoryEvents(sourceMemory.items)
        setSourceMemoryPagination(sourceMemory.pagination)
        setIsLoadingSourceMemory(false)
      }
    }

    void loadSourceDetails()

    return () => {
      isMounted = false
    }
  }, [selectedSource, selectedSourceKey, sourceApi, sourceHistoryPage])

  const handleToggleSourceEnabled = async () => {
    if (selectedSource === null) {
      return
    }

    const enabled = selectedSource.lifecycleStatus === 'disabled'
    setIsUpdatingConfig(true)
    setFeedback(null)

    try {
      await sourceApi.updateSourceConfig({
        sourceKind: selectedSource.sourceKind,
        sourceInstanceId: selectedSource.sourceInstanceId,
        enabled,
        updatedBy: 'mirrorbrain-web',
      })
      setFeedback(enabled ? 'Source enabled.' : 'Source disabled.')
      await loadSources()
    } finally {
      setIsUpdatingConfig(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
      <aside className="shrink-0 border-b border-hairline pb-4 md:w-72 md:border-b-0 md:border-r md:pb-0 md:pr-4">
        <h2 className="font-heading text-xl font-semibold">Memory Sources</h2>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className={`rounded-sm border px-3 py-2 text-left text-sm ${
              selectedSourceKey === ALL_MAIN_SOURCES_KEY
                ? 'border-primary bg-canvas-parchment text-primary'
                : 'border-hairline bg-canvas text-ink'
            }`}
            onClick={() => {
              setSelectedSourceKey(ALL_MAIN_SOURCES_KEY)
              setSelectedTab('Sources')
              setSourceHistoryPage(1)
            }}
          >
            <span className="block font-semibold">All Sources</span>
            <span className="block text-xs text-inkMuted-80">memory events</span>
          </button>
          {sources.map((source) => {
            const sourceKey = getSourceKey(source)
            const isSelected = sourceKey === selectedSourceKey
            const sourceDisplay = getSourceDisplay(source)

            return (
              <button
                key={sourceKey}
                type="button"
                aria-label={`${sourceDisplay.name} ${sourceDisplay.description}`}
                className={`rounded-sm border px-3 py-2 text-left text-sm ${
                  isSelected
                    ? 'border-primary bg-canvas-parchment text-primary'
                    : 'border-hairline bg-canvas text-ink'
                }`}
                onClick={() => {
                  setSelectedSourceKey(sourceKey)
                  setSelectedTab('Sources')
                  setSourceHistoryPage(1)
                }}
              >
                <span className="block font-semibold">{sourceDisplay.name}</span>
                <span className="block text-xs text-inkMuted-80">
                  {sourceDisplay.description}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <div
        data-testid="memory-sources-detail-panel"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {feedback && (
          <div
            role="status"
            className="mb-3 shrink-0 rounded-sm border border-green-300 bg-green-100 p-3 text-sm text-green-700"
          >
            {feedback}
          </div>
        )}

        {selectedSourceKey === ALL_MAIN_SOURCES_KEY && (
          <div
            data-testid="all-main-memory-panel"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <MemoryPanel api={sourceApi} actionMode="import-only" />
          </div>
        )}

        {selectedSourceKey !== ALL_MAIN_SOURCES_KEY && selectedSource === null && (
          <div className="shrink-0 rounded-sm border border-hairline p-4 text-sm text-inkMuted-80">
            Selected source is no longer available.
          </div>
        )}

        {selectedSource && (
          <div
            data-testid="source-detail-layout"
            className="flex min-h-0 flex-1 flex-col overflow-hidden pr-2"
          >
            <div
              data-testid="source-detail-header"
              className="flex shrink-0 items-start justify-between gap-4"
            >
              <div>
                <h3 className="font-heading text-lg font-semibold">
                  {getSourceDisplay(selectedSource).name}
                </h3>
                <p className="text-sm text-inkMuted-80">
                  {getSourceDisplay(selectedSource).description}
                </p>
              </div>
              <span className="rounded-sm border border-hairline px-2 py-1 text-xs uppercase">
                {selectedSource.lifecycleStatus}
              </span>
            </div>

            <div
              role="tablist"
              data-testid="source-detail-tabs"
              className="mt-4 flex shrink-0 border-b border-hairline"
            >
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab === tab}
                  className={`px-3 py-2 text-sm ${
                    selectedTab === tab
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-inkMuted-80'
                  }`}
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div
              data-testid="source-detail-body"
              className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              {selectedTab === 'Sources' && (
                <div
                  data-testid="source-history-panel"
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
                >
                  <div
                    data-testid="source-summary-panel"
                    className="grid shrink-0 grid-cols-2 gap-3 text-sm lg:grid-cols-4"
                  >
                    <Metric label="Imported" value={selectedSource.importedCount} />
                    <Metric label="Skipped" value={selectedSource.skippedCount} />
                    <Metric label="Recorder" value={selectedSource.recorderStatus} />
                    <Metric
                      label="Checkpoint"
                      value={selectedSource.checkpointSummary ?? 'none'}
                    />
                    {selectedSource.latestWarning && (
                      <div className="col-span-full rounded-sm border border-amber-300 bg-amber-50 p-3 text-amber-800">
                        {selectedSource.latestWarning}
                      </div>
                    )}
                  </div>
                  {isLoadingSourceMemory && (
                    <div className="flex min-h-0 flex-1 items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  )}
                  {!isLoadingSourceMemory && sourceMemoryPagination && (
                    <div className="shrink-0 text-xs text-inkMuted-80">
                      Showing {sourceMemoryEvents.length} of {sourceMemoryPagination.total}{' '}
                      source records (page {sourceMemoryPagination.page} of{' '}
                      {sourceMemoryPagination.totalPages})
                    </div>
                  )}
                  {!isLoadingSourceMemory && (
                    <div
                      data-testid="source-history-scroll-region"
                      className="min-h-0 flex-1 overflow-y-auto pr-2"
                    >
                      {sourceMemoryEvents.length === 0 ? (
                        <div className="rounded-sm border border-hairline p-4 text-sm text-inkMuted-80">
                          No source records imported for this source.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {sourceMemoryEvents.map((event) => (
                            <article
                              key={event.id}
                              className="rounded-sm border border-hairline bg-canvas p-3 text-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <strong>{formatMemoryEventTitle(event)}</strong>
                                <span className="shrink-0 text-xs text-inkMuted-80">
                                  {event.sourceType}
                                </span>
                              </div>
                              <p className="mt-1 text-inkMuted-80">
                                {formatMemoryEventSummary(event)}
                              </p>
                              <p className="mt-1 break-words text-xs text-inkMuted-80">
                                {event.sourceRef}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!isLoadingSourceMemory &&
                    sourceMemoryPagination &&
                    sourceMemoryPagination.totalPages > 1 && (
                      <div
                        data-testid="source-history-pagination-footer"
                        className="shrink-0 border-t border-hairline bg-canvas-parchment pt-3"
                      >
                        <Pagination
                          currentPage={sourceMemoryPagination.page}
                          totalPages={sourceMemoryPagination.totalPages}
                          onPageChange={setSourceHistoryPage}
                        />
                      </div>
                  )}
                </div>
              )}

              {selectedTab === 'Ledger Format' && (
                <LedgerFormatPanel sourceKind={selectedSource.sourceKind} />
              )}

              {selectedTab === 'Settings' && (
                <div className="min-h-0 overflow-y-auto text-sm">
                  <div>
                    <p>Source state</p>
                    <Button
                      variant="default"
                      loading={isUpdatingConfig}
                      onClick={handleToggleSourceEnabled}
                    >
                      {selectedSource.lifecycleStatus === 'disabled'
                        ? 'Enable Source'
                        : 'Disable Source'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function formatMemoryEventTitle(event: MemoryEvent): string {
  return typeof event.content.title === 'string' && event.content.title.length > 0
    ? event.content.title
    : event.id
}

function formatMemoryEventSummary(event: MemoryEvent): string {
  return typeof event.content.summary === 'string' && event.content.summary.length > 0
    ? event.content.summary
    : event.timestamp
}

function tokenizeJsonlLine(line: string): Array<{
  text: string
  kind: 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain'
}> {
  const tokenPattern =
    /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?|[{}[\]:,])/gu
  const tokens: Array<{
    text: string
    kind: 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain'
  }> = []
  let cursor = 0

  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0

    if (index > cursor) {
      tokens.push({ text: line.slice(cursor, index), kind: 'plain' })
    }

    const text = match[0]
    let kind: 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain' = 'plain'

    if (/^"(?:\\.|[^"\\])*"$/u.test(text)) {
      kind = line.slice(index + text.length).startsWith(':') ? 'key' : 'string'
    } else if (/^(true|false|null)$/u.test(text)) {
      kind = 'literal'
    } else if (/^-?\d/u.test(text)) {
      kind = 'number'
    } else {
      kind = 'punctuation'
    }

    tokens.push({ text, kind })
    cursor = index + text.length
  }

  if (cursor < line.length) {
    tokens.push({ text: line.slice(cursor), kind: 'plain' })
  }

  return tokens
}

function getJsonlTokenClass(kind: ReturnType<typeof tokenizeJsonlLine>[number]['kind']) {
  switch (kind) {
    case 'key':
      return 'text-sky-700'
    case 'string':
      return 'text-emerald-700'
    case 'number':
      return 'text-amber-700'
    case 'literal':
      return 'text-fuchsia-700'
    case 'punctuation':
      return 'text-inkMuted-80'
    case 'plain':
      return ''
  }
}

function JsonlCodeBlock({
  code,
  label,
}: {
  code: string
  label: string
}) {
  const lines = code.split('\n')

  return (
    <pre
      aria-label={label}
      data-language="jsonl"
      className="language-jsonl overflow-x-auto rounded-sm border border-hairline bg-canvas-parchment p-3 font-mono text-xs leading-relaxed"
    >
      <code>
        {lines.map((line, lineIndex) => (
          <span key={`${label}-${lineIndex}`} className="block min-w-max">
            {tokenizeJsonlLine(line).map((token, tokenIndex) => (
              <span
                key={`${label}-${lineIndex}-${tokenIndex}`}
                className={getJsonlTokenClass(token.kind)}
              >
                {token.text}
              </span>
            ))}
            {lineIndex < lines.length - 1 ? '\n' : null}
          </span>
        ))}
      </code>
    </pre>
  )
}

function LedgerFormatPanel({ sourceKind }: { sourceKind: SourceLedgerKind }) {
  const format =
    SOURCE_LEDGER_FORMATS.find((candidate) => candidate.sourceKind === sourceKind) ??
    SOURCE_LEDGER_FORMATS[0]

  return (
    <div
      data-testid="ledger-format-panel"
      className="min-h-0 flex-1 overflow-y-auto pr-2 text-sm"
    >
      <div className="mb-4">
        <h4 className="font-heading text-base font-semibold">Source Ledger JSONL</h4>
        <p className="mt-1 max-w-3xl text-sm text-inkMuted-80">
          MirrorBrain imports one JSON object per line. Each line uses the shared
          envelope fields below, with a source-specific payload.
        </p>
      </div>
      <article className="rounded-sm border border-hairline bg-canvas p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h5 className="font-semibold">{format.title}</h5>
            <p className="text-xs text-inkMuted-80">{format.description}</p>
          </div>
          <span className="shrink-0 rounded-sm border border-hairline px-2 py-1 font-mono text-xs">
            {format.sourceKind}
          </span>
        </div>
        <p className="mb-2 font-mono text-xs text-inkMuted-80">
          ledgers/YYYY-MM-DD/{format.fileName}
        </p>
        <JsonlCodeBlock
          code={format.example}
          label={`${format.sourceKind} ledger JSONL example`}
        />
      </article>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border border-hairline bg-canvas p-3">
      <p className="text-xs uppercase text-inkMuted-80">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  )
}
