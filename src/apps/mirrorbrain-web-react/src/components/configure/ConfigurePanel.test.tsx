// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MirrorBrainWebAppApi } from '../../api/client'
import type { ResourceConfiguration } from '../../types/index'
import ConfigurePanel from './ConfigurePanel'

afterEach(() => {
  cleanup()
})

function createResourceConfiguration(): ResourceConfiguration {
  return {
    llm: {
      enabled: false,
      providerName: 'OpenAI-compatible chat',
      baseUrl: 'https://api.openai.com/v1',
      model: '',
      apiKeyConfigured: true,
    },
    embedding: {
      enabled: true,
      providerName: 'OpenAI-compatible embeddings',
      baseUrl: 'https://embeddings.example.com/v1',
      model: 'text-embedding-example',
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

function createApi(config = createResourceConfiguration()): MirrorBrainWebAppApi {
  return {
    getHealth: vi.fn(),
    listMemory: vi.fn(),
    listSkills: vi.fn(),
    syncShell: vi.fn(),
    importSourceLedgers: vi.fn(),
    listSourceAuditEvents: vi.fn(),
    listSourceStatuses: vi.fn(),
    updateSourceConfig: vi.fn(),
    analyzeWorkSessions: vi.fn(),
    reviewWorkSessionCandidate: vi.fn(),
    listKnowledgeArticleTree: vi.fn(),
    generateKnowledgeArticlePreview: vi.fn(),
    generateKnowledgeArticleDraft: vi.fn(),
    publishKnowledgeArticleDraft: vi.fn(),
    reviseKnowledgeArticle: vi.fn(),
    deleteKnowledgeArticle: vi.fn(),
    createDailyCandidates: vi.fn(),
    suggestCandidateReviews: vi.fn(),
    reviewCandidateMemory: vi.fn(),
    undoCandidateReview: vi.fn(),
    generateSkill: vi.fn(),
    getResourceConfiguration: vi.fn(async () => config),
    updateResourceConfiguration: vi.fn(async (update) => ({
      ...config,
      llm: update.llm
        ? {
            enabled: update.llm.enabled,
            providerName: update.llm.providerName,
            baseUrl: update.llm.baseUrl,
            model: update.llm.model,
            apiKeyConfigured: Boolean(update.llm.apiKey),
            updatedAt: '2026-05-14T10:00:00.000Z',
            updatedBy: update.llm.updatedBy,
          }
        : config.llm,
      search: update.search
        ? {
            enabled: update.search.enabled,
            providerName: 'tavily',
            baseUrl: update.search.baseUrl,
            apiKeyConfigured: Boolean(update.search.apiKey),
            maxResults: update.search.maxResults,
            updatedAt: '2026-05-14T10:00:00.000Z',
            updatedBy: update.search.updatedBy,
          }
        : config.search,
    })),
  } as unknown as MirrorBrainWebAppApi
}

describe('ConfigurePanel', () => {
  it('loads provider resources without rendering stored API keys', async () => {
    const api = createApi()

    render(<ConfigurePanel api={api} />)

    expect(await screen.findByRole('heading', { name: 'LLM' })).not.toBeNull()
    expect(screen.getByDisplayValue('OpenAI-compatible chat')).not.toBeNull()
    expect(screen.getByPlaceholderText('Configured. Leave blank to keep current key.')).not.toBeNull()
    expect(screen.queryByDisplayValue('existing-llm-key')).toBeNull()
    expect(api.getResourceConfiguration).toHaveBeenCalledOnce()
  })

  it('saves only the edited LLM resource with an optional new API key', async () => {
    const user = userEvent.setup()
    const api = createApi()

    render(<ConfigurePanel api={api} />)

    await screen.findByRole('heading', { name: 'LLM' })
    await user.type(screen.getAllByLabelText('Model')[0], 'gpt-example')
    await user.type(screen.getAllByLabelText('API Key')[0], 'new-key')
    await user.click(screen.getByRole('button', { name: 'Save LLM' }))

    await waitFor(() => {
      expect(api.updateResourceConfiguration).toHaveBeenCalledWith({
        llm: {
          enabled: false,
          providerName: 'OpenAI-compatible chat',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-example',
          apiKey: 'new-key',
          updatedBy: 'mirrorbrain-web',
        },
      })
    })
    expect((await screen.findByRole('alert')).textContent).toContain('LLM resource saved.')
  })
})
