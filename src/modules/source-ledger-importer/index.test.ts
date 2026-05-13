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

  it('restarts from the first line when the checkpoint is beyond the current ledger length', () => {
    const checkpoint: SourceLedgerImportCheckpoint = {
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 66,
      updatedAt: '2026-05-12T10:30:00.000Z',
    };

    const result = importSourceLedgerText({
      authorizationScopeId: 'scope-browser',
      checkpoint,
      importedAt: '2026-05-12T10:31:00.000Z',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      ledgerText:
        '{"schemaVersion":"1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":"page-1","title":"Rewritten Ledger","url":"https://example.com/rewritten","page_content":"Ledger was rewritten with fewer lines."}}',
    });

    expect(result.importedEvents.map((event) => event.content.title)).toEqual([
      'Rewritten Ledger',
    ]);
    expect(result.checkpoint).toEqual({
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      nextLineNumber: 2,
      updatedAt: '2026-05-12T10:31:00.000Z',
    });
  });

  it('accepts numeric ActivityWatch browser payload ids', () => {
    const result = importSourceLedgerText({
      authorizationScopeId: 'scope-browser',
      importedAt: '2026-05-12T10:31:00.000Z',
      ledgerPath: 'ledgers/2026-05-12/browser.jsonl',
      ledgerText:
        '{"schemaVersion":"source-ledger.v1","sourceKind":"browser","sourceInstanceId":"chrome-main","occurredAt":"2026-05-12T10:00:00.000Z","payload":{"id":161,"title":"ActivityWatch Page","url":"https://example.com/activitywatch","page_content":"ActivityWatch can emit numeric ids."}}',
    });

    expect(result.importedEvents.map((event) => event.content.title)).toEqual([
      'ActivityWatch Page',
    ]);
    expect(result.importedEvents[0]?.content.sourceSpecific).toMatchObject({
      id: '161',
    });
  });

  it('normalizes every Phase 4 built-in source kind into MemoryEvent content V2 records', () => {
    const result = importSourceLedgerText({
      authorizationScopeId: 'scope-phase4',
      importedAt: '2026-05-12T11:00:00.000Z',
      ledgerPath: 'ledgers/2026-05-12/mixed.jsonl',
      ledgerText: [
        '{"schemaVersion":"1","sourceKind":"file-activity","sourceInstanceId":"finder-main","occurredAt":"2026-05-12T10:10:00.000Z","payload":{"filePath":"/Users/wanbo/Notes/phase4.md","fileName":"phase4.md","fileType":"markdown","mimeType":"text/markdown","openedByApp":"Cursor","sizeBytes":1200,"modifiedAt":"2026-05-12T10:09:00.000Z","contentSummary":"Phase 4 ledger architecture notes.","fullContentRef":"workspace-file:///Users/wanbo/Notes/phase4.md"}}',
        '{"schemaVersion":"1","sourceKind":"screenshot","sourceInstanceId":"desktop","occurredAt":"2026-05-12T10:11:00.000Z","payload":{"title":"Architecture Diagram","appName":"Preview","windowTitle":"phase4.png","imagePath":"/tmp/phase4.png","imageRetained":true,"imageSize":{"width":1440,"height":900},"ocrSummary":"Phase 4 ledgers and importer","visionSummary":"A diagram showing recorders writing ledgers into MirrorBrain."}}',
        '{"schemaVersion":"1","sourceKind":"audio-recording","sourceInstanceId":"recording-main","occurredAt":"2026-05-12T10:11:30.000Z","payload":{"title":"Design discussion recording","appName":"Voice Memos","audioPath":"/tmp/phase4.m4a","audioRetained":true,"durationMs":420000,"transcriptSummary":"A recorded discussion about adding source names and recording memory.","redactionStatus":"none"}}',
        '{"schemaVersion":"1","sourceKind":"shell","sourceInstanceId":"iterm-main","occurredAt":"2026-05-12T10:12:00.000Z","payload":{"sessionId":"shell-session-1","commandIndex":7,"command":"pnpm test","cwd":"/Users/wanbo/Workspace/mirrorbrain","exitCode":0,"shellType":"zsh","terminalApp":"iTerm2","redactionStatus":"none"}}',
        '{"schemaVersion":"1","sourceKind":"agent","sourceInstanceId":"agent-main","occurredAt":"2026-05-12T10:13:00.000Z","payload":{"transcriptPath":"/Users/wanbo/.codex/sessions/session.jsonl","sessionId":"codex-1","agentIdentity":"Codex","userTask":"Implement Phase 4 importer","messageRange":{"start":3,"end":42},"toolCallSummary":"Read files, edited importer, ran tests.","finalResultSummary":"Importer implemented and verified.","redactionStatus":"none","updatedAt":"2026-05-12T10:13:30.000Z"}}',
      ].join('\n'),
    });

    expect(result.importedEvents).toEqual([
      expect.objectContaining({
        sourceType: 'file-activity',
        content: expect.objectContaining({
          title: 'phase4.md',
          summary: 'Phase 4 ledger architecture notes.',
          contentKind: 'file-activity',
          bodyRef: {
            kind: 'workspace-file',
            uri: 'workspace-file:///Users/wanbo/Notes/phase4.md',
            mediaType: 'text/markdown',
            sizeBytes: 1200,
          },
          entities: expect.arrayContaining([
            {
              kind: 'file',
              label: '/Users/wanbo/Notes/phase4.md',
              ref: '/Users/wanbo/Notes/phase4.md',
            },
          ]),
        }),
      }),
      expect.objectContaining({
        sourceType: 'screenshot',
        content: expect.objectContaining({
          title: 'Architecture Diagram',
          summary: 'A diagram showing recorders writing ledgers into MirrorBrain.',
          contentKind: 'screenshot',
          bodyRef: {
            kind: 'workspace-file',
            uri: '/tmp/phase4.png',
          },
          entities: expect.arrayContaining([
            {
              kind: 'app',
              label: 'Preview',
              ref: 'Preview',
            },
          ]),
        }),
      }),
      expect.objectContaining({
        sourceType: 'audio-recording',
        content: expect.objectContaining({
          title: 'Design discussion recording',
          summary: 'A recorded discussion about adding source names and recording memory.',
          contentKind: 'audio-recording',
          bodyRef: {
            kind: 'workspace-file',
            uri: '/tmp/phase4.m4a',
          },
          entities: expect.arrayContaining([
            {
              kind: 'app',
              label: 'Voice Memos',
              ref: 'Voice Memos',
            },
          ]),
        }),
      }),
      expect.objectContaining({
        sourceType: 'shell',
        content: expect.objectContaining({
          title: 'pnpm test',
          summary: 'zsh command in /Users/wanbo/Workspace/mirrorbrain exited with code 0.',
          contentKind: 'shell-command',
          entities: expect.arrayContaining([
            {
              kind: 'command',
              label: 'pnpm test',
              ref: 'pnpm test',
            },
            {
              kind: 'file',
              label: '/Users/wanbo/Workspace/mirrorbrain',
              ref: '/Users/wanbo/Workspace/mirrorbrain',
            },
          ]),
        }),
      }),
      expect.objectContaining({
        sourceType: 'agent',
        content: expect.objectContaining({
          title: 'Implement Phase 4 importer',
          summary: 'Importer implemented and verified.',
          contentKind: 'agent-session',
          bodyRef: {
            kind: 'workspace-file',
            uri: '/Users/wanbo/.codex/sessions/session.jsonl',
          },
          entities: expect.arrayContaining([
            {
              kind: 'agent',
              label: 'Codex',
              ref: 'codex-1',
            },
          ]),
        }),
      }),
    ]);
    expect(result.auditEvents).toHaveLength(5);
  });
});
