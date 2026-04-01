import type {
  CandidateMemory,
  CandidateReviewSuggestion,
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

type MirrorBrainWebTab = 'memory' | 'review' | 'artifacts';

interface MirrorBrainWebAppState {
  serviceStatus: 'running' | 'stopped' | 'unknown';
  memoryEvents: MemoryEvent[];
  reviewWindowDate: string | null;
  reviewWindowEventCount: number;
  candidateMemories: CandidateMemory[];
  selectedCandidateId: string | null;
  candidateReviewSuggestions: CandidateReviewSuggestion[];
  reviewedMemory: ReviewedMemory | null;
  knowledgeArtifact: KnowledgeArtifact | null;
  skillArtifact: SkillArtifact | null;
  lastSyncSummary: BrowserSyncSummary | null;
  feedback: {
    kind: 'success' | 'error' | 'info';
    message: string;
  } | null;
  activeTab: MirrorBrainWebTab;
  memoryPage: number;
}

interface MirrorBrainWebAppApi {
  getHealth(): Promise<{
    status: 'running' | 'stopped';
  }>;
  listMemory(): Promise<MemoryEvent[]>;
  listKnowledge(): Promise<KnowledgeArtifact[]>;
  listSkills(): Promise<SkillArtifact[]>;
  syncBrowser(): Promise<BrowserSyncSummary>;
  createDailyCandidates(
    reviewDate: string,
    reviewTimeZone?: string,
  ): Promise<CandidateMemory[]>;
  suggestCandidateReviews(
    candidates: CandidateMemory[],
  ): Promise<CandidateReviewSuggestion[]>;
  reviewCandidateMemory(
    candidate: CandidateMemory,
    review: {
      decision: ReviewedMemory['decision'];
      reviewedAt: string;
    },
  ): Promise<ReviewedMemory>;
  generateKnowledge(
    reviewedMemories: ReviewedMemory[],
  ): Promise<KnowledgeArtifact>;
  generateSkill(reviewedMemories: ReviewedMemory[]): Promise<SkillArtifact>;
}

interface CreateMirrorBrainWebAppInput {
  api: MirrorBrainWebAppApi;
  now?: () => string;
  timeZone?: string;
}

interface MountMirrorBrainWebAppInput {
  api?: MirrorBrainWebAppApi;
  baseUrl?: string;
  doc?: Document;
}

const MEMORY_PAGE_SIZE = 5;

function getMemoryPageCount(memoryEvents: MemoryEvent[]): number {
  return Math.max(1, Math.ceil(memoryEvents.length / MEMORY_PAGE_SIZE));
}

function clampMemoryPage(memoryEvents: MemoryEvent[], page: number): number {
  return Math.min(Math.max(1, page), getMemoryPageCount(memoryEvents));
}

function renderTabButton(
  tab: MirrorBrainWebTab,
  activeTab: MirrorBrainWebTab,
  label: string,
): string {
  return `<button type="button" class="mirrorbrain-tab${
    activeTab === tab ? ' is-active' : ''
  }" data-action="switch-tab" data-tab="${tab}" aria-pressed="${
    activeTab === tab ? 'true' : 'false'
  }">${label}</button>`;
}

function renderMemoryList(memoryEvents: MemoryEvent[], page: number): string {
  if (memoryEvents.length === 0) {
    return '<li>No memory events imported yet.</li>';
  }

  const sortedMemoryEvents = [...memoryEvents].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );
  const currentPage = clampMemoryPage(sortedMemoryEvents, page);
  const startIndex = (currentPage - 1) * MEMORY_PAGE_SIZE;
  const pageEvents = sortedMemoryEvents.slice(
    startIndex,
    startIndex + MEMORY_PAGE_SIZE,
  );

  return pageEvents
    .map(
      (event) => {
        const title = String(event.content.title ?? event.content.url ?? 'Untitled');
        const url =
          typeof event.content.url === 'string' ? event.content.url : null;
        const linkedTitle =
          url === null
            ? title
            : `<a href="${url}" target="_blank" rel="noreferrer">${title}</a>`;

        return (
        [
          '<li class="mirrorbrain-record">',
          `<span>${event.sourceType}</span>`,
          `<span>${linkedTitle}${url === null ? '' : ` (${url})`}</span>`,
          `<span>${event.timestamp}</span>`,
          '</li>',
        ].join('')
        );
      },
    )
    .join('');
}

function renderMemoryPanel(state: MirrorBrainWebAppState): string {
  const pageCount = getMemoryPageCount(state.memoryEvents);
  const currentPage = clampMemoryPage(state.memoryEvents, state.memoryPage);

  return [
    '<section class="mirrorbrain-panel">',
    '<h2>Memory</h2>',
    '<p>Imported browser events with page-level browsing to keep the list readable.</p>',
    '<div class="mirrorbrain-actions"><button type="button" data-action="sync-browser">Sync Browser Memory</button></div>',
    `<div class="mirrorbrain-pagination"><button type="button" data-action="memory-first-page"${
      currentPage === 1 ? ' disabled' : ''
    }>First</button><button type="button" data-action="memory-prev-page"${
      currentPage === 1 ? ' disabled' : ''
    }>Previous</button><span>Page ${currentPage} of ${pageCount}</span><button type="button" data-action="memory-next-page"${
      currentPage === pageCount ? ' disabled' : ''
    }>Next</button><button type="button" data-action="memory-last-page"${
      currentPage === pageCount ? ' disabled' : ''
    }>Last</button></div>`,
    `<ul class="mirrorbrain-record-list">${renderMemoryList(
      state.memoryEvents,
      currentPage,
    )}</ul>`,
    '</section>',
  ].join('');
}

function renderDetailRows(
  rows: Array<{ label: string; value: string }>,
): string {
  return rows
    .map(
      (row) =>
        `<div class="mirrorbrain-detail-row"><span>${row.label}</span><strong>${row.value}</strong></div>`,
    )
    .join('');
}

function getSelectedCandidate(
  state: MirrorBrainWebAppState,
): CandidateMemory | null {
  if (state.selectedCandidateId === null) {
    return null;
  }

  return (
    state.candidateMemories.find(
      (candidate) => candidate.id === state.selectedCandidateId,
    ) ?? null
  );
}

function getSelectedCandidateSuggestion(
  state: MirrorBrainWebAppState,
): CandidateReviewSuggestion | null {
  if (state.selectedCandidateId === null) {
    return null;
  }

  return (
    state.candidateReviewSuggestions.find(
      (suggestion) => suggestion.candidateMemoryId === state.selectedCandidateId,
    ) ?? null
  );
}

function renderCandidateList(state: MirrorBrainWebAppState): string {
  if (state.candidateMemories.length === 0) {
    return '<p>No daily candidates generated yet.</p>';
  }

  return state.candidateMemories
    .map((candidate) => {
      const isSelected = candidate.id === state.selectedCandidateId;
      return [
        `<button type="button" class="mirrorbrain-candidate${
          isSelected ? ' is-selected' : ''
        }" data-action="select-candidate" data-candidate-id="${candidate.id}">`,
        `<strong>${candidate.title}</strong>`,
        `<span>${candidate.summary}</span>`,
        `<span>${candidate.memoryEventIds.length} events</span>`,
        '</button>',
      ].join('');
    })
    .join('');
}

function renderReviewPanel(state: MirrorBrainWebAppState): string {
  const candidate = getSelectedCandidate(state);
  const suggestion = getSelectedCandidateSuggestion(state);
  const reviewWindowDescription =
    state.reviewWindowDate === null
      ? 'No review window calculated yet.'
      : `${state.reviewWindowDate} 00:00:00 to ${state.reviewWindowDate} 23:59:59`;

  return [
    '<section class="mirrorbrain-panel">',
    '<h2>Review</h2>',
    '<p>Generate daily candidates, inspect a work stream, and then keep or discard it.</p>',
    '<div class="mirrorbrain-actions"><button type="button" data-action="create-candidate">Create Candidate</button><button type="button" data-action="keep-candidate">Keep Candidate</button><button type="button" data-action="discard-candidate">Discard Candidate</button></div>',
    '<div class="mirrorbrain-review-layout">',
    '<article class="mirrorbrain-detail-card">',
    '<h3>Daily Candidate Streams</h3>',
    `<div class="mirrorbrain-candidate-list">${renderCandidateList(state)}</div>`,
    '</article>',
    '<article class="mirrorbrain-detail-card">',
    '<h3>Selected Candidate</h3>',
    candidate === null
      ? '<p>Select a candidate stream to review it.</p>'
      : renderDetailRows([
          { label: 'Review Window', value: reviewWindowDescription },
          {
            label: 'Matched Memory Events',
            value: String(state.reviewWindowEventCount),
          },
          { label: 'Candidate ID', value: candidate.id },
          { label: 'Title', value: candidate.title },
          { label: 'Theme', value: candidate.theme },
          { label: 'Summary', value: candidate.summary },
          {
            label: 'Memory Event IDs',
            value: candidate.memoryEventIds.join(', '),
          },
          { label: 'Review Date', value: candidate.reviewDate },
        ]),
    '</article>',
    '<article class="mirrorbrain-detail-card">',
    '<h3>AI Review Suggestion</h3>',
    suggestion === null
      ? '<p>No AI suggestion yet.</p>'
      : renderDetailRows([
          { label: 'Recommendation', value: suggestion.recommendation },
          { label: 'Confidence', value: String(suggestion.confidenceScore) },
          { label: 'Priority', value: String(suggestion.priorityScore) },
          { label: 'Rationale', value: suggestion.rationale },
        ]),
    '</article>',
    '<article class="mirrorbrain-detail-card">',
    '<h3>Reviewed Memory</h3>',
    state.reviewedMemory === null
      ? '<p>No reviewed memory yet.</p>'
      : renderDetailRows([
          { label: 'Reviewed ID', value: state.reviewedMemory.id },
          { label: 'Candidate ID', value: state.reviewedMemory.candidateMemoryId },
          { label: 'Decision', value: state.reviewedMemory.decision },
          { label: 'Reviewed At', value: state.reviewedMemory.reviewedAt },
        ]),
    '</article>',
    '</div>',
    '</section>',
  ].join('');
}

function renderArtifactsPanel(state: MirrorBrainWebAppState): string {
  const knowledge = state.knowledgeArtifact;
  const skill = state.skillArtifact;

  return [
    '<section class="mirrorbrain-panel">',
    '<h2>Artifacts</h2>',
    '<div class="mirrorbrain-actions"><button type="button" data-action="generate-knowledge">Generate Knowledge</button><button type="button" data-action="generate-skill">Generate Skill</button></div>',
    '<div class="mirrorbrain-detail-grid">',
    '<article class="mirrorbrain-detail-card">',
    '<h3>Knowledge Artifact</h3>',
    knowledge === null
      ? '<p>No knowledge artifact generated yet.</p>'
      : renderDetailRows([
          { label: 'Knowledge ID', value: knowledge.id },
          { label: 'Draft State', value: knowledge.draftState },
          {
            label: 'Reviewed Inputs',
            value: knowledge.sourceReviewedMemoryIds.join(', '),
          },
        ]),
    '</article>',
    '<article class="mirrorbrain-detail-card">',
    '<h3>Skill Artifact</h3>',
    skill === null
      ? '<p>No skill artifact generated yet.</p>'
      : renderDetailRows([
          { label: 'Skill ID', value: skill.id },
          { label: 'Approval State', value: skill.approvalState },
          {
            label: 'Workflow Evidence',
            value: skill.workflowEvidenceRefs.join(', '),
          },
          {
            label: 'Requires Confirmation',
            value: String(skill.executionSafetyMetadata.requiresConfirmation),
          },
        ]),
    '</article>',
    '</div>',
    '</section>',
  ].join('');
}

function renderFeedback(
  feedback: MirrorBrainWebAppState['feedback'],
): string {
  if (feedback === null) {
    return '<p>Status: ready</p>';
  }

  return `<p data-feedback-kind="${feedback.kind}">Status: ${feedback.message}</p>`;
}

function renderActivePanel(state: MirrorBrainWebAppState): string {
  if (state.activeTab === 'review') {
    return renderReviewPanel(state);
  }

  if (state.activeTab === 'artifacts') {
    return renderArtifactsPanel(state);
  }

  return renderMemoryPanel(state);
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
    '<nav class="mirrorbrain-tabs" aria-label="MirrorBrain sections">',
    renderTabButton('memory', state.activeTab, 'Memory'),
    renderTabButton('review', state.activeTab, 'Review'),
    renderTabButton('artifacts', state.activeTab, 'Artifacts'),
    '</nav>',
    renderActivePanel(state),
    '</header>',
    '</main>',
  ].join('');
}

export function createMirrorBrainWebApp(input: CreateMirrorBrainWebAppInput) {
  const now = input.now ?? (() => new Date().toISOString());
  const timeZone =
    input.timeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'UTC';
  const state: MirrorBrainWebAppState = {
    serviceStatus: 'unknown',
    memoryEvents: [],
    reviewWindowDate: null,
    reviewWindowEventCount: 0,
    candidateMemories: [],
    selectedCandidateId: null,
    candidateReviewSuggestions: [],
    reviewedMemory: null,
    knowledgeArtifact: null,
    skillArtifact: null,
    lastSyncSummary: null,
    feedback: null,
    activeTab: 'memory',
    memoryPage: 1,
  };

  const setFeedback = (feedback: MirrorBrainWebAppState['feedback']) => {
    state.feedback = feedback;
  };

  return {
    state,
    setActiveTab(tab: MirrorBrainWebTab) {
      state.activeTab = tab;
    },
    selectCandidate(candidateId: string) {
      state.selectedCandidateId = candidateId;
    },
    goToNextMemoryPage() {
      state.memoryPage = clampMemoryPage(state.memoryEvents, state.memoryPage + 1);
    },
    goToFirstMemoryPage() {
      state.memoryPage = 1;
    },
    goToLastMemoryPage() {
      state.memoryPage = getMemoryPageCount(state.memoryEvents);
    },
    goToPreviousMemoryPage() {
      state.memoryPage = clampMemoryPage(state.memoryEvents, state.memoryPage - 1);
    },
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
      state.memoryPage = clampMemoryPage(memoryEvents, state.memoryPage);
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
      state.memoryPage = 1;
      state.activeTab = 'memory';
      setFeedback({
        kind: 'success',
        message: `Browser sync completed: ${state.lastSyncSummary.importedCount} events imported.`,
      });
    },
    async createDailyCandidates() {
      const reviewDate = getPreviousCalendarDate(now(), timeZone);
      const reviewWindowEvents = state.memoryEvents.filter((event) =>
        formatCalendarDate(event.timestamp, timeZone) === reviewDate,
      );
      state.reviewWindowDate = reviewDate;
      state.reviewWindowEventCount = reviewWindowEvents.length;

      if (reviewWindowEvents.length === 0) {
        setFeedback({
          kind: 'error',
          message: "No memory events are available for yesterday's candidate review.",
        });
        return;
      }

      state.candidateMemories = await input.api.createDailyCandidates(
        reviewDate,
        timeZone,
      );
      state.candidateReviewSuggestions = await input.api.suggestCandidateReviews(
        state.candidateMemories,
      );
      state.selectedCandidateId = state.candidateMemories[0]?.id ?? null;
      state.activeTab = 'review';
      setFeedback({
        kind: 'success',
        message: `Generated ${state.candidateMemories.length} daily candidates for ${reviewDate}.`,
      });
    },
    async reviewSelectedCandidate(decision: ReviewedMemory['decision']) {
      const candidate = getSelectedCandidate(state);

      if (candidate === null) {
        setFeedback({
          kind: 'error',
          message: 'Select a candidate before reviewing it.',
        });
        return;
      }

      state.reviewedMemory = await input.api.reviewCandidateMemory(candidate, {
        decision,
        reviewedAt: now(),
      });
      state.activeTab = 'review';
      setFeedback({
        kind: 'success',
        message: `Candidate ${decision === 'keep' ? 'kept' : 'discarded'}: ${state.reviewedMemory.id}`,
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
      state.activeTab = 'artifacts';
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
      state.activeTab = 'artifacts';
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
    async createDailyCandidates(reviewDate, reviewTimeZone) {
      const response = await fetch(`${baseUrl}/candidate-memories/daily`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reviewDate,
          reviewTimeZone,
        }),
      });
      const body = (await response.json()) as {
        candidates: CandidateMemory[];
      };

      return body.candidates;
    },
    async suggestCandidateReviews(candidates) {
      const response = await fetch(`${baseUrl}/candidate-reviews/suggestions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          candidates,
        }),
      });
      const body = (await response.json()) as {
        suggestions: CandidateReviewSuggestion[];
      };

      return body.suggestions;
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

function formatCalendarDate(value: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Failed to derive calendar date for timestamp ${value}.`);
  }

  return `${year}-${month}-${day}`;
}

function getPreviousCalendarDate(value: string, timeZone: string): string {
  const currentCalendarDate = formatCalendarDate(value, timeZone);
  const previousDay = new Date(`${currentCalendarDate}T00:00:00.000Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);

  return previousDay.toISOString().slice(0, 10);
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

  const render = () => {
    root.innerHTML = renderMirrorBrainWebApp(app.state);
    bindActions();
  };

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
        await app.createDailyCandidates();
        render();
      });
    root
      .querySelector('[data-action="keep-candidate"]')
      ?.addEventListener('click', async () => {
        await app.reviewSelectedCandidate('keep');
        render();
      });
    root
      .querySelector('[data-action="discard-candidate"]')
      ?.addEventListener('click', async () => {
        await app.reviewSelectedCandidate('discard');
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
    root
      .querySelectorAll<HTMLElement>('[data-action="switch-tab"]')
      .forEach((element) => {
        element.addEventListener('click', () => {
          const tab = element.dataset.tab as MirrorBrainWebTab | undefined;

          if (tab !== undefined) {
            app.setActiveTab(tab);
            render();
          }
        });
      });
    root
      .querySelectorAll<HTMLElement>('[data-action="select-candidate"]')
      .forEach((element) => {
        element.addEventListener('click', () => {
          const candidateId = element.dataset.candidateId;

          if (candidateId) {
            app.selectCandidate(candidateId);
            render();
          }
        });
      });
    root
      .querySelector('[data-action="memory-first-page"]')
      ?.addEventListener('click', () => {
        app.goToFirstMemoryPage();
        render();
      });
    root
      .querySelector('[data-action="memory-prev-page"]')
      ?.addEventListener('click', () => {
        app.goToPreviousMemoryPage();
        render();
      });
    root
      .querySelector('[data-action="memory-next-page"]')
      ?.addEventListener('click', () => {
        app.goToNextMemoryPage();
        render();
      });
    root
      .querySelector('[data-action="memory-last-page"]')
      ?.addEventListener('click', () => {
        app.goToLastMemoryPage();
        render();
      });
  };

  render();
  await app.load();
  render();
}

if (typeof document !== 'undefined' && document.getElementById('app-root') !== null) {
  void mountMirrorBrainWebApp();
}
