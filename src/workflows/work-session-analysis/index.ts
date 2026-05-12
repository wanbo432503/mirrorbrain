import type { MemoryEvent, MemoryTimeRange } from '../../shared/types/index.js';

export type AnalysisWindowPreset = 'last-6-hours' | 'last-24-hours' | 'last-7-days';

export interface WorkSessionAnalysisWindow extends MemoryTimeRange {
  preset: AnalysisWindowPreset;
}

export interface WorkSessionCandidate {
  id: string;
  projectHint: string;
  title: string;
  summary: string;
  memoryEventIds: string[];
  sourceTypes: string[];
  timeRange: MemoryTimeRange;
  relationHints: string[];
  reviewState: 'pending';
}

export interface WorkSessionAnalysisResult {
  analysisWindow: WorkSessionAnalysisWindow;
  generatedAt: string;
  candidates: WorkSessionCandidate[];
  excludedMemoryEventIds: string[];
}

interface AnalyzeWorkSessionCandidatesInput {
  analysisWindow: WorkSessionAnalysisWindow;
  generatedAt: string;
  memoryEvents: MemoryEvent[];
}

function isInWindow(event: MemoryEvent, window: MemoryTimeRange): boolean {
  return event.timestamp >= window.startAt && event.timestamp <= window.endAt;
}

function getProjectHint(event: MemoryEvent): string {
  const entities = Array.isArray(event.content.entities)
    ? event.content.entities
    : [];
  const projectEntity = entities.find((entity): entity is { kind: string; label: string } => (
    typeof entity === 'object' &&
    entity !== null &&
    'kind' in entity &&
    'label' in entity &&
    entity.kind === 'project' &&
    typeof entity.label === 'string' &&
    entity.label.length > 0
  ));

  return projectEntity?.label ?? 'unassigned';
}

function getTitle(event: MemoryEvent): string {
  return typeof event.content.title === 'string' && event.content.title.length > 0
    ? event.content.title
    : event.id;
}

function getSummary(event: MemoryEvent): string {
  return typeof event.content.summary === 'string' && event.content.summary.length > 0
    ? event.content.summary
    : '';
}

function createCandidate(input: {
  projectHint: string;
  generatedAt: string;
  memoryEvents: MemoryEvent[];
}): WorkSessionCandidate {
  const sortedEvents = [...input.memoryEvents].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const sourceTypes = Array.from(new Set(sortedEvents.map((event) => event.sourceType))).sort();
  const memoryEventIds = sortedEvents.map((event) => event.id);
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];

  return {
    id: `work-session-candidate:${input.projectHint}:${input.generatedAt}`,
    projectHint: input.projectHint,
    title: `${input.projectHint} work session`,
    summary: sortedEvents.map(getSummary).filter(Boolean).join(' '),
    memoryEventIds,
    sourceTypes,
    timeRange: {
      startAt: firstEvent.timestamp,
      endAt: lastEvent.timestamp,
    },
    relationHints: sortedEvents.map(getTitle),
    reviewState: 'pending',
  };
}

export function analyzeWorkSessionCandidates(
  input: AnalyzeWorkSessionCandidatesInput,
): WorkSessionAnalysisResult {
  const includedEvents = input.memoryEvents.filter((event) =>
    isInWindow(event, input.analysisWindow),
  );
  const excludedMemoryEventIds = input.memoryEvents
    .filter((event) => !isInWindow(event, input.analysisWindow))
    .map((event) => event.id);
  const eventsByProject = new Map<string, MemoryEvent[]>();

  for (const event of includedEvents) {
    const projectHint = getProjectHint(event);
    eventsByProject.set(projectHint, [
      ...(eventsByProject.get(projectHint) ?? []),
      event,
    ]);
  }

  return {
    analysisWindow: input.analysisWindow,
    generatedAt: input.generatedAt,
    candidates: [...eventsByProject.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([projectHint, memoryEvents]) =>
        createCandidate({
          projectHint,
          generatedAt: input.generatedAt,
          memoryEvents,
        }),
      ),
    excludedMemoryEventIds,
  };
}
