import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SourceAuditEvent } from '../../modules/source-ledger-importer/index.js';
import { createFileSourceLedgerStateStore } from './index.js';

function createAuditEvent(input: Partial<SourceAuditEvent>): SourceAuditEvent {
  return {
    id: input.id ?? 'source-audit:1',
    eventType: input.eventType ?? 'entry-imported',
    sourceKind: input.sourceKind ?? 'browser',
    sourceInstanceId: input.sourceInstanceId ?? 'chrome-main',
    ledgerPath: input.ledgerPath ?? 'ledgers/2026-05-12/browser.jsonl',
    lineNumber: input.lineNumber ?? 1,
    occurredAt: input.occurredAt ?? '2026-05-12T10:00:00.000Z',
    severity: input.severity ?? 'info',
    message: input.message ?? 'Imported browser ledger entry.',
    metadata: input.metadata,
  };
}

describe('source ledger state store', () => {
  it('persists source ledger checkpoints by ledger path', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-state-'));
    const store = createFileSourceLedgerStateStore({ workspaceDir });

    await store.writeCheckpoint({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 4,
      updatedAt: '2026-05-12T10:31:00.000Z',
    });

    await expect(
      store.readCheckpoint('ledgers/2026-05-12/browser.jsonl'),
    ).resolves.toEqual({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 4,
      updatedAt: '2026-05-12T10:31:00.000Z',
    });
    await expect(
      store.readCheckpoint('ledgers/2026-05-12/shell.jsonl'),
    ).resolves.toBeNull();
  });

  it('stores and filters source audit events without mixing them into memory evidence', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-state-'));
    const store = createFileSourceLedgerStateStore({ workspaceDir });

    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:browser-imported',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        occurredAt: '2026-05-12T10:00:00.000Z',
      }),
    );
    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:shell-warning',
        eventType: 'schema-validation-failed',
        sourceKind: 'shell',
        sourceInstanceId: 'iterm-main',
        occurredAt: '2026-05-12T10:02:00.000Z',
        severity: 'warning',
        message: 'Skipped invalid source ledger line.',
      }),
    );

    await expect(store.listSourceAuditEvents({ sourceKind: 'shell' })).resolves.toEqual([
      expect.objectContaining({
        id: 'source-audit:shell-warning',
        sourceKind: 'shell',
        sourceInstanceId: 'iterm-main',
        severity: 'warning',
      }),
    ]);
    await expect(store.listSourceAuditEvents({})).resolves.toEqual([
      expect.objectContaining({ id: 'source-audit:shell-warning' }),
      expect.objectContaining({ id: 'source-audit:browser-imported' }),
    ]);
  });

  it('derives source status summaries from checkpoints and audit history', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-state-'));
    const store = createFileSourceLedgerStateStore({ workspaceDir });

    await store.writeCheckpoint({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 3,
      updatedAt: '2026-05-12T10:30:00.000Z',
    });
    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:imported-1',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        occurredAt: '2026-05-12T10:00:00.000Z',
      }),
    );
    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:warning-1',
        eventType: 'schema-validation-failed',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        occurredAt: '2026-05-12T10:01:00.000Z',
        severity: 'warning',
        message: 'Skipped invalid source ledger line.',
      }),
    );

    await expect(store.listSourceInstanceSummaries()).resolves.toEqual([
      {
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        lifecycleStatus: 'degraded',
        recorderStatus: 'unknown',
        lastImporterScanAt: '2026-05-12T10:30:00.000Z',
        lastImportedAt: '2026-05-12T10:00:00.000Z',
        importedCount: 1,
        skippedCount: 1,
        latestWarning: 'Skipped invalid source ledger line.',
        checkpointSummary: 'ledgers/2026-05-12/browser.jsonl next line 3',
      },
    ]);
  });

  it('persists source instance config and applies disabled state to summaries', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-state-'));
    const store = createFileSourceLedgerStateStore({ workspaceDir });

    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:browser-imported',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    );
    await store.writeSourceInstanceConfig({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: false,
      updatedAt: '2026-05-12T11:00:00.000Z',
      updatedBy: 'mirrorbrain-web',
    });

    await expect(store.listSourceInstanceConfigs()).resolves.toEqual([
      {
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        enabled: false,
        updatedAt: '2026-05-12T11:00:00.000Z',
        updatedBy: 'mirrorbrain-web',
      },
    ]);
    await expect(store.listSourceInstanceSummaries()).resolves.toEqual([
      expect.objectContaining({
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        lifecycleStatus: 'disabled',
        recorderStatus: 'stopped',
        importedCount: 1,
      }),
    ]);
  });

  it('omits retired openclaw source state from audit listings and summaries', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-state-'));
    const store = createFileSourceLedgerStateStore({ workspaceDir });

    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:retired-openclaw-imported',
        sourceKind: 'agent-transcript' as never,
        sourceInstanceId: 'openclaw-main',
        message: 'Imported legacy agent transcript.',
      }),
    );
    await store.writeSourceAuditEvent(
      createAuditEvent({
        id: 'source-audit:agent-imported',
        sourceKind: 'agent',
        sourceInstanceId: 'agent-main',
        message: 'Imported agent session.',
      }),
    );
    await store.writeSourceInstanceConfig({
      sourceKind: 'agent-transcript' as never,
      sourceInstanceId: 'openclaw-main',
      enabled: true,
      updatedAt: '2026-05-12T11:00:00.000Z',
      updatedBy: 'mirrorbrain-web',
    });

    await expect(store.listSourceAuditEvents({})).resolves.toEqual([
      expect.objectContaining({
        id: 'source-audit:agent-imported',
        sourceKind: 'agent',
        sourceInstanceId: 'agent-main',
      }),
    ]);
    await expect(store.listSourceInstanceSummaries()).resolves.toEqual([
      expect.objectContaining({
        sourceKind: 'agent',
        sourceInstanceId: 'agent-main',
        importedCount: 1,
      }),
    ]);
  });
});
