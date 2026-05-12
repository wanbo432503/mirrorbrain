import { describe, expect, it } from 'vitest';

import {
  importSourceLedgerText,
  type SourceLedgerImportCheckpoint,
} from './index.js';

describe('source ledger importer', () => {
  it('normalizes browser ledger entries into source-attributed MemoryEvent records', () => {
    const result = importSourceLedgerText({
      authorizationScopeId: 'scope-browser',
      importedAt: '2026-05-12T10:31:00.000Z',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      ledgerText:
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Phase 4 Design","url":"https://example.com/phase4","page_content":"Phase 4 turns MirrorBrain into multi-source project memory."}}\n',
    });

    expect(result.importedEvents).toEqual([
      {
        id: expect.stringMatching(/^ledger:browser:/u),
        sourceType: 'browser',
        sourceRef: expect.stringMatching(/^browser:chrome-main:/u),
        timestamp: '2026-05-12T10:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          title: 'Phase 4 Design',
          summary: 'Phase 4 turns MirrorBrain into multi-source project memory.',
          contentKind: 'browser-page',
          bodyRef: undefined,
          entities: [
            {
              kind: 'url',
              label: 'https://example.com/phase4',
              ref: 'https://example.com/phase4',
            },
          ],
          sourceSpecific: {
            id: 'page-1',
            url: 'https://example.com/phase4',
            pageContent: 'Phase 4 turns MirrorBrain into multi-source project memory.',
          },
        },
        captureMetadata: {
          upstreamSource: 'source-ledger:browser',
          checkpoint: 'ledgers/2026-05-12/browser.jsonl:1',
        },
      },
    ]);
    expect(result.auditEvents).toEqual([
      expect.objectContaining({
        eventType: 'entry-imported',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
        severity: 'info',
      }),
    ]);
    expect(result.checkpoint).toEqual({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 2,
      updatedAt: '2026-05-12T10:31:00.000Z',
    });
  });

  it('skips malformed or schema-invalid lines with audit warnings and continues importing later lines', () => {
    const result = importSourceLedgerText({
      authorizationScopeId: 'scope-browser',
      importedAt: '2026-05-12T10:31:00.000Z',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      ledgerText: [
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Phase 4 Design","url":"https://example.com/phase4","page_content":"Phase 4 source ledgers."}}',
        '{not-json',
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:02:00.000Z","payload":{"id":"page-2","url":"https://example.com/missing-title","page_content":"Missing title should fail schema validation."}}',
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:03:00.000Z","payload":{"id":"page-3","title":"Imported Later","url":"https://example.com/later","page_content":"Later valid entries still import."}}',
      ].join('\n'),
    });

    expect(result.importedEvents.map((event) => event.content.title)).toEqual([
      'Phase 4 Design',
      'Imported Later',
    ]);
    expect(result.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'schema-validation-failed',
          ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
          lineNumber: 2,
          severity: 'warning',
          metadata: expect.objectContaining({
            badLineSample: '{not-json',
          }),
        }),
        expect.objectContaining({
          eventType: 'schema-validation-failed',
          sourceKind: 'browser',
          sourceInstanceId: 'chrome-main',
          lineNumber: 3,
          severity: 'warning',
          metadata: expect.objectContaining({
            reason: expect.stringContaining('payload.title'),
          }),
        }),
      ]),
    );
    expect(result.checkpoint.nextLineNumber).toBe(5);
  });

  it('imports only lines after the checkpoint so manual re-imports do not duplicate events', () => {
    const checkpoint: SourceLedgerImportCheckpoint = {
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 2,
      updatedAt: '2026-05-12T10:30:00.000Z',
    };

    const result = importSourceLedgerText({
      authorizationScopeId: 'scope-browser',
      checkpoint,
      importedAt: '2026-05-12T10:31:00.000Z',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      ledgerText: [
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Already Imported","url":"https://example.com/old","page_content":"Old page."}}',
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:03:00.000Z","payload":{"id":"page-2","title":"New Import","url":"https://example.com/new","page_content":"New page."}}',
      ].join('\n'),
    });

    expect(result.importedEvents.map((event) => event.content.title)).toEqual([
      'New Import',
    ]);
    expect(result.checkpoint).toEqual({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 3,
      updatedAt: '2026-05-12T10:31:00.000Z',
    });
  });
});
