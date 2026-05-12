import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  createMirrorBrainBrowserApi,
  type MirrorBrainWebAppApi,
} from '../../api/client'
import type {
  MemoryEvent,
  SourceAuditEvent,
  SourceInstanceSummary,
  SourceLedgerKind,
} from '../../types/index'
import Button from '../common/Button'
import LoadingSpinner from '../common/LoadingSpinner'
import MemoryList from '../memory/MemoryList'
import Pagination from '../common/Pagination'
import { MEMORY_PAGE_SIZE } from '../memory/memory-page-config'

type SourceDetailTab = 'Overview' | 'Recent Memory' | 'Audit' | 'Settings'

interface SourceManagementPanelProps {
  api?: MirrorBrainWebAppApi
}

const ALL_MAIN_SOURCES_KEY = 'all-main-sources'
const DETAIL_TABS: SourceDetailTab[] = [
  'Overview',
  'Recent Memory',
  'Audit',
  'Settings',
]

function getSourceKey(source: {
  sourceKind: SourceLedgerKind
  sourceInstanceId: string
}): string {
  return `${source.sourceKind}:${source.sourceInstanceId}`
}

function formatImportMessage(input: {
  importedCount: number
  scannedLedgerCount: number
}): string {
  const eventLabel = input.importedCount === 1 ? 'event' : 'events'
  const ledgerLabel = input.scannedLedgerCount === 1 ? 'ledger' : 'ledgers'

  return `Imported ${input.importedCount} source ledger ${eventLabel} across ${input.scannedLedgerCount} scanned ${ledgerLabel}.`
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
  const [auditEvents, setAuditEvents] = useState<SourceAuditEvent[]>([])
  const [recentMemoryEvents, setRecentMemoryEvents] = useState<MemoryEvent[]>([])
  const [globalMemoryEvents, setGlobalMemoryEvents] = useState<MemoryEvent[]>([])
  const [globalMemoryPagination, setGlobalMemoryPagination] = useState<{
    total: number
    page: number
    pageSize: number
    totalPages: number
  } | null>(null)
  const [globalMemoryPage, setGlobalMemoryPage] = useState(1)
  const [isLoadingGlobalMemory, setIsLoadingGlobalMemory] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
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

  const loadGlobalMemory = async (page: number) => {
    setIsLoadingGlobalMemory(true)

    try {
      const result = await sourceApi.listMemory(page, MEMORY_PAGE_SIZE)
      setGlobalMemoryEvents(result.items)
      setGlobalMemoryPagination(result.pagination)
      setGlobalMemoryPage(page)
    } finally {
      setIsLoadingGlobalMemory(false)
    }
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
      setAuditEvents([])
      setRecentMemoryEvents([])
      return
    }

    if (selectedSource === null) {
      setAuditEvents([])
      setRecentMemoryEvents([])
      return
    }

    let isMounted = true

    const loadSourceDetails = async () => {
      const [events, recentMemory] = await Promise.all([
        sourceApi.listSourceAuditEvents({
          sourceKind: selectedSource.sourceKind,
          sourceInstanceId: selectedSource.sourceInstanceId,
        }),
        sourceApi.listMemory(1, 5, {
          sourceKind: selectedSource.sourceKind,
          sourceInstanceId: selectedSource.sourceInstanceId,
        }),
      ])

      if (isMounted) {
        setAuditEvents(events)
        setRecentMemoryEvents(recentMemory.items)
      }
    }

    void loadSourceDetails()

    return () => {
      isMounted = false
    }
  }, [selectedSource, selectedSourceKey, sourceApi])

  useEffect(() => {
    if (selectedSourceKey !== ALL_MAIN_SOURCES_KEY) {
      return
    }

    void loadGlobalMemory(globalMemoryPage)
  }, [selectedSourceKey, sourceApi])

  const handleImportNow = async () => {
    setIsImporting(true)
    setFeedback(null)

    try {
      const result = await sourceApi.importSourceLedgers()
      setFeedback(formatImportMessage(result))
      await loadSources()
      if (selectedSourceKey === ALL_MAIN_SOURCES_KEY) {
        await loadGlobalMemory(globalMemoryPage)
      }
    } finally {
      setIsImporting(false)
    }
  }

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
    <section className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:flex-row">
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
            onClick={() => setSelectedSourceKey(ALL_MAIN_SOURCES_KEY)}
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
                onClick={() => setSelectedSourceKey(sourceKey)}
              >
                <span className="block font-semibold">{source.sourceInstanceId}</span>
                <span className="block text-xs text-inkMuted-80">{source.sourceKind}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {feedback && (
          <div
            role="status"
            className="mb-3 rounded-sm border border-green-300 bg-green-100 p-3 text-sm text-green-700"
          >
            {feedback}
          </div>
        )}

        {selectedSourceKey === ALL_MAIN_SOURCES_KEY && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex justify-end">
              <Button variant="primary" loading={isImporting} onClick={handleImportNow}>
                Import Sources
              </Button>
            </div>

            {globalMemoryPagination && (
              <div className="mb-2 text-xs text-gray-600">
                Showing {globalMemoryEvents.length} of {globalMemoryPagination.total} unique URLs
                (page {globalMemoryPage} of {globalMemoryPagination.totalPages})
              </div>
            )}

            {isLoadingGlobalMemory ? (
              <div className="flex min-h-0 flex-1 items-center justify-center py-12">
                <LoadingSpinner size="large" />
              </div>
            ) : (
              <div
                data-testid="memory-list-scroll-region"
                className="min-h-0 flex-1 overflow-y-auto pr-2"
              >
                <MemoryList events={globalMemoryEvents} />
              </div>
            )}

            {globalMemoryPagination && globalMemoryPagination.totalPages > 1 && (
              <div
                data-testid="memory-pagination-footer"
                className="shrink-0 border-t border-hairline bg-canvas-parchment pt-3"
              >
                <Pagination
                  currentPage={globalMemoryPage}
                  totalPages={globalMemoryPagination.totalPages}
                  onPageChange={loadGlobalMemory}
                />
              </div>
            )}
          </div>
        )}

        {selectedSourceKey !== ALL_MAIN_SOURCES_KEY && selectedSource === null && (
          <div className="rounded-sm border border-hairline p-4 text-sm text-inkMuted-80">
            Selected source is no longer available.
          </div>
        )}

        {selectedSource && (
          <>
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

            {selectedTab === 'Recent Memory' && (
              <div className="mt-4 flex flex-col gap-2">
                {recentMemoryEvents.length === 0 && (
                  <div className="rounded-sm border border-hairline p-4 text-sm text-inkMuted-80">
                    No recent memory records for this source.
                  </div>
                )}
                {recentMemoryEvents.map((event) => (
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

            {selectedTab === 'Audit' && (
              <div className="mt-4 flex flex-col gap-2">
                {auditEvents.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-sm border border-hairline p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong>{event.eventType}</strong>
                      <span>{event.severity}</span>
                    </div>
                    <p className="mt-1 text-inkMuted-80">{event.message}</p>
                    {event.ledgerPath.length > 0 && (
                      <p className="mt-1 break-words text-xs text-inkMuted-80">
                        {event.ledgerPath}:{event.lineNumber}
                      </p>
                    )}
                  </article>
                ))}
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
                <div>
                  <p>Ledger import</p>
                  <Button variant="primary" loading={isImporting} onClick={handleImportNow}>
                    Import Now
                  </Button>
                </div>
              </div>
            )}
          </>
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
