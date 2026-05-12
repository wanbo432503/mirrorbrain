import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBuiltInSourceLedgerRecorderStarter } from './index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('built-in source ledger recorders', () => {
  it('starts a built-in browser recorder that writes a daily JSONL ledger entry', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-recorder-'));
    tempDirs.push(workspaceDir);
    const captureSourceRecord = vi.fn(async () => ({
      occurredAt: '2026-05-12T10:00:00.000Z',
      payload: {
        id: 'browser-page-1',
        title: 'Phase 4 design',
        url: 'https://example.com/phase-4',
        page_content: 'MirrorBrain Phase 4 notes.',
      },
    }));
    const startRecorder = createBuiltInSourceLedgerRecorderStarter({
      workspaceDir,
      now: () => '2026-05-12T10:01:00.000Z',
      captureSourceRecord,
    });

    const handle = await startRecorder({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: true,
    });

    const ledgerText = await readFile(
      join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12', 'browser.jsonl'),
      'utf8',
    );
    const ledgerEntry = JSON.parse(ledgerText.trim()) as Record<string, unknown>;

    expect(captureSourceRecord).toHaveBeenCalledWith({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: true,
    });
    expect(ledgerEntry).toMatchObject({
      schemaVersion: 'source-ledger.v1',
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      occurredAt: '2026-05-12T10:00:00.000Z',
      capturedAt: '2026-05-12T10:01:00.000Z',
      payload: {
        id: 'browser-page-1',
        title: 'Phase 4 design',
      },
    });

    await handle.stop();
  });

  it('writes multiple captured browser records into the daily JSONL ledger', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'mirrorbrain-recorder-'));
    tempDirs.push(workspaceDir);
    const startRecorder = createBuiltInSourceLedgerRecorderStarter({
      workspaceDir,
      now: () => '2026-05-12T10:06:00.000Z',
      captureSourceRecord: async () => [
        {
          occurredAt: '2026-05-12T10:00:00.000Z',
          payload: {
            id: 'browser-page-1',
            title: 'Phase 4 design',
            url: 'https://example.com/phase-4',
            page_content: 'MirrorBrain Phase 4 notes.',
          },
        },
        {
          occurredAt: '2026-05-12T10:05:00.000Z',
          payload: {
            id: 'browser-page-2',
            title: 'Ledger import',
            url: 'https://example.com/import',
            page_content: 'Source ledger import notes.',
          },
        },
      ],
    });

    await startRecorder({
      sourceKind: 'browser',
      sourceInstanceId: 'chrome-main',
      enabled: true,
    });

    const ledgerText = await readFile(
      join(workspaceDir, 'mirrorbrain', 'ledgers', '2026-05-12', 'browser.jsonl'),
      'utf8',
    );
    const entries = ledgerText
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { payload: { title: string } });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.payload.title)).toEqual([
      'Phase 4 design',
      'Ledger import',
    ]);
  });
});
