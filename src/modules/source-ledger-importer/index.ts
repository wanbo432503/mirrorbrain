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
  | 'schema-validation-failed';

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

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/gu, ' ').trim();

  return normalized.length > 240
    ? `${normalized.slice(0, 237)}...`
    : normalized;
}

function normalizeBrowserLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  const payload = parseBrowserLedgerPayload(input.entry.payload);
  const pageContentHash = hashValue(payload.page_content);
  const identity = {
    sourceKind: input.entry.sourceKind,
    sourceInstanceId: input.entry.sourceInstanceId,
    occurredAt: input.entry.occurredAt,
    pageId: payload.id,
    url: payload.url,
    pageContentHash,
  };
  const identityHash = hashValue(identity);
  const sourceRef = `browser:${input.entry.sourceInstanceId}:${identityHash}`;

  return {
    id: `ledger:browser:${identityHash}`,
    sourceType: 'browser',
    sourceRef,
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

function normalizeLedgerEntry(input: {
  authorizationScopeId: string;
  entry: SourceLedgerEntry;
  ledgerPath: string;
  lineNumber: number;
}): MemoryEvent {
  if (input.entry.sourceKind !== 'browser') {
    throw new Error(
      `Source ledger kind ${input.entry.sourceKind} is not supported yet.`,
    );
  }

  return normalizeBrowserLedgerEntry(input);
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
