import type {
  MemoryEvent,
  KnowledgeArtifact,
  SkillArtifact,
  CandidateMemory,
  CandidateReviewSuggestion,
  ReviewedMemory,
  BrowserSyncSummary,
} from '../types/index';

export interface MirrorBrainWebAppApi {
  getHealth(): Promise<{ status: 'running' | 'stopped' }>;
  listMemory(): Promise<MemoryEvent[]>;
  listKnowledge(): Promise<KnowledgeArtifact[]>;
  listKnowledgeTopics(): Promise<
    Array<{
      topicKey: string;
      title: string;
      summary: string;
      currentBestKnowledgeId: string;
      updatedAt?: string;
      recencyLabel: string;
    }>
  >;
  listSkills(): Promise<SkillArtifact[]>;
  syncBrowser(): Promise<BrowserSyncSummary>;
  syncShell(): Promise<BrowserSyncSummary>;
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
  generateKnowledge(
    reviewedMemories: ReviewedMemory[]
  ): Promise<KnowledgeArtifact>;
  generateSkill(reviewedMemories: ReviewedMemory[]): Promise<SkillArtifact>;
  saveKnowledgeArtifact?(
    artifact: KnowledgeArtifact
  ): Promise<KnowledgeArtifact>;
  saveSkillArtifact?(artifact: SkillArtifact): Promise<SkillArtifact>;
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

  return {
    async getHealth() {
      const response = await fetch(`${baseUrl}/health`);
      const body = await readJson<{ status: 'running' | 'stopped' }>(response);
      return { status: body.status };
    },

    async listMemory() {
      const response = await fetch(`${baseUrl}/memory`);
      const body = await readJson<{ items: MemoryEvent[] }>(response);
      return body.items;
    },

    async listKnowledge() {
      const response = await fetch(`${baseUrl}/knowledge`);
      const body = await readJson<{ items: KnowledgeArtifact[] }>(response);
      return body.items;
    },

    async listKnowledgeTopics() {
      const response = await fetch(`${baseUrl}/knowledge/topics`);
      const body = await readJson<{
        items: Array<{
          topicKey: string;
          title: string;
          summary: string;
          currentBestKnowledgeId: string;
          updatedAt?: string;
          recencyLabel: string;
        }>;
      }>(response);
      return body.items;
    },

    async listSkills() {
      const response = await fetch(`${baseUrl}/skills`);
      const body = await readJson<{ items: SkillArtifact[] }>(response);
      return body.items;
    },

    async syncBrowser() {
      const response = await fetch(`${baseUrl}/sync/browser`, {
        method: 'POST',
      });
      const body = await readJson<{ sync: BrowserSyncSummary }>(response);
      return body.sync;
    },

    async syncShell() {
      const response = await fetch(`${baseUrl}/sync/shell`, {
        method: 'POST',
      });
      const body = await readJson<{ sync: BrowserSyncSummary }>(response);
      return body.sync;
    },

    async createDailyCandidates(reviewDate: string, reviewTimeZone?: string) {
      const response = await fetch(`${baseUrl}/candidate-memories/daily`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewDate, reviewTimeZone }),
      });
      const body = (await response.json()) as { candidates: CandidateMemory[] };
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

    async generateKnowledge(reviewedMemories: ReviewedMemory[]) {
      const response = await fetch(`${baseUrl}/knowledge/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewedMemories }),
      });
      const body = (await response.json()) as { artifact: KnowledgeArtifact };
      return body.artifact;
    },

    async generateSkill(reviewedMemories: ReviewedMemory[]) {
      const response = await fetch(`${baseUrl}/skills/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewedMemories }),
      });
      const body = (await response.json()) as { artifact: SkillArtifact };
      return body.artifact;
    },

    async saveKnowledgeArtifact(artifact: KnowledgeArtifact) {
      const response = await fetch(`${baseUrl}/knowledge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ artifact }),
      });
      const body = await readJson<{ artifact: KnowledgeArtifact }>(response);
      return body.artifact;
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
  };
}