# Knowledge Article

## Summary

`src/modules/knowledge-article` implements the Phase 4 Project -> Topic ->
Knowledge Article domain model. It generates `KnowledgeArticleDraft` artifacts
from reviewed work sessions and publishes drafts into current-best versioned
articles under a project topic.

## Responsibility Boundary

The module owns:

- Validating that Knowledge Article Draft inputs are reviewed work sessions.
- Preserving reviewed work-session and memory-event provenance.
- Representing topic proposals on drafts.
- Preserving a stable `articleId` lineage separate from version ids.
- Publishing drafts into durable project/topic article versions.
- Marking prior current-best article versions as superseded when an update is
  published.

The module does not own:

- Work-session candidate analysis.
- Work-session review and project assignment.
- LLM text generation. Preview synthesis lives in
  `docs/components/knowledge-article-preview.md` and must remain non-durable
  until the review/draft/publish flow completes.
- Durable storage or retrieval indexes.
- UI controls for topic correction or publish approval.
- Skill generation or execution.

## Key Interfaces

Domain draft generation input:

- `reviewedWorkSessions`: one or more reviewed sessions from a single project.
- title, summary, and body.
- `topicProposal`: an existing topic or new topic proposal.
- `articleOperationProposal`: create, update, or attach-as-evidence proposal.

Service/API draft generation input:

- `reviewedWorkSessionIds`: ids of reviewed sessions already persisted by the
  work-session review flow.
- The service loads those reviewed sessions before calling the domain module.
- Caller-supplied reviewed session objects are not trusted API input.

Draft generation output:

- `KnowledgeArticleDraft`
  - `draftState: "draft"`.
  - `projectId`.
  - `sourceReviewedWorkSessionIds`.
  - `sourceMemoryEventIds`.
  - `provenanceRefs` to reviewed sessions and memory events.

Publish input:

- `KnowledgeArticleDraft`.
- final `topicAssignment`.
- publisher metadata.
- existing article versions for the target project/topic.

Publish output:

- `KnowledgeArticle`.
  - `articleId`: stable logical article lineage id.
  - `id`: version-specific article id.
  - ids use readable Unicode slug segments so non-English project, topic, and
    article titles remain distinct instead of collapsing to `untitled`.
- optional created `Topic`.
- optional superseded prior article version.

## Data Flow

1. Reviewed work sessions provide project-scoped, source-attributed synthesis
   input.
2. A draft is created with a topic proposal and article operation proposal.
3. The user can correct topic/article assignment before publishing.
4. Publish resolves the final topic assignment.
5. The module resolves a stable article lineage id.
6. The module creates the next version for that article lineage and marks it as
   current-best.
7. If a prior current-best version exists for the same `articleId`, the returned
   `supersededArticle` marks that prior version as no longer current-best.

## Failure Modes And Constraints

- Draft generation rejects discarded work sessions.
- Draft generation requires all sessions to belong to one reviewed project.
- Service/API draft generation rejects reviewed session ids that have not been
  persisted by the explicit review flow.
- Creating a durable topic requires `confirmed-new-topic` at publish time.
- The module does not persist the new article or superseded article; callers
  must save both atomically when storage is introduced.
- Publishing does not create executable skills.

## Test Strategy

Unit tests live in `src/modules/knowledge-article/index.test.ts`.

The tests verify:

- Drafts preserve reviewed work-session and memory-event provenance.
- Discarded work sessions cannot generate drafts.
- Publishing a first article creates a current-best version and confirmed topic.
- Publishing non-ASCII project/topic/article names preserves readable durable
  ids.
- Publishing separate articles under the same topic preserves separate
  `articleId` and version streams.
- Publishing an update creates a new current-best version and returns the prior
  version as superseded.
