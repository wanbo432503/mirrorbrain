import { createHash } from 'node:crypto';

import type { MemoryEvent } from '../../shared/types/index.js';

export type SourceLedgerKind =
  | 'browser'
  | 'file-activity'
  | 'screenshot'
  | 'shell'
  | 'agent-transcript';

export type SourceAuditEventType =
  | 'entry-imported'
  | 'schema-validation-failed'
  | 'source-enabled'
  | 'source-disabled';

export interface SourceLedgerEntry<TPayload = unknown> {
  schemaVersion: string;
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  occurredAt: string;
  capturedAt?: string;
  payload: TPayload;
}

export interface SourceLedgerImportCheckpoint {
  ledgerPath: string;
  nextLineNumber: number;
  updatedAt: string;
}

export interface SourceAuditEvent {
  id: string;
  eventType: SourceAuditEventType;
  sourceKind?: SourceLedgerKind;
  sourceInstanceId?: string;
  ledgerPath: string;
  lineNumber: number;
  occurredAt: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

interface BrowserLedgerPayload {
  id: string;
  title: string;
  url: string;
  page_content: string;
}

interface FileActivityLedgerPayload {
  filePath: string;
  fileName: string;
  fileType: string;
  mimeType?: string;
  openedByApp?: string;
  sizeBytes?: number;
  modifiedAt?: string;
  contentSummary: string;
  summaryModel?: string;
  fullContentRef?: string;
}

interface ScreenshotLedgerPayload {
  title?: string;
  appName?: string;
  windowTitle?: string;
  imagePath?: string;
  imageRetained: boolean;
  imageSize?: {
    width: number;
    height: number;
  };
  ocrSummary?: string;
  visionSummary: string;
  ocrModel?: string;
  visionModel?: string;
}

interface ShellLedgerPayload {
  sessionId: string;
  commandIndex: number;
  command: string;
  cwd?: string;
  exitCode?: number;
  shellType?: string;
  terminalApp?: string;
  redactionStatus?: string;
}

interface AgentTranscriptLedgerPayload {
  transcriptPath: string;
  sessionId: string;
  agentIdentity: string;
  userTask: string;
  messageRange: {
    start: number;
    end: number;
  };
  toolCallSummary?: string;
  finalResultSummary: string;
  redactionStatus?: string;
  updatedAt: string;
}

interface SourceLedgerImporterInput {
  authorizationScopeId: string;
  checkpoint?: SourceLedgerImportCheckpoint | null;
  importedAt: string;
  ledgerPath: string;
  ledgerText: string;
}

interface SourceLedgerImporterResult {
  importedEvents: MemoryEvent[];
  auditEvents: SourceAuditEvent[];
  checkpoint: SourceLedgerImportCheckpoint;
}

function hashValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 24);
}

function createAuditEvent(input: {
  eventType: SourceAuditEventType;
  sourceKind?: SourceLedgerKind;
  sourceInstanceId?: string;
  ledgerPath: string;
  lineNumber: number;
  occurredAt: string;
  severity: SourceAuditEvent['severity'];
  message: string;
  metadata?: Record<string, unknown>;
}): SourceAuditEvent {
  return {
    ...input,
    id: `source-audit:${hashValue([
      input.eventType,
      input.ledgerPath,
      input.lineNumber,
      input.occurredAt,
      input.message,
    ])}`,
  };
}

function truncateBadLineSample(line: string): string {
  return line.slice(0, 240);
}

function getAuditSourceHint(line: string): {
  sourceKind?: SourceLedgerKind;
  sourceInstanceId?: string;
} {
  try {
    const parsed = JSON.parse(line) as unknown;

    if (!isRecord(parsed)) {
      return {};
    }

    return {
      sourceKind: isSourceKind(parsed.sourceKind)
        ? parsed.sourceKind
        : undefined,
      sourceInstanceId:
        typeof parsed.sourceInstanceId === 'string'
          ? parsed.sourceInstanceId
          : undefined,
    };
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSourceKind(value: unknown): value is SourceLedgerKind {
  return (
    value === 'browser' ||
    value === 'file-activity' ||
    value === 'screenshot' ||
    value === 'shell' ||
    value === 'agent-transcript'
  );
}

function requireString(
  value: Record<string, unknown>,
  path: string,
): string {
  const segments = path.split('.');
  let current: unknown = value;

  for (const segment of segments) {
    if (!isRecord(current)) {
      throw new Error(`${path} must be a string.`);
    }

    current = current[segment];
  }

  if (typeof current !== 'string' || current.trim().length === 0) {
    throw new Error(`${path} must be a string.`);
  }

  return current;
}

function requireStringField(
  value: Record<string, unknown>,
  fieldName: string,
  displayPath: string,
): string {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw new Error(`${displayPath} must be a string.`);
  }

  return fieldValue;
}

function optionalStringField(
  value: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const fieldValue = value[fieldName];

  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : undefined;
}

function optionalNumberField(
  value: Record<string, unknown>,
  fieldName: string,
): number | undefined {
  const fieldValue = value[fieldName];

  return typeof fieldValue === 'number' && Number.isFinite(fieldValue)
    ? fieldValue
    : undefined;
}

function requireNumberField(
  value: Record<string, unknown>,
  fieldName: string,
  displayPath: string,
): number {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
    throw new Error(`${displayPath} must be a number.`);
  }

  return fieldValue;
}

function requireBooleanField(
  value: Record<string, unknown>,
  fieldName: string,
  displayPath: string,
): boolean {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== 'boolean') {
    throw new Error(`${displayPath} must be a boolean.`);
  }

  return fieldValue;
}

function parseLedgerEntry(line: string): SourceLedgerEntry {
  const parsed = JSON.parse(line) as unknown;

  if (!isRecord(parsed)) {
    throw new Error('ledger entry must be an object.');
  }

  const schemaVersion = requireString(parsed, 'schemaVersion');
  const sourceKind = parsed.sourceKind;
  const sourceInstanceId = requireString(parsed, 'sourceInstanceId');
  const occurredAt = requireString(parsed, 'occurredAt');

  if (!isSourceKind(sourceKind)) {
    throw new Error('sourceKind must be a supported source kind.');
  }

  if (!isRecord(parsed.payload)) {
    throw new Error('payload must be an object.');
  }

  return {
    schemaVersion,
    sourceKind,
    sourceInstanceId,
    occurredAt,
    capturedAt:
      typeof parsed.capturedAt === 'string' ? parsed.capturedAt : undefined,
    payload: parsed.payload,
  };
}

function parseBrowserLedgerPayload(payload: unknown): BrowserLedgerPayload {
  if (!isRecord(payload)) {
    throw new Error('payload must be an object.');
  }

  return {
    id: requireStringField(payload, 'id', 'payload.id'),
    title: requireStringField(payload, 'title', 'payload.title'),
    url: requireStringField(payload, 'url', 'payload.url'),
    page_content: requireStringField(
      payload,
      'page_content',
      'payload.page_content',
    ),
  };
}

function parseFileActivityLedgerPayload(
  payload: unknown,
): FileActivityLedgerPayload {
  if (!isRecord(payload)) {
    throw new Error('payload must be an object.');
  }

  return {
    filePath: requireStringField(payload, 'filePath', 'payload.filePath'),
    fileName: requireStringField(payload, 'fileName', 'payload.fileName'),
    fileType: requireStringField(payload, 'fileType', 'payload.fileType'),
    mimeType: optionalStringField(payload, 'mimeType'),
    openedByApp: optionalStringField(payload, 'openedByApp'),
    sizeBytes: optionalNumberField(payload, 'sizeBytes'),
    modifiedAt: optionalStringField(payload, 'modifiedAt'),
    contentSummary: requireStringField(
      payload,
      'contentSummary',
      'payload.contentSummary',
    ),
    summaryModel: optionalStringField(payload, 'summaryModel'),
    fullContentRef: optionalStringField(payload, 'fullContentRef'),
  };
}

function parseScreenshotLedgerPayload(
  payload: unknown,
): ScreenshotLedgerPayload {
  if (!isRecord(payload)) {
    throw new Error('payload must be an object.');
  }

  const rawImageSize = payload.imageSize;
  const imageSize = isRecord(rawImageSize)
    ? {
        width: requireNumberField(rawImageSize, 'width', 'payload.imageSize.width'),
        height: requireNumberField(
          rawImageSize,
          'height',
          'payload.imageSize.height',
        ),
      }
    : undefined;

  return {
    title: optionalStringField(payload, 'title'),
    appName: optionalStringField(payload, 'appName'),
    windowTitle: optionalStringField(payload, 'windowTitle'),
    imagePath: optionalStringField(payload, 'imagePath'),
    imageRetained: requireBooleanField(
      payload,
      'imageRetained',
      'payload.imageRetained',
    ),
    imageSize,
    ocrSummary: optionalStringField(payload, 'ocrSummary'),
    visionSummary: requireStringField(
      payload,
      'visionSummary',
      'payload.visionSummary',
    ),
    ocrModel: optionalStringField(payload, 'ocrModel'),
    visionModel: optionalStringField(payload, 'visionModel'),
  };
}

function parseShellLedgerPayload(payload: unknown): ShellLedgerPayload {
  if (!isRecord(payload)) {
    throw new Error('payload must be an object.');
  }

  return {
    sessionId: requireStringField(payload, 'sessionId', 'payload.sessionId'),
    commandIndex: requireNumberField(
      payload,
      'commandIndex',
      'payload.commandIndex',
    ),
    command: requireStringField(payload, 'command', 'payload.command'),
    cwd: optionalStringField(payload, 'cwd'),
    exitCode: optionalNumberField(payload, 'exitCode'),
    shellType: optionalStringField(payload, 'shellType'),
    terminalApp: optionalStringField(payload, 'terminalApp'),
    redactionStatus: optionalStringField(payload, 'redactionStatus'),
  };
}

function parseAgentTranscriptLedgerPayload(
  payload: unknown,
): AgentTranscriptLedgerPayload {
  if (!isRecord(payload)) {
    throw new Error('payload must be an object.');
  }

  if (!isRecord(payload.messageRange)) {
    throw new Error('payload.messageRange must be an object.');
  }

  return {
    transcriptPath: requireStringField(
      payload,
      'transcriptPath',
      'payload.transcriptPath',
    ),
    sessionId: requireStringField(payload, 'sessionId', 'payload.sessionId'),
    agentIdentity: requireStringField(
      payload,
      'agentIdentity',
      'payload.agentIdentity',
    ),
    userTask: requireStringField(payload, 'userTask', 'payload.userTask'),
    messageRange: {
      start: requireNumberField(
        payload.messageRange,
        'start',
        'payload.messageRange.start',
      ),
      end: requireNumberField(
        payload.messageRange,
        'end',
        'payload.messageRange.end',
      ),
    },
    toolCallSummary: optionalStringField(payload, 'toolCallSummary'),
    finalResultSummary: requireStringField(
      payload,
      'finalResultSummary',
      'payload.finalResultSummary',
    ),
    redactionStatus: optionalStringField(payload, 'redactionStatus'),
    updatedAt: requireStringField(payload, 'updatedAt', 'payload.updatedAt'),
  };
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();

  return normalized.length > 240
    ? `${normalized.slice(0, 237)}...`
    : normalized;
}

function createMemoryEventId(input: {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  identity: Record<string, unknown>;
}): { id: string; sourceRef: string } {
  const identityHash = hashValue({
    sourceKind: input.sourceKind,
    sourceInstanceId: input.sourceInstanceId,
    ...input.identity,
  });

  return {
    id: `ledger:${input.sourceKind}:${identityHash}`,
    sourceRef: `${input.sourceKind}:${input.sourceInstanceId}:${identityHash}`,
  };
}

function normalizeBrowserLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  const payload = parseBrowserLedgerPayload(input.entry.payload);
  const identifiers = createMemoryEventId({
    sourceKind: input.entry.sourceKind,
    sourceInstanceId: input.entry.sourceInstanceId,
    identity: {
      occurredAt: input.entry.occurredAt,
      pageId: payload.id,
      url: payload.url,
      pageContentHash: hashValue(payload.page_content),
    },
  });

  return {
    id: identifiers.id,
    sourceType: 'browser',
    sourceRef: identifiers.sourceRef,
    timestamp: input.entry.occurredAt,
    authorizationScopeId: input.authorizationScopeId,
    content: {
      title: payload.title,
      summary: summarizeText(payload.page_content),
      contentKind: 'browser-page',
      bodyRef: undefined,
      entities: [
        {
          kind: 'url',
          label: payload.url,
          ref: payload.url,
        },
      ],
      sourceSpecific: {
        id: payload.id,
        url: payload.url,
        pageContent: payload.page_content,
      },
    },
    captureMetadata: {
      upstreamSource: 'source-ledger:browser',
      checkpoint: `${input.ledgerPath}:${input.lineNumber}`,
    },
  };
}

function normalizeFileActivityLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  const payload = parseFileActivityLedgerPayload(input.entry.payload);
  const identifiers = createMemoryEventId({
    sourceKind: 'file-activity',
    sourceInstanceId: input.entry.sourceInstanceId,
    identity: {
      occurredAt: input.entry.occurredAt,
      filePath: payload.filePath,
      contentSummaryHash: hashValue(payload.contentSummary),
      fileMetadataHash: hashValue({
        fileName: payload.fileName,
        fileType: payload.fileType,
        mimeType: payload.mimeType,
        modifiedAt: payload.modifiedAt,
        sizeBytes: payload.sizeBytes,
      }),
    },
  });

  return {
    id: identifiers.id,
    sourceType: 'file-activity',
    sourceRef: identifiers.sourceRef,
    timestamp: input.entry.occurredAt,
    authorizationScopeId: input.authorizationScopeId,
    content: {
      title: payload.fileName,
      summary: summarizeText(payload.contentSummary),
      contentKind: 'file-activity',
      bodyRef: payload.fullContentRef
        ? {
            kind: 'workspace-file',
            uri: payload.fullContentRef,
            mediaType: payload.mimeType,
            sizeBytes: payload.sizeBytes,
          }
        : undefined,
      entities: [
        {
          kind: 'file',
          label: payload.filePath,
          ref: payload.filePath,
        },
        ...(payload.openedByApp
          ? [
              {
                kind: 'app',
                label: payload.openedByApp,
                ref: payload.openedByApp,
              },
            ]
          : []),
      ],
      sourceSpecific: payload,
    },
    captureMetadata: {
      upstreamSource: 'source-ledger:file-activity',
      checkpoint: `${input.ledgerPath}:${input.lineNumber}`,
    },
  };
}

function normalizeScreenshotLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  const payload = parseScreenshotLedgerPayload(input.entry.payload);
  const title =
    payload.title ?? payload.windowTitle ?? payload.appName ?? 'Screenshot';
  const identifiers = createMemoryEventId({
    sourceKind: 'screenshot',
    sourceInstanceId: input.entry.sourceInstanceId,
    identity: {
      occurredAt: input.entry.occurredAt,
      visionSummaryHash: hashValue(payload.visionSummary),
      imagePath: payload.imagePath,
    },
  });

  return {
    id: identifiers.id,
    sourceType: 'screenshot',
    sourceRef: identifiers.sourceRef,
    timestamp: input.entry.occurredAt,
    authorizationScopeId: input.authorizationScopeId,
    content: {
      title,
      summary: summarizeText(payload.visionSummary),
      contentKind: 'screenshot',
      bodyRef:
        payload.imageRetained && payload.imagePath
          ? {
              kind: 'workspace-file',
              uri: payload.imagePath,
            }
          : undefined,
      entities: [
        ...(payload.appName
          ? [
              {
                kind: 'app',
                label: payload.appName,
                ref: payload.appName,
              },
            ]
          : []),
      ],
      sourceSpecific: payload,
    },
    captureMetadata: {
      upstreamSource: 'source-ledger:screenshot',
      checkpoint: `${input.ledgerPath}:${input.lineNumber}`,
    },
  };
}

function normalizeShellLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  const payload = parseShellLedgerPayload(input.entry.payload);
  const shellLabel = payload.shellType ?? 'shell';
  const exitSummary =
    payload.exitCode === undefined
      ? `${shellLabel} command${payload.cwd ? ` in ${payload.cwd}` : ''}.`
      : `${shellLabel} command${payload.cwd ? ` in ${payload.cwd}` : ''} exited with code ${payload.exitCode}.`;
  const identifiers = createMemoryEventId({
    sourceKind: 'shell',
    sourceInstanceId: input.entry.sourceInstanceId,
    identity: {
      occurredAt: input.entry.occurredAt,
      sessionId: payload.sessionId,
      commandIndex: payload.commandIndex,
      cwd: payload.cwd,
      redactedCommandHash: hashValue(payload.command),
    },
  });

  return {
    id: identifiers.id,
    sourceType: 'shell',
    sourceRef: identifiers.sourceRef,
    timestamp: input.entry.occurredAt,
    authorizationScopeId: input.authorizationScopeId,
    content: {
      title: payload.command,
      summary: exitSummary,
      contentKind: 'shell-command',
      entities: [
        {
          kind: 'command',
          label: payload.command,
          ref: payload.command,
        },
        ...(payload.cwd
          ? [
              {
                kind: 'file',
                label: payload.cwd,
                ref: payload.cwd,
              },
            ]
          : []),
      ],
      sourceSpecific: payload,
    },
    captureMetadata: {
      upstreamSource: 'source-ledger:shell',
      checkpoint: `${input.ledgerPath}:${input.lineNumber}`,
    },
  };
}

function normalizeAgentTranscriptLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  const payload = parseAgentTranscriptLedgerPayload(input.entry.payload);
  const identifiers = createMemoryEventId({
    sourceKind: 'agent-transcript',
    sourceInstanceId: input.entry.sourceInstanceId,
    identity: {
      transcriptPath: payload.transcriptPath,
      sessionId: payload.sessionId,
      messageRange: payload.messageRange,
      updatedAt: payload.updatedAt,
    },
  });

  return {
    id: identifiers.id,
    sourceType: 'agent-transcript',
    sourceRef: identifiers.sourceRef,
    timestamp: input.entry.occurredAt,
    authorizationScopeId: input.authorizationScopeId,
    content: {
      title: payload.userTask,
      summary: summarizeText(payload.finalResultSummary),
      contentKind: 'agent-transcript',
      bodyRef: {
        kind: 'workspace-file',
        uri: payload.transcriptPath,
      },
      entities: [
        {
          kind: 'agent',
          label: payload.agentIdentity,
          ref: payload.sessionId,
        },
      ],
      sourceSpecific: payload,
    },
    captureMetadata: {
      upstreamSource: 'source-ledger:agent-transcript',
      checkpoint: `${input.ledgerPath}:${input.lineNumber}`,
    },
  };
}

function normalizeLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  switch (input.entry.sourceKind) {
    case 'browser':
      return normalizeBrowserLedgerEntry(input);
    case 'file-activity':
      return normalizeFileActivityLedgerEntry(input);
    case 'screenshot':
      return normalizeScreenshotLedgerEntry(input);
    case 'shell':
      return normalizeShellLedgerEntry(input);
    case 'agent-transcript':
      return normalizeAgentTranscriptLedgerEntry(input);
  }
}

function splitLedgerLines(ledgerText: string): string[] {
  if (ledgerText.length === 0) {
    return [];
  }

  const lines = ledgerText.replace(/\r\n/gu, '\n').split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  return lines;
}

export function importSourceLedgerText(
  input: SourceLedgerImporterInput,
): SourceLedgerImporterResult {
  const importedEvents: MemoryEvent[] = [];
  const auditEvents: SourceAuditEvent[] = [];
  const lines = splitLedgerLines(input.ledgerText);
  const startLineNumber =
    input.checkpoint?.ledgerPath === input.ledgerPath
      ? input.checkpoint.nextLineNumber
      : 1;
  let nextLineNumber = startLineNumber;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;

    if (lineNumber < startLineNumber) {
      continue;
    }

    nextLineNumber = lineNumber + 1;
    const line = lines[index]?.trim() ?? '';

    if (line.length === 0) {
      continue;
    }

    try {
      const entry = parseLedgerEntry(line);
      const event = normalizeLedgerEntry({
        authorizationScopeId: input.authorizationScopeId,
        entry,
        ledgerPath: input.ledgerPath,
        lineNumber,
      });

      importedEvents.push(event);
      auditEvents.push(
        createAuditEvent({
          eventType: 'entry-imported',
          sourceKind: entry.sourceKind,
          sourceInstanceId: entry.sourceInstanceId,
          ledgerPath: input.ledgerPath,
          lineNumber,
          occurredAt: input.importedAt,
          severity: 'info',
          message: `Imported ${entry.sourceKind} ledger entry.`,
          metadata: {
            memoryEventId: event.id,
            sourceRef: event.sourceRef,
          },
        }),
      );
    } catch (error) {
      const sourceHint = getAuditSourceHint(line);

      auditEvents.push(
        createAuditEvent({
          eventType: 'schema-validation-failed',
          sourceKind: sourceHint.sourceKind,
          sourceInstanceId: sourceHint.sourceInstanceId,
          ledgerPath: input.ledgerPath,
          lineNumber,
          occurredAt: input.importedAt,
          severity: 'warning',
          message: 'Skipped invalid source ledger line.',
          metadata: {
            reason: error instanceof Error ? error.message : String(error),
            badLineSample: truncateBadLineSample(line),
          },
        }),
      );
    }
  }

  return {
    importedEvents,
    auditEvents,
    checkpoint: {
      ledgerPath: input.ledgerPath,
      nextLineNumber,
      updatedAt: input.importedAt,
    },
  };
}
