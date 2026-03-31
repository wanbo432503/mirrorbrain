# Daily Review Workflow

## Summary

This workflow coordinates the Phase 1 daily-review path by turning reviewed memories into a draft knowledge artifact through the daily-review knowledge module.

## Responsibility Boundary

This workflow is responsible for:

- accepting reviewed memories selected for daily review
- invoking the knowledge-draft module with those reviewed memories
- returning the resulting draft knowledge artifact to service or API callers

This workflow is not responsible for:

- selecting which memories should enter daily review
- publishing knowledge
- rendering the review experience

## Key Interfaces

- `runDailyReview(...)`

## Data Flow

1. A caller passes reviewed memories into the workflow.
2. The workflow delegates draft creation to the daily-review knowledge module.
3. The workflow returns the resulting draft `KnowledgeArtifact`.

## Test Strategy

- unit coverage in `src/workflows/daily-review/index.test.ts`
- integration coverage through service contract tests that generate knowledge from reviewed memory

## Known Risks Or Limitations

- the workflow currently performs a thin orchestration step and does not include ranking or batching logic
- daily review remains caller-driven rather than scheduled automatically
