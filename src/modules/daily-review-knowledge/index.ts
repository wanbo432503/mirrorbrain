import type {
  KnowledgeArtifact,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface CreateKnowledgeDraftInput {
  reviewedMemories: ReviewedMemory[];
}

function slugifyTopicKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function formatTimeRange(startAt: string, endAt: string): string {
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);
  return `${startTime} - ${endTime}`;
}

function calculateDurationMinutes(startAt: string, endAt: string): number {
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
}

function formatSourceList(
  sources: Array<{
    id: string;
    title?: string;
    url?: string;
    role?: string;
  }>,
): string {
  return sources
    .map((source) => {
      const titleText = source.title ?? 'Untitled page';
      const urlText = source.url ?? '';
      const roleText = source.role ? ` (${source.role})` : '';
      return `- ${titleText}${roleText}\n  ${urlText}`;
    })
    .join('\n');
}

export function createKnowledgeDraft(
  input: CreateKnowledgeDraftInput,
): KnowledgeArtifact {
  const [firstReviewedMemory] = input.reviewedMemories;
  const reviewedAt = firstReviewedMemory?.reviewedAt ?? null;
  const reviewDate = firstReviewedMemory?.reviewDate ?? '';
  const candidateTitle = firstReviewedMemory?.candidateTitle ?? 'Daily Review Draft';
  const candidateSummary =
    firstReviewedMemory?.candidateSummary ?? 'Reviewed memory included.';
  const candidateTheme = firstReviewedMemory?.candidateTheme ?? '';
  const candidateSourceRefs = firstReviewedMemory?.candidateSourceRefs ?? [];
  const candidateFormationReasons = firstReviewedMemory?.candidateFormationReasons ?? [];
  const candidateTimeRange = firstReviewedMemory?.candidateTimeRange;

  // Build a richer knowledge body using enhanced candidate information
  const bodySections: string[] = [];

  // Main description
  bodySections.push(`- ${candidateTitle}: ${candidateSummary}`);

  // Add time range and duration if available
  if (candidateTimeRange) {
    const timeRangeText = formatTimeRange(
      candidateTimeRange.startAt,
      candidateTimeRange.endAt,
    );
    const durationMinutes = calculateDurationMinutes(
      candidateTimeRange.startAt,
      candidateTimeRange.endAt,
    );
    bodySections.push(`\nTime range: ${timeRangeText}`);
    bodySections.push(`Duration: ${durationMinutes} minutes`);
  }

  // Separate primary and supporting sources
  const primarySources = candidateSourceRefs.filter(
    (source) => source.contribution !== 'supporting',
  );
  const supportingSources = candidateSourceRefs.filter(
    (source) => source.contribution === 'supporting',
  );

  // Add primary sources section
  if (primarySources.length > 0) {
    bodySections.push('\nPrimary sources:');
    bodySections.push(formatSourceList(primarySources));
  }

  // Add supporting sources section
  if (supportingSources.length > 0) {
    bodySections.push('\nSupporting sources:');
    bodySections.push(formatSourceList(supportingSources));
  }

  // Add formation reasons to explain why the task was captured
  if (candidateFormationReasons.length > 0) {
    bodySections.push('\nWhy this task was captured:');
    candidateFormationReasons.forEach((reason) => {
      bodySections.push(`- ${reason}`);
    });
  }

  const body = bodySections.join('\n');

  return {
    artifactType: 'daily-review-draft',
    id: `knowledge-draft:${firstReviewedMemory.id}`,
    draftState: 'draft',
    topicKey: candidateTheme.length > 0 ? slugifyTopicKey(candidateTheme) : null,
    title: candidateTitle,
    summary: `${input.reviewedMemories.length} reviewed memor${
      input.reviewedMemories.length === 1 ? 'y' : 'ies'
    } about ${candidateTitle} from ${reviewDate}.`,
    body,
    sourceReviewedMemoryIds: input.reviewedMemories.map((memory) => memory.id),
    derivedFromKnowledgeIds: [],
    version: 1,
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt: reviewedAt ?? undefined,
    reviewedAt,
    recencyLabel: reviewDate.length > 0 ? reviewDate : 'recent',
    provenanceRefs: input.reviewedMemories.map((memory) => ({
      kind: 'reviewed-memory',
      id: memory.id,
    })),
  };
}
