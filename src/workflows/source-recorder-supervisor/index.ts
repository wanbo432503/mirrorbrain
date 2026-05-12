import type {
  SourceAuditEvent,
  SourceLedgerKind,
} from '../../modules/source-ledger-importer/index.js';
import {
  createBuiltInSourceLedgerRecorderStarter,
  type CapturedSourceRecordResult,
} from '../../integrations/source-ledger-recorders/index.js';

export interface SupervisedSourceInstance {
  sourceKind: SourceLedgerKind;
  sourceInstanceId: string;
  enabled: boolean;
}

export interface SourceRecorderHandle {
  stop(): Promise<void> | void;
}

interface StartSourceRecorderSupervisorInput {
  sources: SupervisedSourceInstance[];
  now(): string;
}

interface StartBuiltInSourceLedgerRecorderSupervisorInput
  extends StartSourceRecorderSupervisorInput {
  workspaceDir: string;
  intervalMs?: number;
}

interface StartSourceRecorderSupervisorDependencies {
  startRecorder(source: SupervisedSourceInstance): Promise<SourceRecorderHandle>;
  writeSourceAuditEvent(event: SourceAuditEvent): Promise<void>;
}

interface StartBuiltInSourceLedgerRecorderSupervisorDependencies {
  captureSourceRecord(source: SupervisedSourceInstance): Promise<CapturedSourceRecordResult>;
  writeSourceAuditEvent(event: SourceAuditEvent): Promise<void>;
}

export interface SourceRecorderSupervisor {
  stop(): Promise<void>;
}

function createRecorderAuditEvent(input: {
  eventType: SourceAuditEvent['eventType'];
  source: SupervisedSourceInstance;
  occurredAt: string;
}): SourceAuditEvent {
  const sourceKey = `${input.source.sourceKind}:${input.source.sourceInstanceId}`;

  return {
    id: `source-audit:${input.eventType}:${sourceKey}:${input.occurredAt}`,
    eventType: input.eventType,
    sourceKind: input.source.sourceKind,
    sourceInstanceId: input.source.sourceInstanceId,
    ledgerPath: '',
    lineNumber: 0,
    occurredAt: input.occurredAt,
    severity: 'info',
    message: `Recorder ${input.eventType.replace('recorder-', '')} for ${sourceKey}.`,
  };
}

export async function startSourceRecorderSupervisor(
  input: StartSourceRecorderSupervisorInput,
  dependencies: StartSourceRecorderSupervisorDependencies,
): Promise<SourceRecorderSupervisor> {
  const runningRecorders: Array<{
    source: SupervisedSourceInstance;
    handle: SourceRecorderHandle;
  }> = [];

  for (const source of input.sources) {
    if (!source.enabled) {
      await dependencies.writeSourceAuditEvent(
        createRecorderAuditEvent({
          eventType: 'recorder-disabled',
          source,
          occurredAt: input.now(),
        }),
      );
      continue;
    }

    const handle = await dependencies.startRecorder(source);
    runningRecorders.push({ source, handle });
    await dependencies.writeSourceAuditEvent(
      createRecorderAuditEvent({
        eventType: 'recorder-started',
        source,
        occurredAt: input.now(),
      }),
    );
  }

  return {
    async stop() {
      for (const recorder of runningRecorders) {
        await recorder.handle.stop();
        await dependencies.writeSourceAuditEvent(
          createRecorderAuditEvent({
            eventType: 'recorder-stopped',
            source: recorder.source,
            occurredAt: input.now(),
          }),
        );
      }
    },
  };
}

export function startBuiltInSourceLedgerRecorderSupervisor(
  input: StartBuiltInSourceLedgerRecorderSupervisorInput,
  dependencies: StartBuiltInSourceLedgerRecorderSupervisorDependencies,
): Promise<SourceRecorderSupervisor> {
  return startSourceRecorderSupervisor(input, {
    startRecorder: createBuiltInSourceLedgerRecorderStarter({
      workspaceDir: input.workspaceDir,
      now: input.now,
      captureSourceRecord: dependencies.captureSourceRecord,
      intervalMs: input.intervalMs,
    }),
    writeSourceAuditEvent: dependencies.writeSourceAuditEvent,
  });
}
