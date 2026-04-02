import type {
  KnowledgeArtifact,
  MemoryEvent,
  MemoryQueryInput as MemoryRetrievalQueryInput,
  MemoryQueryResult,
  MemoryTimeRange,
  SkillArtifact,
} from '../../shared/types/index.js';
import {
  listMirrorBrainKnowledgeArtifactsFromOpenViking,
  listMirrorBrainMemoryEventsFromOpenViking,
  listMirrorBrainSkillArtifactsFromOpenViking,
} from '../openviking-store/index.js';

interface QueryMemoryInput {
  baseUrl: string;
  query: string;
  timeRange?: MemoryTimeRange;
  sourceTypes?: MemoryRetrievalQueryInput['sourceTypes'];
}

interface ListMemoryEventsInput {
  baseUrl: string;
}

interface ListKnowledgeInput {
  baseUrl: string;
}

interface ListSkillDraftsInput {
  baseUrl: string;
}

interface OpenClawPluginApiDependencies {
  listMemoryEvents?: (input: ListMemoryEventsInput) => Promise<MemoryEvent[]>;
  listKnowledgeArtifacts?: (
    input: ListKnowledgeInput,
  ) => Promise<KnowledgeArtifact[]>;
  listSkillArtifacts?: (input: ListSkillDraftsInput) => Promise<SkillArtifact[]>;
}

function summarizeGroupedMemoryEvents(
  events: MemoryEvent[],
  title: string,
  representativeEventCount: number,
): string {
  const browserEvents = events.every((event) => event.sourceType.includes('browser'));

  if (browserEvents) {
    if (representativeEventCount <= 1) {
      if (events.length === 1) {
        return `You viewed 1 page about ${title} during the requested time range.`;
      }

      return `You revisited 1 page about ${title} across ${events.length} browser visits during the requested time range.`;
    }

    return `You reviewed ${representativeEventCount} pages about ${title} across ${events.length} browser visits during the requested time range.`;
  }

  return `${events.length} matching memory event${
    events.length === 1 ? '' : 's'
  } about ${title} during the requested time range.`;
}

export async function queryMemory(
  input: QueryMemoryInput,
  dependencies: OpenClawPluginApiDependencies = {},
): Promise<MemoryQueryResult> {
  const listMemoryEvents =
    dependencies.listMemoryEvents ?? listMirrorBrainMemoryEventsFromOpenViking;
  const events = await listMemoryEvents({
    baseUrl: input.baseUrl,
  });
  const filteredEvents = events.filter((event) => {
    if (input.timeRange) {
      const inTimeRange =
        event.timestamp >= input.timeRange.startAt &&
        event.timestamp <= input.timeRange.endAt;

      if (!inTimeRange) {
        return false;
      }
    }

    if (!input.sourceTypes || input.sourceTypes.length === 0) {
      return true;
    }

    return input.sourceTypes.some((sourceType) => {
      if (sourceType === 'browser') {
        return event.sourceType.includes('browser');
      }

      if (sourceType === 'shell') {
        return event.sourceType.includes('shell');
      }

      return event.sourceType.includes('openclaw');
    });
  });
  const groupedEvents = new Map<string, MemoryEvent[]>();

  for (const event of filteredEvents) {
    const title =
      typeof event.content.title === 'string' ? event.content.title : event.id;
    const key = `${event.sourceType}:${title}`;
    const current = groupedEvents.get(key) ?? [];
    current.push(event);
    groupedEvents.set(key, current);
  }

  return {
    timeRange: input.timeRange,
    items: Array.from(groupedEvents.entries())
      .map(([key, grouped]) => {
        const sortedEvents = [...grouped].sort((left, right) =>
          left.timestamp.localeCompare(right.timestamp),
        );
        const [firstEvent] = sortedEvents;
        const title =
          typeof firstEvent.content.title === 'string'
            ? firstEvent.content.title
            : firstEvent.id;

        const representativeEvents = sortedEvents.filter((event, index, events) => {
          if (!event.sourceType.includes('browser')) {
            return true;
          }

          const currentUrl =
            typeof event.content.url === 'string' ? event.content.url : event.sourceRef;

          return (
            events.findIndex((candidate) => {
              const candidateUrl =
                typeof candidate.content.url === 'string'
                  ? candidate.content.url
                  : candidate.sourceRef;

              return candidateUrl === currentUrl;
            }) === index
          );
        });

        return {
          id: `memory-result:${key
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-|-$/gu, '')}`,
          theme: title,
          title,
          eventCount: grouped.length,
          summary: summarizeGroupedMemoryEvents(
            grouped,
            title,
            representativeEvents.length,
          ),
          timeRange: {
            startAt: sortedEvents[0].timestamp,
            endAt: sortedEvents[sortedEvents.length - 1].timestamp,
          },
          sourceRefs: representativeEvents.slice(0, 3).map((event) => ({
            id: event.id,
            sourceType: event.sourceType,
            sourceRef: event.sourceRef,
            timestamp: event.timestamp,
          })),
        };
      })
      .sort((left, right) => {
        const byEventCount = right.eventCount - left.eventCount;

        if (byEventCount !== 0) {
          return byEventCount;
        }

        return right.timeRange.endAt.localeCompare(left.timeRange.endAt);
      })
      .map(({ eventCount: _eventCount, ...item }) => item),
  };
}

export async function listKnowledge(
  input: ListKnowledgeInput,
  dependencies: OpenClawPluginApiDependencies = {},
): Promise<KnowledgeArtifact[]> {
  const listKnowledgeArtifacts =
    dependencies.listKnowledgeArtifacts ??
    listMirrorBrainKnowledgeArtifactsFromOpenViking;

  return listKnowledgeArtifacts(input);
}

export async function listSkillDrafts(
  input: ListSkillDraftsInput,
  dependencies: OpenClawPluginApiDependencies = {},
): Promise<SkillArtifact[]> {
  const listSkillArtifacts =
    dependencies.listSkillArtifacts ?? listMirrorBrainSkillArtifactsFromOpenViking;

  return listSkillArtifacts(input);
}
