import { mkdirSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  CandidateMemory,
  KnowledgeArtifact,
  MemoryEvent,
  MemoryNarrative,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';

export interface OpenVikingMemoryEventRecord {
  recordType: 'memory-event';
  recordId: string;
  payload: MemoryEvent;
}

export interface OpenVikingMemoryEventWriter {
  writeMemoryEvent(record: OpenVikingMemoryEventRecord): Promise<void>;
}

interface IngestMemoryEventToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  event: MemoryEvent;
}

interface IngestMemoryEventToOpenVikingResult {
  sourcePath: string;
  rootUri: string;
}

interface IngestCandidateMemoryToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  artifact: CandidateMemory;
}

interface IngestReviewedMemoryToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  artifact: ReviewedMemory;
}

interface OpenVikingResourceIngestResult {
  sourcePath: string;
  rootUri: string;
}

interface IngestMemoryNarrativeToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  artifact: MemoryNarrative;
}

interface IngestBrowserPageContentToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  artifact: {
    id: string;
    url: string;
    title: string;
    text: string;
    accessTimes: string[];
    latestAccessedAt: string;
  };
}

interface IngestKnowledgeArtifactToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  artifact: KnowledgeArtifact;
}

interface IngestKnowledgeArtifactToOpenVikingResult {
  sourcePath: string;
  rootUri: string;
}

interface IngestSkillArtifactToOpenVikingInput {
  baseUrl: string;
  workspaceDir: string;
  artifact: SkillArtifact;
}

interface IngestSkillArtifactToOpenVikingResult {
  sourcePath: string;
  uri: string;
}

interface OpenVikingReadInput {
  baseUrl: string;
}

interface WorkspaceMemoryReadInput {
  workspaceDir: string;
}

interface OpenVikingFsEntry {
  name: string;
  uri: string;
  isDir: boolean;
}

interface OpenVikingGlobResult {
  matches: string[];
  count: number;
}

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

const OPEN_VIKING_RESOURCES_URI = 'viking://resources/';
const MIRRORBRAIN_MEMORY_EVENTS_PREFIX = 'mirrorbrain-memory-events-';
const MIRRORBRAIN_CANDIDATE_MEMORIES_PREFIX =
  'mirrorbrain-candidate-memories-';
const MIRRORBRAIN_REVIEWED_MEMORIES_PREFIX =
  'mirrorbrain-reviewed-memories-';
const MIRRORBRAIN_KNOWLEDGE_PREFIX = 'mirrorbrain-knowledge-';
const MIRRORBRAIN_MEMORY_NARRATIVES_PREFIX = 'mirrorbrain-memory-narratives-';
const MIRRORBRAIN_SKILL_DRAFTS_PREFIX = 'mirrorbrain-skill-drafts-';
const BROWSER_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const OPEN_VIKING_LOCK_RETRY_ATTEMPTS = 3;
const OPEN_VIKING_LOCK_RETRY_DELAY_MS = 50;

function encodeMirrorBrainResourceName(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]+/g, '-');
}

export function createMirrorBrainResourceTarget(
  namespace:
    | 'memory-events'
    | 'browser-page-content'
    | 'memory-narratives'
    | 'candidate-memories'
    | 'reviewed-memories'
    | 'knowledge'
    | 'skill-drafts',
  fileName: string,
): string {
  return `viking://resources/mirrorbrain-${namespace}-${encodeMirrorBrainResourceName(
    fileName,
  )}`;
}

export function createOpenVikingMemoryEventRecord(
  event: MemoryEvent,
): OpenVikingMemoryEventRecord {
  return {
    recordType: 'memory-event',
    recordId: event.id,
    payload: event,
  };
}

function isRetriableOpenVikingPointLockFailure(
  response: Response,
  body: string,
): boolean {
  return (
    response.status === 500 &&
    body.includes('Failed to acquire point lock')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ingestJsonResourceToOpenViking(
  input: {
    baseUrl: string;
    workspaceDir: string;
    directoryName: string;
    fileName: string;
    targetUri: string;
    reason: string;
    waitForCompletion?: boolean;
    payload: unknown;
  },
  fetchImpl: FetchLike,
): Promise<OpenVikingResourceIngestResult> {
  const resourceDir = join(input.workspaceDir, 'mirrorbrain', input.directoryName);
  const sourcePath = join(resourceDir, input.fileName);

  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(sourcePath, JSON.stringify(input.payload, null, 2));

  return ingestFileResourceToOpenViking(
    {
      baseUrl: input.baseUrl,
      sourcePath,
      targetUri: input.targetUri,
      reason: input.reason,
      waitForCompletion: input.waitForCompletion,
    },
    fetchImpl,
  );
}

async function ingestFileResourceToOpenViking(
  input: {
    baseUrl: string;
    sourcePath: string;
    targetUri: string;
    reason: string;
    waitForCompletion?: boolean;
  },
  fetchImpl: FetchLike,
): Promise<OpenVikingResourceIngestResult> {
  let response: Response | null = null;

  for (
    let attempt = 1;
    attempt <= OPEN_VIKING_LOCK_RETRY_ATTEMPTS;
    attempt += 1
  ) {
    response = await fetchImpl(`${input.baseUrl}/api/v1/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: input.sourcePath,
        target: input.targetUri,
        reason: input.reason,
        wait: input.waitForCompletion ?? false,
      }),
    });

    if (response.ok) {
      break;
    }

    const errorBody = await response.text();

    if (
      attempt < OPEN_VIKING_LOCK_RETRY_ATTEMPTS &&
      isRetriableOpenVikingPointLockFailure(response, errorBody)
    ) {
      await delay(OPEN_VIKING_LOCK_RETRY_DELAY_MS * attempt);
      continue;
    }

    const trimmedErrorBody = errorBody.trim();

    throw new Error(
      trimmedErrorBody.length > 0
        ? `OpenViking request failed with status ${response.status}: ${trimmedErrorBody}`
        : `OpenViking request failed with status ${response.status}`,
    );
  }

  if (response === null || !response.ok) {
    throw new Error('OpenViking request failed before a response was received.');
  }

  const body = (await response.json()) as {
    result?: {
      root_uri?: string;
    };
  };

  return {
    sourcePath: input.sourcePath,
    rootUri: body.result?.root_uri ?? input.targetUri,
  };
}

export async function ingestMemoryEventToOpenViking(
  input: IngestMemoryEventToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<IngestMemoryEventToOpenVikingResult> {
  const record = createOpenVikingMemoryEventRecord(input.event);
  return ingestJsonResourceToOpenViking(
    {
      baseUrl: input.baseUrl,
      workspaceDir: input.workspaceDir,
      directoryName: 'memory-events',
      fileName: `${input.event.id}.json`,
      targetUri: createMirrorBrainResourceTarget(
        'memory-events',
        `${input.event.id}.json`,
      ),
      reason: 'MirrorBrain imported browser memory event',
      waitForCompletion: false,
      payload: record.payload,
    },
    fetchImpl,
  );
}

export async function ingestCandidateMemoryToOpenViking(
  input: IngestCandidateMemoryToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<OpenVikingResourceIngestResult> {
  return ingestJsonResourceToOpenViking(
    {
      baseUrl: input.baseUrl,
      workspaceDir: input.workspaceDir,
      directoryName: 'candidate-memories',
      fileName: `${input.artifact.id}.json`,
      targetUri: createMirrorBrainResourceTarget(
        'candidate-memories',
        `${input.artifact.id}.json`,
      ),
      reason: 'MirrorBrain imported candidate memory',
      payload: input.artifact,
    },
    fetchImpl,
  );
}

export async function ingestMemoryNarrativeToOpenViking(
  input: IngestMemoryNarrativeToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<OpenVikingResourceIngestResult> {
  return ingestJsonResourceToOpenViking(
    {
      baseUrl: input.baseUrl,
      workspaceDir: input.workspaceDir,
      directoryName: 'memory-narratives',
      fileName: `${input.artifact.id}.json`,
      targetUri: createMirrorBrainResourceTarget(
        'memory-narratives',
        `${input.artifact.id}.json`,
      ),
      reason: 'MirrorBrain imported memory narrative',
      payload: input.artifact,
    },
    fetchImpl,
  );
}

export async function ingestBrowserPageContentToOpenViking(
  input: IngestBrowserPageContentToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<OpenVikingResourceIngestResult> {
  const resourceDir = join(
    input.workspaceDir,
    'mirrorbrain',
    'browser-page-content',
  );
  const sourcePath = join(resourceDir, `${input.artifact.id}.md`);
  const targetUri = createMirrorBrainResourceTarget(
    'browser-page-content',
    `${input.artifact.id}.md`,
  );
  const markdown = [
    `# ${input.artifact.title}`,
    '',
    `- url: ${input.artifact.url}`,
    `- latestAccessedAt: ${input.artifact.latestAccessedAt}`,
    '',
    '## Access Times',
    ...input.artifact.accessTimes.map((accessedAt) => `- ${accessedAt}`),
    '',
    '## Text',
    '',
    input.artifact.text,
  ].join('\n');

  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(sourcePath, markdown);

  return ingestFileResourceToOpenViking(
    {
      baseUrl: input.baseUrl,
      sourcePath,
      targetUri,
      reason: 'MirrorBrain imported browser page content',
      waitForCompletion: false,
    },
    fetchImpl,
  );
}

export async function ingestReviewedMemoryToOpenViking(
  input: IngestReviewedMemoryToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<OpenVikingResourceIngestResult> {
  return ingestJsonResourceToOpenViking(
    {
      baseUrl: input.baseUrl,
      workspaceDir: input.workspaceDir,
      directoryName: 'reviewed-memories',
      fileName: `${input.artifact.id}.json`,
      targetUri: createMirrorBrainResourceTarget(
        'reviewed-memories',
        `${input.artifact.id}.json`,
      ),
      reason: 'MirrorBrain imported reviewed memory',
      payload: input.artifact,
    },
    fetchImpl,
  );
}

export async function ingestKnowledgeArtifactToOpenViking(
  input: IngestKnowledgeArtifactToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<IngestKnowledgeArtifactToOpenVikingResult> {
  const resourceDir = join(input.workspaceDir, 'mirrorbrain', 'knowledge');
  const sourcePath = join(resourceDir, `${input.artifact.id}.md`);
  const target = createMirrorBrainResourceTarget(
    'knowledge',
    `${input.artifact.id}.md`,
  );
  const markdown = [
    `# ${input.artifact.id}`,
    '',
    `- artifactType: ${input.artifact.artifactType}`,
    `- draftState: ${input.artifact.draftState}`,
    `- topicKey: ${input.artifact.topicKey ?? ''}`,
    `- title: ${input.artifact.title}`,
    `- summary: ${input.artifact.summary}`,
    `- version: ${String(input.artifact.version)}`,
    `- isCurrentBest: ${String(input.artifact.isCurrentBest)}`,
    `- supersedesKnowledgeId: ${input.artifact.supersedesKnowledgeId ?? ''}`,
    `- updatedAt: ${input.artifact.updatedAt ?? ''}`,
    `- reviewedAt: ${input.artifact.reviewedAt ?? ''}`,
    `- recencyLabel: ${input.artifact.recencyLabel}`,
    '',
    '## Body',
    input.artifact.body ?? '',
    '',
    '## Source Reviewed Memories',
    ...input.artifact.sourceReviewedMemoryIds.map((id) => `- ${id}`),
    '',
    '## Derived Knowledge Artifacts',
    ...(input.artifact.derivedFromKnowledgeIds ?? []).map((id) => `- ${id}`),
    '',
    '## Provenance Refs',
    ...(input.artifact.provenanceRefs ?? []).map((ref) => `- ${ref.kind}:${ref.id}`),
  ].join('\n');

  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(sourcePath, markdown);

  const response = await fetchImpl(`${input.baseUrl}/api/v1/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: sourcePath,
      target,
      reason: 'MirrorBrain imported knowledge draft',
      wait: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenViking request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: {
      root_uri?: string;
    };
  };

  return {
    sourcePath,
    rootUri: payload.result?.root_uri ?? target,
  };
}

export async function ingestSkillArtifactToOpenViking(
  input: IngestSkillArtifactToOpenVikingInput,
  fetchImpl: FetchLike = fetch,
): Promise<IngestSkillArtifactToOpenVikingResult> {
  const resourceDir = join(input.workspaceDir, 'mirrorbrain', 'skill-drafts');
  const sourcePath = join(resourceDir, `${input.artifact.id}.md`);
  const target = createMirrorBrainResourceTarget(
    'skill-drafts',
    `${input.artifact.id}.md`,
  );
  const content = [
    `# ${input.artifact.id}`,
    '',
    `- approvalState: ${input.artifact.approvalState}`,
    `- requiresConfirmation: ${String(
      input.artifact.executionSafetyMetadata.requiresConfirmation,
    )}`,
    '',
    '## Workflow Evidence',
    ...input.artifact.workflowEvidenceRefs.map((ref) => `- ${ref}`),
  ].join('\n');

  mkdirSync(resourceDir, { recursive: true });
  writeFileSync(sourcePath, content);

  const response = await fetchImpl(`${input.baseUrl}/api/v1/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: sourcePath,
      target,
      reason: 'MirrorBrain imported skill draft',
      wait: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenViking request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: {
      root_uri?: string;
    };
  };

  return {
    sourcePath,
    uri: payload.result?.root_uri ?? target,
  };
}

async function listOpenVikingEntries(
  input: OpenVikingReadInput & {
    uri: string;
  },
  fetchImpl: FetchLike,
): Promise<OpenVikingFsEntry[]> {
  const response = await fetchImpl(
    `${input.baseUrl}/api/v1/fs/ls?uri=${encodeURIComponent(input.uri)}&output=original`,
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`OpenViking request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: OpenVikingFsEntry[];
  };

  return payload.result ?? [];
}

async function globOpenVikingEntries(
  input: OpenVikingReadInput & {
    uri: string;
    pattern: string;
    nodeLimit?: number;
  },
  fetchImpl: FetchLike,
): Promise<OpenVikingGlobResult> {
  const response = await fetchImpl(`${input.baseUrl}/api/v1/search/glob`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uri: input.uri,
      pattern: input.pattern,
      node_limit: input.nodeLimit,
    }),
  });

  if (response.status === 404) {
    return {
      matches: [],
      count: 0,
    };
  }

  if (!response.ok) {
    throw new Error(`OpenViking request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: OpenVikingGlobResult;
  };

  return payload.result?.matches !== undefined ? payload.result : {
    matches: [],
    count: 0,
  };
}

function isTopLevelOpenVikingResourceUri(uri: string): boolean {
  const prefix = 'viking://resources/';

  if (!uri.startsWith(prefix)) {
    return false;
  }

  return !uri.slice(prefix.length).includes('/');
}

async function readOpenVikingContent(
  input: OpenVikingReadInput & {
    uri: string;
  },
  fetchImpl: FetchLike,
): Promise<string> {
  const response = await fetchImpl(
    `${input.baseUrl}/api/v1/content/read?uri=${encodeURIComponent(input.uri)}`,
  );

  if (!response.ok) {
    throw new Error(`OpenViking request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: string;
  };

  return payload.result ?? '';
}

async function resolveReadableContentUris(
  input: OpenVikingReadInput & {
    entry: OpenVikingFsEntry;
  },
  fetchImpl: FetchLike,
): Promise<string[]> {
  if (input.entry.isDir === false) {
    return [input.entry.uri];
  }

  const childEntries = await listOpenVikingEntries(
    {
      ...input,
      uri: input.entry.uri,
    },
    fetchImpl,
  );

  return childEntries
    .filter((entry) => entry.isDir === false)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => entry.uri);
}

function parseKnowledgeArtifact(markdown: string): KnowledgeArtifact {
  const lines = markdown.split('\n');
  const getSectionLines = (sectionTitle: string): string[] => {
    const sectionIndex = lines.findIndex((line) => line.trim() === sectionTitle);

    if (sectionIndex === -1) {
      return [];
    }

    const nextSectionIndex = lines.findIndex(
      (line, index) => index > sectionIndex && line.startsWith('## '),
    );

    return lines.slice(
      sectionIndex + 1,
      nextSectionIndex === -1 ? undefined : nextSectionIndex,
    );
  };
  const id = lines[0]?.replace(/^#\s+/, '').trim() ?? '';
  const artifactType = (lines
    .find((line) => line.startsWith('- artifactType: '))
    ?.replace('- artifactType: ', '')
    .trim() ?? 'daily-review-draft') as KnowledgeArtifact['artifactType'];
  const draftState = (lines
    .find((line) => line.startsWith('- draftState: '))
    ?.replace('- draftState: ', '')
    .trim() ?? 'draft') as KnowledgeArtifact['draftState'];
  const topicKey =
    lines
      .find((line) => line.startsWith('- topicKey: '))
      ?.replace('- topicKey: ', '')
      .trim() ?? '';
  const title =
    lines
      .find((line) => line.startsWith('- title: '))
      ?.replace('- title: ', '')
      .trim() ?? id;
  const summary =
    lines
      .find((line) => line.startsWith('- summary: '))
      ?.replace('- summary: ', '')
      .trim() ?? '';
  const version = Number(
    lines
      .find((line) => line.startsWith('- version: '))
      ?.replace('- version: ', '')
      .trim() ?? '1',
  );
  const isCurrentBest =
    (lines
      .find((line) => line.startsWith('- isCurrentBest: '))
      ?.replace('- isCurrentBest: ', '')
      .trim() ?? 'false') === 'true';
  const supersedesKnowledgeId =
    lines
      .find((line) => line.startsWith('- supersedesKnowledgeId: '))
      ?.replace('- supersedesKnowledgeId: ', '')
      .trim() ?? '';
  const updatedAt =
    lines
      .find((line) => line.startsWith('- updatedAt: '))
      ?.replace('- updatedAt: ', '')
      .trim() ?? '';
  const reviewedAt =
    lines
      .find((line) => line.startsWith('- reviewedAt: '))
      ?.replace('- reviewedAt: ', '')
      .trim() ?? '';
  const recencyLabel =
    lines
      .find((line) => line.startsWith('- recencyLabel: '))
      ?.replace('- recencyLabel: ', '')
      .trim() ?? '';
  const sourceReviewedMemoryIds = getSectionLines('## Source Reviewed Memories')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- /, '').trim());
  const derivedFromKnowledgeIds = getSectionLines('## Derived Knowledge Artifacts')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- /, '').trim())
    .filter((line) => line.length > 0);
  const body = getSectionLines('## Body').join('\n').trim();
  const provenanceRefs = getSectionLines('## Provenance Refs')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- /, '').trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [kind, ...idParts] = line.split(':');

      return {
        kind: (kind?.trim() ?? 'reviewed-memory') as 'reviewed-memory' | 'knowledge-artifact',
        id: idParts.join(':').trim(),
      };
    });

  return {
    artifactType,
    id,
    draftState,
    topicKey: topicKey.length > 0 ? topicKey : null,
    title,
    summary,
    body,
    sourceReviewedMemoryIds,
    derivedFromKnowledgeIds,
    version: Number.isFinite(version) ? version : 1,
    isCurrentBest,
    supersedesKnowledgeId:
      supersedesKnowledgeId.length > 0 ? supersedesKnowledgeId : null,
    updatedAt: updatedAt.length > 0 ? updatedAt : undefined,
    reviewedAt: reviewedAt.length > 0 ? reviewedAt : null,
    recencyLabel,
    provenanceRefs,
  };
}

function parseSkillArtifact(markdown: string): SkillArtifact {
  const lines = markdown.split('\n');
  const id = lines[0]?.replace(/^#\s+/, '').trim() ?? '';
  const approvalState = (lines
    .find((line) => line.startsWith('- approvalState: '))
    ?.replace('- approvalState: ', '')
    .trim() ?? 'draft') as SkillArtifact['approvalState'];
  const requiresConfirmation =
    (lines
      .find((line) => line.startsWith('- requiresConfirmation: '))
      ?.replace('- requiresConfirmation: ', '')
      .trim() ?? 'true') === 'true';
  const sectionIndex = lines.findIndex(
    (line) => line.trim() === '## Workflow Evidence',
  );
  const workflowEvidenceRefs =
    sectionIndex === -1
      ? []
      : lines
          .slice(sectionIndex + 1)
          .filter((line) => line.startsWith('- '))
          .map((line) => line.replace(/^- /, '').trim());

  return {
    id,
    approvalState,
    workflowEvidenceRefs,
    executionSafetyMetadata: {
      requiresConfirmation,
    },
  };
}

function isMirrorBrainMemoryEvent(value: unknown): value is MemoryEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'sourceType' in value &&
    'sourceRef' in value &&
    'timestamp' in value &&
    'authorizationScopeId' in value &&
    'captureMetadata' in value
  );
}

function isCandidateMemory(value: unknown): value is CandidateMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'memoryEventIds' in value &&
    'reviewState' in value
  );
}

function isMemoryNarrative(value: unknown): value is MemoryNarrative {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'narrativeType' in value &&
    'sourceCategory' in value &&
    'sourceEventIds' in value &&
    'queryHints' in value
  );
}

function isReviewedMemory(value: unknown): value is ReviewedMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'candidateMemoryId' in value &&
    'decision' in value
  );
}

function filterMirrorBrainResourceEntries(
  entries: OpenVikingFsEntry[],
  predicate: (entry: OpenVikingFsEntry) => boolean,
): OpenVikingFsEntry[] {
  return entries.filter(predicate);
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function isBrowserUrlMemoryEvent(event: MemoryEvent): boolean {
  return (
    event.sourceType === 'activitywatch-browser' &&
    typeof event.content.url === 'string' &&
    event.content.url.length > 0
  );
}

function createMemoryEventDisplaySignature(event: MemoryEvent): string {
  if (isBrowserUrlMemoryEvent(event)) {
    return [
      event.sourceType,
      event.authorizationScopeId,
      String(event.content.url),
    ].join('|');
  }

  return event.id;
}

function getMemoryEventAccessTimes(event: MemoryEvent): string[] {
  const contentAccessTimes = Array.isArray(event.content.accessTimes)
    ? event.content.accessTimes.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  return Array.from(new Set([event.timestamp, ...contentAccessTimes])).sort(
    (left, right) => right.localeCompare(left),
  );
}

function mergeMemoryEventsForDisplay(
  previousEvent: MemoryEvent,
  nextEvent: MemoryEvent,
): MemoryEvent {
  const latestEvent =
    nextEvent.timestamp.localeCompare(previousEvent.timestamp) >= 0
      ? nextEvent
      : previousEvent;
  const mergedAccessTimes = Array.from(
    new Set([
      ...getMemoryEventAccessTimes(previousEvent),
      ...getMemoryEventAccessTimes(nextEvent),
    ]),
  ).sort((left, right) => right.localeCompare(left));

  if (!isBrowserUrlMemoryEvent(latestEvent)) {
    return latestEvent;
  }

  return {
    ...latestEvent,
    content: {
      ...latestEvent.content,
      accessTimes: mergedAccessTimes,
      latestAccessedAt: mergedAccessTimes[0] ?? latestEvent.timestamp,
    },
  };
}

function deduplicateMemoryEventsForDisplay(events: MemoryEvent[]): MemoryEvent[] {
  const deduplicatedById = deduplicateById(events);
  const latestBySignature = new Map<string, MemoryEvent>();

  for (const event of deduplicatedById) {
    const signature = createMemoryEventDisplaySignature(event);
    const previousEvent = latestBySignature.get(signature);

    if (previousEvent === undefined) {
      latestBySignature.set(signature, mergeMemoryEventsForDisplay(event, event));
      continue;
    }

    latestBySignature.set(
      signature,
      mergeMemoryEventsForDisplay(previousEvent, event),
    );
  }

  return [...latestBySignature.values()].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

function isKnowledgeResourceEntry(entry: OpenVikingFsEntry): boolean {
  return (
    entry.name.startsWith(MIRRORBRAIN_KNOWLEDGE_PREFIX) ||
    entry.name.startsWith('knowledge-draft')
  );
}

function isMemoryNarrativeResourceEntry(entry: OpenVikingFsEntry): boolean {
  return (
    entry.name.startsWith(MIRRORBRAIN_MEMORY_NARRATIVES_PREFIX) ||
    entry.name.startsWith('memory-narrative')
  );
}

function isCandidateMemoryResourceEntry(entry: OpenVikingFsEntry): boolean {
  return (
    entry.name.startsWith(MIRRORBRAIN_CANDIDATE_MEMORIES_PREFIX) ||
    entry.name.startsWith('candidate')
  );
}

function isReviewedMemoryResourceEntry(entry: OpenVikingFsEntry): boolean {
  return (
    entry.name.startsWith(MIRRORBRAIN_REVIEWED_MEMORIES_PREFIX) ||
    entry.name.startsWith('reviewed')
  );
}

function isSkillDraftResourceEntry(entry: OpenVikingFsEntry): boolean {
  return (
    entry.name.startsWith(MIRRORBRAIN_SKILL_DRAFTS_PREFIX) ||
    entry.name.startsWith('skill-draft')
  );
}

function isMemoryEventResourceEntry(entry: OpenVikingFsEntry): boolean {
  return (
    entry.name.startsWith(MIRRORBRAIN_MEMORY_EVENTS_PREFIX) ||
    entry.name.startsWith('browser')
  );
}

export async function listMirrorBrainMemoryEventsFromOpenViking(
  input: OpenVikingReadInput,
  fetchImpl: FetchLike = fetch,
): Promise<MemoryEvent[]> {
  const entries = await listOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
    },
    fetchImpl,
  );
  const browserGlob = await globOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
      pattern: 'browser*',
      nodeLimit: 10000,
    },
    fetchImpl,
  );
  const globEntries = browserGlob.matches
    .filter((uri) => isTopLevelOpenVikingResourceUri(uri))
    .map((uri) => ({
      name: uri.split('/').at(-1) ?? '',
      uri,
      isDir: true,
    }));
  const resourceEntries = deduplicateById(
    [...entries, ...globEntries].map((entry) => ({
      id: entry.uri,
      ...entry,
    })),
  ).map(({ id: _id, ...entry }) => entry);

  return Promise.all(
    filterMirrorBrainResourceEntries(
      resourceEntries,
      isMemoryEventResourceEntry,
    ).map(async (entry) => {
      const contentUris = await resolveReadableContentUris(
        {
          ...input,
          entry,
        },
        fetchImpl,
      );

      if (contentUris.length === 0) {
        return null;
      }

      const content = (
        await Promise.all(
          contentUris.map((uri) =>
            readOpenVikingContent(
              {
                ...input,
                uri,
              },
              fetchImpl,
            ),
          ),
        )
      ).join('');
      const parsed = JSON.parse(content) as unknown;

      return isMirrorBrainMemoryEvent(parsed) ? parsed : null;
    }),
  ).then((items) =>
    deduplicateMemoryEventsForDisplay(
      items.filter((item): item is MemoryEvent => item !== null),
    ),
  );
}

export async function listMirrorBrainMemoryEventsFromWorkspace(
  input: WorkspaceMemoryReadInput,
): Promise<MemoryEvent[]> {
  const memoryEventsDir = join(input.workspaceDir, 'mirrorbrain', 'memory-events');
  let files: string[];

  try {
    files = await readdir(memoryEventsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const items = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const content = await readFile(join(memoryEventsDir, file), 'utf8');
        const parsed = JSON.parse(content) as unknown;

        return isMirrorBrainMemoryEvent(parsed) ? parsed : null;
      }),
  );

  return deduplicateMemoryEventsForDisplay(
    items.filter((item): item is MemoryEvent => item !== null),
  );
}

export async function listRawMirrorBrainMemoryEventsFromWorkspace(
  input: WorkspaceMemoryReadInput,
): Promise<MemoryEvent[]> {
  const memoryEventsDir = join(input.workspaceDir, 'mirrorbrain', 'memory-events');
  let files: string[];

  try {
    files = await readdir(memoryEventsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const items = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const content = await readFile(join(memoryEventsDir, file), 'utf8');
        const parsed = JSON.parse(content) as unknown;

        return isMirrorBrainMemoryEvent(parsed) ? parsed : null;
      }),
  );

  return items
    .filter((item): item is MemoryEvent => item !== null)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export async function listMirrorBrainKnowledgeArtifactsFromOpenViking(
  input: OpenVikingReadInput,
  fetchImpl: FetchLike = fetch,
): Promise<KnowledgeArtifact[]> {
  const entries = await listOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
    },
    fetchImpl,
  );

  return Promise.all(
    filterMirrorBrainResourceEntries(
      entries,
      isKnowledgeResourceEntry,
    )
      .map(async (entry) => {
        const contentUris = await resolveReadableContentUris(
          {
            ...input,
            entry,
          },
          fetchImpl,
        );

        if (contentUris.length === 0) {
          return null;
        }

        return parseKnowledgeArtifact(
          (
            await Promise.all(
              contentUris.map((uri) =>
                readOpenVikingContent(
                  {
                    ...input,
                    uri,
                  },
                  fetchImpl,
                ),
              ),
            )
          ).join(''),
        );
      }),
  ).then((items) =>
    deduplicateById(
      items.filter((item): item is KnowledgeArtifact => item !== null),
    ),
  );
}

export async function listMirrorBrainMemoryNarrativesFromOpenViking(
  input: OpenVikingReadInput,
  fetchImpl: FetchLike = fetch,
): Promise<MemoryNarrative[]> {
  const entries = await listOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
    },
    fetchImpl,
  );

  return Promise.all(
    filterMirrorBrainResourceEntries(
      entries,
      isMemoryNarrativeResourceEntry,
    ).map(async (entry) => {
      const contentUris = await resolveReadableContentUris(
        {
          ...input,
          entry,
        },
        fetchImpl,
      );

      if (contentUris.length === 0) {
        return null;
      }

      const content = (
        await Promise.all(
          contentUris.map((uri) =>
            readOpenVikingContent(
              {
                ...input,
                uri,
              },
              fetchImpl,
            ),
          ),
        )
      ).join('');
      const parsed = JSON.parse(content) as unknown;

      return isMemoryNarrative(parsed) ? parsed : null;
    }),
  ).then((items) =>
    deduplicateById(
      items.filter((item): item is MemoryNarrative => item !== null),
    ),
  );
}

export async function listMirrorBrainCandidateMemoriesFromWorkspace(
  input: WorkspaceMemoryReadInput,
): Promise<CandidateMemory[]> {
  const candidateMemoriesDir = join(input.workspaceDir, 'mirrorbrain', 'candidate-memories');
  let files: string[];

  try {
    files = await readdir(candidateMemoriesDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const items = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const content = await readFile(join(candidateMemoriesDir, file), 'utf8');
        const parsed = JSON.parse(content) as unknown;

        return isCandidateMemory(parsed) ? parsed : null;
      }),
  );

  return deduplicateById(
    items.filter((item): item is CandidateMemory => item !== null),
  );
}

export async function listMirrorBrainCandidateMemoriesFromOpenViking(
  input: OpenVikingReadInput,
  fetchImpl: FetchLike = fetch,
): Promise<CandidateMemory[]> {
  const entries = await listOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
    },
    fetchImpl,
  );

  return Promise.all(
    filterMirrorBrainResourceEntries(
      entries,
      isCandidateMemoryResourceEntry,
    )
      .map(async (entry) => {
        const contentUris = await resolveReadableContentUris(
          {
            ...input,
            entry,
          },
          fetchImpl,
        );

        if (contentUris.length === 0) {
          return null;
        }

        const content = (
          await Promise.all(
            contentUris.map((uri) =>
              readOpenVikingContent(
                {
                  ...input,
                  uri,
                },
                fetchImpl,
              ),
            ),
          )
        ).join('');

        const parsed = JSON.parse(content) as unknown;

        return isCandidateMemory(parsed) ? parsed : null;
      }),
  ).then((items) =>
    deduplicateById(
      items.filter((item): item is CandidateMemory => item !== null),
    ),
  );
}

export async function listMirrorBrainReviewedMemoriesFromOpenViking(
  input: OpenVikingReadInput,
  fetchImpl: FetchLike = fetch,
): Promise<ReviewedMemory[]> {
  const entries = await listOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
    },
    fetchImpl,
  );

  return Promise.all(
    filterMirrorBrainResourceEntries(
      entries,
      isReviewedMemoryResourceEntry,
    )
      .map(async (entry) => {
        const contentUris = await resolveReadableContentUris(
          {
            ...input,
            entry,
          },
          fetchImpl,
        );

        if (contentUris.length === 0) {
          return null;
        }

        const content = (
          await Promise.all(
            contentUris.map((uri) =>
              readOpenVikingContent(
                {
                  ...input,
                  uri,
                },
                fetchImpl,
              ),
            ),
          )
        ).join('');

        const parsed = JSON.parse(content) as unknown;

        return isReviewedMemory(parsed) ? parsed : null;
      }),
  ).then((items) =>
    deduplicateById(
      items.filter((item): item is ReviewedMemory => item !== null),
    ),
  );
}

export async function listMirrorBrainSkillArtifactsFromOpenViking(
  input: OpenVikingReadInput,
  fetchImpl: FetchLike = fetch,
): Promise<SkillArtifact[]> {
  const entries = await listOpenVikingEntries(
    {
      ...input,
      uri: OPEN_VIKING_RESOURCES_URI,
    },
    fetchImpl,
  );

  return Promise.all(
    filterMirrorBrainResourceEntries(
      entries,
      isSkillDraftResourceEntry,
    )
      .map(async (entry) => {
        const contentUris = await resolveReadableContentUris(
          {
            ...input,
            entry,
          },
          fetchImpl,
        );

        if (contentUris.length === 0) {
          return null;
        }

        return parseSkillArtifact(
          (
            await Promise.all(
              contentUris.map((uri) =>
                readOpenVikingContent(
                  {
                    ...input,
                    uri,
                  },
                  fetchImpl,
                ),
              ),
            )
          ).join(''),
        );
      }),
  ).then((items) =>
    deduplicateById(
      items.filter((item): item is SkillArtifact => item !== null),
    ),
  );
}
