import type {
  CandidateMemory,
  KnowledgeArtifact,
  MemoryEvent,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';

interface BrowserSyncSummary {
  sourceKey: string;
  strategy: 'initial-backfill' | 'incremental';
  importedCount: number;
  lastSyncedAt: string;
}

interface MirrorBrainWebAppState {
  serviceStatus: 'running' | 'stopped' | 'unknown';
  memoryEvents: MemoryEvent[];
  candidateMemory: CandidateMemory | null;
  reviewedMemory: ReviewedMemory | null;
  knowledgeArtifact: KnowledgeArtifact | null;
  skillArtifact: SkillArtifact | null;
  lastSyncSummary: BrowserSyncSummary | null;
  feedback: {
    kind: 'success' | 'error' | 'info';
    message: string;
  } | null;
}

interface MirrorBrainWebAppApi {
  getHealth(): Promise<{
    status: 'running' | 'stopped';
  }>;
  listMemory(): Promise<MemoryEvent[]>;
  listKnowledge(): Promise<KnowledgeArtifact[]>;
  listSkills(): Promise<SkillArtifact[]>;
  syncBrowser(): Promise<BrowserSyncSummary>;
  createCandidateMemory(memoryEvents: MemoryEvent[]): Promise<CandidateMemory>;
  reviewCandidateMemory(
    candidate: CandidateMemory,
    review: { decision: ReviewedMemory['decision'] },
  ): Promise<ReviewedMemory>;
  generateKnowledge(
    reviewedMemories: ReviewedMemory[],
  ): Promise<KnowledgeArtifact>;
  generateSkill(reviewedMemories: ReviewedMemory[]): Promise<SkillArtifact>;
}

interface CreateMirrorBrainWebAppInput {
  api: MirrorBrainWebAppApi;
}

interface MountMirrorBrainWebAppInput {
  api?: MirrorBrainWebAppApi;
  baseUrl?: string;
  doc?: Document;
}

function renderMemoryList(memoryEvents: MemoryEvent[]): string {
  if (memoryEvents.length === 0) {
    return '<li>No memory events imported yet.</li>';
  }

  return memoryEvents
    .map(
      (event) =>
        `<li><strong>${event.id}</strong> <span>${event.sourceType}</span></li>`,
    )
    .join('');
}

function renderArtifact(label: string, artifact: { id: string } | null): string {
  return artifact === null
    ? `<p>${label}: not generated</p>`
    : `<p>${label}: ${artifact.id}</p>`;
}

function renderFeedback(
  feedback: MirrorBrainWebAppState['feedback'],
): string {
  if (feedback === null) {
    return '<p>Status: ready</p>';
  }

  return `<p data-feedback-kind="${feedback.kind}">Status: ${feedback.message}</p>`;
}

export function renderMirrorBrainWebApp(
  state: MirrorBrainWebAppState,
): string {
  const syncSummary =
    state.lastSyncSummary === null
      ? '<p>Last Sync: not run yet</p>'
      : `<p>Last Sync: ${state.lastSyncSummary.sourceKey} / ${state.lastSyncSummary.strategy} / ${state.lastSyncSummary.importedCount} / ${state.lastSyncSummary.lastSyncedAt}</p>`;

  return [
    '<main class="mirrorbrain-app">',
    '<header>',
    '<h1>MirrorBrain Phase 1 MVP</h1>',
    `<p>Service Status: ${state.serviceStatus}</p>`,
    syncSummary,
    renderFeedback(state.feedback),
    '<div class="mirrorbrain-actions">',
    '<button type="button" data-action="sync-browser">Sync Browser Memory</button>',
    '<button type="button" data-action="create-candidate">Create Candidate</button>',
    '<button type="button" data-action="keep-candidate">Keep Candidate</button>',
    '<button type="button" data-action="generate-knowledge">Generate Knowledge</button>',
    '<button type="button" data-action="generate-skill">Generate Skill</button>',
    '</div>',
    '</header>',
    '<section>',
    '<h2>Memory</h2>',
    `<ul>${renderMemoryList(state.memoryEvents)}</ul>`,
    '</section>',
    '<section>',
    '<h2>Review</h2>',
    renderArtifact('Candidate', state.candidateMemory),
    renderArtifact('Reviewed', state.reviewedMemory),
    '</section>',
    '<section>',
    '<h2>Artifacts</h2>',
    renderArtifact('Knowledge', state.knowledgeArtifact),
    renderArtifact('Skill', state.skillArtifact),
    '</section>',
    '</main>',
  ].join('');
}

export function createMirrorBrainWebApp(input: CreateMirrorBrainWebAppInput) {
  const state: MirrorBrainWebAppState = {
    serviceStatus: 'unknown',
    memoryEvents: [],
    candidateMemory: null,
    reviewedMemory: null,
    knowledgeArtifact: null,
    skillArtifact: null,
    lastSyncSummary: null,
    feedback: null,
  };

  const setFeedback = (feedback: MirrorBrainWebAppState['feedback']) => {
    state.feedback = feedback;
  };

  return {
    state,
    async load() {
      const [health, memoryEvents, knowledgeArtifacts, skillArtifacts] =
        await Promise.all([
          input.api.getHealth(),
          input.api.listMemory(),
          input.api.listKnowledge(),
          input.api.listSkills(),
        ]);

      state.serviceStatus = health.status;
      state.memoryEvents = memoryEvents;
      state.knowledgeArtifact = knowledgeArtifacts[0] ?? null;
      state.skillArtifact = skillArtifacts[0] ?? null;
      setFeedback({
        kind: 'info',
        message: `Loaded ${memoryEvents.length} memory events.`,
      });
    },
    async syncBrowserMemory() {
      state.lastSyncSummary = await input.api.syncBrowser();
      state.memoryEvents = await input.api.listMemory();
      setFeedback({
        kind: 'success',
        message: `Browser sync completed: ${state.lastSyncSummary.importedCount} events imported.`,
      });
    },
    async createCandidateMemory(memoryEventIds: string[]) {
      const selectedEvents = state.memoryEvents.filter((event) =>
        memoryEventIds.includes(event.id),
      );

      if (selectedEvents.length === 0) {
        setFeedback({
          kind: 'error',
          message: 'No memory events are available to create a candidate.',
        });

        return;
      }

      state.candidateMemory = await input.api.createCandidateMemory(selectedEvents);
      setFeedback({
        kind: 'success',
        message: `Candidate created: ${state.candidateMemory.id}`,
      });
    },
    async reviewCurrentCandidate(decision: ReviewedMemory['decision']) {
      if (state.candidateMemory === null) {
        setFeedback({
          kind: 'error',
          message: 'Create a candidate before reviewing it.',
        });

        return;
      }

      state.reviewedMemory = await input.api.reviewCandidateMemory(
        state.candidateMemory,
        {
          decision,
        },
      );
      setFeedback({
        kind: 'success',
        message: `Candidate kept: ${state.reviewedMemory.id}`,
      });
    },
    async generateKnowledge() {
      if (state.reviewedMemory === null) {
        setFeedback({
          kind: 'error',
          message: 'Keep a reviewed memory before generating knowledge.',
        });

        return;
      }

      state.knowledgeArtifact = await input.api.generateKnowledge([
        state.reviewedMemory,
      ]);
      setFeedback({
        kind: 'success',
        message: `Knowledge generated: ${state.knowledgeArtifact.id}`,
      });
    },
    async generateSkill() {
      if (state.reviewedMemory === null) {
        setFeedback({
          kind: 'error',
          message: 'Keep a reviewed memory before generating a skill draft.',
        });

        return;
      }

      state.skillArtifact = await input.api.generateSkill([state.reviewedMemory]);
      setFeedback({
        kind: 'success',
        message: `Skill generated: ${state.skillArtifact.id}`,
      });
    },
  };
}

export function createMirrorBrainBrowserApi(
  baseUrl: string,
): MirrorBrainWebAppApi {
  return {
    async getHealth() {
      const response = await fetch(`${baseUrl}/health`);
      const body = (await response.json()) as {
        status: 'running' | 'stopped';
      };

      return {
        status: body.status,
      };
    },
    async listMemory() {
      const response = await fetch(`${baseUrl}/memory`);
      const body = (await response.json()) as {
        items: MemoryEvent[];
      };

      return body.items;
    },
    async listKnowledge() {
      const response = await fetch(`${baseUrl}/knowledge`);
      const body = (await response.json()) as {
        items: KnowledgeArtifact[];
      };

      return body.items;
    },
    async listSkills() {
      const response = await fetch(`${baseUrl}/skills`);
      const body = (await response.json()) as {
        items: SkillArtifact[];
      };

      return body.items;
    },
    async syncBrowser() {
      const response = await fetch(`${baseUrl}/sync/browser`, {
        method: 'POST',
      });
      const body = (await response.json()) as {
        sync: BrowserSyncSummary;
      };

      return body.sync;
    },
    async createCandidateMemory(memoryEvents) {
      const response = await fetch(`${baseUrl}/candidate-memories`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          memoryEvents,
        }),
      });
      const body = (await response.json()) as {
        candidate: CandidateMemory;
      };

      return body.candidate;
    },
    async reviewCandidateMemory(candidate, review) {
      const response = await fetch(`${baseUrl}/reviewed-memories`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          candidate,
          review,
        }),
      });
      const body = (await response.json()) as {
        reviewedMemory: ReviewedMemory;
      };

      return body.reviewedMemory;
    },
    async generateKnowledge(reviewedMemories) {
      const response = await fetch(`${baseUrl}/knowledge/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reviewedMemories,
        }),
      });
      const body = (await response.json()) as {
        artifact: KnowledgeArtifact;
      };

      return body.artifact;
    },
    async generateSkill(reviewedMemories) {
      const response = await fetch(`${baseUrl}/skills/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reviewedMemories,
        }),
      });
      const body = (await response.json()) as {
        artifact: SkillArtifact;
      };

      return body.artifact;
    },
  };
}

export async function mountMirrorBrainWebApp(
  input: MountMirrorBrainWebAppInput = {},
): Promise<void> {
  const doc = input.doc ?? document;
  const root = doc.getElementById('app-root');

  if (root === null) {
    throw new Error('MirrorBrain web app root element was not found.');
  }

  const app = createMirrorBrainWebApp({
    api:
      input.api ??
      createMirrorBrainBrowserApi(input.baseUrl ?? window.location.origin),
  });

  const bindActions = () => {
    root
      .querySelector('[data-action="sync-browser"]')
      ?.addEventListener('click', async () => {
        await app.syncBrowserMemory();
        render();
      });
    root
      .querySelector('[data-action="create-candidate"]')
      ?.addEventListener('click', async () => {
        await app.createCandidateMemory(app.state.memoryEvents.map((event) => event.id));
        render();
      });
    root
      .querySelector('[data-action="keep-candidate"]')
      ?.addEventListener('click', async () => {
        await app.reviewCurrentCandidate('keep');
        render();
      });
    root
      .querySelector('[data-action="generate-knowledge"]')
      ?.addEventListener('click', async () => {
        await app.generateKnowledge();
        render();
      });
    root
      .querySelector('[data-action="generate-skill"]')
      ?.addEventListener('click', async () => {
        await app.generateSkill();
        render();
      });
  };
  const render = () => {
    root.innerHTML = renderMirrorBrainWebApp(app.state);
    bindActions();
  };

  render();
  await app.load();
  render();
}

if (typeof document !== 'undefined' && document.getElementById('app-root') !== null) {
  void mountMirrorBrainWebApp();
}
