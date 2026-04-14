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
  formationReasons: string[];
  compressedSourceCount: number;
  discardedSourceRefs: Array<{
    id: string;
    sourceType: string;
    timestamp: string;
    title?: string;
    url?: string;
    role: EventDescriptor['role'];
  }>;
  discardReasons: string[];
}

interface EventDescriptor {
  event: MemoryEvent;
  host: string;
  url?: string;
  title?: string;
  role: 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'web';
  tokens: string[];
  salientTokens: string[];
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
  'focus',
  'session',
  'work',
  'tree',
  'blob',
  'search',
  'query',
  'localhost',
  'general',
  'task',
  'overview',
  'implementation',
  'verify',
  'verification',
  'check',
  'checks',
  'checklist',
  'notes',
  'status',
  'issue',
  'patch',
  'review',
  'rollout',
  'release',
  'summary',
  'steps',
  'guide',
  'plan',
  'google',
  'results',
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
      discardedSourceRefs:
        group.discardedSourceRefs.length > 0 ? [...group.discardedSourceRefs] : undefined,
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
      formationReasons: [...group.formationReasons],
      compressedSourceCount: group.compressedSourceCount,
      discardReasons:
        group.discardReasons.length > 0 ? [...group.discardReasons] : undefined,
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
    candidateSourceRefs: candidate.sourceRefs,
    candidateFormationReasons: candidate.formationReasons,
    candidateTimeRange: candidate.timeRange,
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

    if ((candidate.compressedSourceCount ?? 0) > 0) {
      supportingReasons.push(
        `The candidate absorbed ${candidate.compressedSourceCount} low-evidence visit${
          candidate.compressedSourceCount === 1 ? '' : 's'
        } to keep the daily review list under 10 tasks.`,
      );
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
    const previousHosts = targetGroup.hosts;
    targetGroup.hosts = Array.from(
      new Set([...targetGroup.hosts, descriptor.host]),
    ).sort();

    // Add formation reason for cross-host merging
    if (previousHosts.length < targetGroup.hosts.length) {
      // This merge added a new host
      const newHost = descriptor.host;
      const crossHostReason = `Cross-host task grouping: ${newHost} pages support the same task as ${previousHosts.join(', ')} pages.`;
      targetGroup.formationReasons.push(crossHostReason);
    }

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
      salientTokens: [] as string[],
    };
  });

  // For small event sets (<= 6 events), allow highly-shared tokens as salient
  // This ensures core task keywords like "authentication" are preserved even if they appear in many events
  const minShared = 2;
  const maxCommonCount =
    memoryEvents.length <= 6
      ? Math.ceil(memoryEvents.length * 0.8) // Allow tokens shared across 80% of events
      : Math.max(2, Math.ceil(memoryEvents.length / 3));

  return baseDescriptors.map((descriptor) => ({
    ...descriptor,
    salientTokens: descriptor.tokens.filter((token) => {
      const count = tokenCounts.get(token) ?? 0;
      return count >= minShared && count <= maxCommonCount;
    }),
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
  const pageTextTokens = extractRepeatedPageTextTokens(
    input.pageText ?? '',
    new Set([...titleTokens, ...pageTitleTokens]),
  ).slice(0, 40);
  const fallbackUrlTokens =
    titleTokens.length === 0 && pageTitleTokens.length === 0 && pageTextTokens.length === 0
      ? input.url === undefined
        ? []
        : extractTokens(input.url)
      : [];
  const fallbackHostTokens =
    titleTokens.length === 0 && pageTitleTokens.length === 0 && pageTextTokens.length === 0
      ? extractTokens(input.host)
      : [];

  return Array.from(
    new Set([
      ...titleTokens,
      ...pageTitleTokens,
      ...pageTextTokens,
      ...fallbackUrlTokens,
      ...fallbackHostTokens,
    ]),
  );
}

function extractRepeatedPageTextTokens(
  value: string,
  titleTokens: Set<string>,
): string[] {
  const rawTokens = extractTokens(value);
  const counts = new Map<string, number>();

  for (const token of rawTokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  // Keep tokens that:
  // 1. Appear multiple times in this page text (repeated within page)
  // 2. Appear in title/pageTitle (strong relevance signal)
  // 3. Are short (3-4 char) technical-looking keywords
  //    - Avoid common English words by checking if they appear in technical contexts
  //    - Technical keywords often appear in URLs, titles, or are repeated
  return rawTokens.filter((token) => {
    const count = counts.get(token) ?? 0;
    const isRepeated = count >= 2;
    const isInTitle = titleTokens.has(token);

    // Short keyword heuristic: 3-4 chars, appears at least once
    // But exclude obviously non-technical common words
    const COMMON_ENGLISH_WORDS = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'had', 'her', 'was', 'one', 'our', 'out', 'has', 'his', 'had',
      'see', 'now', 'way', 'may', 'day', 'get', 'new', 'its', 'who',
      'them', 'did', 'own', 'how', 'why', 'ask', 'any', 'too', 'use',
      'due', 'top', 'two', 'she', 'yes', 'near', 'far', 'here', 'there',
    ]);

    const isShortKeyword = token.length >= 3 && token.length <= 4 && count >= 1 && !COMMON_ENGLISH_WORDS.has(token);

    return isRepeated || isInTitle || isShortKeyword;
  });
}

function extractTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((part) => part.length >= 3)
    .filter((part) => !TOKEN_STOP_WORDS.has(part));
}

function createCandidateGroup(descriptor: EventDescriptor): CandidateStreamGroup {
  const taskTokens = descriptor.salientTokens.length > 0
    ? descriptor.salientTokens
    : descriptor.tokens.slice(0, 3);
  const hosts = [descriptor.host];

  return {
    key: `${sanitizeForId(descriptor.host)}:${sanitizeForId(taskTokens.join('-') || 'general')}`,
    theme: createTaskTheme(taskTokens, hosts),
    title: createTaskTitle(taskTokens, hosts),
    memoryEvents: [descriptor.event],
    taskTokens,
    hosts,
    formationReasons: [
      `Started from ${descriptor.role} evidence on ${toTitleCase(taskTokens.join(' ') || descriptor.host)}.`,
    ],
    compressedSourceCount: 0,
    discardedSourceRefs: [],
    discardReasons: [],
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

  // Sort by frequency first, then alphabetically
  // But prioritize tokens that are not pure numbers (more semantic)
  return [...counts.entries()]
    .sort((left, right) => {
      // Primary: higher frequency
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      // Secondary: prefer non-numeric tokens (more semantic meaning)
      const leftIsNumeric = /^\d+$/.test(left[0]);
      const rightIsNumeric = /^\d+$/.test(right[0]);

      if (!leftIsNumeric && rightIsNumeric) {
        return -1; // Prefer left (non-numeric)
      }

      if (leftIsNumeric && !rightIsNumeric) {
        return 1; // Prefer right (non-numeric)
      }

      // Tertiary: alphabetical order
      return left[0].localeCompare(right[0]);
    })
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
  const salientOverlap = descriptor.salientTokens.filter((token) =>
    groupTokens.has(token),
  ).length;
  const anyOverlap = descriptor.tokens.filter((token) => groupTokens.has(token)).length;

  // Semantic similarity is the primary factor - salient tokens are task-specific keywords
  // High salient overlap (>= 2) indicates strong task relationship
  if (salientOverlap >= 2) {
    // Strong semantic match - allow cross-host merging
    return salientOverlap * 5 + anyOverlap * 2 + 3; // Base score 3 ensures merge
  }

  // For weaker semantic matches, consider other factors
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
          salientOverlap > 0
        ? 1
        : 0;
  const groupEnd = group.memoryEvents[group.memoryEvents.length - 1]?.timestamp ?? '';
  const minutesGap = getDurationMinutes(groupEnd, descriptor.event.timestamp);
  const timeBonus = minutesGap <= 120 ? 1 : 0;
  const supportingOnlyDescriptor =
    descriptor.role === 'search' || descriptor.role === 'chat';

  if (supportingOnlyDescriptor && salientOverlap === 0 && anyOverlap === 0) {
    return 0;
  }

  // For moderate semantic overlap, same host helps but is not decisive
  // This prevents over-merging different tasks on same host when semantic similarity is weak
  return salientOverlap * 4 + anyOverlap * 2 + sameHost + roleBonus + timeBonus;
}

function limitCandidateGroups(
  groups: CandidateStreamGroup[],
  maxCount: number,
): CandidateStreamGroup[] {
  const limitedGroups = [...groups];

  while (limitedGroups.length > maxCount) {
    limitedGroups.sort(compareGroupsForCompression);

    const mergeIndex = limitedGroups.findIndex((group) =>
      classifyGroupForCompression(group) !== 'keep',
    );
    const groupToMerge =
      mergeIndex === -1
        ? limitedGroups.shift()
        : limitedGroups.splice(mergeIndex, 1)[0];

    if (groupToMerge === undefined || limitedGroups.length === 0) {
      break;
    }

    const mergeCandidates = limitedGroups
      .map((group) => ({
        group,
        score: scoreGroupSimilarity(group, groupToMerge),
      }))
      .sort((left, right) => right.score - left.score);
    const mergeTarget = mergeCandidates[0]?.group ?? limitedGroups[0];
    const mergeScore = mergeCandidates[0]?.score ?? 0;
    const compressionAction = decideCompressionAction(groupToMerge, mergeScore);

    if (compressionAction === 'discard') {
      attachDiscardDiagnostics(mergeTarget, groupToMerge);
      continue;
    }

    mergeTarget.memoryEvents.push(...groupToMerge.memoryEvents);
    mergeTarget.memoryEvents.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    mergeTarget.hosts = Array.from(
      new Set([...mergeTarget.hosts, ...groupToMerge.hosts]),
    ).sort();
    mergeTarget.taskTokens = summarizeTaskTokens(mergeTarget.memoryEvents);
    mergeTarget.title = createTaskTitle(mergeTarget.taskTokens, mergeTarget.hosts);
    mergeTarget.theme = createTaskTheme(mergeTarget.taskTokens, mergeTarget.hosts);
    mergeTarget.compressedSourceCount += groupToMerge.memoryEvents.length;
    mergeTarget.formationReasons.push(
      `This candidate absorbed ${groupToMerge.memoryEvents.length} low-evidence visit${
        groupToMerge.memoryEvents.length === 1 ? '' : 's'
      } from ${groupToMerge.title} to stay within the 10-task daily review limit.`,
    );
  }

  return limitedGroups.sort(
    (left, right) =>
      left.memoryEvents[0]?.timestamp.localeCompare(right.memoryEvents[0]?.timestamp ?? '') ?? 0,
  );
}

function attachDiscardDiagnostics(
  targetGroup: CandidateStreamGroup,
  discardedGroup: CandidateStreamGroup,
): void {
  const discardedSourceRefs = discardedGroup.memoryEvents.map((event) => ({
    id: event.id,
    sourceType: event.sourceType,
    timestamp: event.timestamp,
    title: typeof event.content.title === 'string' ? event.content.title : undefined,
    url: typeof event.content.url === 'string' ? event.content.url : undefined,
    role: inferPageRole({
      url: typeof event.content.url === 'string' ? event.content.url : undefined,
      title: typeof event.content.title === 'string' ? event.content.title : undefined,
    }),
  }));

  targetGroup.discardedSourceRefs.push(...discardedSourceRefs);
  targetGroup.discardReasons.push(
    `Excluded ${discardedGroup.memoryEvents.length} low-evidence page${
      discardedGroup.memoryEvents.length === 1 ? '' : 's'
    } near this task because ${discardedGroup.title} did not share enough task evidence to stand alone.`,
  );
}

function decideCompressionAction(
  group: CandidateStreamGroup,
  mergeScore: number,
): 'discard' | 'merge' {
  const classification = classifyGroupForCompression(group);

  if (classification === 'discard') {
    return mergeScore >= 4 ? 'merge' : 'discard';
  }

  return 'merge';
}

function scoreGroupSimilarity(
  left: CandidateStreamGroup,
  right: CandidateStreamGroup,
): number {
  const leftTokens = new Set(left.taskTokens);
  const sharedTokens = right.taskTokens.filter((token) => leftTokens.has(token)).length;
  const sharedHosts = right.hosts.filter((host) => left.hosts.includes(host)).length;
  const leftRoles = new Set(buildGroupRoles(left));
  const rightRoles = new Set(buildGroupRoles(right));
  const supportingOnlyRight = [...rightRoles].every(
    (role) => role === 'search' || role === 'chat',
  );
  const leftHasPrimary = [...leftRoles].some(
    (role) => role !== 'search' && role !== 'chat',
  );
  const roleBonus = supportingOnlyRight && leftHasPrimary && sharedTokens > 0 ? 2 : 0;
  const timeDistance = Math.abs(
    getDurationMinutes(
      left.memoryEvents[left.memoryEvents.length - 1]?.timestamp ?? '',
      right.memoryEvents[0]?.timestamp ?? '',
    ),
  );
  const timeBonus = timeDistance <= 180 ? 1 : 0;

  return sharedTokens * 4 + sharedHosts * 2 + roleBonus + timeBonus;
}

function compareGroupsForCompression(
  left: CandidateStreamGroup,
  right: CandidateStreamGroup,
): number {
  return (
    getCompressionStrength(left) - getCompressionStrength(right) ||
    left.memoryEvents.length - right.memoryEvents.length ||
    getDurationMinutes(
      left.memoryEvents[0]?.timestamp ?? '',
      left.memoryEvents[left.memoryEvents.length - 1]?.timestamp ?? '',
    ) -
      getDurationMinutes(
        right.memoryEvents[0]?.timestamp ?? '',
        right.memoryEvents[right.memoryEvents.length - 1]?.timestamp ?? '',
      )
  );
}

function classifyGroupForCompression(
  group: CandidateStreamGroup,
): 'discard' | 'merge' | 'keep' {
  const roles = buildGroupRoles(group);
  const primaryCount = roles.filter((role) => role !== 'search' && role !== 'chat').length;
  const eventCount = group.memoryEvents.length;
  const strongPrimaryRole = roles.some(
    (role) => role === 'issue' || role === 'pull-request' || role === 'debug',
  );
  const supportOnly = roles.every((role) => role === 'search' || role === 'chat');
  const durationMinutes = getDurationMinutes(
    group.memoryEvents[0]?.timestamp ?? '',
    group.memoryEvents[group.memoryEvents.length - 1]?.timestamp ?? '',
  );

  if (supportOnly && eventCount === 1) {
    return 'discard';
  }

  if (supportOnly && eventCount <= 2 && durationMinutes <= 5 && group.taskTokens.length < 3) {
    return 'discard';
  }

  if (primaryCount >= 2 || strongPrimaryRole || (primaryCount >= 1 && eventCount >= 2)) {
    return 'keep';
  }

  return 'merge';
}

function getCompressionStrength(group: CandidateStreamGroup): number {
  const roles = buildGroupRoles(group);
  const primaryCount = roles.filter((role) => role !== 'search' && role !== 'chat').length;
  const eventCount = group.memoryEvents.length;
  const durationMinutes = getDurationMinutes(
    group.memoryEvents[0]?.timestamp ?? '',
    group.memoryEvents[group.memoryEvents.length - 1]?.timestamp ?? '',
  );

  return primaryCount * 6 + eventCount * 3 + group.taskTokens.length * 2 + Math.min(durationMinutes, 60) / 15;
}

function buildGroupRoles(
  group: CandidateStreamGroup,
): Array<EventDescriptor['role']> {
  return group.memoryEvents.map((event) =>
    inferPageRole({
      url: typeof event.content.url === 'string' ? event.content.url : undefined,
      title: typeof event.content.title === 'string' ? event.content.title : undefined,
    }),
  );
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
