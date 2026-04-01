import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CandidateMemory,
  KnowledgeArtifact,
  MemoryEvent,
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
const MIRRORBRAIN_SKILL_DRAFTS_PREFIX = 'mirrorbrain-skill-drafts-';
const BROWSER_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

function encodeMirrorBrainResourceName(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]+/g, '-');
}

export function createMirrorBrainResourceTarget(
  namespace:
    | 'memory-events'
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

  const response = await fetchImpl(`${input.baseUrl}/api/v1/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: sourcePath,
      target: input.targetUri,
      reason: input.reason,
      wait: input.waitForCompletion ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenViking request failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    result?: {
      root_uri?: string;
    };
  };

  return {
    sourcePath,
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
      waitForCompletion: true,
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
    `- draftState: ${input.artifact.draftState}`,
    '',
    '## Source Reviewed Memories',
    ...input.artifact.sourceReviewedMemoryIds.map((id) => `- ${id}`),
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
  const id = lines[0]?.replace(/^#\s+/, '').trim() ?? '';
  const draftState = (lines
    .find((line) => line.startsWith('- draftState: '))
    ?.replace('- draftState: ', '')
    .trim() ?? 'draft') as KnowledgeArtifact['draftState'];
  const sectionIndex = lines.findIndex(
    (line) => line.trim() === '## Source Reviewed Memories',
  );
  const sourceReviewedMemoryIds =
    sectionIndex === -1
      ? []
      : lines
          .slice(sectionIndex + 1)
          .filter((line) => line.startsWith('- '))
          .map((line) => line.replace(/^- /, '').trim());

  return {
    id,
    draftState,
    sourceReviewedMemoryIds,
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

function createBrowserEventSignature(event: MemoryEvent): string {
  return [
    event.sourceType,
    event.authorizationScopeId,
    String(event.content.url ?? ''),
    String(event.content.title ?? ''),
  ].join('|');
}

function deduplicateMemoryEventsForDisplay(events: MemoryEvent[]): MemoryEvent[] {
  const deduplicatedById = deduplicateById(events);
  const latestBySignature = new Map<string, MemoryEvent>();

  for (const event of deduplicatedById) {
    const signature = createBrowserEventSignature(event);
    const previousEvent = latestBySignature.get(signature);

    if (previousEvent === undefined) {
      latestBySignature.set(signature, event);
      continue;
    }

    const eventTime = new Date(event.timestamp).getTime();
    const previousEventTime = new Date(previousEvent.timestamp).getTime();
    const shouldReplace =
      Number.isFinite(eventTime) &&
      Number.isFinite(previousEventTime) &&
      eventTime >= previousEventTime;

    if (shouldReplace) {
      latestBySignature.set(signature, event);
    }
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
      (entry) =>
        entry.name.startsWith(MIRRORBRAIN_MEMORY_EVENTS_PREFIX) ||
        entry.name.startsWith('browser'),
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
