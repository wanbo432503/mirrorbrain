import type {
  CandidateReviewSuggestion,
  CandidateMemory,
  MemoryEvent,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface CreateCandidateMemoriesInput {
  reviewDate: string;
  reviewTimeZone?: string;
  memoryEvents: MemoryEvent[];
}

interface ReviewCandidateMemoryInput {
  decision: ReviewedMemory['decision'];
  reviewedAt: string;
}

interface CandidateStreamGroup {
  key: string;
  theme: string;
  title: string;
  memoryEvents: MemoryEvent[];
  taskTokens: string[];
  hosts: string[];
}

interface EventDescriptor {
  event: MemoryEvent;
  host: string;
  url?: string;
  title?: string;
  role: 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web';
  tokens: string[];
  repeatedTokens: string[];
}

const MAX_DAILY_CANDIDATES = 10;
const TOKEN_STOP_WORDS = new Set([
  'http',
  'https',
  'www',
  'com',
  'net',
  'org',
  'html',
  'index',
  'home',
  'page',
  'detail',
  'after',
  'and',
  'browser',
  'example',
  'docs',
  'guide',
  'guides',
  'github',
  'issues',
  'sync',
  'pull',
  'tree',
  'blob',
  'search',
  'query',
  'localhost',
  'general',
  'task',
  'overview',
]);

export function createCandidateMemories(
  input: CreateCandidateMemoriesInput,
): CandidateMemory[] {
  const reviewTimeZone = input.reviewTimeZone;
  const dailyEvents = input.memoryEvents
    .filter((event) =>
      getCalendarDateForComparison(event.timestamp, reviewTimeZone) ===
      input.reviewDate,
    )
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  if (dailyEvents.length === 0) {
    throw new Error(`No memory events found for review date ${input.reviewDate}.`);
  }

  const groups = Array.from(groupEventsByStream(dailyEvents).values());
  const limitedGroups = limitCandidateGroups(groups, MAX_DAILY_CANDIDATES);
  const stableKeys = assignStableGroupKeys(limitedGroups);

  return limitedGroups.map((group, index) => {
    const sortedEvents = [...group.memoryEvents].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    );

    return {
      id: `candidate:${input.reviewDate}:${stableKeys[index]}`,
      memoryEventIds: sortedEvents.map((event) => event.id),
      sourceRefs: sortedEvents.map((event) => ({
        role: inferPageRole({
          url: typeof event.content.url === 'string' ? event.content.url : undefined,
          title: typeof event.content.title === 'string' ? event.content.title : undefined,
        }),
        contribution: inferSourceContribution(
          inferPageRole({
            url: typeof event.content.url === 'string' ? event.content.url : undefined,
            title: typeof event.content.title === 'string' ? event.content.title : undefined,
          }),
        ),
        id: event.id,
        sourceType: event.sourceType,
        timestamp: event.timestamp,
        title: typeof event.content.title === 'string' ? event.content.title : undefined,
        url: typeof event.content.url === 'string' ? event.content.url : undefined,
      })),
      title: group.title,
      summary: createCandidateSummary({
        title: group.title,
        eventCount: sortedEvents.length,
        hostCount: new Set(group.hosts).size,
        durationMinutes: getDurationMinutes(
          sortedEvents[0]?.timestamp ?? '',
          sortedEvents[sortedEvents.length - 1]?.timestamp ?? '',
        ),
      }),
      theme: group.theme,
      reviewDate: input.reviewDate,
      timeRange: {
        startAt: sortedEvents[0]?.timestamp ?? '',
        endAt: sortedEvents[sortedEvents.length - 1]?.timestamp ?? '',
      },
      reviewState: 'pending',
    };
  });
}

export function reviewCandidateMemory(
  candidate: CandidateMemory,
  input: ReviewCandidateMemoryInput,
): ReviewedMemory {
  return {
    id: `reviewed:${candidate.id}`,
    candidateMemoryId: candidate.id,
    candidateTitle: candidate.title,
    candidateSummary: candidate.summary,
    candidateTheme: candidate.theme,
    memoryEventIds: candidate.memoryEventIds,
    reviewDate: candidate.reviewDate,
    decision: input.decision,
    reviewedAt: input.reviewedAt,
  };
}

export function suggestCandidateReviews(
  candidates: CandidateMemory[],
): CandidateReviewSuggestion[] {
  return candidates.map((candidate) => {
    const primarySourceCount = (candidate.sourceRefs ?? []).filter(
      (source) => source.contribution !== 'supporting',
    ).length;
    const supportingSourceCount = (candidate.sourceRefs ?? []).filter(
      (source) => source.contribution === 'supporting',
    ).length;
    const evidenceSummary = `Built from ${primarySourceCount} primary page${
      primarySourceCount === 1 ? '' : 's'
    } and ${supportingSourceCount} supporting page${
      supportingSourceCount === 1 ? '' : 's'
    }.`;
    const uniqueHosts = new Set(
      (candidate.sourceRefs ?? [])
        .map((source) => source.url)
        .filter((url): url is string => typeof url === 'string')
        .map((url) => {
          try {
            return new URL(url).host;
          } catch {
            return 'unknown';
          }
        }),
    ).size;
    const durationMinutes = getDurationMinutes(
      candidate.timeRange.startAt,
      candidate.timeRange.endAt,
    );
    const keepScore = Math.min(
      100,
      Math.round(
        28 +
          candidate.memoryEventIds.length * 18 +
          Math.min(durationMinutes, 120) / 2 +
          (uniqueHosts > 1 ? 8 : 0),
      ),
    );
    const supportingReasons = [
      `${candidate.memoryEventIds.length} related visits were grouped into one task.`,
      `The task lasted about ${Math.max(1, durationMinutes)} minutes.`,
    ];

    if (uniqueHosts > 1) {
      supportingReasons.push(`The task spans ${uniqueHosts} related hosts.`);
    }

    if (keepScore >= 70) {
      return {
        candidateMemoryId: candidate.id,
        recommendation: 'keep',
        confidenceScore: Math.min(0.95, keepScore / 100),
        keepScore,
        primarySourceCount,
        supportingSourceCount,
        evidenceSummary,
        priorityScore: candidate.memoryEventIds.length + durationMinutes / 30,
        rationale:
          'This candidate has enough repeated and sustained activity to preserve as a meaningful work item.',
        supportingReasons,
      };
    }

    if (keepScore < 40) {
      return {
        candidateMemoryId: candidate.id,
        recommendation: 'discard',
        confidenceScore: Math.min(0.9, (100 - keepScore) / 100),
        keepScore,
        primarySourceCount,
        supportingSourceCount,
        evidenceSummary,
        priorityScore: candidate.memoryEventIds.length,
        rationale:
          'This candidate looks too small or short-lived to justify keeping without more supporting evidence.',
        supportingReasons,
      };
    }

    return {
      candidateMemoryId: candidate.id,
      recommendation: 'review',
      confidenceScore: 0.55,
      keepScore,
      primarySourceCount,
      supportingSourceCount,
      evidenceSummary,
      priorityScore: candidate.memoryEventIds.length + durationMinutes / 60,
      rationale:
        'This candidate may be useful, but the evidence is moderate enough that it should stay in human review.',
      supportingReasons,
    };
  });
}

function groupEventsByStream(
  memoryEvents: MemoryEvent[],
): Map<string, CandidateStreamGroup> {
  const descriptors = buildEventDescriptors(memoryEvents);
  const groups: CandidateStreamGroup[] = [];

  for (const descriptor of descriptors) {
    const targetGroup = selectBestGroup(groups, descriptor);

    if (targetGroup === null) {
      groups.push(createCandidateGroup(descriptor));
      continue;
    }

    targetGroup.memoryEvents.push(descriptor.event);
    targetGroup.taskTokens = summarizeTaskTokens(targetGroup.memoryEvents);
    targetGroup.hosts = Array.from(
      new Set([...targetGroup.hosts, descriptor.host]),
    ).sort();
    targetGroup.title = createTaskTitle(targetGroup.taskTokens, targetGroup.hosts);
    targetGroup.theme = createTaskTheme(targetGroup.taskTokens, targetGroup.hosts);
  }

  return new Map(groups.map((group) => [group.key, group]));
}

function buildEventDescriptors(memoryEvents: MemoryEvent[]): EventDescriptor[] {
  const tokenCounts = new Map<string, number>();
  const baseDescriptors = memoryEvents.map((event) => {
    const url =
      typeof event.content.url === 'string' ? event.content.url : undefined;
    const title =
      typeof event.content.title === 'string' ? event.content.title : undefined;
    const pageTitle =
      typeof event.content.pageTitle === 'string'
        ? event.content.pageTitle
        : undefined;
    const pageText =
      typeof event.content.pageText === 'string' ? event.content.pageText : undefined;
    const host = getEventHost(url);
    const role = inferPageRole({ url, title });
    const tokens = extractEventTokens({ url, title, pageTitle, pageText, host });

    for (const token of new Set(tokens)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }

    return {
      event,
      host,
      url,
      title,
      role,
      tokens,
      repeatedTokens: [] as string[],
    };
  });

  return baseDescriptors.map((descriptor) => ({
    ...descriptor,
    repeatedTokens: descriptor.tokens.filter(
      (token) => (tokenCounts.get(token) ?? 0) >= 2,
    ),
  }));
}

function createCandidateSummary(input: {
  title: string;
  eventCount: number;
  hostCount: number;
  durationMinutes: number;
}): string {
  const eventLabel = input.eventCount === 1 ? 'browser event' : 'browser events';
  const hostLabel = input.hostCount === 1 ? 'one site' : `${input.hostCount} sites`;
  return `${input.eventCount} ${eventLabel} connected to ${input.title} across ${hostLabel} over about ${Math.max(1, input.durationMinutes)} minutes.`;
}

function getEventHost(url?: string): string {
  if (!url) {
    return 'unknown-source';
  }

  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return 'unknown-source';
  }
}

function extractEventTokens(input: {
  url?: string;
  title?: string;
  pageTitle?: string;
  pageText?: string;
  host: string;
}): string[] {
  const titleTokens = extractTokens(input.title ?? '');
  const pageTitleTokens = extractTokens(input.pageTitle ?? '');
  const pageTextTokens = extractTokens(input.pageText ?? '').slice(0, 40);
  const urlTokens = input.url === undefined ? [] : extractTokens(input.url);
  const hostTokens = extractTokens(input.host);

  return Array.from(
    new Set([
      ...titleTokens,
      ...pageTitleTokens,
      ...pageTextTokens,
      ...urlTokens,
      ...hostTokens,
    ]),
  );
}

function extractTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((part) => part.length >= 3)
    .filter((part) => !TOKEN_STOP_WORDS.has(part));
}

function createCandidateGroup(descriptor: EventDescriptor): CandidateStreamGroup {
  const taskTokens = descriptor.repeatedTokens.length > 0
    ? descriptor.repeatedTokens
    : descriptor.tokens.slice(0, 3);
  const hosts = [descriptor.host];

  return {
    key: `${sanitizeForId(descriptor.host)}:${sanitizeForId(taskTokens.join('-') || 'general')}`,
    theme: createTaskTheme(taskTokens, hosts),
    title: createTaskTitle(taskTokens, hosts),
    memoryEvents: [descriptor.event],
    taskTokens,
    hosts,
  };
}

function createTaskTitle(taskTokens: string[], hosts: string[]): string {
  if (taskTokens.length === 0) {
    return `Work on ${toTitleCase(hosts[0] ?? 'General Task')}`;
  }

  return `Work on ${toTitleCase(taskTokens.slice(0, 3).join(' '))}`;
}

function createTaskTheme(taskTokens: string[], hosts: string[]): string {
  if (taskTokens.length === 0) {
    return `${hosts[0] ?? 'unknown-source'} / general`;
  }

  return taskTokens.slice(0, 3).join(' / ');
}

function summarizeTaskTokens(memoryEvents: MemoryEvent[]): string[] {
  const counts = new Map<string, number>();

  for (const event of memoryEvents) {
    const url =
      typeof event.content.url === 'string' ? event.content.url : undefined;
    const title =
      typeof event.content.title === 'string' ? event.content.title : undefined;
    const pageTitle =
      typeof event.content.pageTitle === 'string'
        ? event.content.pageTitle
        : undefined;
    const pageText =
      typeof event.content.pageText === 'string' ? event.content.pageText : undefined;
    const host = getEventHost(url);

    for (const token of extractEventTokens({ url, title, pageTitle, pageText, host })) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([token]) => token);
}

function selectBestGroup(
  groups: CandidateStreamGroup[],
  descriptor: EventDescriptor,
): CandidateStreamGroup | null {
  let bestGroup: CandidateStreamGroup | null = null;
  let bestScore = 0;

  for (const group of groups) {
    const score = scoreDescriptorAgainstGroup(group, descriptor);

    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  }

  return bestScore >= 3 ? bestGroup : null;
}

function scoreDescriptorAgainstGroup(
  group: CandidateStreamGroup,
  descriptor: EventDescriptor,
): number {
  const groupTokens = new Set(group.taskTokens);
  const repeatedOverlap = descriptor.repeatedTokens.filter((token) =>
    groupTokens.has(token),
  ).length;
  const anyOverlap = descriptor.tokens.filter((token) => groupTokens.has(token)).length;
  const sameHost = group.hosts.includes(descriptor.host) ? 1 : 0;
  const groupRoles = new Set(
    group.memoryEvents.map((event) =>
      inferPageRole({
        url: typeof event.content.url === 'string' ? event.content.url : undefined,
        title: typeof event.content.title === 'string' ? event.content.title : undefined,
      }),
    ),
  );
  const sameRole = groupRoles.has(descriptor.role);
  const hasPrimaryRole = [...groupRoles].some(
    (role) => role !== 'search' && role !== 'chat',
  );
  const roleBonus =
    sameRole && anyOverlap > 0
      ? 1
      : (descriptor.role === 'search' || descriptor.role === 'chat') &&
          hasPrimaryRole &&
          repeatedOverlap > 0
        ? 1
        : 0;
  const groupEnd = group.memoryEvents[group.memoryEvents.length - 1]?.timestamp ?? '';
  const minutesGap = getDurationMinutes(groupEnd, descriptor.event.timestamp);
  const timeBonus = minutesGap <= 120 ? 1 : 0;

  return repeatedOverlap * 4 + anyOverlap * 2 + sameHost + roleBonus + timeBonus;
}

function limitCandidateGroups(
  groups: CandidateStreamGroup[],
  maxCount: number,
): CandidateStreamGroup[] {
  const limitedGroups = [...groups];

  while (limitedGroups.length > maxCount) {
    limitedGroups.sort(
      (left, right) =>
        left.memoryEvents.length - right.memoryEvents.length ||
        getDurationMinutes(
          left.memoryEvents[0]?.timestamp ?? '',
          left.memoryEvents[left.memoryEvents.length - 1]?.timestamp ?? '',
        ) -
          getDurationMinutes(
            right.memoryEvents[0]?.timestamp ?? '',
            right.memoryEvents[right.memoryEvents.length - 1]?.timestamp ?? '',
          ),
    );

    const groupToMerge = limitedGroups.shift();

    if (groupToMerge === undefined || limitedGroups.length === 0) {
      break;
    }

    const mergeTarget =
      limitedGroups
        .map((group) => ({
          group,
          score: scoreGroupSimilarity(group, groupToMerge),
        }))
        .sort((left, right) => right.score - left.score)[0]?.group ??
      limitedGroups[0];

    mergeTarget.memoryEvents.push(...groupToMerge.memoryEvents);
    mergeTarget.memoryEvents.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    mergeTarget.hosts = Array.from(
      new Set([...mergeTarget.hosts, ...groupToMerge.hosts]),
    ).sort();
    mergeTarget.taskTokens = summarizeTaskTokens(mergeTarget.memoryEvents);
    mergeTarget.title = createTaskTitle(mergeTarget.taskTokens, mergeTarget.hosts);
    mergeTarget.theme = createTaskTheme(mergeTarget.taskTokens, mergeTarget.hosts);
  }

  return limitedGroups.sort(
    (left, right) =>
      left.memoryEvents[0]?.timestamp.localeCompare(right.memoryEvents[0]?.timestamp ?? '') ?? 0,
  );
}

function scoreGroupSimilarity(
  left: CandidateStreamGroup,
  right: CandidateStreamGroup,
): number {
  const leftTokens = new Set(left.taskTokens);
  const sharedTokens = right.taskTokens.filter((token) => leftTokens.has(token)).length;
  const sharedHosts = right.hosts.filter((host) => left.hosts.includes(host)).length;

  return sharedTokens * 3 + sharedHosts;
}

function assignStableGroupKeys(groups: CandidateStreamGroup[]): string[] {
  const seen = new Map<string, number>();

  return groups.map((group) => {
    const base = [
      sanitizeForId(group.memoryEvents[0]?.sourceType ?? 'memory'),
      sanitizeForId(group.taskTokens.join('-') || group.hosts[0] || 'general'),
    ].join(':');
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

function getDurationMinutes(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, Math.round((end - start) / (60 * 1000)));
}

function inferPageRole(input: {
  url?: string;
  title?: string;
}): 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web' {
  const url = input.url ?? '';
  const title = (input.title ?? '').toLowerCase();
  const normalized = `${url.toLowerCase()} ${title}`;

  if (normalized.includes('/search?') || normalized.includes('google search')) {
    return 'search';
  }

  if (normalized.includes('chatgpt.com/') || normalized.includes(' claude ') || normalized.includes('/c/')) {
    return 'chat';
  }

  if (normalized.includes('/issues/')) {
    return 'issue';
  }

  if (normalized.includes('/pull/')) {
    return 'pull-request';
  }

  if (normalized.includes('docs.') || normalized.includes('/docs/') || normalized.includes('guide')) {
    return 'docs';
  }

  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'debug';
  }

  if (normalized.includes('github.com/') && !normalized.includes('/issues/') && !normalized.includes('/pull/')) {
    return 'repository';
  }

  if (normalized.includes('/reference/')) {
    return 'reference';
  }

  return 'web';
}

function inferSourceContribution(
  role: 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web',
): 'primary' | 'supporting' {
  if (role === 'search' || role === 'chat') {
    return 'supporting';
  }

  return 'primary';
}

function getCalendarDateForComparison(
  value: string,
  timeZone?: string,
): string {
  if (timeZone === undefined) {
    return [
      new Date(value).getFullYear(),
      String(new Date(value).getMonth() + 1).padStart(2, '0'),
      String(new Date(value).getDate()).padStart(2, '0'),
    ].join('-');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Failed to derive review date for timestamp ${value}.`);
  }

  return `${year}-${month}-${day}`;
}

function sanitizeForId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toTitleCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
