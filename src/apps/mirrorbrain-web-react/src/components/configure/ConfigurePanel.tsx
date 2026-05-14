import { useEffect, useState } from 'react'

import type {
  OpenAICompatibleResourceConfig,
  ResourceConfiguration,
  TavilySearchResourceConfig,
} from '../../types/index'
import {
  createMirrorBrainBrowserApi,
  type MirrorBrainWebAppApi,
} from '../../api/client'
import Button from '../common/Button'
import Card from '../common/Card'
import LoadingSpinner from '../common/LoadingSpinner'
import Input from '../forms/Input'

interface ConfigurePanelProps {
  api?: MirrorBrainWebAppApi
}

type ResourceFeedback = {
  kind: 'success' | 'error'
  message: string
}

interface OpenAICompatibleFormState {
  providerName: string
  baseUrl: string
  model: string
  apiKey: string
}

interface TavilySearchFormState {
  baseUrl: string
  apiKey: string
  maxResults: number
}

const ENV_REFERENCE = [
  'MIRRORBRAIN_HTTP_HOST',
  'MIRRORBRAIN_HTTP_PORT',
  'MIRRORBRAIN_WORKSPACE_DIR',
  'MIRRORBRAIN_ACTIVITYWATCH_BASE_URL',
  'MIRRORBRAIN_BROWSER_BUCKET_ID',
  'MIRRORBRAIN_SYNC_INTERVAL_MS',
  'MIRRORBRAIN_INITIAL_BACKFILL_HOURS',
  'MIRRORBRAIN_LLM_API_BASE',
  'MIRRORBRAIN_LLM_API_KEY',
  'MIRRORBRAIN_LLM_MODEL',
  'MIRRORBRAIN_EMBEDDING_API_BASE',
  'MIRRORBRAIN_EMBEDDING_API_KEY',
  'MIRRORBRAIN_EMBEDDING_MODEL',
  'MIRRORBRAIN_TAVILY_API_BASE',
  'MIRRORBRAIN_TAVILY_API_KEY',
  'MIRRORBRAIN_TAVILY_MAX_RESULTS',
] as const

function createDefaultConfig(): ResourceConfiguration {
  return {
    llm: {
      enabled: false,
      providerName: 'OpenAI-compatible chat',
      baseUrl: '',
      model: '',
      apiKeyConfigured: false,
    },
    embedding: {
      enabled: false,
      providerName: 'OpenAI-compatible embeddings',
      baseUrl: '',
      model: '',
      apiKeyConfigured: false,
    },
    search: {
      enabled: false,
      providerName: 'tavily',
      baseUrl: '',
      apiKeyConfigured: false,
      maxResults: 0,
    },
  }
}

function createOpenAIFormState(
  config: OpenAICompatibleResourceConfig,
): OpenAICompatibleFormState {
  return {
    providerName: config.providerName,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: '',
  }
}

function createSearchFormState(config: TavilySearchResourceConfig): TavilySearchFormState {
  return {
    baseUrl: config.baseUrl,
    apiKey: '',
    maxResults: config.maxResults,
  }
}

function keyPlaceholder(apiKeyConfigured: boolean): string {
  return apiKeyConfigured ? 'Configured. Leave blank to keep current key.' : 'API key'
}

export default function ConfigurePanel({
  api = createMirrorBrainBrowserApi(window.location.origin),
}: ConfigurePanelProps) {
  const [config, setConfig] = useState<ResourceConfiguration>(createDefaultConfig)
  const [llmForm, setLlmForm] = useState<OpenAICompatibleFormState>(
    createOpenAIFormState(createDefaultConfig().llm),
  )
  const [embeddingForm, setEmbeddingForm] = useState<OpenAICompatibleFormState>(
    createOpenAIFormState(createDefaultConfig().embedding),
  )
  const [searchForm, setSearchForm] = useState<TavilySearchFormState>(
    createSearchFormState(createDefaultConfig().search),
  )
  const [loading, setLoading] = useState(true)
  const [savingResource, setSavingResource] = useState<'llm' | 'embedding' | 'search' | null>(
    null,
  )
  const [feedback, setFeedback] = useState<ResourceFeedback | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const nextConfig = await api.getResourceConfiguration()

        if (cancelled) {
          return
        }

        setConfig(nextConfig)
        setLlmForm(createOpenAIFormState(nextConfig.llm))
        setEmbeddingForm(createOpenAIFormState(nextConfig.embedding))
        setSearchForm(createSearchFormState(nextConfig.search))
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Failed to load configuration.',
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [api])

  async function saveOpenAICompatibleResource(
    resource: 'llm' | 'embedding',
    form: OpenAICompatibleFormState,
  ) {
    setSavingResource(resource)
    setFeedback(null)

    try {
      const nextConfig = await api.updateResourceConfiguration({
        [resource]: {
          providerName: form.providerName,
          baseUrl: form.baseUrl,
          model: form.model,
          apiKey: form.apiKey.trim().length > 0 ? form.apiKey : undefined,
          updatedBy: 'mirrorbrain-web',
        },
      })

      setConfig(nextConfig)
      if (resource === 'llm') {
        setLlmForm(createOpenAIFormState(nextConfig.llm))
      } else {
        setEmbeddingForm(createOpenAIFormState(nextConfig.embedding))
      }
      setFeedback({ kind: 'success', message: `${resource.toUpperCase()} resource saved.` })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : `Failed to save ${resource}.`,
      })
    } finally {
      setSavingResource(null)
    }
  }

  async function saveSearchResource() {
    setSavingResource('search')
    setFeedback(null)

    try {
      const nextConfig = await api.updateResourceConfiguration({
        search: {
          baseUrl: searchForm.baseUrl,
          apiKey: searchForm.apiKey.trim().length > 0 ? searchForm.apiKey : undefined,
          maxResults: searchForm.maxResults,
          updatedBy: 'mirrorbrain-web',
        },
      })

      setConfig(nextConfig)
      setSearchForm(createSearchFormState(nextConfig.search))
      setFeedback({ kind: 'success', message: 'Search resource saved.' })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Failed to save search resource.',
      })
    } finally {
      setSavingResource(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {feedback && (
        <div
          role="alert"
          className={`rounded-lg border p-3 font-body text-sm font-medium ${
            feedback.kind === 'success'
              ? 'border-green-300 bg-green-100 text-green-700'
              : 'border-red-300 bg-red-100 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {loading ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3">
          <LoadingSpinner size="large" />
          <p className="font-body text-sm text-inkMuted-48">Loading configuration...</p>
        </Card>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="grid gap-4 xl:grid-cols-3">
            <OpenAICompatibleResourceCard
              title="LLM"
              subtitle="OpenAI compatible chat"
              envBaseUrl="MIRRORBRAIN_LLM_API_BASE"
              envApiKey="MIRRORBRAIN_LLM_API_KEY"
              envModel="MIRRORBRAIN_LLM_MODEL"
              config={config.llm}
              form={llmForm}
              saving={savingResource === 'llm'}
              onFormChange={setLlmForm}
              onSave={() => saveOpenAICompatibleResource('llm', llmForm)}
            />
            <OpenAICompatibleResourceCard
              title="Embedding"
              subtitle="OpenAI compatible vectors"
              envBaseUrl="MIRRORBRAIN_EMBEDDING_API_BASE"
              envApiKey="MIRRORBRAIN_EMBEDDING_API_KEY"
              envModel="MIRRORBRAIN_EMBEDDING_MODEL"
              config={config.embedding}
              form={embeddingForm}
              saving={savingResource === 'embedding'}
              onFormChange={setEmbeddingForm}
              onSave={() => saveOpenAICompatibleResource('embedding', embeddingForm)}
            />
            <SearchResourceCard
              config={config.search}
              form={searchForm}
              saving={savingResource === 'search'}
              onFormChange={setSearchForm}
              onSave={saveSearchResource}
            />
          </div>

          <Card>
            <h2 className="font-heading text-lg font-semibold text-ink">Environment Reference</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {ENV_REFERENCE.map((name) => (
                <code
                  key={name}
                  className="rounded-md border border-hairline bg-surfacePearl px-3 py-2 font-mono text-xs text-ink"
                >
                  {name}
                </code>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function OpenAICompatibleResourceCard({
  title,
  subtitle,
  config,
  form,
  saving,
  envBaseUrl,
  envApiKey,
  envModel,
  onFormChange,
  onSave,
}: {
  title: string
  subtitle: string
  config: OpenAICompatibleResourceConfig
  form: OpenAICompatibleFormState
  saving: boolean
  envBaseUrl: string
  envApiKey: string
  envModel: string
  onFormChange: (form: OpenAICompatibleFormState) => void
  onSave: () => void
}) {
  return (
    <Card className="flex min-h-[520px] flex-col gap-5">
      <ResourceHeader
        title={title}
        subtitle={subtitle}
        enabled={config.enabled}
        apiKeyConfigured={config.apiKeyConfigured}
      />

      <div className="space-y-4">
        <Input
          id={`${title.toLowerCase()}-provider`}
          label="Provider Name"
          value={form.providerName}
          onChange={(event) => onFormChange({ ...form, providerName: event.target.value })}
        />
        <Input
          id={`${title.toLowerCase()}-base-url`}
          label="API Base URL"
          helpText={envBaseUrl}
          value={form.baseUrl}
          onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}
        />
        <Input
          id={`${title.toLowerCase()}-model`}
          label="Model"
          helpText={envModel}
          value={form.model}
          onChange={(event) => onFormChange({ ...form, model: event.target.value })}
        />
        <Input
          id={`${title.toLowerCase()}-api-key`}
          label="API Key"
          type="password"
          helpText={envApiKey}
          value={form.apiKey}
          placeholder={keyPlaceholder(config.apiKeyConfigured)}
          onChange={(event) => onFormChange({ ...form, apiKey: event.target.value })}
        />
      </div>

      <Button variant="primary" loading={saving} onClick={onSave} className="mt-auto">
        Save {title}
      </Button>
    </Card>
  )
}

function SearchResourceCard({
  config,
  form,
  saving,
  onFormChange,
  onSave,
}: {
  config: TavilySearchResourceConfig
  form: TavilySearchFormState
  saving: boolean
  onFormChange: (form: TavilySearchFormState) => void
  onSave: () => void
}) {
  return (
    <Card className="flex min-h-[520px] flex-col gap-5">
      <ResourceHeader
        title="Search"
        subtitle="Tavily"
        enabled={config.enabled}
        apiKeyConfigured={config.apiKeyConfigured}
      />

      <div className="space-y-4">
        <Input
          id="search-base-url"
          label="API Base URL"
          helpText="MIRRORBRAIN_TAVILY_API_BASE"
          value={form.baseUrl}
          onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}
        />
        <Input
          id="search-max-results"
          label="Max Results"
          type="number"
          min={1}
          helpText="MIRRORBRAIN_TAVILY_MAX_RESULTS"
          value={form.maxResults === 0 ? '' : form.maxResults}
          onChange={(event) =>
            onFormChange({ ...form, maxResults: Number(event.target.value) })
          }
        />
        <Input
          id="search-api-key"
          label="API Key"
          type="password"
          helpText="MIRRORBRAIN_TAVILY_API_KEY"
          value={form.apiKey}
          placeholder={keyPlaceholder(config.apiKeyConfigured)}
          onChange={(event) => onFormChange({ ...form, apiKey: event.target.value })}
        />
      </div>

      <Button variant="primary" loading={saving} onClick={onSave} className="mt-auto">
        Save Search
      </Button>
    </Card>
  )
}

function ResourceHeader({
  title,
  subtitle,
  enabled,
  apiKeyConfigured,
}: {
  title: string
  subtitle: string
  enabled: boolean
  apiKeyConfigured: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline pb-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
        <p className="font-body text-sm text-inkMuted-48">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span
          className={`rounded-full px-2.5 py-1 font-heading text-[11px] font-semibold uppercase ${
            enabled
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-inkMuted-80'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
        <span className="font-heading text-[11px] font-semibold uppercase text-inkMuted-48">
          Key {apiKeyConfigured ? 'set' : 'empty'}
        </span>
      </div>
    </div>
  )
}
