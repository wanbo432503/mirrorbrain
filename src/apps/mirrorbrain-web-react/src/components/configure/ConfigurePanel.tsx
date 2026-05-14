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
import Checkbox from '../forms/Checkbox'
import Input from '../forms/Input'

interface ConfigurePanelProps {
  api?: MirrorBrainWebAppApi
}

type ResourceFeedback = {
  kind: 'success' | 'error'
  message: string
}

interface OpenAICompatibleFormState {
  enabled: boolean
  providerName: string
  baseUrl: string
  model: string
  apiKey: string
}

interface TavilySearchFormState {
  enabled: boolean
  baseUrl: string
  apiKey: string
  maxResults: number
}

function createDefaultConfig(): ResourceConfiguration {
  return {
    llm: {
      enabled: false,
      providerName: 'OpenAI-compatible chat',
      baseUrl: 'https://api.openai.com/v1',
      model: '',
      apiKeyConfigured: false,
    },
    embedding: {
      enabled: false,
      providerName: 'OpenAI-compatible embeddings',
      baseUrl: 'https://api.openai.com/v1',
      model: '',
      apiKeyConfigured: false,
    },
    search: {
      enabled: false,
      providerName: 'tavily',
      baseUrl: 'https://api.tavily.com',
      apiKeyConfigured: false,
      maxResults: 5,
    },
  }
}

function createOpenAIFormState(
  config: OpenAICompatibleResourceConfig,
): OpenAICompatibleFormState {
  return {
    enabled: config.enabled,
    providerName: config.providerName,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: '',
  }
}

function createSearchFormState(config: TavilySearchResourceConfig): TavilySearchFormState {
  return {
    enabled: config.enabled,
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
          enabled: form.enabled,
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
          enabled: searchForm.enabled,
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
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-3">
          <OpenAICompatibleResourceCard
            title="LLM"
            subtitle="OpenAI compatible chat"
            config={config.llm}
            form={llmForm}
            saving={savingResource === 'llm'}
            onFormChange={setLlmForm}
            onSave={() => saveOpenAICompatibleResource('llm', llmForm)}
          />
          <OpenAICompatibleResourceCard
            title="Embedding"
            subtitle="OpenAI compatible vectors"
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
  onFormChange,
  onSave,
}: {
  title: string
  subtitle: string
  config: OpenAICompatibleResourceConfig
  form: OpenAICompatibleFormState
  saving: boolean
  onFormChange: (form: OpenAICompatibleFormState) => void
  onSave: () => void
}) {
  return (
    <Card className="flex min-h-[520px] flex-col gap-5">
      <ResourceHeader
        title={title}
        subtitle={subtitle}
        enabled={form.enabled}
        apiKeyConfigured={config.apiKeyConfigured}
      />

      <div className="space-y-4">
        <Checkbox
          id={`${title.toLowerCase()}-enabled`}
          checked={form.enabled}
          onChange={(event) => onFormChange({ ...form, enabled: event.target.checked })}
          label="Enabled"
        />
        <Input
          id={`${title.toLowerCase()}-provider`}
          label="Provider Name"
          value={form.providerName}
          onChange={(event) => onFormChange({ ...form, providerName: event.target.value })}
        />
        <Input
          id={`${title.toLowerCase()}-base-url`}
          label="API Base URL"
          value={form.baseUrl}
          onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}
        />
        <Input
          id={`${title.toLowerCase()}-model`}
          label="Model"
          value={form.model}
          onChange={(event) => onFormChange({ ...form, model: event.target.value })}
        />
        <Input
          id={`${title.toLowerCase()}-api-key`}
          label="API Key"
          type="password"
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
        enabled={form.enabled}
        apiKeyConfigured={config.apiKeyConfigured}
      />

      <div className="space-y-4">
        <Checkbox
          id="search-enabled"
          checked={form.enabled}
          onChange={(event) => onFormChange({ ...form, enabled: event.target.checked })}
          label="Enabled"
        />
        <Input
          id="search-base-url"
          label="API Base URL"
          value={form.baseUrl}
          onChange={(event) => onFormChange({ ...form, baseUrl: event.target.value })}
        />
        <Input
          id="search-max-results"
          label="Max Results"
          type="number"
          min={1}
          value={form.maxResults}
          onChange={(event) =>
            onFormChange({ ...form, maxResults: Number(event.target.value) })
          }
        />
        <Input
          id="search-api-key"
          label="API Key"
          type="password"
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
