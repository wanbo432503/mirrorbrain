import type {
  MemoryEvent,
  SkillArtifact,
  CandidateMemory,
  CandidateReviewSuggestion,
  ReviewedMemory,
  BrowserSyncSummary,
  SourceAuditEvent,
  SourceInstanceConfig,
  SourceInstanceSummary,
  SourceLedgerImportResult,
  SourceLedgerKind,
  AnalysisWindowPreset,
  ReviewWorkSessionInput,
  WorkSessionAnalysisResult,
  WorkSessionCandidate,
  WorkSessionReviewResult,
  KnowledgeArticleTree,
  GenerateKnowledgeArticlePreviewRequest,
  KnowledgeArticlePreview,
  GenerateKnowledgeArticleDraftRequest,
  KnowledgeArticleDraft,
  PublishKnowledgeArticleDraftRequest,
  PublishKnowledgeArticleDraftResult,
  ReviseKnowledgeArticleRequest,
  ReviseKnowledgeArticleResult,
  ResourceConfiguration,
  ResourceConfigurationUpdate,
} from '../types/index';

export interface PaginatedMemoryEvents {
  items: MemoryEvent[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface MirrorBrainWebAppApi {
  getHealth(): Promise<{ status: 'running' | 'stopped' }>;
  listMemory(
    page?: number,
    pageSize?: number,
    filter?: {
      sourceKind?: SourceLedgerKind;
      sourceInstanceId?: string;
    },
  ): Promise<PaginatedMemoryEvents>;
  listSkills(): Promise<SkillArtifact[]>;
  listCandidateMemoriesByDate?(reviewDate: string): Promise<CandidateMemory[]>;
  syncShell(): Promise<BrowserSyncSummary>;
  importSourceLedgers(): Promise<SourceLedgerImportResult>;
  listSourceAuditEvents(filter?: {
    sourceKind?: SourceLedgerKind;
    sourceInstanceId?: string;
  }): Promise<SourceAuditEvent[]>;
  listSourceStatuses(): Promise<SourceInstanceSummary[]>;
  updateSourceConfig(config: {
    sourceKind: SourceLedgerKind;
    sourceInstanceId: string;
    enabled: boolean;
    updatedBy: string;
  }): Promise<SourceInstanceConfig>;
  getResourceConfiguration(): Promise<ResourceConfiguration>;
  updateResourceConfiguration(
    update: ResourceConfigurationUpdate
  ): Promise<ResourceConfiguration>;
  analyzeWorkSessions(preset: AnalysisWindowPreset): Promise<WorkSessionAnalysisResult>;
  reviewWorkSessionCandidate(
    candidate: WorkSessionCandidate,
    review: ReviewWorkSessionInput
  ): Promise<WorkSessionReviewResult>;
  listKnowledgeArticleTree(): Promise<KnowledgeArticleTree>;
  generateKnowledgeArticlePreview(
    request: GenerateKnowledgeArticlePreviewRequest
  ): Promise<KnowledgeArticlePreview>;
  generateKnowledgeArticleDraft(
    request: GenerateKnowledgeArticleDraftRequest
  ): Promise<KnowledgeArticleDraft>;
  publishKnowledgeArticleDraft(
    request: PublishKnowledgeArticleDraftRequest
  ): Promise<PublishKnowledgeArticleDraftResult>;
  reviseKnowledgeArticle(
    request: ReviseKnowledgeArticleRequest
  ): Promise<ReviseKnowledgeArticleResult>;
  deleteKnowledgeArticle(articleId: string): Promise<void>;
  createDailyCandidates(
    reviewDate: string,
    reviewTimeZone?: string
  ): Promise<CandidateMemory[]>;
  suggestCandidateReviews(
    candidates: CandidateMemory[]
  ): Promise<CandidateReviewSuggestion[]>;
  reviewCandidateMemory(
    candidate: CandidateMemory,
    review: { decision: ReviewedMemory['decision']; reviewedAt: string }
  ): Promise<ReviewedMemory>;
  undoCandidateReview(reviewedMemoryId: string): Promise<void>;
  generateSkill(reviewedMemories: ReviewedMemory[]): Promise<SkillArtifact>;
  saveSkillArtifact?(artifact: SkillArtifact): Promise<SkillArtifact>;
  deleteSkillArtifact?(artifactId: string): Promise<void>;
  deleteCandidateMemory?(candidateMemoryId: string): Promise<void>;
}

export function createMirrorBrainBrowserApi(
  baseUrl: string
): MirrorBrainWebAppApi {
  const readJson = async <T>(response: Response): Promise<T> => {
    const body = (await response.json()) as T & {
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        body.message ?? body.error ?? `Request failed with status ${response.status}`
      );
    }

    return body;
  };

  const ensureNoContent = async (
    response: Response,
    defaultErrorMessage: string,
  ): Promise<void> => {
    if (response.status === 204) {
      return;
    }

    if (response.ok) {
      throw new Error(
        `${defaultErrorMessage}: expected 204, received ${response.status}`,
      );
    }

    let errorMessage = defaultErrorMessage;

    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (body.message || body.error) {
        errorMessage = body.message ?? body.error ?? defaultErrorMessage;
      }
    } catch {
      errorMessage += `: ${response.statusText}`;
    }

    throw new Error(errorMessage);
  };

  return {
    async getHealth() {
      const response = await fetch(`${baseUrl}/health`);
      const body = await readJson<{ status: 'running' | 'stopped' }>(response);
      return { status: body.status };
    },

    async listMemory(
      page?: number,
      pageSize?: number,
      filter: {
        sourceKind?: SourceLedgerKind;
        sourceInstanceId?: string;
      } = {},
    ) {
      const params = new URLSearchParams();
      if (page !== undefined) params.set('page', String(page));
      if (pageSize !== undefined) params.set('pageSize', String(pageSize));
      if (filter.sourceKind !== undefined) params.set('sourceKind', filter.sourceKind);
      if (filter.sourceInstanceId !== undefined) {
        params.set('sourceInstanceId', filter.sourceInstanceId);
      }

      const url = `${baseUrl}/memory${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const body = await readJson<PaginatedMemoryEvents>(response);
      return body;
    },

    async listSkills() {
      const response = await fetch(`${baseUrl}/skills`);
      const body = await readJson<{ items: SkillArtifact[] }>(response);
      return body.items;
    },

    async listCandidateMemoriesByDate(reviewDate: string) {
      const response = await fetch(`${baseUrl}/candidate-memories?reviewDate=${reviewDate}`);
      const body = await readJson<{ candidates: CandidateMemory[] }>(response);
      return body.candidates;
    },

    async syncShell() {
      const response = await fetch(`${baseUrl}/sync/shell`, {
        method: 'POST',
      });
      const body = await readJson<{ sync: BrowserSyncSummary }>(response);
      return body.sync;
    },

    async importSourceLedgers() {
      const response = await fetch(`${baseUrl}/sources/import`, {
        method: 'POST',
      });
      const body = await readJson<{ import: SourceLedgerImportResult }>(response);
      return body.import;
    },

    async listSourceAuditEvents(filter = {}) {
      const params = new URLSearchParams();
      if (filter.sourceKind !== undefined) {
        params.set('sourceKind', filter.sourceKind);
      }
      if (filter.sourceInstanceId !== undefined) {
        params.set('sourceInstanceId', filter.sourceInstanceId);
      }

      const queryString = params.toString();
      const response = await fetch(
        `${baseUrl}/sources/audit${queryString ? `?${queryString}` : ''}`
      );
      const body = await readJson<{ items: SourceAuditEvent[] }>(response);
      return body.items;
    },

    async listSourceStatuses() {
      const response = await fetch(`${baseUrl}/sources/status`);
      const body = await readJson<{ items: SourceInstanceSummary[] }>(response);
      return body.items;
    },

    async updateSourceConfig(config) {
      const response = await fetch(`${baseUrl}/sources/config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const body = await readJson<{ config: SourceInstanceConfig }>(response);
      return body.config;
    },

    async getResourceConfiguration() {
      const response = await fetch(`${baseUrl}/resources/config`);
      const body = await readJson<{ config: ResourceConfiguration }>(response);
      return body.config;
    },

    async updateResourceConfiguration(update) {
      const response = await fetch(`${baseUrl}/resources/config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      });
      const body = await readJson<{ config: ResourceConfiguration }>(response);
      return body.config;
    },

    async analyzeWorkSessions(preset: AnalysisWindowPreset) {
      const response = await fetch(`${baseUrl}/work-sessions/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      const body = await readJson<{ analysis: WorkSessionAnalysisResult }>(response);
      return body.analysis;
    },

    async reviewWorkSessionCandidate(candidate, review) {
      const response = await fetch(`${baseUrl}/work-sessions/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidate, review }),
      });
      const body = await readJson<WorkSessionReviewResult>(response);
      return body;
    },

    async listKnowledgeArticleTree() {
      const response = await fetch(`${baseUrl}/knowledge-articles/tree`);
      return readJson<KnowledgeArticleTree>(response);
    },

    async generateKnowledgeArticlePreview(request) {
      const response = await fetch(`${baseUrl}/knowledge-articles/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = await readJson<{ preview: KnowledgeArticlePreview }>(response);
      return body.preview;
    },

    async generateKnowledgeArticleDraft(request) {
      const response = await fetch(`${baseUrl}/knowledge-articles/drafts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = await readJson<{ draft: KnowledgeArticleDraft }>(response);
      return body.draft;
    },

    async publishKnowledgeArticleDraft(request) {
      const response = await fetch(`${baseUrl}/knowledge-articles/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      return readJson<PublishKnowledgeArticleDraftResult>(response);
    },

    async reviseKnowledgeArticle(request) {
      const response = await fetch(`${baseUrl}/knowledge-articles/revise`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      return readJson<ReviseKnowledgeArticleResult>(response);
    },

    async deleteKnowledgeArticle(articleId: string) {
      const response = await fetch(
        `${baseUrl}/knowledge-articles/${encodeURIComponent(articleId)}`,
        {
          method: 'DELETE',
        },
      );

      await ensureNoContent(response, 'Failed to delete Knowledge Article');
    },

    async createDailyCandidates(reviewDate: string, reviewTimeZone?: string) {
      const response = await fetch(`${baseUrl}/candidate-memories/daily`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewDate, reviewTimeZone }),
      });
      const body = await readJson<{ candidates: CandidateMemory[] }>(response);
      return body.candidates;
    },

    async suggestCandidateReviews(candidates: CandidateMemory[]) {
      const response = await fetch(`${baseUrl}/candidate-reviews/suggestions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidates }),
      });
      const body = (await response.json()) as {
        suggestions: CandidateReviewSuggestion[];
      };
      return body.suggestions;
    },

    async reviewCandidateMemory(
      candidate: CandidateMemory,
      review: { decision: ReviewedMemory['decision']; reviewedAt: string }
    ) {
      const response = await fetch(`${baseUrl}/reviewed-memories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidate, review }),
      });
      const body = (await response.json()) as {
        reviewedMemory: ReviewedMemory;
      };
      return body.reviewedMemory;
    },

    async undoCandidateReview(reviewedMemoryId: string) {
      const response = await fetch(`${baseUrl}/reviewed-memories/${reviewedMemoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Parse error body to get meaningful message from backend
        let errorMessage = `Failed to undo candidate review`;

        try {
          const body = await response.json();
          if (body.message || body.error) {
            errorMessage = body.message || body.error;
          }
        } catch {
          // If parsing fails, use status text
          errorMessage += `: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }
      // Success (204 No Content) - return void implicitly
    },

    async generateSkill(reviewedMemories: ReviewedMemory[]) {
      const response = await fetch(`${baseUrl}/skills/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewedMemories }),
      });
      const body = await readJson<{ artifact: SkillArtifact }>(response);
      return body.artifact;
    },

    async deleteSkillArtifact(artifactId: string) {
      const response = await fetch(`${baseUrl}/skills/${artifactId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to delete skill artifact';

        try {
          const body = await response.json();
          if (body.message || body.error) {
            errorMessage = body.message || body.error;
          }
        } catch {
          errorMessage += `: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }
    },

    async saveSkillArtifact(artifact: SkillArtifact) {
      const response = await fetch(`${baseUrl}/skills`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifact }),
      });
      const body = await readJson<{ artifact: SkillArtifact }>(response);
      return body.artifact;
    },

    async deleteCandidateMemory(candidateMemoryId: string) {
      const response = await fetch(`${baseUrl}/candidate-memories/${candidateMemoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          // File already deleted, treat as success
          return;
        }

        let errorMessage = 'Failed to delete candidate memory';
        try {
          const body = await response.json();
          errorMessage = body.message || body.error || errorMessage;
        } catch {
          errorMessage += `: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
    },
  };
}
