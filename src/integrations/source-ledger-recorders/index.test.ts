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
});
