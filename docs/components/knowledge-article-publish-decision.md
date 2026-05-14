# Knowledge Article Publish Decision

## Summary

`src/modules/knowledge-article-publish-decision` decides how a generated Knowledge Article Draft should enter the durable Project -> Topic -> Knowledge Article tree. It can select an existing topic and article lineage, create a new article, update an existing article, or attach the draft as supporting evidence.

## Responsibility Boundary

The module owns:

- Comparing a draft with existing topics and current-best articles inside the reviewed project.
- Building the LLM prompt for publish placement and operation selection.
- Validating LLM decisions against known topic and article ids.
- Falling back to deterministic title/summary similarity when the LLM is unavailable or returns invalid JSON.

The module does not own:

- Project assignment or durable project creation confirmation.
- Draft generation from reviewed work sessions.
- Persisting topics, articles, or superseded versions.
- User-facing publish approval.
- Skill generation or execution.

## Key Interfaces

Input:

- `draft`: the generated `KnowledgeArticleDraft`.
- `topics`: existing topics for the draft project.
- `articles`: existing article versions for the draft project.
- optional `analyzeWithLLM(prompt)`: configured LLM call.

Output:

- `topicProposal`: existing or new topic proposal to write back onto the draft before publish.
- `topicAssignment`: final publish-time topic assignment.
- `articleOperationProposal`: create, update, or attach-as-supporting-evidence operation.
- `rationale`: short explanation from the LLM or fallback selector.

## Data Flow

1. Preview UI still requires the user-confirmed project name before durable publication.
2. If the project already exists by normalized name, the UI assigns the reviewed work session to that project instead of creating a duplicate project.
3. The service creates a draft from the reviewed work session and generated preview content.
4. Preview publication calls `publishKnowledgeArticleDraft` with `autoResolvePublishDecision: true`.
5. The service loads existing topics and article histories for the draft project.
6. This module decides the topic and article operation, using the LLM first and deterministic matching as fallback.
7. The service publishes the resolved draft through the normal versioned Knowledge Article path.

## Failure Modes And Operational Constraints

- Invalid LLM JSON or ids outside the known project topics/articles are ignored and do not block publishing.
- If no suitable match is found, the fallback creates a new topic/article from the draft proposal.
- Update and attach decisions are limited to article ids under the selected existing topic.
- Attaching supporting evidence creates a new version that preserves current-best title, summary, and body while merging source refs and provenance.

## Test Strategy

Unit tests live in `src/modules/knowledge-article-publish-decision/index.test.ts`.

The tests verify:

- LLM JSON can select an existing topic and existing article update.
- Plain `json { ... }` responses are accepted.
- Invalid LLM output falls back to deterministic matching.

Service coverage in `src/apps/mirrorbrain-service/index.test.ts` verifies that preview publication with `autoResolvePublishDecision` increments the existing article version instead of creating a duplicate article.
