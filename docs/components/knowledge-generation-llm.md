# Knowledge Generation LLM

## Summary

The knowledge generation module turns reviewed memories into structured `daily-review-draft` knowledge artifacts. It is the Phase 2/3 bridge between human-reviewed memory and later topic knowledge publishing.

## Responsibility Boundary

- Owns content-aware draft generation from `ReviewedMemory` inputs.
- Retrieves source text from captured memory event `pageText` first, then stored browser page content artifacts, then optional live fetch fallback.
- Classifies drafts as `workflow`, `tutorial`, `insight-report`, or `development-record`.
- Assigns a topic key from reviewed memory themes or source URLs.
- Builds a dedicated LLM synthesis prompt for the note body instead of pasting raw page text.
- Derives the artifact title from a complete Chinese markdown H1 when the LLM provides one, and otherwise falls back to a Chinese summary title instead of candidate ids, hashes, URL fragments, or broken English.
- Removes repeated login, navigation, legal, iframe, and mailbox-shell boilerplate before prompt construction.
- Does not publish artifacts, approve drafts, clear UI state, or execute skills.

## Key Interfaces

- `retrievePageContent(eventId, deps)` returns source-attributed page text for one memory event.
- `classifyNoteType(content, deps)` returns the knowledge note type.
- `extractThemeFromUrls(urls, deps)` returns a stable topic theme.
- `buildKnowledgeSynthesisPrompt(...)` returns the markdown-generation prompt used for LLM synthesis.
- `analyzeKnowledgeWithConfiguredLLM(prompt)` calls the configured OpenAI-compatible model from `MIRRORBRAIN_LLM_API_BASE`, `MIRRORBRAIN_LLM_API_KEY`, and `MIRRORBRAIN_LLM_MODEL`.
- `generateKnowledgeFromReviewedMemories(reviewedMemories, options)` returns a draft `KnowledgeArtifact` whose `title` is a readable Chinese knowledge title.

Dependencies are injectable so tests can supply memory events, artifact loaders, LLM analysis, clocks, and fetchers without hidden global state.

## Data Flow

1. The service passes kept reviewed memories to the module.
2. The module resolves each reviewed memory event into captured page text.
3. Retrieved text is cleaned and reduced to useful excerpts.
4. Retrieved text is classified.
5. The service injects the configured LLM analyzer and the module asks it to write a structured knowledge note.
6. If LLM classification or theme extraction is unavailable, the module falls back to local heuristics.
7. If body synthesis is unavailable, the module returns a degraded scaffold that preserves review context and provenance but does not dump raw source excerpts into a knowledge-looking note.
8. The service persists the draft and later approves it through the existing topic merge workflow.

## Prompt Policy

The synthesis prompt tells the model:

- write as the MirrorBrain knowledge draft writer
- transform reviewed work memories into a concise human-readable note
- do not paste raw page text or create a browsing transcript
- discard navigation chrome, login forms, legal text, repeated boilerplate, iframes, counters, and account/session tokens
- treat login pages and mailbox shells as weak evidence instead of pretending to know email body content
- cite sources with labels such as `[S1]`
- return markdown with a complete Chinese H1 title plus `核心结论`, `背景与证据`, `可复用知识`, `后续行动 / 待确认`, and `来源`
- never use random short codes, hashes, ids, URL fragments, or broken English as the knowledge title

## Failure Modes

- Empty reviewed memory input throws before artifact creation.
- Missing page text is represented explicitly in the draft body instead of silently fabricating content.
- LLM provider fetch failures must not block draft creation; note classification falls back to content heuristics, topic extraction falls back to URL keywords, and body synthesis falls back to a clearly marked degraded scaffold without raw source excerpt synthesis.
- If the model returns no usable Chinese H1 title, the module keeps generation moving by deriving a Chinese fallback title from reviewed memory title, summary, or theme.
- Mailbox/login-shell pages are marked as weak evidence; boilerplate from those pages must not appear in the draft body.
- Source URLs in prompts and provenance are stripped of query strings so session ids are not copied into generated knowledge.
- Missing approval draft ids are handled in the service layer and reported as request errors.

## Test Strategy

- Unit tests cover retrieval priority, fallback artifact loading, note classification, LLM failure fallback, theme extraction, multi-memory generation, LLM prompt construction, and mailbox-login noise removal.
- Service tests cover source-content generation and approval through topic publishing.
