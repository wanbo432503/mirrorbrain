import type {
  CandidateMemory,
  MemoryEvent,
  ReviewedMemory,
} from '../../shared/types/index.js';

interface ReviewCandidateMemoryInput {
  decision: ReviewedMemory['decision'];
}

export function createCandidateMemory(
  memoryEvents: MemoryEvent[],
): CandidateMemory {
  const [firstEvent] = memoryEvents;

  return {
    id: `candidate:${firstEvent.id}`,
    memoryEventIds: memoryEvents.map((event) => event.id),
    reviewState: 'pending',
  };
}

export function reviewCandidateMemory(
  candidate: CandidateMemory,
  input: ReviewCandidateMemoryInput,
): ReviewedMemory {
  return {
    id: `reviewed:${candidate.id}`,
    candidateMemoryId: candidate.id,
    decision: input.decision,
  };
}
