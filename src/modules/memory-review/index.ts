import type {
  CandidateReviewSuggestion,
  CandidateMemory,
  MemoryEvent,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface CreateCandidateMemoriesInput {
  reviewDate: string;
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
}

export function createCandidateMemories(
  input: CreateCandidateMemoriesInput,
): CandidateMemory[] {
  const dailyEvents = input.memoryEvents
    .filter((event) => event.timestamp.startsWith(input.reviewDate))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  if (dailyEvents.length === 0) {
    throw new Error(`No memory events found for review date ${input.reviewDate}.`);
  }

  return Array.from(groupEventsByStream(dailyEvents).values()).map((group) => ({
    id: `candidate:${input.reviewDate}:${group.key}`,
    memoryEventIds: group.memoryEvents.map((event) => event.id),
    title: group.title,
    summary: createCandidateSummary({
      reviewDate: input.reviewDate,
      themeLabel: group.title,
      eventCount: group.memoryEvents.length,
    }),
    theme: group.theme,
    reviewDate: input.reviewDate,
    timeRange: {
      startAt: group.memoryEvents[0]?.timestamp ?? '',
      endAt: group.memoryEvents[group.memoryEvents.length - 1]?.timestamp ?? '',
    },
    reviewState: 'pending',
  }));
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
    if (candidate.memoryEventIds.length >= 2) {
      return {
        candidateMemoryId: candidate.id,
        recommendation: 'keep',
        confidenceScore: 0.8,
        priorityScore: candidate.memoryEventIds.length,
        rationale:
          'This daily stream has repeated activity and is a strong keep candidate.',
      };
    }

    return {
      candidateMemoryId: candidate.id,
      recommendation: 'review',
      confidenceScore: 0.55,
      priorityScore: candidate.memoryEventIds.length,
      rationale:
        'This daily stream has limited evidence and should stay in human review.',
    };
  });
}

function groupEventsByStream(
  memoryEvents: MemoryEvent[],
): Map<string, CandidateStreamGroup> {
  const groups = new Map<string, CandidateStreamGroup>();

  for (const event of memoryEvents) {
    const streamDescriptor = describeEventStream(event);
    const key = [
      sanitizeForId(event.sourceType),
      sanitizeForId(streamDescriptor.host),
      sanitizeForId(streamDescriptor.scope),
    ].join(':');
    const existing = groups.get(key);

    if (existing) {
      existing.memoryEvents.push(event);
      continue;
    }

    groups.set(key, {
      key,
      theme: `${streamDescriptor.host} / ${streamDescriptor.scope}`,
      title: `${toTitleCase(streamDescriptor.host)} / ${streamDescriptor.scope}`,
      memoryEvents: [event],
    });
  }

  return groups;
}

function describeEventStream(event: MemoryEvent): {
  host: string;
  scope: string;
} {
  const rawUrl =
    typeof event.content.url === 'string' ? event.content.url : undefined;

  if (!rawUrl) {
    return {
      host: 'unknown-source',
      scope: 'general',
    };
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const firstPathSegment =
      parsedUrl.pathname.split('/').filter(Boolean)[0] ?? 'general';

    return {
      host: parsedUrl.host.toLowerCase(),
      scope: firstPathSegment.toLowerCase(),
    };
  } catch {
    return {
      host: 'unknown-source',
      scope: 'general',
    };
  }
}

function createCandidateSummary(input: {
  reviewDate: string;
  themeLabel: string;
  eventCount: number;
}): string {
  const eventLabel = input.eventCount === 1 ? 'browser event' : 'browser events';
  return `${input.eventCount} ${eventLabel} about ${input.themeLabel} on ${input.reviewDate}.`;
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
