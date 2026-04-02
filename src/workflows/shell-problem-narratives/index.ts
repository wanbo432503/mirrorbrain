import { basename, resolve } from 'node:path';

import type {
  MemoryEvent,
  MemoryNarrative,
  MemoryResultSourceRef,
} from '../../shared/types/index.js';

interface GenerateShellProblemNarrativesInput {
  memoryEvents: MemoryEvent[];
}

interface ShellEventWithContext {
  event: MemoryEvent;
  inferredCwd?: string;
  sessionId: string;
}

const GENERIC_SHELL_HINTS = new Set([
  'cd',
  'status',
  'diff',
  'fix',
  'log',
  'run',
  'install',
  'apply',
  'apply_patch',
  'patch',
  'sed',
  'perl',
  'test',
  'typecheck',
]);

function getShellCommandText(event: MemoryEvent): string {
  return typeof event.content.command === 'string' ? event.content.command : '';
}

function isVerificationShellCommand(command: string): boolean {
  const normalized = command.toLowerCase();

  return (
    normalized.includes('test') ||
    normalized.includes('vitest') ||
    normalized.includes('pytest') ||
    normalized.includes('typecheck') ||
    normalized.includes('tsc --noemit')
  );
}

function isInspectionShellCommand(command: string): boolean {
  const normalized = command.toLowerCase();

  return (
    normalized.includes(' status') ||
    normalized.endsWith(' status') ||
    normalized.includes(' diff') ||
    normalized.endsWith(' diff') ||
    normalized.includes(' log') ||
    normalized.endsWith(' log')
  );
}

function isApplyShellCommand(command: string): boolean {
  const normalized = command.toLowerCase();

  return (
    normalized.includes(' apply') ||
    normalized.endsWith(' apply') ||
    normalized.startsWith('patch ') ||
    normalized.startsWith('sed -i') ||
    normalized.startsWith('perl -pi') ||
    normalized.startsWith('apply_patch ')
  );
}

function extractChangedDirectory(command: string, currentCwd?: string): string | undefined {
  const trimmed = command.trim();
  const cdMatch = trimmed.match(/^(?:cd|pushd)\s+(.+)$/u);

  if (!cdMatch) {
    return undefined;
  }

  const nextPath = cdMatch[1]?.trim();

  if (!nextPath) {
    return undefined;
  }

  if (nextPath.startsWith('/')) {
    return nextPath;
  }

  if (currentCwd) {
    return resolve(currentCwd, nextPath);
  }

  return nextPath;
}

function collectOperationPhases(events: MemoryEvent[]): string[] {
  const phases = new Set<string>();

  for (const event of events) {
    const command = getShellCommandText(event);

    if (isInspectionShellCommand(command)) {
      phases.add('inspected state');
    }

    if (isApplyShellCommand(command)) {
      phases.add('applied changes');
    }

    if (isVerificationShellCommand(command)) {
      phases.add('verified the result');
    }
  }

  return [
    'inspected state',
    'applied changes',
    'verified the result',
  ].filter((phase) => phases.has(phase));
}

function joinPhasesForSummary(phases: string[]): string {
  if (phases.length === 0) {
    return 'worked through the sequence';
  }

  if (phases.length === 1) {
    return phases[0];
  }

  if (phases.length === 2) {
    return `${phases[0]} and ${phases[1]}`;
  }

  return `${phases[0]}, ${phases[1]}, and ${phases[2]}`;
}

function createRepresentativeSourceRefs(events: MemoryEvent[]): MemoryResultSourceRef[] {
  return events
    .filter((event) => !getShellCommandText(event).toLowerCase().startsWith('cd '))
    .slice(0, 3)
    .map((event) => ({
      id: event.id,
      sourceType: event.sourceType,
      sourceRef: event.sourceRef,
      timestamp: event.timestamp,
    }));
}

function collectShellQueryHints(
  events: MemoryEvent[],
  workspaceLabel?: string,
): string[] {
  const hints = new Set<string>();

  if (workspaceLabel) {
    hints.add(workspaceLabel);
  }

  for (const event of events) {
    const commandText = getShellCommandText(event);
    const commandName = String(event.content.commandName ?? '').trim().toLowerCase();

    if (
      commandName.length > 0 &&
      commandName !== 'cd' &&
      commandName !== 'apply_patch'
    ) {
      hints.add(commandName);
    }

    if (commandName === 'cd' || commandName === 'pushd') {
      continue;
    }

    for (const token of commandText.split(/[^a-z0-9]+/u)) {
      if (token.length < 3 || GENERIC_SHELL_HINTS.has(token)) {
        continue;
      }

      hints.add(token);
    }
  }

  return [...hints];
}

function annotateShellEventsWithContext(events: MemoryEvent[]): ShellEventWithContext[] {
  const sortedEvents = [...events].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const maxSessionGapMs = 30 * 60 * 1000;
  let sessionNumber = 1;
  let previousTimestamp: string | undefined;
  let currentCwd: string | undefined;

  return sortedEvents.map((event) => {
    if (previousTimestamp) {
      const gapMs = Date.parse(event.timestamp) - Date.parse(previousTimestamp);

      if (gapMs > maxSessionGapMs) {
        sessionNumber += 1;
        currentCwd = undefined;
      }
    }

    const sessionId = `shell-session:${event.timestamp.slice(0, 10)}:${sessionNumber}`;
    const nextCwd = extractChangedDirectory(getShellCommandText(event), currentCwd);

    if (nextCwd) {
      currentCwd = nextCwd;
    }

    previousTimestamp = event.timestamp;

    return {
      event,
      inferredCwd: currentCwd,
      sessionId,
    };
  });
}

function createShellNarrativeSummary(
  phases: string[],
  workspaceLabel: string | undefined,
  events: MemoryEvent[],
): string {
  const phaseSummary = joinPhasesForSummary(phases);

  if (workspaceLabel) {
    return `You ${phaseSummary} in the ${workspaceLabel} workspace across ${events.length} shell commands.`;
  }

  return `You ${phaseSummary} across ${events.length} shell commands.`;
}

export function generateShellProblemNarratives(
  input: GenerateShellProblemNarrativesInput,
): MemoryNarrative[] {
  const shellEvents = annotateShellEventsWithContext(
    input.memoryEvents.filter((event) => event.sourceType.includes('shell')),
  );
  const groupedEvents = new Map<string, ShellEventWithContext[]>();

  for (const entry of shellEvents) {
    const workspaceLabel =
      entry.inferredCwd && basename(entry.inferredCwd).length > 0
        ? basename(entry.inferredCwd).toLowerCase()
        : 'session';
    const key = `${entry.event.timestamp.slice(0, 10)}:${workspaceLabel}:${entry.sessionId}`;
    const current = groupedEvents.get(key) ?? [];

    current.push(entry);
    groupedEvents.set(key, current);
  }

  return Array.from(groupedEvents.entries()).map(([key, entries], index) => {
    const [reviewDate, workspaceLabel, ...sessionIdParts] = key.split(':');
    const sessionId = sessionIdParts.join(':');
    const events = entries.map((entry) => entry.event);
    const operationPhases = collectOperationPhases(events);
    const preferredWorkspaceLabel =
      workspaceLabel !== 'session' ? workspaceLabel : undefined;
    const title = preferredWorkspaceLabel
      ? `${preferredWorkspaceLabel.charAt(0).toUpperCase()}${preferredWorkspaceLabel.slice(
          1,
        )} shell fix sequence`
      : 'Shell problem-solving sequence';
    const queryHints = collectShellQueryHints(
      events,
      preferredWorkspaceLabel,
    );

    return {
      id: `memory-narrative:shell-problem:${reviewDate}:${workspaceLabel}:${index + 1}`,
      narrativeType: 'shell-problem' as const,
      sourceCategory: 'shell' as const,
      title,
      theme: title,
      summary: createShellNarrativeSummary(
        operationPhases,
        preferredWorkspaceLabel,
        events,
      ),
      timeRange: {
        startAt: events[0].timestamp,
        endAt: events[events.length - 1].timestamp,
      },
      sourceEventIds: events.map((event) => event.id),
      sourceRefs: createRepresentativeSourceRefs(events),
      queryHints,
      operationPhases,
      context: {
        inferredCwd: entries[entries.length - 1]?.inferredCwd,
        workspaceLabel: preferredWorkspaceLabel,
        sessionId,
      },
    };
  });
}
