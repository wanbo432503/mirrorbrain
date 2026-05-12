import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  SourceLedgerEntry,
  SourceLedgerKind,
} from '../../modules/source-ledger-importer/index.js';
import type {
  SourceRecorderHandle,
  SupervisedSourceInstance,
} from '../../workflows/source-recorder-supervisor/index.js';

export interface CapturedSourceRecord {
  occurredAt: string;
  capturedAt?: string;
  payload: unknown;
}

export interface BuiltInSourceLedgerRecorderStarterInput {
  workspaceDir: string;
  now(): string;
  captureSourceRecord(source: SupervisedSourceInstance): Promise<CapturedSourceRecord | null>;
  intervalMs?: number;
}

export type BuiltInSourceLedgerRecorderStarter = (
  source: SupervisedSourceInstance,
) => Promise<SourceRecorderHandle>;

function getLedgerDate(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

function getLedgerPath(input: {
  workspaceDir: string;
  sourceKind: SourceLedgerKind;
  occurredAt: string;
}): string {
  return join(
    input.workspaceDir,
    'mirrorbrain',
    'ledgers',
    getLedgerDate(input.occurredAt),
    `${input.sourceKind}.jsonl`,
  );
}

async function appendLedgerEntry(input: {
  workspaceDir: string;
  now(): string;
  source: SupervisedSourceInstance;
  record: CapturedSourceRecord;
}): Promise<void> {
  const entry: SourceLedgerEntry = {
    schemaVersion: 'source-ledger.v1',
    sourceKind: input.source.sourceKind,
    sourceInstanceId: input.source.sourceInstanceId,
    occurredAt: input.record.occurredAt,
    capturedAt: input.record.capturedAt ?? input.now(),
    payload: input.record.payload,
  };
  const ledgerPath = getLedgerPath({
    workspaceDir: input.workspaceDir,
    sourceKind: input.source.sourceKind,
    occurredAt: input.record.occurredAt,
  });

  await mkdir(join(ledgerPath, '..'), { recursive: true });
  await appendFile(ledgerPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

export function createBuiltInSourceLedgerRecorderStarter(
  input: BuiltInSourceLedgerRecorderStarterInput,
): BuiltInSourceLedgerRecorderStarter {
  return async (source) => {
    const captureOnce = async (): Promise<void> => {
      const record = await input.captureSourceRecord(source);

      if (record === null) {
        return;
      }

      await appendLedgerEntry({
        workspaceDir: input.workspaceDir,
        now: input.now,
        source,
        record,
      });
    };

    await captureOnce();

    const interval =
      input.intervalMs === undefined
        ? undefined
        : setInterval(() => {
            void captureOnce();
          }, input.intervalMs);

    return {
      stop() {
        if (interval !== undefined) {
          clearInterval(interval);
        }
      },
    };
  };
}
