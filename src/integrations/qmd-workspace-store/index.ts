import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type {
  CandidateMemory,
  KnowledgeArtifact,
  MemoryEvent,
  MemoryNarrative,
  ReviewedMemory,
  SkillArtifact,
} from '../../shared/types/index.js';
import {
  listMirrorBrainCandidateMemoriesFromWorkspace,
  listMirrorBrainKnowledgeArtifactsFromWorkspace,
  listMirrorBrainMemoryEventsFromWorkspace,
  listMirrorBrainSkillArtifactsFromWorkspace,
  listRawMirrorBrainMemoryEventsFromWorkspace,
} from '../openviking-store/index.js';

export interface QmdWorkspaceMemoryEventRecord {
  recordType: 'memory-event';
  recordId: string;
  payload: MemoryEvent;
}

export interface QmdWorkspaceMemoryEventWriter {
  writeMemoryEvent(record: QmdWorkspaceMemoryEventRecord): Promise<void>;
}

interface QmdWorkspaceStoreInput {
  workspaceDir: string;
}

interface QmdWorkspaceMemoryQueryInput extends QmdWorkspaceStoreInput {
  query?: string;
  limit?: number;
}

interface QmdSearchResultLike {
  path?: string;
  filepath?: string;
  filePath?: string;
  file?: string;
  displayPath?: string;
}

interface QmdStoreLike {
  update(options?: { collections?: string[] }): Promise<unknown>;
  search?(
    options: {
      query?: string;
      queries?: Array<{ type: 'lex' | 'vec' | 'hyde'; query: string }>;
      collection?: string;
      limit?: number;
      rerank?: boolean;
    },
  ): Promise<QmdSearchResultLike[]>;
  searchLex(
    query: string,
    options?: { collection?: string; limit?: number },
  ): Promise<QmdSearchResultLike[]>;
  close(): Promise<void>;
}

type CreateQmdStore = (options: {
  dbPath: string;
  config: QmdWorkspaceConfig;
}) => Promise<QmdStoreLike>;

interface QmdWorkspaceStoreDependencies {
  createStore?: CreateQmdStore;
}

interface QmdWorkspaceConfig {
  collections: Record<
    'memory-events' | 'memory-narratives' | 'knowledge' | 'skill-drafts',
    {
      path: string;
      pattern: string;
    }
  >;
}

export interface QmdWorkspacePaths {
  rootDir: string;
  qmdDir: string;
  dbPath: string;
  memoryEventsDir: string;
  memoryNarrativesDir: string;
  knowledgeDir: string;
  skillDraftsDir: string;
}

export interface QmdWorkspaceResourceWriteResult {
  sourcePath: string;
  rootUri: string;
}

function encodePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/gu, '-');
}

function formatUnknownValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function qmdWorkspaceUri(relativePath: string): string {
  return `qmd://mirrorbrain/${relativePath}`;
}

export function getQmdWorkspacePaths(workspaceDir: string): QmdWorkspacePaths {
  const rootDir = join(workspaceDir, 'mirrorbrain');

  return {
    rootDir,
    qmdDir: join(rootDir, 'qmd'),
    dbPath: join(rootDir, 'qmd', 'index.sqlite'),
    memoryEventsDir: join(rootDir, 'memory-events'),
    memoryNarrativesDir: join(rootDir, 'memory-narratives'),
    knowledgeDir: join(rootDir, 'knowledge'),
    skillDraftsDir: join(rootDir, 'skill-drafts'),
  };
}

function createQmdWorkspaceConfig(workspaceDir: string): QmdWorkspaceConfig {
  const paths = getQmdWorkspacePaths(workspaceDir);

  return {
    collections: {
      'memory-events': {
        path: paths.memoryEventsDir,
        pattern: '**/*.md',
      },
      'memory-narratives': {
        path: paths.memoryNarrativesDir,
        pattern: '**/*.md',
      },
      knowledge: {
        path: paths.knowledgeDir,
        pattern: '**/*.md',
      },
      'skill-drafts': {
        path: paths.skillDraftsDir,
        pattern: '**/*.md',
      },
    },
  };
}

async function loadDefaultCreateStore(): Promise<CreateQmdStore> {
  const qmd = await import('@tobilu/qmd');

  return qmd.createStore as CreateQmdStore;
}

async function openQmdWorkspaceStore(
  input: QmdWorkspaceStoreInput,
  dependencies: QmdWorkspaceStoreDependencies = {},
): Promise<QmdStoreLike> {
  const paths = getQmdWorkspacePaths(input.workspaceDir);
  const createStore = dependencies.createStore ?? await loadDefaultCreateStore();

  await mkdir(paths.qmdDir, { recursive: true });

  return createStore({
    dbPath: paths.dbPath,
    config: createQmdWorkspaceConfig(input.workspaceDir),
  });
}

function toMemoryEventMarkdown(event: MemoryEvent): string {
  const title =
    typeof event.content.title === 'string' && event.content.title.length > 0
      ? event.content.title
      : event.id;
  const summary =
    typeof event.content.summary === 'string' ? event.content.summary : '';

  return [
    '---',
    'mirrorbrainType: memory-event',
    `id: ${event.id}`,
    `sourceType: ${event.sourceType}`,
    `sourceRef: ${event.sourceRef}`,
    `timestamp: ${event.timestamp}`,
    `authorizationScopeId: ${event.authorizationScopeId}`,
    '---',
    '',
    `# ${title}`,
    '',
    summary,
    '',
    '## Content',
    '',
    ...Object.entries(event.content).map(
      ([key, value]) => `- ${key}: ${formatUnknownValue(value)}`,
    ),
    '',
    '## Capture Metadata',
    '',
    `- upstreamSource: ${event.captureMetadata.upstreamSource}`,
    `- checkpoint: ${event.captureMetadata.checkpoint}`,
  ].join('\n');
}

function toMemoryNarrativeMarkdown(artifact: MemoryNarrative): string {
  return [
    '---',
    'mirrorbrainType: memory-narrative',
    `id: ${artifact.id}`,
    `sourceCategory: ${artifact.sourceCategory}`,
    `narrativeType: ${artifact.narrativeType}`,
    `startAt: ${artifact.timeRange.startAt}`,
    `endAt: ${artifact.timeRange.endAt}`,
    '---',
    '',
    `# ${artifact.title}`,
    '',
    artifact.summary,
    '',
    '## Query Hints',
    ...artifact.queryHints.map((hint) => `- ${hint}`),
  ].join('\n');
}

function toKnowledgeMarkdown(artifact: KnowledgeArtifact): string {
  return [
    `# ${artifact.id}`,
    '',
    `- artifactType: ${artifact.artifactType}`,
    `- draftState: ${artifact.draftState}`,
    `- topicKey: ${artifact.topicKey ?? ''}`,
    `- title: ${artifact.title}`,
    `- summary: ${artifact.summary}`,
    `- version: ${String(artifact.version)}`,
    `- isCurrentBest: ${String(artifact.isCurrentBest)}`,
    `- supersedesKnowledgeId: ${artifact.supersedesKnowledgeId ?? ''}`,
    `- updatedAt: ${artifact.updatedAt ?? ''}`,
    `- reviewedAt: ${artifact.reviewedAt ?? ''}`,
    `- recencyLabel: ${artifact.recencyLabel}`,
    '',
    '## Body',
    artifact.body ?? '',
    '',
    '## Source Reviewed Memories',
    ...artifact.sourceReviewedMemoryIds.map((id) => `- ${id}`),
    '',
    '## Derived Knowledge Artifacts',
    ...(artifact.derivedFromKnowledgeIds ?? []).map((id) => `- ${id}`),
    '',
    '## Provenance Refs',
    ...(artifact.provenanceRefs ?? []).map((ref) => `- ${ref.kind}:${ref.id}`),
  ].join('\n');
}

function toSkillMarkdown(artifact: SkillArtifact): string {
  return [
    `# ${artifact.id}`,
    '',
    `- approvalState: ${artifact.approvalState}`,
    `- requiresConfirmation: ${String(
      artifact.executionSafetyMetadata.requiresConfirmation,
    )}`,
    '',
    '## Workflow Evidence',
    ...artifact.workflowEvidenceRefs.map((ref) => `- ${ref}`),
  ].join('\n');
}

async function writeJsonAndMarkdown(input: {
  directory: string;
  id: string;
  payload: unknown;
  markdown: string;
}): Promise<QmdWorkspaceResourceWriteResult> {
  const safeId = encodePathSegment(input.id);
  const jsonPath = join(input.directory, `${safeId}.json`);
  const markdownPath = join(input.directory, `${safeId}.md`);

  await mkdir(input.directory, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(input.payload, null, 2)}\n`);
  await writeFile(markdownPath, `${input.markdown}\n`);

  return {
    sourcePath: markdownPath,
    rootUri: qmdWorkspaceUri(`${input.directory.split('/mirrorbrain/').at(-1) ?? ''}/${safeId}.md`),
  };
}

async function writeMarkdown(input: {
  directory: string;
  id: string;
  markdown: string;
}): Promise<QmdWorkspaceResourceWriteResult> {
  const safeId = encodePathSegment(input.id);
  const markdownPath = join(input.directory, `${safeId}.md`);

  await mkdir(input.directory, { recursive: true });
  await writeFile(markdownPath, `${input.markdown}\n`);

  return {
    sourcePath: markdownPath,
    rootUri: qmdWorkspaceUri(`${input.directory.split('/mirrorbrain/').at(-1) ?? ''}/${safeId}.md`),
  };
}

export function createQmdWorkspaceMemoryEventRecord(
  event: MemoryEvent,
): QmdWorkspaceMemoryEventRecord {
  return {
    recordType: 'memory-event',
    recordId: event.id,
    payload: event,
  };
}

export function createQmdWorkspaceMemoryEventWriter(
  input: QmdWorkspaceStoreInput,
): QmdWorkspaceMemoryEventWriter {
  return {
    writeMemoryEvent(record) {
      return ingestMemoryEventToQmdWorkspace({
        workspaceDir: input.workspaceDir,
        event: record.payload,
      }).then(() => undefined);
    },
  };
}

export function ingestMemoryEventToQmdWorkspace(
  input: QmdWorkspaceStoreInput & { event: MemoryEvent },
): Promise<QmdWorkspaceResourceWriteResult> {
  return writeJsonAndMarkdown({
    directory: getQmdWorkspacePaths(input.workspaceDir).memoryEventsDir,
    id: input.event.id,
    payload: input.event,
    markdown: toMemoryEventMarkdown(input.event),
  });
}

export function ingestCandidateMemoryToQmdWorkspace(
  input: QmdWorkspaceStoreInput & { artifact: CandidateMemory },
): Promise<QmdWorkspaceResourceWriteResult> {
  return writeJsonAndMarkdown({
    directory: join(input.workspaceDir, 'mirrorbrain', 'candidate-memories'),
    id: input.artifact.id,
    payload: input.artifact,
    markdown: [
      `# ${input.artifact.title}`,
      '',
      input.artifact.summary,
      '',
      `- id: ${input.artifact.id}`,
      `- theme: ${input.artifact.theme}`,
      `- reviewState: ${input.artifact.reviewState}`,
    ].join('\n'),
  });
}

export function ingestReviewedMemoryToQmdWorkspace(
  input: QmdWorkspaceStoreInput & { artifact: ReviewedMemory },
): Promise<QmdWorkspaceResourceWriteResult> {
  return writeJsonAndMarkdown({
    directory: join(input.workspaceDir, 'mirrorbrain', 'reviewed-memories'),
    id: input.artifact.id,
    payload: input.artifact,
    markdown: [
      `# ${input.artifact.id}`,
      '',
      `- candidateMemoryId: ${input.artifact.candidateMemoryId}`,
      `- decision: ${input.artifact.decision}`,
      `- reviewedAt: ${input.artifact.reviewedAt}`,
      '',
      input.artifact.candidateSummary,
    ].join('\n'),
  });
}

export function ingestMemoryNarrativeToQmdWorkspace(
  input: QmdWorkspaceStoreInput & { artifact: MemoryNarrative },
): Promise<QmdWorkspaceResourceWriteResult> {
  return writeJsonAndMarkdown({
    directory: getQmdWorkspacePaths(input.workspaceDir).memoryNarrativesDir,
    id: input.artifact.id,
    payload: input.artifact,
    markdown: toMemoryNarrativeMarkdown(input.artifact),
  });
}

export function ingestKnowledgeArtifactToQmdWorkspace(
  input: QmdWorkspaceStoreInput & { artifact: KnowledgeArtifact },
): Promise<QmdWorkspaceResourceWriteResult> {
  return writeMarkdown({
    directory: getQmdWorkspacePaths(input.workspaceDir).knowledgeDir,
    id: input.artifact.id,
    markdown: toKnowledgeMarkdown(input.artifact),
  });
}

export function ingestSkillArtifactToQmdWorkspace(
  input: QmdWorkspaceStoreInput & { artifact: SkillArtifact },
): Promise<{ sourcePath: string; uri: string }> {
  return writeMarkdown({
    directory: getQmdWorkspacePaths(input.workspaceDir).skillDraftsDir,
    id: input.artifact.id,
    markdown: toSkillMarkdown(input.artifact),
  }).then((result) => ({
    sourcePath: result.sourcePath,
    uri: result.rootUri,
  }));
}

function getPathFromQmdResult(result: QmdSearchResultLike): string | null {
  return (
    result.path ??
    result.filepath ??
    result.filePath ??
    result.file ??
    result.displayPath ??
    null
  );
}

function resolveMemoryEventJsonPath(
  workspaceDir: string,
  qmdPath: string,
): string | null {
  const paths = getQmdWorkspacePaths(workspaceDir);
  const relativeQmdPath = qmdPath.startsWith('qmd://')
    ? qmdPath.slice('qmd://'.length)
    : qmdPath;
  const normalizedPath = relativeQmdPath.startsWith('memory-events/')
    ? join(paths.rootDir, relativeQmdPath)
    : relativeQmdPath;
  const absolutePath = resolve(normalizedPath);
  const memoryEventsDir = resolve(paths.memoryEventsDir);

  if (!absolutePath.startsWith(memoryEventsDir)) {
    return null;
  }

  if (!absolutePath.endsWith('.md')) {
    return null;
  }

  return absolutePath.replace(/\.md$/u, '.json');
}

async function readMemoryEventJson(path: string): Promise<MemoryEvent | null> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;

  return isMemoryEvent(parsed) ? parsed : null;
}

function isMemoryEvent(value: unknown): value is MemoryEvent {
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

export async function listMirrorBrainMemoryEventsFromQmdWorkspace(
  input: QmdWorkspaceMemoryQueryInput,
  dependencies: QmdWorkspaceStoreDependencies = {},
): Promise<MemoryEvent[]> {
  if (input.query === undefined || input.query.trim().length === 0) {
    return listMirrorBrainMemoryEventsFromWorkspace({
      workspaceDir: input.workspaceDir,
    });
  }

  const store = await openQmdWorkspaceStore(input, dependencies);

  try {
    await store.update({
      collections: ['memory-events'],
    });
    let results: QmdSearchResultLike[];

    if (store.search !== undefined) {
      try {
        results = await store.search({
          queries: [{ type: 'lex', query: input.query }],
          collection: 'memory-events',
          limit: input.limit ?? 20,
          rerank: false,
        });

        if (results.length === 0) {
          results = await store.searchLex(input.query, {
            collection: 'memory-events',
            limit: input.limit ?? 20,
          });
        }
      } catch {
        results = await store.searchLex(input.query, {
          collection: 'memory-events',
          limit: input.limit ?? 20,
        });
      }
    } else {
      results = await store.searchLex(input.query, {
        collection: 'memory-events',
        limit: input.limit ?? 20,
      });
    }
    const events: MemoryEvent[] = [];

    for (const result of results) {
      const qmdPath = getPathFromQmdResult(result);

      if (qmdPath === null) {
        continue;
      }

      const jsonPath = resolveMemoryEventJsonPath(input.workspaceDir, qmdPath);

      if (jsonPath === null) {
        continue;
      }

      const event = await readMemoryEventJson(jsonPath);

      if (event !== null) {
        events.push(event);
      }
    }

    return events;
  } finally {
    await store.close();
  }
}

export function listRawMirrorBrainMemoryEventsFromQmdWorkspace(
  input: QmdWorkspaceStoreInput,
): Promise<MemoryEvent[]> {
  return listRawMirrorBrainMemoryEventsFromWorkspace(input);
}

export async function listMirrorBrainMemoryNarrativesFromQmdWorkspace(
  input: QmdWorkspaceStoreInput,
): Promise<MemoryNarrative[]> {
  const directory = getQmdWorkspacePaths(input.workspaceDir).memoryNarrativesDir;
  let files: string[];

  try {
    files = await readdir(directory);
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
        const parsed = JSON.parse(await readFile(join(directory, file), 'utf8')) as unknown;

        return isMemoryNarrative(parsed) ? parsed : null;
      }),
  );

  return items.filter((item): item is MemoryNarrative => item !== null);
}

function isMemoryNarrative(value: unknown): value is MemoryNarrative {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'narrativeType' in value &&
    'sourceCategory' in value &&
    'sourceEventIds' in value
  );
}

export function listMirrorBrainCandidateMemoriesFromQmdWorkspace(
  input: QmdWorkspaceStoreInput,
): Promise<CandidateMemory[]> {
  return listMirrorBrainCandidateMemoriesFromWorkspace(input);
}

export async function listMirrorBrainReviewedMemoriesFromQmdWorkspace(
  input: QmdWorkspaceStoreInput,
): Promise<ReviewedMemory[]> {
  const reviewedDir = join(input.workspaceDir, 'mirrorbrain', 'reviewed-memories');
  let files: string[];

  try {
    files = await readdir(reviewedDir);
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
        const parsed = JSON.parse(await readFile(join(reviewedDir, file), 'utf8')) as unknown;

        return isReviewedMemory(parsed) ? parsed : null;
      }),
  );

  return items.filter((item): item is ReviewedMemory => item !== null);
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

export function listMirrorBrainKnowledgeArtifactsFromQmdWorkspace(
  input: QmdWorkspaceStoreInput,
): Promise<KnowledgeArtifact[]> {
  return listMirrorBrainKnowledgeArtifactsFromWorkspace(input);
}

export function listMirrorBrainSkillArtifactsFromQmdWorkspace(
  input: QmdWorkspaceStoreInput,
): Promise<SkillArtifact[]> {
  return listMirrorBrainSkillArtifactsFromWorkspace(input);
}
