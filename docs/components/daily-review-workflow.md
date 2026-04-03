# Daily Review Workflow

## Summary

This workflow coordinates the daily-review path by turning reviewed memories into a richer draft knowledge artifact through the daily-review knowledge module. In Phase 3, that draft is no longer treated as the final durable unit; it becomes the upstream input to topic-merge workflows.

## Responsibility Boundary

This workflow is responsible for:

- accepting reviewed memories selected for daily review
- invoking the knowledge-draft module with those reviewed memories
- returning the resulting draft knowledge artifact to service or API callers

This workflow is not responsible for:

- selecting which memories should enter daily review
- publishing knowledge or merging drafts into durable topic knowledge
- rendering the review experience

## Key Interfaces

- `runDailyReview(...)`

## Data Flow

1. A caller passes reviewed memories into the workflow.
2. The workflow delegates draft creation to the daily-review knowledge module.
3. The workflow returns the resulting draft `KnowledgeArtifact`.
4. That draft can later flow into the topic-knowledge merge workflow from Phase 3 Milestone 2.

## Test Strategy

- unit coverage in `src/workflows/daily-review/index.test.ts`
- integration coverage through service contract tests that generate knowledge from reviewed memory

## Known Risks Or Limitations

- the workflow currently performs a thin orchestration step and does not include ranking or batching logic
- daily review remains caller-driven rather than scheduled automatically
