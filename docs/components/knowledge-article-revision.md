# Knowledge Article Revision

## Summary

`src/modules/knowledge-article-revision` turns an explicit user revision request
for a published Knowledge Article into revised article content. The service then
publishes that content as the next version in the same article lineage.

## Responsibility Boundary

The module owns:

- Building the LLM prompt for revising one selected published article.
- Requiring a non-empty user instruction.
- Parsing the LLM response into title, summary, and complete Markdown body.

The module does not own:

- Selecting the article to revise.
- Calling HTTP endpoints.
- Persisting article versions.
- Changing provenance or source attribution.
- Publishing the revised content.

## Key Interfaces

Input:

- `article`: current published `KnowledgeArticle`.
- `instruction`: user-provided revision request.
- `analyzeWithLLM(prompt)`: injected LLM call.

Output:

- `RevisedKnowledgeArticleContent`
  - `title`.
  - `summary`.
  - `body`.

The LLM response must contain JSON with those three string fields. The parser accepts strict JSON, fenced `json` blocks, and plain `json { ... }` prefixes so minor model formatting drift does not break the explicit revision flow. The body is a full Markdown article, not a diff.

## Data Flow

1. Published UI sends article lineage ids and the revision instruction to the
   service.
2. The service loads the current-best article from the Knowledge Article store.
3. This module builds the LLM prompt and parses the revised content.
4. The service creates a Knowledge Article revision draft.
5. The standard publish path writes the next current-best version and marks the
   previous version as superseded.

## Failure Modes And Constraints

- Empty instructions are rejected before any LLM call.
- Invalid LLM JSON is rejected.
- LLM revision is only initiated from an explicit user request.
- Revisions preserve the source article's project, topic, article lineage,
  reviewed work-session refs, memory-event refs, and provenance refs.

## Test Strategy

Unit tests live in
`src/modules/knowledge-article-revision/index.test.ts`.

The tests verify:

- Prompt construction includes the instruction and article content.
- Fenced JSON and plain `json { ... }` LLM responses parse into revised article content.
- Empty instructions are rejected without calling the LLM.
