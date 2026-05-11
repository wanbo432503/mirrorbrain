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
const SENSITIVE_ENV_ASSIGNMENT_PATTERN =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|API[_-]?KEY|KEY)[A-Z0-9_]*)=([^\s]+)/giu;
const BEARER_TOKEN_PATTERN = /(Authorization:\s*Bearer\s+)[^"'\s]+/giu;
const URL_CREDENTIAL_PATTERN = /(https?:\/\/)[^\/\s:@]+:[^\/\s@]+@/giu;
const SENSITIVE_FLAG_PATTERN =
  /(--(?:password|passwd|token|api-key|apikey|secret|key)(?:=|\s+))("[^"]+"|'[^']+'|\S+)/giu;

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
  const commandName = command
    .trim()
    .split(/\s+/u)
    .find((part) => !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(part));

  return commandName && commandName.length > 0 ? commandName : 'unknown';
}

export function sanitizeShellCommand(command: string): {
  command: string;
  redactionApplied: boolean;
} {
  let sanitized = command;

  sanitized = sanitized.replace(
    SENSITIVE_ENV_ASSIGNMENT_PATTERN,
    '$1=[REDACTED]',
  );
  sanitized = sanitized.replace(BEARER_TOKEN_PATTERN, '$1[REDACTED]');
  sanitized = sanitized.replace(URL_CREDENTIAL_PATTERN, '$1[REDACTED]@');
  sanitized = sanitized.replace(
    SENSITIVE_FLAG_PATTERN,
    (match, prefix: string) => {
      const separator = prefix.endsWith('=') ? '' : ' ';
      return `${prefix.trimEnd()}${separator}[REDACTED]`;
    },
  );

  return {
    command: sanitized,
    redactionApplied: sanitized !== command,
  };
}

function createShellHistoryEntryId(timestampSeconds: string, command: string): string {
  const sanitizedCommand = sanitizeShellCommand(command);

  return `shell-history:${timestampSeconds}:${slugifyCommand(sanitizedCommand.command)}`;
}

function getShellHistoryTimestampSeconds(entry: ShellHistoryEntry): string {
  const idMatch = entry.id.match(/^shell-history:(\d+):/u);

  if (idMatch) {
    return idMatch[1];
  }

  return String(Math.floor(new Date(entry.timestamp).getTime() / 1000));
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
          id: createShellHistoryEntryId(rawTimestamp, command),
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
  const sanitizedCommand = sanitizeShellCommand(input.event.command);
  const sourceRef = createShellHistoryEntryId(
    getShellHistoryTimestampSeconds(input.event),
    input.event.command,
  );
  const content: MemoryEvent['content'] = {
    command: sanitizedCommand.command,
    commandName: getCommandName(input.event.command),
  };

  if (sanitizedCommand.redactionApplied) {
    content.redactionApplied = true;
  }

  return {
    id: `shell:${sourceRef}`,
    sourceType: 'shell-history',
    sourceRef,
    timestamp: input.event.timestamp,
    authorizationScopeId: input.scopeId,
    content,
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
