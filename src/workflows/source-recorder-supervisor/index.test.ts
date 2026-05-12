import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SourceAuditEvent } from '../../modules/source-ledger-importer/index.js';
import {
  startBuiltInSourceLedgerRecorderSupervisor,
  startSourceRecorderSupervisor,
} from './index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('source recorder supervisor', () => {
  it('starts enabled source recorders, skips disabled sources, and audits lifecycle events', async () => {
    const stopped: string[] = [];
    const auditEvents: SourceAuditEvent[] = [];
    const startRecorder = vi.fn(async (source) => ({
      stop: vi.fn(async () => {
        stopped.push(`${source.sourceKind}:${source.sourceInstanceId}`);
      }),
    }));

    const supervisor = await startSourceRecorderSupervisor(
      {
        sources: [
          {
            sourceKind: 'browser',
            sourceInstanceId: 'chrome-main',
            enabled: true,
          },
          {
            sourceKind: 'shell',
            sourceInstanceId: 'iterm-main',
            enabled: false,
          },
        ],
        now: () => '2026-05-12T12:00:00.000Z',
      },
      {
        startRecorder,
        writeSourceAuditEvent: async (event) => {
          auditEvents.push(event);
        },
      },
    );

    expect(startRecorder).toHaveBeenCalledTimes(1);
    expect(startRecorder).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: true,
    });
    expect(auditEvents).toEqual([
      expect.objectContaining({
        eventType: 'recorder-started',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
      expect.objectContaining({
        eventType: 'recorder-disabled',
        sourceKind: 'shell',
        sourceInstanceId: 'iterm-main',
      }),
    ]);

    await supervisor.stop();

    expect(stopped).toEqual(['browser:chrome-main']);
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'recorder-stopped',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    );
  });

  it('wires built-in source ledger recorders into the supervisor lifecycle', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-built-in-supervisor-'));
    tempDirs.push(workspaceDir);
    const auditEvents: SourceAuditEvent[] = [];
    const supervisor = await startBuiltInSourceLedgerRecorderSupervisor(
      {
        workspaceDir,
        sources: [
          {
            sourceKind: 'browser',
            sourceInstanceId: 'chrome-main',
            enabled: true,
          },
        ],
        now: () => '2026-05-12T12:00:00.000Z',
      },
      {
        captureSourceRecord: vi.fn(async () => ({
          occurredAt: '2026-05-12T10:00:00.000Z',
          payload: {
            id: 'browser-page-1',
            title: 'Phase 4 design',
            url: 'https://example.com/phase-4',
            page_content: 'MirrorBrain Phase 4 notes.',
          },
        })),
        writeSourceAuditEvent: async (event) => {
          auditEvents.push(event);
        },
      },
    );

    const ledgerText = await readFile(
      join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12', 'browser.jsonl'),
      'utf8',
    );

    expect(JSON.parse(ledgerText.trim())).toMatchObject({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      payload: {
        title: 'Phase 4 design',
      },
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'recorder-started',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    );

    await supervisor.stop();

    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'recorder-stopped',
        sourceKind: 'browser',
        sourceInstanceId: 'chrome-main',
      }),
    );
  });
});
