# Knowledge Generation LLM

## Summary

The knowledge generation LLM module provides source-content retrieval helpers and the configured LLM analyzer used by Phase 4 Knowledge Article preview and revision flows.

## Responsibility Boundary

- Retrieves source text from captured memory event `pageText` first, then stored browser page content artifacts, then optional live fetch fallback.
- Provides content classification and theme extraction helpers for knowledge article synthesis flows.
- Builds LLM prompts for synthesis callers without owning publication or review state.
- Exposes `analyzeKnowledgeWithConfiguredLLM(prompt)` for callers that need the configured OpenAI-compatible model.
- Does not create legacy `KnowledgeArtifact` drafts, publish artifacts, approve drafts, clear UI state, or execute skills.

## Key Interfaces

- `retrievePageContent(eventId, deps)` returns source-attributed page text for one memory event.
- `classifyNoteType(content, deps)` returns the knowledge note type.
- `extractThemeFromUrls(urls, deps)` returns a stable topic theme.
- `buildKnowledgeSynthesisPrompt(...)` returns the markdown-generation prompt used by synthesis callers.
- `analyzeKnowledgeWithConfiguredLLM(prompt)` calls the configured model from `MIRRORBRAIN_LLM_API_BASE`, `MIRRORBRAIN_LLM_API_KEY`, and `MIRRORBRAIN_LLM_MODEL`.

Dependencies are injectable so tests and service code can supply memory events, artifact loaders, LLM analysis, clocks, and fetchers without hidden global state.

## Data Flow

1. A Phase 4 Knowledge Article caller supplies reviewed work-session context or source-linked inputs.
2. The module resolves relevant memory events into captured page text when requested.
3. Retrieved text is cleaned and reduced to useful excerpts.
4. The caller injects or uses the configured LLM analyzer to write or revise article content.
5. Publication remains owned by the Knowledge Article workflow and store.

## Failure Modes

- Missing page text is represented explicitly instead of silently fabricating content.
- LLM provider fetch failures are surfaced to the caller that requested analysis.
- Source URLs in prompts and provenance are stripped of query strings so session ids are not copied into generated knowledge.
- The module does not expose legacy `/knowledge*` draft approval behavior.

## Test Strategy

- Phase 4 Knowledge Article preview and revision tests cover use of the configured analyzer.
- Retrieval helper behavior should be verified with focused unit coverage when touched.
