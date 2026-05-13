import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import {
  importSourceLedgerText,
  type SourceAuditEvent,
  type SourceLedgerImportCheckpoint,
  type SourceLedgerKind,
} from '../../modules/source-ledger-importer/index.js';
import type { MemoryEvent } from '../../shared/types/index.js';

export interface SourceLedgerImportSchedule {
  scanIntervalMs: number;
}

export interface SourceLedgerImportPolling {
  stop(): void;
}

export interface SourceLedgerImportResult {
  importedCount: number;
  skippedCount: number;
  scannedLedgerCount: number;
  changedLedgerCount: number;
  ledgerResults: Array<{
    ledgerPath: string;
    importedCount: number;
    skippedCount: number;
    checkpoint: SourceLedgerImportCheckpoint;
  }>;
}

interface ImportChangedSourceLedgersInput {
  authorizationScopeId: string;
  importedAt: string;
  workspaceDir: string;
}

interface ImportChangedSourceLedgersDependencies {
  readCheckpoint(
    ledgerPath: string,
  ): Promise<SourceLedgerImportCheckpoint | null>;
  writeCheckpoint(checkpoint: SourceLedgerImportCheckpoint): Promise<void>;
  writeMemoryEvent(event: MemoryEvent): Promise<void>;
  writeSourceAuditEvent(event: SourceAuditEvent): Promise<void>;
  isSourceImportAllowed?(source: {
    sourceKind: SourceLedgerKind;
    sourceInstanceId: string;
  }): Promise<boolean>;
}

interface StartSourceLedgerImportPollingInput {
  schedule?: SourceLedgerImportSchedule;
}

interface StartSourceLedgerImportPollingDependencies {
  runImportOnce(): Promise<unknown>;
}

export function getSourceLedgerImportSchedule(): SourceLedgerImportSchedule {
  return {
    scanIntervalMs: 30 * 60 * 1000,
  };
}

export function startSourceLedgerImportPolling(
  input: StartSourceLedgerImportPollingInput,
  dependencies: StartSourceLedgerImportPollingDependencies,
): SourceLedgerImportPolling {
  const schedule = input.schedule ?? getSourceLedgerImportSchedule();
  let isRunning = false;

  const tick = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      await dependencies.runImportOnce();
    } catch {
      // Import failures are surfaced through explicit manual import and audit paths.
    } finally {
      isRunning = false;
    }
  };

  void tick();

  const intervalId = setInterval(() => {
    void tick();
  }, schedule.scanIntervalMs);

  return {
    stop() {
      clearInterval(intervalId);
    },
  };
}

function toLedgerPath(input: {
  ledgersRoot: string;
  absolutePath: string;
}): string {
  return ['ledgers', relative(input.ledgersRoot, input.absolutePath)]
    .join(sep)
    .replaceAll(sep, '/');
}

function getEventSource(input: MemoryEvent): {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
} | null {
  const [sourceKind, sourceInstanceId] = input.sourceRef.split(':');

  if (
    sourceInstanceId === undefined ||
    !(
      sourceKind === 'browser' ||
      sourceKind === 'file-activity' ||
      sourceKind === 'screenshot' ||
      sourceKind === 'audio-recording' ||
      sourceKind === 'shell' ||
      sourceKind === 'agent'
    )
  ) {
    return null;
  }

  return {
    sourceKind,
    sourceInstanceId,
  };
}

function createSkippedAuditEvent(input: {
  event: MemoryEvent;
  ledgerPath: string;
  importedAt: string;
}): SourceAuditEvent {
  const source = getEventSource(input.event);

  return {
    id: `source-audit:entry-skipped:${input.event.id}:${input.importedAt}`,
    eventType: 'entry-skipped',
    sourceKind: source?.sourceKind,
    sourceInstanceId: source?.sourceInstanceId,
    ledgerPath: input.ledgerPath,
    lineNumber: Number(input.event.captureMetadata.checkpoint.split(':').at(-1) ?? 0),
    occurredAt: input.importedAt,
    severity: 'info',
    message: 'Skipped ledger entry because the source instance is disabled.',
    metadata: {
      memoryEventId: input.event.id,
      sourceRef: input.event.sourceRef,
    },
  };
}

async function listLedgerFiles(ledgersRoot: string): Promise<string[]> {
  let dateDirectories: string[];

  try {
    dateDirectories = await readdir(ledgersRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const ledgerFiles: string[] = [];

  for (const dateDirectory of dateDirectories.sort()) {
    const dayPath = join(ledgersRoot, dateDirectory);
    const entries = await readdir(dayPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        ledgerFiles.push(join(dayPath, entry.name));
      }
    }
  }

  return ledgerFiles.sort();
}

export async function importChangedSourceLedgers(
  input: ImportChangedSourceLedgersInput,
  dependencies: ImportChangedSourceLedgersDependencies,
): Promise<SourceLedgerImportResult> {
  const ledgersRoot = join(input.workspaceDir, 'mirrorbrain', 'ledgers');
  const ledgerFiles = await listLedgerFiles(ledgersRoot);
  const ledgerResults: SourceLedgerImportResult['ledgerResults'] = [];
  let importedCount = 0;
  let skippedCount = 0;
  let changedLedgerCount = 0;

  for (const absolutePath of ledgerFiles) {
    const ledgerPath = toLedgerPath({ ledgersRoot, absolutePath });
    const checkpoint = await dependencies.readCheckpoint(ledgerPath);
    const ledgerText = await readFile(absolutePath, 'utf8');
    const importResult = importSourceLedgerText({
      authorizationScopeId: input.authorizationScopeId,
      checkpoint,
      importedAt: input.importedAt,
      ledgerPath,
      ledgerText,
    });
    let ledgerImportedCount = 0;
    const filteredAuditEvents = [...importResult.auditEvents];
    let ledgerSkippedCount = importResult.auditEvents.filter(
      (event) => event.eventType === 'schema-validation-failed',
    ).length;

    for (const event of importResult.importedEvents) {
      const source = getEventSource(event);
      const isAllowed =
        dependencies.isSourceImportAllowed === undefined ||
        source === null ||
        await dependencies.isSourceImportAllowed(source);

      if (!isAllowed) {
        ledgerSkippedCount += 1;
        filteredAuditEvents.push(
          createSkippedAuditEvent({
            event,
            ledgerPath,
            importedAt: input.importedAt,
          }),
        );
        continue;
      }

      await dependencies.writeMemoryEvent(event);
      ledgerImportedCount += 1;
    }

    if (ledgerImportedCount > 0 || ledgerSkippedCount > 0) {
      changedLedgerCount += 1;
    }

    for (const auditEvent of filteredAuditEvents) {
      await dependencies.writeSourceAuditEvent(auditEvent);
    }

    await dependencies.writeCheckpoint(importResult.checkpoint);

    importedCount += ledgerImportedCount;
    skippedCount += ledgerSkippedCount;
    ledgerResults.push({
      ledgerPath,
      importedCount: ledgerImportedCount,
      skippedCount: ledgerSkippedCount,
      checkpoint: importResult.checkpoint,
    });
  }

  return {
    importedCount,
    skippedCount,
    scannedLedgerCount: ledgerFiles.length,
    changedLedgerCount,
    ledgerResults,
  };
}
