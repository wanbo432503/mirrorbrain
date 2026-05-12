import { describe, expect, it, vi } from 'vitest';

import type { SourceAuditEvent } from '../../modules/source-ledger-importer/index.js';
import { startSourceRecorderSupervisor } from './index.js';

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
});
