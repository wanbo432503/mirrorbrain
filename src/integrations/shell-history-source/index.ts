import { readFile } from 'node:fs/promises';

import type { MirrorBrainConfig, MemoryEvent } from '../../shared/types/index.js';
import {
  deduplicateMemoryEvents,
  type MemorySourcePlugin,
} from '../../modules/memory-capture/index.js';

interface InitialShellHistorySyncPlanInput {
  now: string;
}

interface IncrementalShellHistorySyncPlanInput {
  lastSyncedAt: string;
  now: string;
}

interface ShellHistorySyncPlan {
  strategy: 'initial-backfill' | 'incremental';
  start: string;
  end: string;
}

export interface ShellHistoryEntry {
  id: string;
  timestamp: string;
  command: string;
}

interface NormalizeShellHistoryEntryInput {
  scopeId: string;
  event: ShellHistoryEntry;
}

interface ReadShellHistoryInput {
  historyPath: string;
  start: string;
  end: string;
}

interface CreateShellHistoryMemorySourcePluginInput {
  historyPath: string;
  readShellHistory?: typeof readShellHistory;
}

const ZSH_EXTENDED_HISTORY_PATTERN = /^: (\d+):\d+;(.*)$/u;

function slugifyCommand(command: string): string {
  const normalized = command
    .trim()
    .replace(/\s+/gu, '-')
    .replace(/[^a-z0-9-]/giu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();

  return normalized.length > 0 ? normalized : 'command';
}

function getCommandName(command: string): string {
  const [commandName] = command.trim().split(/\s+/u);

  return commandName && commandName.length > 0 ? commandName : 'unknown';
}

export function createInitialShellHistorySyncPlan(
  config: MirrorBrainConfig,
  input: InitialShellHistorySyncPlanInput,
): ShellHistorySyncPlan {
  const end = new Date(input.now);
  const start = new Date(end);
  start.setUTCHours(start.getUTCHours() - config.sync.initialBackfillHours);

  return {
    strategy: 'initial-backfill',
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function createIncrementalShellHistorySyncPlan(
  _config: MirrorBrainConfig,
  input: IncrementalShellHistorySyncPlanInput,
): ShellHistorySyncPlan {
  return {
    strategy: 'incremental',
    start: input.lastSyncedAt,
    end: input.now,
  };
}

export function parseShellHistory(contents: string): ShellHistoryEntry[] {
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const match = line.match(ZSH_EXTENDED_HISTORY_PATTERN);

      if (!match) {
        return [];
      }

      const [, rawTimestamp, command] = match;
      const timestampMs = Number(rawTimestamp) * 1000;

      if (!Number.isFinite(timestampMs) || command.trim().length === 0) {
        return [];
      }

      return [
        {
          id: `shell-history:${rawTimestamp}:${slugifyCommand(command)}`,
          timestamp: new Date(timestampMs).toISOString(),
          command: command.trim(),
        },
      ];
    });
}

export async function readShellHistory(
  input: ReadShellHistoryInput,
): Promise<ShellHistoryEntry[]> {
  const contents = await readFile(input.historyPath, 'utf8');

  return parseShellHistory(contents).filter(
    (entry) =>
      entry.timestamp >= input.start && entry.timestamp <= input.end,
  );
}

export function normalizeShellHistoryEntry(
  input: NormalizeShellHistoryEntryInput,
): MemoryEvent {
  return {
    id: `shell:${input.event.id}`,
    sourceType: 'shell-history',
    sourceRef: input.event.id,
    timestamp: input.event.timestamp,
    authorizationScopeId: input.scopeId,
    content: {
      command: input.event.command,
      commandName: getCommandName(input.event.command),
    },
    captureMetadata: {
      upstreamSource: 'shell-history',
      checkpoint: input.event.timestamp,
    },
  };
}

export function getShellHistorySourceKey(historyPath: string): string {
  return `shell-history:${historyPath}`;
}

export function createShellHistoryMemorySourcePlugin(
  input: CreateShellHistoryMemorySourcePluginInput,
): MemorySourcePlugin<ShellHistoryEntry> {
  const readShellHistoryEntries = input.readShellHistory ?? readShellHistory;

  return {
    sourceKey: getShellHistorySourceKey(input.historyPath),
    sourceCategory: 'shell',
    createSyncPlan({ config, checkpoint, now }) {
      return checkpoint
        ? createIncrementalShellHistorySyncPlan(config, {
            lastSyncedAt: checkpoint.lastSyncedAt,
            now,
          })
        : createInitialShellHistorySyncPlan(config, {
            now,
          });
    },
    fetchEvents({ plan }) {
      return readShellHistoryEntries({
        historyPath: input.historyPath,
        start: plan.start,
        end: plan.end,
      });
    },
    normalizeEvent({ scopeId, event }) {
      return normalizeShellHistoryEntry({
        scopeId,
        event,
      });
    },
    sanitizeEvents(events) {
      return deduplicateMemoryEvents(events);
    },
  };
}
