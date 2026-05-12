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
  importedEvents?: MemoryEvent[];
}

interface SourceLedgerImportResult {
  importedCount: number;
  skippedCount: number;
  scannedLedgerCount: number;
  changedLedgerCount: number;
  ledgerResults: unknown[];
}

type MirrorBrainWebTab = 'memory' | 'review' | 'artifacts';
type MirrorBrainArtifactsSubtab =
  | 'history-topics'
  | 'generate-knowledge'
  | 'generate-skill';

interface MirrorBrainWebAppState {
  serviceStatus: 'running' | 'stopped' | 'unknown';
  memoryEvents: MemoryEvent[];
  reviewWindowDate: string | null;
  reviewWindowEventCount: number;
  candidateMemories: CandidateMemory[];
  selectedCandidateId: string | null;
  candidateReviewSuggestions: CandidateReviewSuggestion[];
  reviewedMemory: ReviewedMemory | null;
  knowledgeArtifacts?: KnowledgeArtifact[];
  knowledgeArtifact: KnowledgeArtifact | null;
  knowledgeDraft?: KnowledgeArtifact | null;
  knowledgeTopics: Array<{
    topicKey: string;
    title: string;
    summary: string;
    currentBestKnowledgeId: string;
    updatedAt?: string;
    recencyLabel: string;
  }>;
  skillArtifacts?: SkillArtifact[];
  skillArtifact: SkillArtifact | null;
  skillDraft?: SkillArtifact | null;
  lastSyncSummary: BrowserSyncSummary | null;
  feedback: {
    kind: 'success' | 'error' | 'info';
    message: string;
  } | null;
  activeTab: MirrorBrainWebTab;
  artifactsSubtab?: MirrorBrainArtifactsSubtab;
  memoryPage: number;
  knowledgeHistoryPage?: number;
  skillHistoryPage?: number;
}

interface MirrorBrainWebAppApi {
  getHealth(): Promise<{
    status: 'running' | 'stopped';
  }>;
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
  importSourceLedgers(): Promise<SourceLedgerImportResult>;
  syncShell(): Promise<BrowserSyncSummary>;
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
  saveKnowledgeArtifact?(artifact: KnowledgeArtifact): Promise<KnowledgeArtifact>;
  saveSkillArtifact?(artifact: SkillArtifact): Promise<SkillArtifact>;
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
const ARTIFACT_HISTORY_PAGE_SIZE = 5;

function getMemoryPageCount(memoryEvents: MemoryEvent[]): number {
  return Math.max(1, Math.ceil(memoryEvents.length / MEMORY_PAGE_SIZE));
}

function clampMemoryPage(memoryEvents: MemoryEvent[], page: number): number {
  return Math.min(Math.max(1, page), getMemoryPageCount(memoryEvents));
}

function getPageCount(length: number, pageSize: number): number {
  return Math.max(1, Math.ceil(length / pageSize));
}

function clampPage(length: number, page: number, pageSize: number): number {
  return Math.min(Math.max(1, page), getPageCount(length, pageSize));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function mergeMemoryEvents(
  currentEvents: MemoryEvent[],
  importedEvents: MemoryEvent[],
): MemoryEvent[] {
  const mergedById = new Map<string, MemoryEvent>();

  for (const event of [...currentEvents, ...importedEvents]) {
    const previousEvent = mergedById.get(event.id);

    if (
      previousEvent === undefined ||
      event.timestamp.localeCompare(previousEvent.timestamp) >= 0
    ) {
      mergedById.set(event.id, event);
    }
  }

  return [...mergedById.values()].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );
}

function isCompleteSyncPreview(
  sync: BrowserSyncSummary,
): sync is BrowserSyncSummary & { importedEvents: MemoryEvent[] } {
  return (
    Array.isArray(sync.importedEvents) &&
    sync.importedEvents.length === sync.importedCount &&
    sync.strategy === 'incremental'
  );
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
    return '<li style="text-align: center; padding: 32px; color: var(--muted);">No memory events imported yet.</li>';
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

        const formattedTimestamp = new Date(event.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
        [
          '<li class="mirrorbrain-record">',
          `<span style="color: var(--muted); font-size: 0.85rem;">${event.sourceType}</span>`,
          `<span>${linkedTitle}</span>`,
          `<span style="color: var(--muted); font-size: 0.85rem;">${formattedTimestamp}</span>`,
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
    '<h2>Memory Events</h2>',
    '<p style="font-size: 0.9rem;">Imported browser and shell events. Use pagination to browse.</p>',
    '<div class="mirrorbrain-actions"><button type="button" data-action="import-sources">Import Sources</button><button type="button" data-action="sync-shell">Sync Shell</button></div>',
    `<div class="mirrorbrain-pagination" style="font-size: 0.85rem;"><button type="button" data-action="memory-prev-page"${
      currentPage === 1 ? ' disabled' : ''
    }>←</button><span style="color: var(--muted);">Page ${currentPage} of ${pageCount}</span><button type="button" data-action="memory-next-page"${
      currentPage === pageCount ? ' disabled' : ''
    }>→</button></div>`,
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

function renderMetricTile(input: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'success';
}): string {
  return [
    `<div class="mirrorbrain-metric mirrorbrain-metric--${input.tone ?? 'default'}">`,
    `<span class="mirrorbrain-metric-label">${input.label}</span>`,
    `<strong class="mirrorbrain-metric-value">${input.value}</strong>`,
    '</div>',
  ].join('');
}

function renderArtifactsSubtabButton(
  subtab: MirrorBrainArtifactsSubtab,
  activeSubtab: MirrorBrainArtifactsSubtab,
  label: string,
): string {
  return `<button type="button" class="mirrorbrain-subtab${
    subtab === activeSubtab ? ' is-active' : ''
  }" data-action="switch-artifacts-subtab" data-subtab="${subtab}">${label}</button>`;
}

function renderHistoryTable(
  title: string,
  rows: Array<{ primary: string; secondary: string; tertiary: string }>,
  page: number,
  pageSize: number,
  dataActionPrefix: string,
): string {
  if (rows.length === 0) {
    return [
      '<section class="mirrorbrain-subcard">',
      `<h4>${title}</h4>`,
      '<p class="mirrorbrain-empty">No saved artifacts yet.</p>',
      '</section>',
    ].join('');
  }

  const currentPage = clampPage(rows.length, page, pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);

  return [
    '<section class="mirrorbrain-subcard">',
    `<div class="mirrorbrain-card-heading"><h4>${title}</h4><span class="mirrorbrain-card-meta">Page ${currentPage} of ${getPageCount(rows.length, pageSize)}</span></div>`,
    '<div class="mirrorbrain-history-table">',
    pageRows
      .map(
        (row) => [
          '<div class="mirrorbrain-history-row">',
          `<strong>${row.primary}</strong>`,
          `<span>${row.secondary}</span>`,
          `<span class="mirrorbrain-card-meta">${row.tertiary}</span>`,
          '</div>',
        ].join(''),
      )
      .join(''),
    '</div>',
    '<div class="mirrorbrain-pagination">',
    `<button type="button" data-action="${dataActionPrefix}-prev"${
      currentPage === 1 ? ' disabled' : ''
    }>Previous</button>`,
    `<button type="button" data-action="${dataActionPrefix}-next"${
      currentPage === getPageCount(rows.length, pageSize) ? ' disabled' : ''
    }>Next</button>`,
    '</div>',
    '</section>',
  ].join('');
}

function renderReviewPanel(state: MirrorBrainWebAppState): string {
  const candidate = getSelectedCandidate(state);
  const suggestion = getSelectedCandidateSuggestion(state);
  const reviewWindowDescription =
    state.reviewWindowDate === null
      ? 'No review window calculated yet.'
      : `${state.reviewWindowDate}`;
  const recommendationTone =
    suggestion?.recommendation === 'keep'
      ? 'success'
      : suggestion?.recommendation === 'discard'
        ? 'default'
        : 'accent';

  return [
    '<section class="mirrorbrain-panel">',
    '<div class="mirrorbrain-panel-header">',
    '<div>',
    '<p class="mirrorbrain-eyebrow">Daily Review</p>',
    '<h2>Review Workbench</h2>',
    '<p class="mirrorbrain-panel-copy">Generate candidate streams from the full history, inspect the best signal, and make a clear keep or discard decision.</p>',
    '</div>',
    '<div class="mirrorbrain-actions">',
    '<button type="button" data-action="create-candidate" class="mirrorbrain-button mirrorbrain-button--primary">Create Candidates</button>',
    '<button type="button" data-action="keep-candidate" class="mirrorbrain-button mirrorbrain-button--success">Keep Candidate</button>',
    '<button type="button" data-action="discard-candidate" class="mirrorbrain-button mirrorbrain-button--ghost">Discard Candidate</button>',
    '</div>',
    '</div>',
    '<div class="mirrorbrain-metric-grid">',
    renderMetricTile({ label: 'Review Date', value: state.reviewWindowDate ?? 'Not ready', tone: 'accent' }),
    renderMetricTile({ label: 'Candidate Streams', value: String(state.candidateMemories.length) }),
    renderMetricTile({ label: 'Matched Events', value: String(state.reviewWindowEventCount) }),
    renderMetricTile({ label: 'Recommendation', value: suggestion?.recommendation ?? 'Pending', tone: recommendationTone }),
    '</div>',
    '<div class="mirrorbrain-review-layout">',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--rail">',
    '<div class="mirrorbrain-card-heading"><h3>Candidate Streams</h3><span class="mirrorbrain-card-meta">Pick a stream to inspect its evidence</span></div>',
    `<div class="mirrorbrain-candidate-list">${renderCandidateList(state)}</div>`,
    '</article>',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--focus">',
    '<div class="mirrorbrain-card-heading"><h3>Selected Candidate</h3><span class="mirrorbrain-card-meta">Summary, time range, and memory ids</span></div>',
    candidate === null
      ? '<p class="mirrorbrain-empty">Select a candidate stream to review it.</p>'
      : [
          '<div class="mirrorbrain-highlight-block">',
          `<h4>${candidate.title}</h4>`,
          `<p>${candidate.summary}</p>`,
          '</div>',
          renderDetailRows([
            { label: 'Review Window', value: reviewWindowDescription },
            { label: 'Events', value: String(state.reviewWindowEventCount) },
            { label: 'Theme', value: candidate.theme },
            { label: 'Time Range', value: `${candidate.timeRange.startAt} → ${candidate.timeRange.endAt}` },
            { label: 'Memory IDs', value: candidate.memoryEventIds.join(', ') },
          ]),
        ].join(''),
    '</article>',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--assist">',
    '<div class="mirrorbrain-card-heading"><h3>Decision Guidance</h3><span class="mirrorbrain-card-meta">AI guidance plus your latest review result</span></div>',
    '<div class="mirrorbrain-detail-stack">',
    '<section class="mirrorbrain-subcard">',
    '<h4>AI Suggestion</h4>',
    suggestion === null
      ? '<p class="mirrorbrain-empty">No AI suggestion yet.</p>'
      : renderDetailRows([
          { label: 'Recommendation', value: suggestion.recommendation },
          { label: 'Confidence', value: `${Math.round(suggestion.confidenceScore * 100)}%` },
          { label: 'Priority', value: String(suggestion.priorityScore) },
          { label: 'Rationale', value: suggestion.rationale },
        ]),
    '</section>',
    '<section class="mirrorbrain-subcard">',
    '<h4>Reviewed Memory</h4>',
    state.reviewedMemory === null
      ? '<p class="mirrorbrain-empty">No reviewed memory yet.</p>'
      : renderDetailRows([
          { label: 'Decision', value: state.reviewedMemory.decision },
          { label: 'Reviewed At', value: new Date(state.reviewedMemory.reviewedAt).toLocaleString() },
          { label: 'Reviewed ID', value: state.reviewedMemory.id },
        ]),
    '</section>',
    '</div>',
    '</article>',
    '</div>',
    '</section>',
  ].join('');
}

function renderArtifactsPanel(state: MirrorBrainWebAppState): string {
  const selectedCandidate = getSelectedCandidate(state);
  const knowledge = state.knowledgeArtifact;
  const knowledgeDraft =
    state.knowledgeDraft ??
    (knowledge === null
      ? null
      : {
          ...knowledge,
          derivedFromKnowledgeIds: [...(knowledge.derivedFromKnowledgeIds ?? [])],
          provenanceRefs: [...(knowledge.provenanceRefs ?? [])],
        });
  const knowledgeTopics = state.knowledgeTopics;
  const skill = state.skillArtifact;
  const skillDraft =
    state.skillDraft ??
    (skill === null
      ? null
      : {
          ...skill,
          workflowEvidenceRefs: [...skill.workflowEvidenceRefs],
          executionSafetyMetadata: {
            ...skill.executionSafetyMetadata,
          },
        });
  const workflowEvidenceValue = skillDraft?.workflowEvidenceRefs.join('\n') ?? '';
  const knowledgeArtifacts = state.knowledgeArtifacts ?? [];
  const skillArtifacts = state.skillArtifacts ?? [];
  const artifactsSubtab = state.artifactsSubtab ?? 'history-topics';
  const knowledgeHistoryPage = state.knowledgeHistoryPage ?? 1;
  const skillHistoryPage = state.skillHistoryPage ?? 1;
  const subtabNav = [
    '<div class="mirrorbrain-subtabs">',
    renderArtifactsSubtabButton(
      'history-topics',
      artifactsSubtab,
      'History Topics',
    ),
    renderArtifactsSubtabButton(
      'generate-knowledge',
      artifactsSubtab,
      'Generate Knowledge',
    ),
    renderArtifactsSubtabButton(
      'generate-skill',
      artifactsSubtab,
      'Generate Skill',
    ),
    '</div>',
  ].join('');
  const historyPanel = [
    '<div class="mirrorbrain-history-layout">',
    renderHistoryTable(
      'Topic Knowledge',
      knowledgeTopics.map((topic) => ({
        primary: topic.title,
        secondary: topic.summary,
        tertiary: topic.recencyLabel,
      })),
      1,
      ARTIFACT_HISTORY_PAGE_SIZE,
      'knowledge-topics',
    ),
    renderHistoryTable(
      'Generated Knowledge',
      knowledgeArtifacts.map((artifact) => ({
        primary: artifact.title ?? artifact.id,
        secondary: artifact.summary ?? artifact.id,
        tertiary: artifact.recencyLabel ?? artifact.draftState,
      })),
      knowledgeHistoryPage,
      ARTIFACT_HISTORY_PAGE_SIZE,
      'knowledge-history',
    ),
    renderHistoryTable(
      'Generated Skills',
      skillArtifacts.map((artifact) => ({
        primary: artifact.id,
        secondary: artifact.approvalState,
        tertiary: `${artifact.workflowEvidenceRefs.length} refs`,
      })),
      skillHistoryPage,
      ARTIFACT_HISTORY_PAGE_SIZE,
      'skill-history',
    ),
    '</div>',
  ].join('');
  const candidateContext = selectedCandidate === null
    ? '<p class="mirrorbrain-empty">Select a candidate in Review before generating an artifact.</p>'
    : [
        '<div class="mirrorbrain-highlight-block">',
        `<h4>${selectedCandidate.title}</h4>`,
        `<p>${selectedCandidate.summary}</p>`,
        '</div>',
        renderDetailRows([
          { label: 'Theme', value: selectedCandidate.theme },
          { label: 'Review Date', value: selectedCandidate.reviewDate },
          { label: 'Time Range', value: `${selectedCandidate.timeRange.startAt} → ${selectedCandidate.timeRange.endAt}` },
          { label: 'Memory IDs', value: selectedCandidate.memoryEventIds.join(', ') },
        ]),
      ].join('');
  const knowledgePanel = [
    '<div class="mirrorbrain-generate-layout">',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--focus">',
    '<div class="mirrorbrain-card-heading"><h3>Candidate Context</h3><span class="mirrorbrain-card-meta">Current Review selection</span></div>',
    candidateContext,
    '</article>',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--assist">',
    '<div class="mirrorbrain-card-heading"><h3>Knowledge Draft Editor</h3><span class="mirrorbrain-card-meta">Generate or refine a knowledge draft for the selected candidate</span></div>',
    '<div class="mirrorbrain-actions mirrorbrain-actions--editor"><button type="button" data-action="generate-knowledge" class="mirrorbrain-button mirrorbrain-button--primary">Generate Knowledge</button><button type="button" data-action="save-knowledge" class="mirrorbrain-button mirrorbrain-button--success">Save Knowledge Draft</button></div>',
    knowledgeDraft === null
      ? '<p class="mirrorbrain-empty">Generate knowledge to open the editor.</p>'
      : [
          `<label class="mirrorbrain-field"><span>Title</span><input class="mirrorbrain-input" name="knowledge-title" type="text" value="${knowledgeDraft.title ?? ''}" /></label>`,
          `<label class="mirrorbrain-field"><span>Summary</span><textarea class="mirrorbrain-textarea mirrorbrain-textarea--compact" name="knowledge-summary">${knowledgeDraft.summary ?? ''}</textarea></label>`,
          `<label class="mirrorbrain-field"><span>Body</span><textarea class="mirrorbrain-textarea" name="knowledge-body">${knowledgeDraft.body ?? ''}</textarea></label>`,
        ].join(''),
    '</article>',
    '</div>',
  ].join('');
  const skillPanel = [
    '<div class="mirrorbrain-generate-layout">',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--focus">',
    '<div class="mirrorbrain-card-heading"><h3>Candidate Context</h3><span class="mirrorbrain-card-meta">Current Review selection</span></div>',
    candidateContext,
    '</article>',
    '<article class="mirrorbrain-detail-card mirrorbrain-detail-card--assist">',
    '<div class="mirrorbrain-card-heading"><h3>Skill Draft Editor</h3><span class="mirrorbrain-card-meta">Generate or refine a skill draft for the selected candidate</span></div>',
    '<div class="mirrorbrain-actions mirrorbrain-actions--editor"><button type="button" data-action="generate-skill" class="mirrorbrain-button mirrorbrain-button--primary">Generate Skill</button><button type="button" data-action="save-skill" class="mirrorbrain-button mirrorbrain-button--success">Save Skill Draft</button></div>',
    skillDraft === null
      ? '<p class="mirrorbrain-empty">Generate a skill to open the editor.</p>'
      : [
          '<label class="mirrorbrain-field"><span>Approval State</span><select class="mirrorbrain-input" name="skill-approval-state">',
          `<option value="draft"${skillDraft.approvalState === 'draft' ? ' selected' : ''}>Draft</option>`,
          `<option value="approved"${skillDraft.approvalState === 'approved' ? ' selected' : ''}>Approved</option>`,
          '</select></label>',
          `<label class="mirrorbrain-field"><span>Workflow Evidence Refs</span><textarea class="mirrorbrain-textarea" name="skill-workflow-evidence-refs">${workflowEvidenceValue}</textarea></label>`,
          `<label class="mirrorbrain-checkbox"><input name="skill-requires-confirmation" type="checkbox"${skillDraft.executionSafetyMetadata.requiresConfirmation ? ' checked' : ''} /><span>Requires explicit confirmation before execution</span></label>`,
        ].join(''),
    '</article>',
    '</div>',
  ].join('');

  return [
    '<section class="mirrorbrain-panel">',
    '<div class="mirrorbrain-panel-header">',
    '<div>',
    '<p class="mirrorbrain-eyebrow">Artifacts</p>',
    '<h2>Artifact Studio</h2>',
    '<p class="mirrorbrain-panel-copy">Generate drafts from reviewed memory, refine them in-place, and save the edited artifact back to MirrorBrain.</p>',
    '</div>',
    '</div>',
    subtabNav,
    artifactsSubtab === 'history-topics'
      ? historyPanel
      : artifactsSubtab === 'generate-knowledge'
        ? knowledgePanel
        : skillPanel,
    '</section>',
  ].join('');
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
      ? '<p style="font-size: 0.9rem;">Last Sync: <span style="color: var(--muted);">not run yet</span></p>'
      : `<p style="font-size: 0.9rem;">Last Sync: <strong>${state.lastSyncSummary.sourceKey}</strong> • <span style="color: var(--muted);">${state.lastSyncSummary.strategy} / ${state.lastSyncSummary.importedCount} events</span></p>`;

  const statusMessage =
    state.feedback === null
      ? ''
      : `<p style="font-size: 0.85rem; padding: 8px 12px; background: var(--accent-soft); border-radius: 4px; margin-bottom: 8px;">${state.feedback.message}</p>`;

  return [
    '<main class="mirrorbrain-app">',
    '<header style="margin-bottom: 48px;">',
    '<h1 style="margin-bottom: 4px;">MirrorBrain</h1>',
    '<p style="font-size: 0.9rem; color: var(--muted);">Personal Memory & Knowledge System</p>',
    syncSummary,
    statusMessage,
    '<nav class="mirrorbrain-tabs" aria-label="MirrorBrain sections" style="margin-top: 24px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">',
    renderTabButton('memory', state.activeTab, 'Memory'),
    renderTabButton('review', state.activeTab, 'Review'),
    renderTabButton('artifacts', state.activeTab, 'Artifacts'),
    '</nav>',
    '</header>',
    renderActivePanel(state),
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
    knowledgeArtifacts: [],
    knowledgeArtifact: null,
    knowledgeDraft: null,
    knowledgeTopics: [],
    skillArtifacts: [],
    skillArtifact: null,
    skillDraft: null,
    lastSyncSummary: null,
    feedback: null,
    activeTab: 'memory',
    artifactsSubtab: 'history-topics',
    memoryPage: 1,
    knowledgeHistoryPage: 1,
    skillHistoryPage: 1,
  };

  const setFeedback = (feedback: MirrorBrainWebAppState['feedback']) => {
    state.feedback = feedback;
  };

  return {
    state,
    setActiveTab(tab: MirrorBrainWebTab) {
      state.activeTab = tab;
    },
    setArtifactsSubtab(subtab: MirrorBrainArtifactsSubtab) {
      state.artifactsSubtab = subtab;
    },
    goToNextKnowledgeHistoryPage() {
      state.knowledgeHistoryPage = clampPage(
        state.knowledgeArtifacts?.length ?? 0,
        (state.knowledgeHistoryPage ?? 1) + 1,
        ARTIFACT_HISTORY_PAGE_SIZE,
      );
    },
    goToPreviousKnowledgeHistoryPage() {
      state.knowledgeHistoryPage = clampPage(
        state.knowledgeArtifacts?.length ?? 0,
        (state.knowledgeHistoryPage ?? 1) - 1,
        ARTIFACT_HISTORY_PAGE_SIZE,
      );
    },
    goToNextSkillHistoryPage() {
      state.skillHistoryPage = clampPage(
        state.skillArtifacts?.length ?? 0,
        (state.skillHistoryPage ?? 1) + 1,
        ARTIFACT_HISTORY_PAGE_SIZE,
      );
    },
    goToPreviousSkillHistoryPage() {
      state.skillHistoryPage = clampPage(
        state.skillArtifacts?.length ?? 0,
        (state.skillHistoryPage ?? 1) - 1,
        ARTIFACT_HISTORY_PAGE_SIZE,
      );
    },
    updateKnowledgeDraft(input: {
      title?: string;
      summary?: string;
      body?: string;
    }) {
      const knowledgeDraft = state.knowledgeDraft;

      if (knowledgeDraft === null || knowledgeDraft === undefined) {
        return;
      }

      state.knowledgeDraft = {
        ...knowledgeDraft,
        title: input.title ?? knowledgeDraft.title,
        summary: input.summary ?? knowledgeDraft.summary,
        body: input.body ?? knowledgeDraft.body,
      };
    },
    updateSkillDraft(input: {
      approvalState?: SkillArtifact['approvalState'];
      workflowEvidenceRefs?: string[];
      requiresConfirmation?: boolean;
    }) {
      const skillDraft = state.skillDraft;

      if (skillDraft === null || skillDraft === undefined) {
        return;
      }

      state.skillDraft = {
        ...skillDraft,
        approvalState: input.approvalState ?? skillDraft.approvalState,
        workflowEvidenceRefs:
          input.workflowEvidenceRefs ?? skillDraft.workflowEvidenceRefs,
        executionSafetyMetadata: {
          requiresConfirmation:
            input.requiresConfirmation ??
            skillDraft.executionSafetyMetadata.requiresConfirmation,
        },
      };
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
      const [
        healthResult,
        memoryResult,
        knowledgeResult,
        topicsResult,
        skillsResult,
      ] = await Promise.allSettled([
        input.api.getHealth(),
        input.api.listMemory(),
        input.api.listKnowledge(),
        input.api.listKnowledgeTopics(),
        input.api.listSkills(),
      ]);

      if (healthResult.status === 'fulfilled') {
        state.serviceStatus = healthResult.value.status;
      }

      if (memoryResult.status === 'fulfilled') {
        state.memoryEvents = memoryResult.value;
        state.memoryPage = clampMemoryPage(memoryResult.value, state.memoryPage);
      }

      if (knowledgeResult.status === 'fulfilled') {
        state.knowledgeArtifacts = knowledgeResult.value;
        state.knowledgeArtifact = knowledgeResult.value[0] ?? null;
        state.knowledgeDraft =
          state.knowledgeArtifact === null
            ? null
            : {
                ...state.knowledgeArtifact,
                derivedFromKnowledgeIds: [
                  ...(state.knowledgeArtifact.derivedFromKnowledgeIds ?? []),
                ],
                provenanceRefs: [
                  ...(state.knowledgeArtifact.provenanceRefs ?? []),
                ],
              };
      }

      if (topicsResult.status === 'fulfilled') {
        state.knowledgeTopics = topicsResult.value;
      }

      if (skillsResult.status === 'fulfilled') {
        state.skillArtifacts = skillsResult.value;
        state.skillArtifact = skillsResult.value[0] ?? null;
        state.skillDraft =
          state.skillArtifact === null
            ? null
            : {
                ...state.skillArtifact,
                workflowEvidenceRefs: [...state.skillArtifact.workflowEvidenceRefs],
                executionSafetyMetadata: {
                  ...state.skillArtifact.executionSafetyMetadata,
                },
              };
      }

      const firstRejectedResult = [
        healthResult,
        memoryResult,
        knowledgeResult,
        topicsResult,
        skillsResult,
      ].find((result) => result.status === 'rejected');

      if (firstRejectedResult?.status === 'rejected') {
        setFeedback({
          kind: 'error',
          message: toErrorMessage(firstRejectedResult.reason),
        });
        return;
      }

      setFeedback({
        kind: 'info',
        message: `Loaded ${state.memoryEvents.length} memory events.`,
      });
    },
    async importSourceLedgers() {
      const importResult = await input.api.importSourceLedgers();
      state.memoryEvents = await input.api.listMemory();
      state.memoryPage = 1;
      state.activeTab = 'memory';
      setFeedback({
        kind: 'success',
        message: `Source import completed: ${importResult.importedCount} events imported from ${importResult.scannedLedgerCount} ledgers.`,
      });
    },
    async syncShellMemory() {
      state.lastSyncSummary = await input.api.syncShell();
      state.memoryEvents =
        isCompleteSyncPreview(state.lastSyncSummary)
          ? mergeMemoryEvents(
              state.memoryEvents,
              state.lastSyncSummary.importedEvents,
            )
          : await input.api.listMemory();
      state.memoryPage = 1;
      state.activeTab = 'memory';
      setFeedback({
        kind: 'success',
        message: `Shell sync completed: ${state.lastSyncSummary.importedCount} events imported.`,
      });
    },
    async createDailyCandidates() {
      const reviewDate = getPreviousCalendarDate(now(), timeZone);
      state.reviewWindowDate = reviewDate;
      try {
        const candidateMemories = await input.api.createDailyCandidates(
          reviewDate,
          timeZone,
        );
        if (!Array.isArray(candidateMemories)) {
          throw new Error('Candidate generation returned an invalid response.');
        }
        state.candidateMemories = candidateMemories;
        state.reviewWindowEventCount = state.candidateMemories.reduce(
          (count, candidate) => count + candidate.memoryEventIds.length,
          0,
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
      } catch (error) {
        state.reviewWindowEventCount = 0;
        setFeedback({
          kind: 'error',
          message: toErrorMessage(error),
        });
      }
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
      state.knowledgeArtifacts = [
        state.knowledgeArtifact,
        ...(state.knowledgeArtifacts ?? []).filter(
          (artifact) => artifact.id !== state.knowledgeArtifact?.id,
        ),
      ];
      state.knowledgeDraft = {
        ...state.knowledgeArtifact,
        derivedFromKnowledgeIds: [
          ...(state.knowledgeArtifact.derivedFromKnowledgeIds ?? []),
        ],
        provenanceRefs: [...(state.knowledgeArtifact.provenanceRefs ?? [])],
      };
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
      state.skillArtifacts = [
        state.skillArtifact,
        ...(state.skillArtifacts ?? []).filter(
          (artifact) => artifact.id !== state.skillArtifact?.id,
        ),
      ];
      state.skillDraft = {
        ...state.skillArtifact,
        workflowEvidenceRefs: [...state.skillArtifact.workflowEvidenceRefs],
        executionSafetyMetadata: {
          ...state.skillArtifact.executionSafetyMetadata,
        },
      };
      state.activeTab = 'artifacts';
      setFeedback({
        kind: 'success',
        message: `Skill generated: ${state.skillArtifact.id}`,
      });
    },
    async saveKnowledgeDraft() {
      const knowledgeDraft = state.knowledgeDraft;

      if (
        knowledgeDraft === null ||
        knowledgeDraft === undefined ||
        input.api.saveKnowledgeArtifact === undefined
      ) {
        setFeedback({
          kind: 'error',
          message: 'Knowledge draft saving is unavailable.',
        });
        return;
      }

      state.knowledgeArtifact = await input.api.saveKnowledgeArtifact(
        knowledgeDraft,
      );
      state.knowledgeArtifacts = [
        state.knowledgeArtifact,
        ...(state.knowledgeArtifacts ?? []).filter(
          (artifact) => artifact.id !== state.knowledgeArtifact?.id,
        ),
      ];
      state.knowledgeDraft = {
        ...state.knowledgeArtifact,
        derivedFromKnowledgeIds: [
          ...(state.knowledgeArtifact.derivedFromKnowledgeIds ?? []),
        ],
        provenanceRefs: [...(state.knowledgeArtifact.provenanceRefs ?? [])],
      };
      setFeedback({
        kind: 'success',
        message: `Knowledge saved: ${state.knowledgeArtifact.id}`,
      });
    },
    async saveSkillDraft() {
      const skillDraft = state.skillDraft;

      if (
        skillDraft === null ||
        skillDraft === undefined ||
        input.api.saveSkillArtifact === undefined
      ) {
        setFeedback({
          kind: 'error',
          message: 'Skill draft saving is unavailable.',
        });
        return;
      }

      state.skillArtifact = await input.api.saveSkillArtifact(skillDraft);
      state.skillArtifacts = [
        state.skillArtifact,
        ...(state.skillArtifacts ?? []).filter(
          (artifact) => artifact.id !== state.skillArtifact?.id,
        ),
      ];
      state.skillDraft = {
        ...state.skillArtifact,
        workflowEvidenceRefs: [...state.skillArtifact.workflowEvidenceRefs],
        executionSafetyMetadata: {
          ...state.skillArtifact.executionSafetyMetadata,
        },
      };
      setFeedback({
        kind: 'success',
        message: `Skill saved: ${state.skillArtifact.id}`,
      });
    },
  };
}

export function createMirrorBrainBrowserApi(
  baseUrl: string,
): MirrorBrainWebAppApi {
  const readJson = async <T>(response: Response): Promise<T> => {
    const body = (await response.json()) as T & {
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(body.message ?? body.error ?? `Request failed with status ${response.status}`);
    }

    return body;
  };

  return {
    async getHealth() {
      const response = await fetch(`${baseUrl}/health`);
      const body = await readJson<{
        status: 'running' | 'stopped';
      }>(response);

      return {
        status: body.status,
      };
    },
    async listMemory() {
      const response = await fetch(`${baseUrl}/memory`);
      const body = await readJson<{
        items: MemoryEvent[];
      }>(response);

      return body.items;
    },
    async listKnowledge() {
      const response = await fetch(`${baseUrl}/knowledge`);
      const body = await readJson<{
        items: KnowledgeArtifact[];
      }>(response);

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
      const body = await readJson<{
        items: SkillArtifact[];
      }>(response);

      return body.items;
    },
    async importSourceLedgers() {
      const response = await fetch(`${baseUrl}/sources/import`, {
        method: 'POST',
      });
      const body = await readJson<{
        import: SourceLedgerImportResult;
      }>(response);

      return body.import;
    },
    async syncShell() {
      const response = await fetch(`${baseUrl}/sync/shell`, {
        method: 'POST',
      });
      const body = await readJson<{
        sync: BrowserSyncSummary;
      }>(response);

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
    async saveKnowledgeArtifact(artifact) {
      const response = await fetch(`${baseUrl}/knowledge`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          artifact,
        }),
      });
      const body = await readJson<{
        artifact: KnowledgeArtifact;
      }>(response);

      return body.artifact;
    },
    async saveSkillArtifact(artifact) {
      const response = await fetch(`${baseUrl}/skills`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          artifact,
        }),
      });
      const body = await readJson<{
        artifact: SkillArtifact;
      }>(response);

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
      .querySelector('[data-action="import-sources"]')
      ?.addEventListener('click', async () => {
        await app.importSourceLedgers();
        render();
      });
    root
      .querySelector('[data-action="sync-shell"]')
      ?.addEventListener('click', async () => {
        await app.syncShellMemory();
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
      .querySelector('[data-action="save-knowledge"]')
      ?.addEventListener('click', async () => {
        await app.saveKnowledgeDraft();
        render();
      });
    root
      .querySelector('[data-action="save-skill"]')
      ?.addEventListener('click', async () => {
        await app.saveSkillDraft();
        render();
      });
    root
      .querySelector<HTMLInputElement>('[name="knowledge-title"]')
      ?.addEventListener('input', (event) => {
        app.updateKnowledgeDraft({
          title: (event.currentTarget as HTMLInputElement).value,
        });
      });
    root
      .querySelector<HTMLTextAreaElement>('[name="knowledge-summary"]')
      ?.addEventListener('input', (event) => {
        app.updateKnowledgeDraft({
          summary: (event.currentTarget as HTMLTextAreaElement).value,
        });
      });
    root
      .querySelector<HTMLTextAreaElement>('[name="knowledge-body"]')
      ?.addEventListener('input', (event) => {
        app.updateKnowledgeDraft({
          body: (event.currentTarget as HTMLTextAreaElement).value,
        });
      });
    root
      .querySelector<HTMLSelectElement>('[name="skill-approval-state"]')
      ?.addEventListener('change', (event) => {
        app.updateSkillDraft({
          approvalState: (event.currentTarget as HTMLSelectElement)
            .value as SkillArtifact['approvalState'],
        });
      });
    root
      .querySelector<HTMLTextAreaElement>('[name="skill-workflow-evidence-refs"]')
      ?.addEventListener('input', (event) => {
        app.updateSkillDraft({
          workflowEvidenceRefs: (event.currentTarget as HTMLTextAreaElement)
            .value
            .split('\n')
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        });
      });
    root
      .querySelector<HTMLInputElement>('[name="skill-requires-confirmation"]')
      ?.addEventListener('change', (event) => {
        app.updateSkillDraft({
          requiresConfirmation:
            (event.currentTarget as HTMLInputElement).checked,
        });
      });
    root
      .querySelectorAll<HTMLElement>('[data-action="switch-artifacts-subtab"]')
      .forEach((element) => {
        element.addEventListener('click', () => {
          const subtab = element.dataset.subtab as
            | MirrorBrainArtifactsSubtab
            | undefined;

          if (subtab !== undefined) {
            app.setArtifactsSubtab(subtab);
            render();
          }
        });
      });
    root
      .querySelector('[data-action="knowledge-history-prev"]')
      ?.addEventListener('click', () => {
        app.goToPreviousKnowledgeHistoryPage();
        render();
      });
    root
      .querySelector('[data-action="knowledge-history-next"]')
      ?.addEventListener('click', () => {
        app.goToNextKnowledgeHistoryPage();
        render();
      });
    root
      .querySelector('[data-action="skill-history-prev"]')
      ?.addEventListener('click', () => {
        app.goToPreviousSkillHistoryPage();
        render();
      });
    root
      .querySelector('[data-action="skill-history-next"]')
      ?.addEventListener('click', () => {
        app.goToNextSkillHistoryPage();
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
