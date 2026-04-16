import type {
  CandidateReviewSuggestion,
  CandidateMemory,
  MemoryEvent,
  ReviewedMemory,
} from '../../shared/types/index.js';
import { generateTitleWithLLM } from '../../shared/llm-title-generation/http-fetch.js';

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
const MAX_SESSION_GAP_MINUTES = 180;
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
  // Common technical terms that appear too often across unrelated pages
  'diff',
  'list',
  'sign',
  'launch',
  'best',
  'step',
  'time',
  'line',
  'file',
  'code',
  'text',
  'data',
  'user',
  'name',
  'type',
  'case',
  'page',
  'form',
  'load',
  'show',
  'hide',
  'call',
  'send',
  'move',
  'copy',
  'save',
  'open',
  'view',
  'edit',
  'test',
  'pass',
  'fail',
  'size',
  'sort',
  'turn',
  'pull',
  'push',
  'wait',
  'read',
  'sync',
  // Pure numeric tokens (digits only)
  // Numbers are filtered during token extraction instead
]);

export async function createCandidateMemories(
  input: CreateCandidateMemoriesInput,
): Promise<CandidateMemory[]> {
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

  const groups = groupEventsByStream(dailyEvents);
  const limitedGroups = limitCandidateGroups(groups, MAX_DAILY_CANDIDATES);
  const stableKeys = assignStableGroupKeys(limitedGroups);

  return await Promise.all(
    limitedGroups.map(async (group, index) => {
      const sortedEvents = [...group.memoryEvents].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp),
      );

      // Prepare LLM context
      const urls = sortedEvents
        .map(e => typeof e.content.url === 'string' ? e.content.url : undefined)
        .filter((url): url is string => url !== undefined);

      const titles = sortedEvents
        .map(e => typeof e.content.title === 'string' ? e.content.title : undefined)
        .filter((title): title is string => title !== undefined);

      const pageContents = sortedEvents
        .map(e => typeof e.content.pageText === 'string' ? e.content.pageText : undefined)
        .filter((content): content is string => content !== undefined);

      // Generate natural language title/summary using LLM
      const llmOutput = await generateTitleWithLLM({
        urls,
        titles,
        pageContents,
        hosts: group.hosts,
        timeRange: {
          startAt: sortedEvents[0]?.timestamp ?? '',
          endAt: sortedEvents[sortedEvents.length - 1]?.timestamp ?? '',
        },
      });

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
        title: llmOutput.title, // Use LLM-generated natural language title
        summary: llmOutput.summary, // Use LLM-generated summary
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
    }),
  );
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

    // Analyze task pattern from page roles
    const pageRoles = (candidate.sourceRefs ?? []).map(source => source.role ?? 'web');
    const uniqueRoles = new Set(pageRoles);
    const primaryRoles = pageRoles.filter(role => role !== 'search' && role !== 'chat');
    const hasIssue = pageRoles.includes('issue');
    const hasPR = pageRoles.includes('pull-request');
    const hasRepo = pageRoles.includes('repository');
    const hasDocs = pageRoles.includes('docs');
    const hasDebug = pageRoles.includes('debug');
    const hasSearch = pageRoles.includes('search');
    const hasReference = pageRoles.includes('reference');

    // Infer task type
    const taskType = inferTaskType({
      hasIssue,
      hasPR,
      hasRepo,
      hasDocs,
      hasDebug,
      hasSearch,
      hasReference,
      pageRoles,
      title: candidate.title,
    });

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

    // Calculate keep score with better differentiation
    // New formula design:
    // - Lower event count weight to avoid premature max scores
    // - Add task type importance weighting
    // - Consider source quality distribution
    // - Use non-linear scoring for high-score range differentiation
    const taskImportanceWeight =
      taskType === 'bug-fix' || taskType === 'feature-implementation' ? 15 :
      taskType === 'code-review' || taskType === 'debugging' ? 10 :
      taskType === 'research' ? 8 :
      0;

    const qualityBonus =
      primarySourceCount >= 4 ? 8 :
      primarySourceCount >= 3 ? 4 :
      0;

    const keepScore = Math.min(
      100,
      Math.round(
        20 +                          // Lower base score (was 28)
        Math.min(candidate.memoryEventIds.length * 6, 30) +    // Lower event count weight (was 18 per event)
        Math.min(durationMinutes, 180) / 4 +      // Duration weight (was /2)
        (uniqueHosts > 1 ? 10 : 0) +               // Cross-host bonus (was 8)
        (primarySourceCount >= 2 ? 12 : 0) +       // Primary source threshold (was 10)
        taskImportanceWeight +                     // Task type importance
        qualityBonus,                              // High-quality source bonus
      ),
    );

    // Generate contextual rationale
    const rationale = generateContextualRationale({
      taskType,
      title: candidate.title,
      durationMinutes,
      primarySourceCount,
      supportingSourceCount,
      uniqueHosts,
      pageRoles: uniqueRoles,
      keepScore,
    });

    // Generate contextual supporting reasons
    const supportingReasons = generateContextualSupportingReasons({
      taskType,
      durationMinutes,
      uniqueHosts,
      primarySourceCount,
      supportingSourceCount,
      pageRoles,
      title: candidate.title,
      compressedSourceCount: candidate.compressedSourceCount ?? 0,
    });

    const evidenceSummary = `Built from ${primarySourceCount} primary page${
      primarySourceCount === 1 ? '' : 's'
    } and ${supportingSourceCount} supporting page${
      supportingSourceCount === 1 ? '' : 's'
    }.`;

    // Recommendation thresholds (adjusted for new scoring algorithm)
    // High-quality work: 70+ (keep)
    // Low-quality noise: <40 (discard)
    // Moderate quality: 40-69 (review)
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
        rationale,
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
        rationale,
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
      rationale,
      supportingReasons,
    };
  });
}

interface TaskTypeInferenceInput {
  hasIssue: boolean;
  hasPR: boolean;
  hasRepo: boolean;
  hasDocs: boolean;
  hasDebug: boolean;
  hasSearch: boolean;
  hasReference: boolean;
  hasShopping: boolean;
  hasEntertainment: boolean;
  hasLearning: boolean;
  hasReading: boolean;
  pageRoles: string[];
  title: string;
}

type TaskType = 'bug-fix' | 'feature-implementation' | 'research' | 'debugging' | 'code-review' | 'shopping' | 'entertainment' | 'learning' | 'reading' | 'general';

function inferTaskType(input: TaskTypeInferenceInput): TaskType {
  const docsRefCount = input.pageRoles.filter(role => role === 'docs' || role === 'reference').length;

  // Shopping: shopping pages present
  if (input.hasShopping) {
    return 'shopping';
  }

  // Entertainment: entertainment pages present (music, video, games)
  if (input.hasEntertainment) {
    return 'entertainment';
  }

  // Learning: learning pages present (courses, tutorials, language)
  if (input.hasLearning) {
    return 'learning';
  }

  // Reading: reading pages present (papers, articles, blogs)
  if (input.hasReading) {
    return 'reading';
  }

  // Code review: issue + PR + repo together is stronger than either signal alone
  if (input.hasIssue && input.hasPR && input.hasRepo) {
    return 'code-review';
  }

  // Bug fix: Issue present (primary debugging indicator)
  if (input.hasIssue) {
    return 'bug-fix';
  }

  // Feature implementation: PR present (primary implementation indicator)
  if (input.hasPR) {
    return 'feature-implementation';
  }

  // Debugging: Localhost/debug pages (active development testing)
  if (input.hasDebug || input.pageRoles.some(role => role === 'debug')) {
    return 'debugging';
  }

  // Research: Docs-heavy pattern (knowledge gathering)
  if (docsRefCount >= 1) {
    return 'research';
  }

  return 'general';
}

interface RationaleGenerationInput {
  taskType: TaskType;
  title: string;
  durationMinutes: number;
  primarySourceCount: number;
  supportingSourceCount: number;
  uniqueHosts: number;
  pageRoles: Set<string>;
  keepScore: number;
}

function generateContextualRationale(input: RationaleGenerationInput): string {
  const durationLabel = input.durationMinutes > 60 ? 'hour' : 'minute';
  const durationValue = input.durationMinutes > 60
    ? Math.round(input.durationMinutes / 60)
    : Math.max(1, input.durationMinutes);

  const actionContext = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');

  switch (input.taskType) {
    case 'bug-fix':
      const bugRationale = input.keepScore >= 70
        ? `Fixed a blocking bug in ${actionContext}. Spent ${durationValue} ${durationLabel}${durationValue === 1 ? '' : 's'} debugging across issue tracking and documentation.`
        : `Investigated bug in ${actionContext} but may need more context to confirm significance.`;
      return bugRationale;

    case 'feature-implementation':
      const implRationale = input.keepScore >= 70
        ? `Implemented new feature: ${actionContext}. Cross-host work between GitHub and documentation indicates end-to-end implementation.`
        : `Started feature work on ${actionContext} but scope unclear from available evidence.`;
      return implRationale;

    case 'research':
      const researchRationale = input.keepScore >= 70
        ? `Research session on ${actionContext}. Documentation-heavy pattern suggests knowledge gathering for upcoming implementation work.`
        : `Brief documentation lookup on ${actionContext}. May be reference check rather than dedicated research.`;
      return researchRationale;

    case 'debugging':
      const debugRationale = input.keepScore >= 70
        ? `Debugging session for ${actionContext}. Localhost activity + docs lookup indicates active troubleshooting with reference support.`
        : `Quick debugging check on ${actionContext}. May be routine testing rather than significant issue.`;
      return debugRationale;

    case 'code-review':
      const reviewRationale = input.keepScore >= 70
        ? `Code review of ${actionContext}. Issue + PR + repo pattern suggests thorough change review workflow.`
        : `Partial review of ${actionContext}. Limited engagement may be quick check rather than thorough review.`;
      return reviewRationale;

    default:
      const generalRationale = input.keepScore >= 70
        ? `Worked on ${actionContext} for ${durationValue} ${durationLabel}${durationValue === 1 ? '' : 's'} across ${input.uniqueHosts} related source${input.uniqueHosts === 1 ? '' : 's'}. Sustained activity suggests meaningful work session.`
        : `Brief activity on ${actionContext}. Short duration suggests quick reference or navigation.`;
      return generalRationale;
  }
}

interface SupportingReasonsInput {
  taskType: TaskType;
  durationMinutes: number;
  uniqueHosts: number;
  primarySourceCount: number;
  supportingSourceCount: number;
  pageRoles: string[];
  title: string;
  compressedSourceCount: number;
}

function generateContextualSupportingReasons(input: SupportingReasonsInput): string[] {
  const reasons: string[] = [];

  // Task-specific pattern explanation
  switch (input.taskType) {
    case 'bug-fix':
      reasons.push('Issue page + documentation pattern indicates debugging session.');
      if (input.uniqueHosts > 1) {
        reasons.push(`Cross-host investigation (${input.uniqueHosts} sources) suggests thorough bug analysis.`);
      }
      break;

    case 'feature-implementation':
      reasons.push('PR + documentation combination suggests implementation work with reference research.');
      if (input.uniqueHosts > 1) {
        reasons.push('Cross-host work indicates end-to-end feature development.');
      }
      break;

    case 'research':
      reasons.push('Documentation-heavy pattern indicates knowledge gathering phase.');
      if (input.supportingSourceCount > 0) {
        reasons.push('Multiple documentation sources suggest comprehensive research.');
      }
      break;

    case 'debugging':
      if (input.pageRoles.includes('debug')) {
        reasons.push('Localhost pages indicate active development testing.');
      }
      if (input.pageRoles.includes('docs')) {
        reasons.push('Docs lookup during debugging suggests reference-guided troubleshooting.');
      }
      break;

    case 'code-review':
      reasons.push('Issue + PR + repository pattern indicates review workflow.');
      break;

    default:
      if (input.primarySourceCount >= 2) {
        reasons.push(`Multiple primary pages suggest focused work session.`);
      }
      if (input.uniqueHosts > 1) {
        reasons.push(`Work spanned ${input.uniqueHosts} related sources.`);
      }
  }

  // Duration significance
  const durationValue = Math.max(1, input.durationMinutes);
  if (durationValue >= 30) {
    reasons.push(`${durationValue} minutes${durationValue >= 60 ? ' (' + Math.round(durationValue / 60) + ' hour)' : ''} of focused work.`);
  } else if (durationValue < 10) {
    reasons.push('Short duration suggests quick reference or navigation.');
  }

  // Compressed evidence explanation
  if (input.compressedSourceCount > 0) {
    reasons.push(
      `Absorbed ${input.compressedSourceCount} low-evidence visit${input.compressedSourceCount === 1 ? '' : 's'} to keep daily review under 10 tasks.`,
    );
  }

  return reasons;
}

function groupEventsByStream(
  memoryEvents: MemoryEvent[],
): CandidateStreamGroup[] {
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

    targetGroup.title = createTaskTitle(
      targetGroup.memoryEvents,
      targetGroup.taskTokens,
      targetGroup.hosts,
    );
    targetGroup.theme = createTaskTheme(targetGroup.taskTokens, targetGroup.hosts);
  }

  return groups;
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
    const tokens = extractEventTokens({ url, title, pageTitle, pageText, host, role });

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
  // Infer task action from the title structure
  // Extract action verb if present
  const titleLower = input.title.toLowerCase();

  const actionVerbs = {
    'fix': 'Fixed',
    'implement': 'Implemented',
    'debug': 'Debugged',
    'review': 'Reviewed',
    'build': 'Built',
    'update': 'Updated',
    'add': 'Added',
    'remove': 'Removed',
    'refactor': 'Refactored',
    'optimize': 'Optimized',
    'test': 'Tested',
    'deploy': 'Deployed',
    'configure': 'Configured',
    'integrate': 'Integrated',
    'document': 'Documented',
    'migrate': 'Migrated',
    'upgrade': 'Upgraded',
    'release': 'Released',
    'monitor': 'Monitored',
    'analyze': 'Analyzed',
    // New activity verbs
    'shop': 'Shopped',
    'buy': 'Bought',
    'purchase': 'Purchased',
    'enjoy': 'Enjoyed',
    'watch': 'Watched',
    'listen': 'Listened',
    'play': 'Played',
    'learn': 'Learned',
    'study': 'Studied',
    'read': 'Read',
    'browse': 'Browsed',
  };

  // Try to match action verb from title start
  const matchedAction = Object.entries(actionVerbs).find(([verb]) =>
    titleLower.startsWith(verb + ' ') || titleLower.startsWith(verb)
  );

  if (matchedAction) {
    // Use past tense action verb
    const [_, pastTense] = matchedAction;
    // Extract task topic (remaining title after action verb)
    const topicMatch = titleLower.match(new RegExp(`^${matchedAction[0]}\\s+(.+)$`));
    const topic = topicMatch ? topicMatch[1] : input.title.slice(matchedAction[0].length).trim();

    return `${pastTense} ${toTitleCase(topic)} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // Fallback: infer action from task context keywords
  // Check for documentation/research tasks
  const isResearchTask = titleLower.includes('documentation') ||
    titleLower.includes('docs') ||
    titleLower.includes('api') ||
    titleLower.includes('guide') ||
    titleLower.includes('reference') ||
    titleLower.includes('tutorial');

  if (isResearchTask) {
    // Remove "work on" prefix if present
    const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
    const hostDescription = input.hostCount > 1
      ? ` from ${input.hostCount} sources`
      : '';

    return `Reviewed ${topic}${hostDescription} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // Check for shopping tasks
  const isShoppingTask = titleLower.includes('shop') ||
    titleLower.includes('buy') ||
    titleLower.includes('cart') ||
    titleLower.includes('checkout') ||
    titleLower.includes('product');

  if (isShoppingTask) {
    const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
    return `Shopped for ${topic} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // Check for entertainment tasks
  const isEntertainmentTask = titleLower.includes('music') ||
    titleLower.includes('video') ||
    titleLower.includes('watch') ||
    titleLower.includes('listen') ||
    titleLower.includes('play');

  if (isEntertainmentTask) {
    const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
    return `Enjoyed ${topic} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // Check for learning tasks
  const isLearningTask = titleLower.includes('learn') ||
    titleLower.includes('course') ||
    titleLower.includes('tutorial') ||
    titleLower.includes('english') ||
    titleLower.includes('language');

  if (isLearningTask) {
    const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
    return `Learned ${topic} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // Check for reading tasks
  const isReadingTask = titleLower.includes('read') ||
    titleLower.includes('paper') ||
    titleLower.includes('article') ||
    titleLower.includes('blog');

  if (isReadingTask) {
    const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
    return `Read ${topic} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // Check for investigation/exploration tasks
  const isInvestigationTask = titleLower.includes('stackoverflow') ||
    titleLower.includes('search') ||
    titleLower.includes('question') ||
    titleLower.includes('answer');

  if (isInvestigationTask) {
    const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
    return `Investigated ${topic} over about ${Math.max(1, input.durationMinutes)} minutes.`;
  }

  // General fallback
  const topic = input.title.replace(/^Work on\s+/i, '').replace(/^work\s+on\s+/i, '');
  const hostDescription = input.hostCount > 1
    ? ` across ${input.hostCount} related sites`
    : '';

  return `Worked on ${topic}${hostDescription} over about ${Math.max(1, input.durationMinutes)} minutes.`;
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
  role: EventDescriptor['role'];
}): string[] {
  const titleTokens = extractTokens(input.title ?? '');
  const pageTitleTokens = extractTokens(input.pageTitle ?? '');
  const pageTextTokens = extractRepeatedPageTextTokens(
    input.pageText ?? '',
    new Set([...titleTokens, ...pageTitleTokens]),
    input.role,
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
  role: EventDescriptor['role'],
): string[] {
  const rawTokens = extractTokens(value);

  if (
    rawTokens.length <= 10 &&
    (role === 'repository' || role === 'debug' || role === 'web')
  ) {
    return rawTokens;
  }

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
    // But exclude obviously non-technical common words and overly generic technical terms
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
    .filter((part) => !TOKEN_STOP_WORDS.has(part))
    .filter((part) => !/^\d+$/.test(part)); // Filter pure numeric tokens
}

function createCandidateGroup(descriptor: EventDescriptor): CandidateStreamGroup {
  const taskTokens = descriptor.salientTokens.length > 0
    ? descriptor.salientTokens
    : descriptor.tokens.slice(0, 3);
  const hosts = [descriptor.host];

  return {
    key: `${sanitizeForId(descriptor.host)}:${sanitizeForId(taskTokens.join('-') || 'general')}`,
    theme: createTaskTheme(taskTokens, hosts),
    title: createTaskTitle([descriptor.event], taskTokens, hosts),
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

function createTaskTitle(
  memoryEvents: MemoryEvent[],
  taskTokens: string[],
  hosts: string[],
): string {
  const representativeTitle = selectRepresentativeSourceTitle(memoryEvents);

  if (representativeTitle !== null) {
    return representativeTitle;
  }

  if (taskTokens.length === 0) {
    return `Work on ${toTitleCase(hosts[0] ?? 'General Task')}`;
  }

  const topic = toTitleCase(taskTokens.slice(0, 3).join(' '));
  const taskType = inferTaskTypeFromEvents(memoryEvents, topic);

  switch (taskType) {
    case 'shopping':
      return `Shop ${topic}`;
    case 'entertainment':
      return `Enjoy ${topic}`;
    case 'learning':
      return `Learn ${topic}`;
    case 'reading':
      return `Read ${topic}`;
    case 'bug-fix':
      return `Fix ${topic}`;
    case 'feature-implementation':
      return `Implement ${topic}`;
    case 'research':
      return `Review ${topic}`;
    case 'debugging':
      return `Debug ${topic}`;
    case 'code-review':
      return `Review ${topic}`;
    default:
      return `Work on ${topic}`;
  }
}

function createTaskTheme(taskTokens: string[], hosts: string[]): string {
  if (taskTokens.length === 0) {
    return `${hosts[0] ?? 'unknown-source'} / general`;
  }

  return taskTokens.slice(0, 3).join(' / ');
}

function selectRepresentativeSourceTitle(
  memoryEvents: MemoryEvent[],
): string | null {
  const scoredTitles = memoryEvents
    .map((event) => {
      const title =
        typeof event.content.title === 'string' ? event.content.title : undefined;
      const normalizedTitle = normalizeSourceTitle(title);

      if (normalizedTitle === null) {
        return null;
      }

      const role = inferPageRole({
        url: typeof event.content.url === 'string' ? event.content.url : undefined,
        title,
      });
      const actionPhrase = extractActionPhrase(normalizedTitle);

      return {
        role,
        normalizedTitle,
        actionPhrase,
        score:
          (actionPhrase !== null ? 10 : 0) +
          (role === 'issue' ? 6 : 0) +
          (role === 'pull-request' ? 5 : 0) +
          (role === 'debug' ? 4 : 0) +
          (role === 'docs' || role === 'reference' ? 3 : 0) +
          normalizedTitle.split(/\s+/).length,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.score - left.score);

  const best = scoredTitles[0];

  if (best?.actionPhrase) {
    return best.actionPhrase;
  }

  return null;
}

function normalizeSourceTitle(title?: string): string | null {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return null;
  }

  return title
    .replace(/\s*[-|:]\s*(issue|pr|pull request)\s*#?\d+$/i, '')
    .replace(/\s*[-|:]\s*google search$/i, '')
    .replace(/\s*[-|:]\s*stack overflow$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractActionPhrase(title: string): string | null {
  const actionVerbs = [
    'fix', 'implement', 'debug', 'review', 'build', 'update', 'add', 'remove',
    'refactor', 'optimize', 'test', 'deploy', 'configure', 'integrate',
    'document', 'migrate', 'upgrade', 'release', 'monitor', 'analyze', 'investigate',
    'explore',
  ];
  const tokens = title
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  const firstToken = tokens[0]?.toLowerCase();

  if (!firstToken || !actionVerbs.includes(firstToken)) {
    return null;
  }

  return toTitleCase(tokens.slice(0, 5).join(' '));
}

function inferTaskTypeFromEvents(
  memoryEvents: MemoryEvent[],
  title: string,
): TaskType {
  const pageRoles = memoryEvents.map((event) =>
    inferPageRole({
      url: typeof event.content.url === 'string' ? event.content.url : undefined,
      title: typeof event.content.title === 'string' ? event.content.title : undefined,
    }),
  );

  return inferTaskType({
    hasIssue: pageRoles.includes('issue'),
    hasPR: pageRoles.includes('pull-request'),
    hasRepo: pageRoles.includes('repository'),
    hasDocs: pageRoles.includes('docs'),
    hasDebug: pageRoles.includes('debug'),
    hasSearch: pageRoles.includes('search'),
    hasReference: pageRoles.includes('reference'),
    hasShopping: pageRoles.includes('shopping'),
    hasEntertainment: pageRoles.includes('entertainment'),
    hasLearning: pageRoles.includes('learning'),
    hasReading: pageRoles.includes('reading'),
    pageRoles,
    title,
  });
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

    const role = inferPageRole({ url, title });

    for (const token of extractEventTokens({ url, title, pageTitle, pageText, host, role })) {
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
  const groupEnd = group.memoryEvents[group.memoryEvents.length - 1]?.timestamp ?? '';
  const minutesGap = getDurationMinutes(groupEnd, descriptor.event.timestamp);

  const allowSparseCrossGapMerge =
    minutesGap > MAX_SESSION_GAP_MINUTES &&
    group.memoryEvents.length === 1 &&
    descriptor.role !== 'search' &&
    descriptor.role !== 'chat' &&
    salientOverlap >= 2;

  if (minutesGap > MAX_SESSION_GAP_MINUTES && !allowSparseCrossGapMerge) {
    return 0;
  }

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
    mergeTarget.title = createTaskTitle(
      mergeTarget.memoryEvents,
      mergeTarget.taskTokens,
      mergeTarget.hosts,
    );
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
}): 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'shopping' | 'entertainment' | 'learning' | 'reading' | 'web' {
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

  // Shopping patterns
  if (normalized.includes('amazon') || normalized.includes('ebay') || normalized.includes('taobao') ||
      normalized.includes('jd.com') || normalized.includes('shop') || normalized.includes('cart') ||
      normalized.includes('checkout') || normalized.includes('product')) {
    return 'shopping';
  }

  // Entertainment patterns (music, video, games)
  if (normalized.includes('music') || normalized.includes('spotify') || normalized.includes('youtube.com/watch') ||
      normalized.includes('video') || normalized.includes('movie') || normalized.includes('tv') ||
      normalized.includes('game') || normalized.includes('play')) {
    return 'entertainment';
  }

  // Learning patterns (courses, tutorials, language learning)
  if (normalized.includes('course') || normalized.includes('tutorial') || normalized.includes('learn') ||
      normalized.includes('english') || normalized.includes('language') || normalized.includes('duolingo') ||
      normalized.includes('coursera') || normalized.includes('udemy') || normalized.includes('edx')) {
    return 'learning';
  }

  // Reading patterns (papers, articles, blogs, news)
  if (normalized.includes('arxiv') || normalized.includes('paper') || normalized.includes('article') ||
      normalized.includes('blog') || normalized.includes('news') || normalized.includes('read') ||
      normalized.includes('pdf') || normalized.includes('scholar')) {
    return 'reading';
  }

  return 'web';
}

function inferSourceContribution(
  role: 'search' | 'docs' | 'chat' | 'issue' | 'pull-request' | 'repository' | 'debug' | 'reference' | 'shopping' | 'entertainment' | 'learning' | 'reading' | 'web',
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
