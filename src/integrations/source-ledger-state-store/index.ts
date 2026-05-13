import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  SourceAuditEvent,
  SourceLedgerImportCheckpoint,
  SourceLedgerKind,
} from '../../modules/source-ledger-importer/index.js';

export interface SourceInstanceSummary {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  lifecycleStatus: 'enabled' | 'disabled' | 'running' | 'degraded' | 'error';
  recorderStatus: 'unknown' | 'running' | 'stopped' | 'error';
  lastImporterScanAt?: string;
  lastImportedAt?: string;
  importedCount: number;
  skippedCount: number;
  latestWarning?: string;
  checkpointSummary?: string;
}

export interface SourceInstanceConfig {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface SourceAuditEventFilter {
  sourceKind?: SourceLedgerKind;
  sourceInstanceId?: string;
}

export interface SourceLedgerStateStore {
  readCheckpoint(
    ledgerPath: string,
  ): Promise<SourceLedgerImportCheckpoint | null>;
  writeCheckpoint(checkpoint: SourceLedgerImportCheckpoint): Promise<void>;
  writeSourceAuditEvent(event: SourceAuditEvent): Promise<void>;
  listSourceAuditEvents(
    filter: SourceAuditEventFilter,
  ): Promise<SourceAuditEvent[]>;
  writeSourceInstanceConfig(config: SourceInstanceConfig): Promise<void>;
  listSourceInstanceConfigs(): Promise<SourceInstanceConfig[]>;
  listSourceInstanceSummaries(): Promise<SourceInstanceSummary[]>;
}

interface CreateFileSourceLedgerStateStoreInput {
  workspaceDir: string;
}

function encodeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9.-]+/g, '-');
}

function getCheckpointDir(workspaceDir: string): string {
  return join(workspaceDir, 'mirrorbrain', 'state', 'source-ledger-checkpoints');
}

function getAuditDir(workspaceDir: string): string {
  return join(workspaceDir, 'mirrorbrain', 'source-audit-events');
}

function getConfigDir(workspaceDir: string): string {
  return join(workspaceDir, 'mirrorbrain', 'source-instance-configs');
}

function getCheckpointPath(input: {
  workspaceDir: string;
  ledgerPath: string;
}): string {
  return join(getCheckpointDir(input.workspaceDir), `${encodeFileName(input.ledgerPath)}.json`);
}

function getAuditPath(input: {
  workspaceDir: string;
  eventId: string;
}): string {
  return join(getAuditDir(input.workspaceDir), `${encodeFileName(input.eventId)}.json`);
}

function getConfigPath(input: {
  workspaceDir: string;
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
}): string {
  return join(
    getConfigDir(input.workspaceDir),
    `${encodeFileName(getSummaryKey(input))}.json`,
  );
}

async function readJsonFiles<T>(directoryPath: string): Promise<T[]> {
  let fileNames: string[];

  try {
    fileNames = await readdir(directoryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const records: T[] = [];

  for (const fileName of fileNames.sort()) {
    if (!fileName.endsWith('.json')) {
      continue;
    }

    records.push(
      JSON.parse(await readFile(join(directoryPath, fileName), 'utf8')) as T,
    );
  }

  return records;
}

function getSourceKindFromLedgerPath(
  ledgerPath: string,
): SourceLedgerKind | null {
  const fileName = ledgerPath.split('/').at(-1) ?? '';
  const sourceKind = fileName.replace(/\.jsonl$/u, '');

  return (
    sourceKind === 'browser' ||
    sourceKind === 'file-activity' ||
    sourceKind === 'screenshot' ||
    sourceKind === 'audio-recording' ||
    sourceKind === 'shell' ||
    sourceKind === 'agent'
  )
    ? sourceKind
    : null;
}

function getSummaryKey(input: {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
}): string {
  return `${input.sourceKind}:${input.sourceInstanceId}`;
}

function deriveSourceInstanceSummaries(input: {
  auditEvents: SourceAuditEvent[];
  checkpoints: SourceLedgerImportCheckpoint[];
  configs: SourceInstanceConfig[];
}): SourceInstanceSummary[] {
  const summaries = new Map<string, SourceInstanceSummary>();

  for (const event of input.auditEvents) {
    if (!event.sourceKind || !event.sourceInstanceId) {
      continue;
    }

    const key = getSummaryKey({
      sourceKind: event.sourceKind,
      sourceInstanceId: event.sourceInstanceId,
    });
    const existing = summaries.get(key) ?? {
      sourceKind: event.sourceKind,
      sourceInstanceId: event.sourceInstanceId,
      lifecycleStatus: 'enabled' as const,
      recorderStatus: 'unknown' as const,
      importedCount: 0,
      skippedCount: 0,
    };

    if (event.eventType === 'entry-imported') {
      existing.importedCount += 1;
      existing.lastImportedAt =
        existing.lastImportedAt === undefined ||
        event.occurredAt > existing.lastImportedAt
          ? event.occurredAt
          : existing.lastImportedAt;
    }

    if (event.eventType === 'schema-validation-failed') {
      existing.skippedCount += 1;
      existing.lifecycleStatus = 'degraded';
      existing.latestWarning = event.message;
    }

    summaries.set(key, existing);
  }

  for (const checkpoint of input.checkpoints) {
    const sourceKind = getSourceKindFromLedgerPath(checkpoint.ledgerPath);

    if (!sourceKind) {
      continue;
    }

    for (const summary of summaries.values()) {
      if (summary.sourceKind !== sourceKind) {
        continue;
      }

      summary.lastImporterScanAt =
        summary.lastImporterScanAt === undefined ||
        checkpoint.updatedAt > summary.lastImporterScanAt
          ? checkpoint.updatedAt
          : summary.lastImporterScanAt;
      summary.checkpointSummary = `${checkpoint.ledgerPath} next line ${checkpoint.nextLineNumber}`;
    }
  }

  for (const config of input.configs) {
    const key = getSummaryKey(config);
    const existing = summaries.get(key) ?? {
      sourceKind: config.sourceKind,
      sourceInstanceId: config.sourceInstanceId,
      lifecycleStatus: 'enabled' as const,
      recorderStatus: 'unknown' as const,
      importedCount: 0,
      skippedCount: 0,
    };

    if (!config.enabled) {
      existing.lifecycleStatus = 'disabled';
      existing.recorderStatus = 'stopped';
    } else if (existing.lifecycleStatus === 'disabled') {
      existing.lifecycleStatus = 'enabled';
      existing.recorderStatus = 'unknown';
    }

    summaries.set(key, existing);
  }

  return [...summaries.values()].sort((left, right) =>
    getSummaryKey(left).localeCompare(getSummaryKey(right)),
  );
}

export function createFileSourceLedgerStateStore(
  input: CreateFileSourceLedgerStateStoreInput,
): SourceLedgerStateStore {
  return {
    async readCheckpoint(ledgerPath) {
      try {
        return JSON.parse(
          await readFile(
            getCheckpointPath({
              workspaceDir: input.workspaceDir,
              ledgerPath,
            }),
            'utf8',
          ),
        ) as SourceLedgerImportCheckpoint;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }

        throw error;
      }
    },
    async writeCheckpoint(checkpoint) {
      await mkdir(getCheckpointDir(input.workspaceDir), { recursive: true });
      await writeFile(
        getCheckpointPath({
          workspaceDir: input.workspaceDir,
          ledgerPath: checkpoint.ledgerPath,
        }),
        JSON.stringify(checkpoint, null, 2),
      );
    },
    async writeSourceAuditEvent(event) {
      await mkdir(getAuditDir(input.workspaceDir), { recursive: true });
      await writeFile(
        getAuditPath({
          workspaceDir: input.workspaceDir,
          eventId: event.id,
        }),
        JSON.stringify(event, null, 2),
      );
    },
    async listSourceAuditEvents(filter) {
      const auditEvents = await readJsonFiles<SourceAuditEvent>(
        getAuditDir(input.workspaceDir),
      );

      return auditEvents
        .filter((event) =>
          filter.sourceKind === undefined
            ? true
            : event.sourceKind === filter.sourceKind,
        )
        .filter((event) =>
          filter.sourceInstanceId === undefined
            ? true
            : event.sourceInstanceId === filter.sourceInstanceId,
        )
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    },
    async writeSourceInstanceConfig(config) {
      await mkdir(getConfigDir(input.workspaceDir), { recursive: true });
      await writeFile(
        getConfigPath({
          workspaceDir: input.workspaceDir,
          sourceKind: config.sourceKind,
          sourceInstanceId: config.sourceInstanceId,
        }),
        JSON.stringify(config, null, 2),
      );
    },
    async listSourceInstanceConfigs() {
      return readJsonFiles<SourceInstanceConfig>(
        getConfigDir(input.workspaceDir),
      );
    },
    async listSourceInstanceSummaries() {
      const [auditEvents, checkpoints, configs] = await Promise.all([
        readJsonFiles<SourceAuditEvent>(getAuditDir(input.workspaceDir)),
        readJsonFiles<SourceLedgerImportCheckpoint>(
          getCheckpointDir(input.workspaceDir),
        ),
        readJsonFiles<SourceInstanceConfig>(getConfigDir(input.workspaceDir)),
      ]);

      return deriveSourceInstanceSummaries({
        auditEvents,
        checkpoints,
        configs,
      });
    },
  };
}
