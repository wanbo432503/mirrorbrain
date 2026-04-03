import type { KnowledgeArtifact } from '../../shared/types/index.js';

interface EvaluateTopicKnowledgeQualityInput {
  fixtureName: string;
  dailyReviewDraft: KnowledgeArtifact;
  currentBestTopic: KnowledgeArtifact;
  history: KnowledgeArtifact[];
}

interface TopicKnowledgeQualityScores {
  summarizationFidelity: number;
  structureAndReasoning: number;
  futureUsefulness: number;
  provenanceCompleteness: number;
  recencyClarity: number;
}

interface TopicKnowledgeQualityComparisons {
  currentBestAtLeastAsReadableAsDraft: boolean;
  provenanceRetained: boolean;
  historyRetained: boolean;
}

export interface TopicKnowledgeQualityReport {
  fixtureName: string;
  pass: boolean;
  scores: TopicKnowledgeQualityScores;
  comparisons: TopicKnowledgeQualityComparisons;
  notes: string[];
}

function scoreSummarizationFidelity(currentBestTopic: KnowledgeArtifact): number {
  return currentBestTopic.summary && currentBestTopic.summary.trim().length >= 24 ? 4 : 2;
}

function scoreStructureAndReasoning(currentBestTopic: KnowledgeArtifact): number {
  const body = currentBestTopic.body ?? '';
  const paragraphCount = body
    .split('\n\n')
    .map((section) => section.trim())
    .filter((section) => section.length > 0).length;

  return paragraphCount >= 3 ? 4 : 2;
}

function scoreFutureUsefulness(
  dailyReviewDraft: KnowledgeArtifact,
  currentBestTopic: KnowledgeArtifact,
): number {
  const draftBodyLength = dailyReviewDraft.body?.trim().length ?? 0;
  const currentBestBodyLength = currentBestTopic.body?.trim().length ?? 0;

  return currentBestBodyLength > draftBodyLength ? 4 : 2;
}

function scoreProvenanceCompleteness(currentBestTopic: KnowledgeArtifact): number {
  return (currentBestTopic.provenanceRefs?.length ?? 0) > 0 ? 4 : 0;
}

function scoreRecencyClarity(currentBestTopic: KnowledgeArtifact): number {
  return (currentBestTopic.recencyLabel?.trim().length ?? 0) > 0 ? 4 : 1;
}

export function evaluateTopicKnowledgeQuality(
  input: EvaluateTopicKnowledgeQualityInput,
): TopicKnowledgeQualityReport {
  const notes: string[] = [];
  const comparisons: TopicKnowledgeQualityComparisons = {
    currentBestAtLeastAsReadableAsDraft:
      (input.currentBestTopic.body?.trim().length ?? 0) >=
      (input.dailyReviewDraft.body?.trim().length ?? 0),
    provenanceRetained: (input.currentBestTopic.provenanceRefs?.length ?? 0) > 0,
    historyRetained: input.history.length > 0,
  };

  if (!comparisons.provenanceRetained) {
    notes.push('Current-best topic knowledge lost provenance references.');
  }

  if (!comparisons.historyRetained) {
    notes.push('Topic history is empty for this fixture.');
  }

  const scores: TopicKnowledgeQualityScores = {
    summarizationFidelity: scoreSummarizationFidelity(input.currentBestTopic),
    structureAndReasoning: scoreStructureAndReasoning(input.currentBestTopic),
    futureUsefulness: scoreFutureUsefulness(
      input.dailyReviewDraft,
      input.currentBestTopic,
    ),
    provenanceCompleteness: scoreProvenanceCompleteness(input.currentBestTopic),
    recencyClarity: scoreRecencyClarity(input.currentBestTopic),
  };

  return {
    fixtureName: input.fixtureName,
    pass:
      comparisons.currentBestAtLeastAsReadableAsDraft &&
      comparisons.provenanceRetained &&
      comparisons.historyRetained &&
      scores.provenanceCompleteness >= 3 &&
      scores.recencyClarity >= 3,
    scores,
    comparisons,
    notes,
  };
}
