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

interface ShellProblemCluster {
  events: MemoryEvent[];
  startAt: string;
  endAt: string;
}

function normalizeBrowserThemeTitle(title: string): string {
  const normalized = title.split(/ \| | - | — /u)[0]?.trim();

  return normalized && normalized.length > 0 ? normalized : title;
}

function formatThemeTitleForDisplay(title: string): string {
  if (title === title.toLowerCase()) {
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  return title;
}

function getMemoryEventThemeTitle(event: MemoryEvent): string {
  if (event.sourceType.includes('shell')) {
    const commandName =
      typeof event.content.commandName === 'string'
        ? event.content.commandName.trim()
        : '';

    if (commandName.length > 0) {
      return commandName;
    }
  }

  const rawTitle =
    typeof event.content.title === 'string' ? event.content.title : event.id;

  if (event.sourceType.includes('browser')) {
    return normalizeBrowserThemeTitle(rawTitle);
  }

  return rawTitle;
}

function getShellCommandText(event: MemoryEvent): string {
  return typeof event.content.command === 'string'
    ? event.content.command.toLowerCase()
    : '';
}

function isVerificationShellCommand(command: string): boolean {
  return (
    command.includes('test') ||
    command.includes('vitest') ||
    command.includes('pytest') ||
    command.includes('typecheck') ||
    command.includes('tsc --noemit')
  );
}

function isInspectionShellCommand(command: string): boolean {
  return (
    command.includes(' status') ||
    command.endsWith(' status') ||
    command.includes(' diff') ||
    command.endsWith(' diff') ||
    command.includes(' log') ||
    command.endsWith(' log')
  );
}

function isApplyShellCommand(command: string): boolean {
  return (
    command.includes(' apply') ||
    command.endsWith(' apply') ||
    command.startsWith('patch ') ||
    command.startsWith('sed -i') ||
    command.startsWith("perl -pi")
  );
}

function isShellProblemSolvingQuery(input: QueryMemoryInput): boolean {
  const query = input.query.toLowerCase();
  const allowsShellSource =
    !input.sourceTypes ||
    input.sourceTypes.length === 0 ||
    input.sourceTypes.includes('shell');
  const isShellSpecificQuery =
    query.includes('shell') ||
    query.includes('command line') ||
    query.includes('命令行');

  return allowsShellSource && isShellSpecificQuery && (query.includes('solve') || query.includes('解决'));
}

function createShellProblemNarrativeSummary(events: MemoryEvent[]): string {
  const phases = new Set<string>();

  for (const event of events) {
    const command = getShellCommandText(event);

    if (isInspectionShellCommand(command)) {
      phases.add('inspected state');
      continue;
    }

    if (isApplyShellCommand(command)) {
      phases.add('applied changes');
      continue;
    }

    if (isVerificationShellCommand(command)) {
      phases.add('verified the result');
    }
  }

  const orderedPhases = [
    'inspected state',
    'applied changes',
    'verified the result',
  ].filter((phase) => phases.has(phase));

  if (orderedPhases.length === 3) {
    return `You ${orderedPhases[0]}, ${orderedPhases[1]}, and ${orderedPhases[2]} across ${events.length} shell commands during the requested time range.`;
  }

  if (orderedPhases.length === 2) {
    return `You ${orderedPhases[0]} and ${orderedPhases[1]} across ${events.length} shell commands during the requested time range.`;
  }

  return `You worked through ${events.length} shell commands while solving the problem during the requested time range.`;
}

function clusterShellProblemSolvingEvents(events: MemoryEvent[]): ShellProblemCluster[] {
  const sortedEvents = [...events].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const clusters: ShellProblemCluster[] = [];
  const maxClusterGapMs = 15 * 60 * 1000;
  let currentCluster: MemoryEvent[] = [];

  for (const event of sortedEvents) {
    const previousEvent = currentCluster[currentCluster.length - 1];

    if (!previousEvent) {
      currentCluster.push(event);
      continue;
    }

    const gapMs =
      Date.parse(event.timestamp) - Date.parse(previousEvent.timestamp);

    if (gapMs <= maxClusterGapMs) {
      currentCluster.push(event);
      continue;
    }

    clusters.push({
      events: currentCluster,
      startAt: currentCluster[0].timestamp,
      endAt: currentCluster[currentCluster.length - 1].timestamp,
    });
    currentCluster = [event];
  }

  if (currentCluster.length > 0) {
    clusters.push({
      events: currentCluster,
      startAt: currentCluster[0].timestamp,
      endAt: currentCluster[currentCluster.length - 1].timestamp,
    });
  }

  return clusters;
}

function summarizeGroupedMemoryEvents(
  events: MemoryEvent[],
  title: string,
  representativeEventCount: number,
): string {
  const browserEvents = events.every((event) => event.sourceType.includes('browser'));
  const shellEvents = events.every((event) => event.sourceType.includes('shell'));

  if (browserEvents) {
    const includesDebuggingPage = events.some((event) => {
      const titleText =
        typeof event.content.title === 'string' ? event.content.title.toLowerCase() : '';
      const urlText =
        typeof event.content.url === 'string' ? event.content.url.toLowerCase() : '';

      return (
        titleText.includes('error') ||
        titleText.includes('bug') ||
        titleText.includes('fix') ||
        titleText.includes('troubleshoot') ||
        titleText.includes('issue') ||
        urlText.includes('error') ||
        urlText.includes('bug') ||
        urlText.includes('fix') ||
        urlText.includes('troubleshoot') ||
        urlText.includes('issue')
      );
    });
    const includesComparisonPage = events.some((event) => {
      const titleText =
        typeof event.content.title === 'string' ? event.content.title.toLowerCase() : '';
      const urlText =
        typeof event.content.url === 'string' ? event.content.url.toLowerCase() : '';

      return (
        titleText.includes('compare') ||
        titleText.includes('comparison') ||
        titleText.includes(' vs ') ||
        urlText.includes('compare') ||
        urlText.includes('comparison') ||
        urlText.includes('-vs-') ||
        urlText.includes('/vs/')
      );
    });

    const isDocumentationPage = (event: MemoryEvent): boolean => {
      if (typeof event.content.url !== 'string') {
        return false;
      }

      try {
        const url = new URL(event.content.url);
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();

        return (
          host.startsWith('docs.') ||
          host.includes('.docs.') ||
          path.startsWith('/docs') ||
          path.includes('/docs/')
        );
      } catch {
        return false;
      }
    };

    const onlyDocumentationPages = events.every(isDocumentationPage);
    const includesDocumentationPage = events.some(isDocumentationPage);

    const includesSearchPage = events.some((event) => {
      if (typeof event.content.url !== 'string') {
        return false;
      }

      try {
        const url = new URL(event.content.url);
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();

        return (
          url.searchParams.has('q') ||
          host.includes('search') ||
          path.includes('/search')
        );
      } catch {
        return false;
      }
    });

    if (representativeEventCount <= 1) {
      if (events.length === 1) {
        return `You viewed 1 page about ${title} during the requested time range.`;
      }

      return `You revisited 1 page about ${title} across ${events.length} browser visits during the requested time range.`;
    }

    if (includesDebuggingPage) {
      return `You debugged ${title} across ${representativeEventCount} pages and ${events.length} browser visits during the requested time range.`;
    }

    if (includesSearchPage && includesDocumentationPage) {
      return `You researched ${title} by reading documentation across ${representativeEventCount} pages and ${events.length} browser visits during the requested time range.`;
    }

    if (includesSearchPage) {
      return `You researched ${title} across ${representativeEventCount} pages and ${events.length} browser visits during the requested time range.`;
    }

    if (includesComparisonPage) {
      return `You compared information about ${title} across ${representativeEventCount} pages and ${events.length} browser visits during the requested time range.`;
    }

    if (onlyDocumentationPages) {
      return `You read documentation about ${title} across ${representativeEventCount} pages and ${events.length} browser visits during the requested time range.`;
    }

    return `You reviewed ${representativeEventCount} pages about ${title} across ${events.length} browser visits during the requested time range.`;
  }

  if (shellEvents) {
    const shellCommands = events.map(getShellCommandText).filter((command) => command.length > 0);
    const onlyVerificationCommands =
      shellCommands.length === events.length && shellCommands.every(isVerificationShellCommand);
    const onlyInspectionCommands =
      shellCommands.length === events.length && shellCommands.every(isInspectionShellCommand);
    const onlyApplyCommands =
      shellCommands.length === events.length && shellCommands.every(isApplyShellCommand);

    if (onlyVerificationCommands) {
      return `You verified changes with ${title} across ${events.length} shell commands during the requested time range.`;
    }

    if (onlyApplyCommands) {
      return `You applied changes with ${title} across ${events.length} shell commands during the requested time range.`;
    }

    if (onlyInspectionCommands) {
      return `You inspected state with ${title} across ${events.length} shell commands during the requested time range.`;
    }

    return `You ran ${events.length} shell command${
      events.length === 1 ? '' : 's'
    } with ${title} during the requested time range.`;
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

  if (isShellProblemSolvingQuery(input)) {
    const shellEvents = filteredEvents.filter((event) =>
      event.sourceType.includes('shell'),
    );

    if (shellEvents.length === 0) {
      return {
        timeRange: input.timeRange,
        items: [],
      };
    }

    return {
      explanation:
        'MirrorBrain grouped adjacent shell commands into a problem-solving sequence for this solve-oriented shell query.',
      timeRange: input.timeRange,
      items: clusterShellProblemSolvingEvents(shellEvents)
        .map((cluster, index) => ({
          id: `memory-result:shell-history-problem-solving-sequence-${index + 1}`,
          theme: 'Shell problem-solving sequence',
          title: 'Shell problem-solving sequence',
          summary: createShellProblemNarrativeSummary(cluster.events),
          timeRange: {
            startAt: cluster.startAt,
            endAt: cluster.endAt,
          },
          sourceRefs: cluster.events.slice(0, 3).map((event) => ({
            id: event.id,
            sourceType: event.sourceType,
            sourceRef: event.sourceRef,
            timestamp: event.timestamp,
          })),
        }))
        .sort((left, right) => right.timeRange.endAt.localeCompare(left.timeRange.endAt)),
    };
  }

  for (const event of filteredEvents) {
    const title = getMemoryEventThemeTitle(event);
    const key = `${event.sourceType}:${title.toLowerCase()}`;
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
        const normalizedTitle = getMemoryEventThemeTitle(firstEvent);
        const title = firstEvent.sourceType.includes('browser')
          ? formatThemeTitleForDisplay(normalizedTitle)
          : normalizedTitle;

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
