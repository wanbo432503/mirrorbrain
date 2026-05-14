import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  SourceAuditEvent,
  SourceLedgerImportCheckpoint,
} from '../../modules/source-ledger-importer/index.js';
import type { MemoryEvent } from '../../shared/types/index.js';
import {
  getSourceLedgerImportSchedule,
  importChangedSourceLedgers,
  startSourceLedgerImportPolling,
} from './index.js';

describe('source ledger import workflow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('scans daily JSONL ledgers and persists imported MemoryEvents with audit output', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-ledgers-'));
    const ledgerDir = join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12');
    await mkdir(ledgerDir, { recursive: true });
    await writeFile(
      join(ledgerDir, 'browser.jsonl'),
      [
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Phase 4 Design","url":"https://example.com/phase4","page_content":"Phase 4 source ledgers."}}',
        '{not-json',
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:05:00.000Z","payload":{"id":"page-2","title":"Import Workflow","url":"https://example.com/import","page_content":"Manual imports should continue after bad lines."}}',
      ].join('\n'),
    );

    const checkpoints = new Map<string, SourceLedgerImportCheckpoint>();
    const writtenEvents: MemoryEvent[] = [];
    const writtenAuditEvents: SourceAuditEvent[] = [];

    const result = await importChangedSourceLedgers(
      {
        authorizationScopeId: 'scope-browser',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir,
      },
      {
        readCheckpoint: async (ledgerPath) => checkpoints.get(ledgerPath) ?? null,
        writeCheckpoint: async (checkpoint) => {
          checkpoints.set(checkpoint.ledgerPath, checkpoint);
        },
        writeMemoryEvent: async (event) => {
          writtenEvents.push(event);
        },
        writeSourceAuditEvent: async (event) => {
          writtenAuditEvents.push(event);
        },
      },
    );

    expect(result).toMatchObject({
      importedCount: 2,
      skippedCount: 1,
      scannedLedgerCount: 1,
      changedLedgerCount: 1,
    });
    expect(writtenEvents.map((event) => event.content.title)).toEqual([
      'Phase 4 Design',
      'Import Workflow',
    ]);
    expect(writtenAuditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'entry-imported' }),
        expect.objectContaining({
          eventType: 'schema-validation-failed',
          severity: 'warning',
        }),
      ]),
    );
    expect(checkpoints.get('ledgers/2026-05-12/browser.jsonl')).toEqual({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 4,
      updatedAt: '2026-05-12T10:31:00.000Z',
    });
  });

  it('uses source ledger checkpoints so manual import now avoids duplicates', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-ledgers-'));
    const ledgerDir = join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12');
    await mkdir(ledgerDir, { recursive: true });
    await writeFile(
      join(ledgerDir, 'browser.jsonl'),
      [
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Already Imported","url":"https://example.com/old","page_content":"Old page."}}',
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:05:00.000Z","payload":{"id":"page-2","title":"New Import","url":"https://example.com/new","page_content":"New page."}}',
      ].join('\n'),
    );
    const writtenEvents: MemoryEvent[] = [];

    const result = await importChangedSourceLedgers(
      {
        authorizationScopeId: 'scope-browser',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir,
      },
      {
        readCheckpoint: async () => ({
          ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
          nextLineNumber: 2,
          updatedAt: '2026-05-12T10:30:00.000Z',
        }),
        writeCheckpoint: async () => undefined,
        writeMemoryEvent: async (event) => {
          writtenEvents.push(event);
        },
        writeSourceAuditEvent: async () => undefined,
      },
    );

    expect(result.importedCount).toBe(1);
    expect(writtenEvents.map((event) => event.content.title)).toEqual([
      'New Import',
    ]);
  });

  it('fetches readable page content for browser ledger entries whose page_content only contains title and URL', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-ledgers-'));
    const ledgerDir = join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12');
    await mkdir(ledgerDir, { recursive: true });
    await writeFile(
      join(ledgerDir, 'browser.jsonl'),
      '{"schemaVersion":"source-ledger.v1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Gemma 4 Usage Guide - vLLM Recipes","url":"https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal","page_content":"Gemma 4 Usage Guide - vLLM Recipes\\n\\nhttps://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal"}}',
    );
    const writtenEvents: MemoryEvent[] = [];
    const fetchBrowserPageContent = vi.fn(async () => ({
      url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
      title: 'Gemma 4 Usage Guide - vLLM Recipes',
      fetchedAt: '2026-05-12T10:31:00.000Z',
      text: [
        'Gemma 4 Usage Guide - vLLM Recipes',
        '',
        'This recipe explains offline multimodal inference with Gemma 4 in vLLM.',
        '',
        'It includes installation steps, model loading, and generation examples.',
      ].join('\n'),
    }));

    await importChangedSourceLedgers(
      {
        authorizationScopeId: 'scope-browser',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir,
      },
      {
        readCheckpoint: async () => null,
        writeCheckpoint: async () => undefined,
        writeMemoryEvent: async (event) => {
          writtenEvents.push(event);
        },
        writeSourceAuditEvent: async () => undefined,
        fetchBrowserPageContent,
      },
    );

    expect(fetchBrowserPageContent).toHaveBeenCalledWith({
      url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
      title: 'Gemma 4 Usage Guide - vLLM Recipes',
      fetchedAt: '2026-05-12T10:31:00.000Z',
    });
    expect(writtenEvents).toHaveLength(1);
    expect(writtenEvents[0].content).toMatchObject({
      title: 'Gemma 4 Usage Guide - vLLM Recipes',
      summary:
        'Gemma 4 Usage Guide - vLLM Recipes This recipe explains offline multimodal inference with Gemma 4 in vLLM. It includes installation steps, model loading, and generation examples.',
      sourceSpecific: {
        url: 'https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#offline-inference-multimodal',
        pageContent: [
          'Gemma 4 Usage Guide - vLLM Recipes',
          '',
          'This recipe explains offline multimodal inference with Gemma 4 in vLLM.',
          '',
          'It includes installation steps, model loading, and generation examples.',
        ].join('\n'),
        pageContentSource: 'web-fetch',
        pageContentFetchedAt: '2026-05-12T10:31:00.000Z',
      },
    });
  });

  it('counts a ledger with only valid imported entries as changed', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-ledgers-'));
    const ledgerDir = join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12');
    await mkdir(ledgerDir, { recursive: true });
    await writeFile(
      join(ledgerDir, 'browser.jsonl'),
      '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Valid Entry","url":"https://example.com/valid","page_content":"Valid page."}}',
    );

    const result = await importChangedSourceLedgers(
      {
        authorizationScopeId: 'scope-browser',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir,
      },
      {
        readCheckpoint: async () => null,
        writeCheckpoint: async () => undefined,
        writeMemoryEvent: async () => undefined,
        writeSourceAuditEvent: async () => undefined,
      },
    );

    expect(result.importedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.changedLedgerCount).toBe(1);
  });

  it('skips disabled source instances before writing imported MemoryEvents', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-ledgers-'));
    const ledgerDir = join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12');
    await mkdir(ledgerDir, { recursive: true });
    await writeFile(
      join(ledgerDir, 'browser.jsonl'),
      '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Disabled Source","url":"https://example.com/disabled","page_content":"Should not import."}}',
    );
    const writtenEvents: MemoryEvent[] = [];
    const writtenAuditEvents: SourceAuditEvent[] = [];

    const result = await importChangedSourceLedgers(
      {
        authorizationScopeId: 'scope-browser',
        importedAt: '2026-05-12T10:31:00.000Z',
        workspaceDir,
      },
      {
        readCheckpoint: async () => null,
        writeCheckpoint: async () => undefined,
        writeMemoryEvent: async (event) => {
          writtenEvents.push(event);
        },
        writeSourceAuditEvent: async (event) => {
          writtenAuditEvents.push(event);
        },
        isSourceImportAllowed: async ({ sourceKind, sourceInstanceId }) =>
          !(sourceKind === 'browser' && sourceInstanceId === 'chrome-main'),
      },
    );

    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(writtenEvents).toEqual([]);
    expect(writtenAuditEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'entry-skipped',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        severity: 'info',
      }),
    );
  });

  it('documents the default asynchronous scan cadence as 30 minutes', () => {
    expect(getSourceLedgerImportSchedule()).toEqual({
      scanIntervalMs: 30 * 60 * 1000,
    });
  });

  it('runs source ledger import immediately and then on the configured interval', async () => {
    vi.useFakeTimers();
    const runImportOnce = vi.fn(async () => undefined);

    const polling = startSourceLedgerImportPolling(
      {
        schedule: {
          scanIntervalMs: 1_000,
        },
      },
      {
        runImportOnce,
      },
    );

    await Promise.resolve();
    expect(runImportOnce).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(runImportOnce).toHaveBeenCalledTimes(2);

    polling.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runImportOnce).toHaveBeenCalledTimes(2);
  });
});
