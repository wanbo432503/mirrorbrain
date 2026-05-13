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

type SourceDetailTab = 'Overview' | 'Sources' | 'Settings'

interface SourceManagementPanelProps {
  api?: MirrorBrainWebAppApi
}

const ALL_MAIN_SOURCES_KEY = 'all-main-sources'
const DETAIL_TABS: SourceDetailTab[] = ['Overview', 'Sources', 'Settings']
const SOURCE_HISTORY_PAGE_SIZE = 10

function getSourceKey(source: {
  sourceKind: SourceLedgerKind
  sourceInstanceId: string
}): string {
  return `${source.sourceKind}:${source.sourceInstanceId}`
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
  const [selectedTab, setSelectedTab] = useState<SourceDetailTab>('Overview')
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
              setSelectedTab('Overview')
              setSourceHistoryPage(1)
            }}
          >
            <span className="block font-semibold">All-Main Sources</span>
            <span className="block text-xs text-inkMuted-80">memory events</span>
          </button>
          {sources.map((source) => {
            const sourceKey = getSourceKey(source)
            const isSelected = sourceKey === selectedSourceKey

            return (
              <button
                key={sourceKey}
                type="button"
                aria-label={`${source.sourceInstanceId} ${source.sourceKind}`}
                className={`rounded-sm border px-3 py-2 text-left text-sm ${
                  isSelected
                    ? 'border-primary bg-canvas-parchment text-primary'
                    : 'border-hairline bg-canvas text-ink'
                }`}
                onClick={() => {
                  setSelectedSourceKey(sourceKey)
                  setSelectedTab('Overview')
                  setSourceHistoryPage(1)
                }}
              >
                <span className="block font-semibold">{source.sourceInstanceId}</span>
                <span className="block text-xs text-inkMuted-80">{source.sourceKind}</span>
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
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-lg font-semibold">
                  {selectedSource.sourceInstanceId}
                </h3>
                <p className="text-sm text-inkMuted-80">{selectedSource.sourceKind}</p>
              </div>
              <span className="rounded-sm border border-hairline px-2 py-1 text-xs uppercase">
                {selectedSource.lifecycleStatus}
              </span>
            </div>

            <div role="tablist" className="mt-4 flex border-b border-hairline">
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

            {selectedTab === 'Overview' && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
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
            )}

            {selectedTab === 'Sources' && (
              <div className="mt-4 flex min-h-0 flex-col gap-3">
                {isLoadingSourceMemory && (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                )}
                {!isLoadingSourceMemory && sourceMemoryPagination && (
                  <div className="text-xs text-inkMuted-80">
                    Showing {sourceMemoryEvents.length} of {sourceMemoryPagination.total}{' '}
                    source records (page {sourceMemoryPagination.page} of{' '}
                    {sourceMemoryPagination.totalPages})
                  </div>
                )}
                {!isLoadingSourceMemory && sourceMemoryEvents.length === 0 && (
                  <div className="rounded-sm border border-hairline p-4 text-sm text-inkMuted-80">
                    No source records imported for this source.
                  </div>
                )}
                {!isLoadingSourceMemory && sourceMemoryEvents.map((event) => (
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
                {!isLoadingSourceMemory &&
                  sourceMemoryPagination &&
                  sourceMemoryPagination.totalPages > 1 && (
                    <div className="shrink-0 border-t border-hairline bg-canvas-parchment pt-3">
                      <Pagination
                        currentPage={sourceMemoryPagination.page}
                        totalPages={sourceMemoryPagination.totalPages}
                        onPageChange={setSourceHistoryPage}
                      />
                    </div>
                  )}
              </div>
            )}

            {selectedTab === 'Settings' && (
              <div className="mt-4 flex flex-col gap-4 text-sm">
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

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border border-hairline bg-canvas p-3">
      <p className="text-xs uppercase text-inkMuted-80">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  )
}
