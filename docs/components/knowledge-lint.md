# Knowledge Lint Workflow

## Summary

The knowledge lint workflow runs after reviewed memories generate or regenerate a knowledge draft. It is a background quality pass that keeps knowledge relationships fresh and removes only mechanically provable duplicate generated drafts.

## Responsibility Boundary

- owns relation refresh planning across knowledge artifacts
- identifies duplicated `daily-review-draft` artifacts that have the same topic and the same reviewed-memory sources
- keeps the newest or just-generated draft and marks older duplicates for deletion
- returns an explicit plan for the service to apply
- does not publish new topic knowledge, infer arbitrary factual wrongness, or delete published knowledge without an explicit service action

## Key Interfaces

- `lintKnowledgeArtifacts(input)`
- `KnowledgeLintInput`
  - `knowledgeArtifacts`: the current knowledge corpus plus the newly generated draft
  - `seedKnowledgeIds`: knowledge ids that triggered the lint pass
- `KnowledgeLintPlan`
  - `updateArtifacts`: artifacts whose `relatedKnowledgeIds` should be persisted
  - `deleteArtifactIds`: duplicate generated draft ids that can be tombstoned

## Data Flow

1. The MirrorBrain service generates or regenerates a knowledge draft from reviewed memories.
2. The service publishes the generated artifact and returns it to the caller.
3. The service schedules knowledge lint in the background with the generated artifact id as the seed.
4. The lint workflow removes same-topic, same-source duplicate drafts from its active corpus.
5. The workflow builds a relation graph over active artifacts and returns artifacts whose `relatedKnowledgeIds` changed.
6. The service applies the plan by tombstoning duplicate drafts and publishing relation updates.

## Failure Modes And Constraints

- Lint is asynchronous and may lag behind the generated knowledge response.
- Lint failures are logged and do not fail the original knowledge-generation request.
- Deletion is intentionally narrow: only duplicate generated drafts with matching topic and reviewed-memory source ids are eligible.
- Published topic knowledge still requires the existing approval and topic-merge workflow; lint does not bypass human review.
- Relation quality depends on artifact tags and extracted terms, so weak source text can still produce sparse links.

## Test Strategy

- `src/workflows/knowledge-lint/index.test.ts` verifies relation updates and duplicate draft deletion planning.
- `src/apps/mirrorbrain-service/knowledge-generation.test.ts` verifies the service schedules lint asynchronously after knowledge generation.
- Broader verification runs the service test suite and TypeScript checks.
