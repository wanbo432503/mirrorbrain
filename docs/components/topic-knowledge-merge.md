# Topic Knowledge Merge

## Summary

This workflow implements Phase 3 Milestone 2 for MirrorBrain knowledge. It converts `daily-review-draft` knowledge artifacts into `topic-merge-candidate` artifacts, then promotes strong candidates into `topic-knowledge` current-best artifacts while preserving superseded history.

## Responsibility Boundary

This workflow is responsible for:

- deriving stable `topicKey` values for topic-oriented knowledge
- converting daily-review drafts into topic merge candidates
- deciding whether a candidate should create a new topic, update the current-best topic, or remain a draft
- marking the previous current-best artifact as superseded when a topic is updated

This workflow is not responsible for:

- storing artifacts in the QMD workspace
- rendering topic knowledge in the UI
- ranking topic knowledge for retrieval beyond its own merge decisions

## Key Interfaces

- `buildTopicKnowledgeCandidates(...)`
- `mergeDailyReviewIntoTopicKnowledge(...)`

## Data Flow

1. A caller passes one or more `daily-review-draft` knowledge artifacts into the workflow.
2. The workflow derives a stable `topicKey` when one is missing.
3. The workflow emits `topic-merge-candidate` artifacts that preserve provenance and draft lineage.
4. A caller passes one candidate plus existing topic knowledge into the merge step.
5. The workflow either:
   - creates a new `topic-knowledge` current-best artifact,
   - updates the current-best topic and returns the superseded previous version,
   - or keeps a weak candidate as draft.

## Test Strategy

- focused workflow coverage in `src/workflows/topic-knowledge-merge/index.test.ts`
- service-level merge orchestration coverage in `src/apps/mirrorbrain-service/topic-knowledge.test.ts`

## Known Risks And Limitations

- merge decisions are currently rule-based and intentionally simple
- weak-candidate detection is heuristic and may need refinement in later Phase 3 work
- this workflow does not yet include retrieval or UI concerns from Milestone 3
