# Work Session Analysis UI

## Summary

`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`
is the Phase 4 operator UI behind the top-level Preview and Published tabs. In
Preview mode, it exposes the three planned analysis windows, renders pending
`WorkSessionCandidate` results as a Preview Project -> Topic -> Knowledge tree,
and lets the user publish useful preview knowledge into the durable Published
tree. In Published mode, it renders the durable historical Project -> Topic ->
Knowledge tree directly. Preview and Published intentionally share the same
three-level mental model, but they have different lifecycles: Preview is
regenerated from the selected analysis window, while Published is durable
historical knowledge.
Preview knowledge is no longer generated automatically. A topic appears first,
then the user explicitly clicks `Generate` to create the preview knowledge body,
and only generated knowledge can be published.

## Responsibility Boundary

The component owns:

- Showing manual analysis controls for last 6 hours, last 24 hours, and last 7
  days.
- Calling `MirrorBrainWebAppApi.analyzeWorkSessions(...)`.
- Calling `MirrorBrainWebAppApi.reviewWorkSessionCandidate(...)`.
- Calling Knowledge Article draft and publish APIs when the user publishes a
  preview knowledge item.
- Loading the Published Project -> Topic -> Knowledge tree from the API.
- Deleting published Knowledge Article lineages from the Published panel and
  refreshing the Published tree after deletion.
- Revising the currently selected published Knowledge Article through an
  explicit user instruction, then refreshing the tree so the new current-best
  article version is shown.
- Rendering the returned analysis window, excluded event count, and generated
  knowledge content.
- Rendering generated preview knowledge as a complete scrollable article body.
  Supporting memory-event labels, source types, provenance ids, and evidence
  excerpts are folded into the article body and References section instead of
  being shown in a separate metadata block.
- Rendering either the top-level Preview view or the top-level Published view
  through the explicit component `mode` prop, without nested Preview/Published
  subtabs.
- Rendering Preview as Project -> Topic -> one generated Knowledge item per
  topic, where the project is task-level and must not simply mirror source
  hosts such as `arxiv.org`.
- Rendering ungenerated Preview topics with an explicit `Generate` action
  instead of silently showing a knowledge artifact.
- Rendering Published as Project -> Topic -> many historical Knowledge Articles
  per topic.
- Letting the user edit the project name that will be used when publishing a
  generated preview knowledge item.
- Letting the user discard a candidate.
- Removing published and discarded candidates from the Preview tree so
  Preview remains a queue of work still waiting for review.
- Showing Published article bodies in the right panel when the user opens the
  top-level Published tab.
- Rendering Published with a collapsible Project -> Topic -> Knowledge tree in
  the left rail. Project and topic nodes can be opened or collapsed, and
  clicking one knowledge article displays that single article in the right
  panel. The first project, first topic, and first article are selected by
  default when the tree loads.
- Rendering a compact one-line revision request control fixed to the bottom of
  the selected Published article panel. The article body scrolls independently,
  so the request input and send button stay visible while reading long
  knowledge. The control sends the user's instruction to the service, where LLM
  revision creates a new version in the same article lineage while preserving
  source provenance.
- Displaying request errors without mutating candidate state.

The component does not own:

- Memory capture or source import.
- Work-session candidate generation rules.
- Reviewed work-session persistence rules.
- Project creation or assignment domain policy.
- Knowledge Article Draft generation or publication.
- Knowledge Article merge policy.
- Skill generation or execution.

## Key Interfaces

Input:

- `api: MirrorBrainWebAppApi`
  - `analyzeWorkSessions(preset)` calls `POST /work-sessions/analyze`.
  - `reviewWorkSessionCandidate(candidate, review)` calls
    `POST /work-sessions/reviews`.
  - `generateKnowledgeArticlePreview(request)` calls
    `POST /knowledge-articles/preview`.
  - `generateKnowledgeArticleDraft(request)` calls
    `POST /knowledge-articles/drafts`.
  - `publishKnowledgeArticleDraft(request)` calls
    `POST /knowledge-articles/publish`.
  - `listKnowledgeArticleTree()` calls `GET /knowledge-articles/tree`.
  - `deleteKnowledgeArticle(articleId)` calls
    `DELETE /knowledge-articles/:articleId`.
  - `reviseKnowledgeArticle(request)` calls
    `POST /knowledge-articles/revise`.

Output:

- A rendered list of generated preview knowledge items derived from pending
  work-session candidates.
- A preview Project -> Topic -> Knowledge tree for the latest analysis window.
- A published Project -> Topic -> Knowledge tree for durable articles.
- Explicit discard review requests sent to the service.
- Explicit publish requests sent to the service.
- Explicit delete requests for published Knowledge Article lineages.
- Local loading and error state.

## Data Flow

1. The user opens the top-level Preview tab.
2. The user chooses an analysis window.
3. The browser API client posts the selected preset to
   `/work-sessions/analyze`.
4. The panel derives a Preview Project -> Topic tree. Source-like
   hints such as browser hostnames are treated as source evidence, not as final
   project names.
5. The user can edit the proposed project name and inspect the topic evidence
   through the generated article references.
6. The user clicks `Generate` for a topic. The panel sends the full
   work-session candidate to `POST /knowledge-articles/preview`; the service
   builds a synthesis prompt from candidate evidence excerpts, including
   browser `pageContent` excerpts when available, and asks the configured LLM
   for a complete preview article with source references. If the LLM is
   unavailable, the backend returns an explicit fallback article that preserves
   evidence excerpts and tells the user to regenerate after configuration.
7. The user can discard the candidate. This records a discard review and removes
   the candidate from Preview.
8. The user publishes a generated preview knowledge item.
9. The panel records the reviewed work session, generates a Knowledge Article
   Draft, publishes it, refreshes the Published tree, and removes the preview
   item. After publication, the active top-level tab remains Preview; the user
   can switch to the top-level Published tab manually to inspect the durable
   article under the edited Project -> Topic -> Knowledge location.
10. In the top-level Published tab, the user can delete one Knowledge Article.
    The panel deletes that article lineage through the API and refreshes the
    Published tree.
11. In the top-level Published tab, the user can select one article and submit
    a revision instruction. The panel sends the selected article lineage ids
    and instruction to `POST /knowledge-articles/revise`; the service asks the
    configured LLM for a complete revised article, publishes it as the next
    current-best version, and returns the updated article. The panel refreshes
    the tree and keeps the same article lineage selected.

## Failure Modes And Constraints

- A failed analysis request is shown as a local error.
- Buttons are disabled while one analysis request is in flight.
- Analysis results are not stored in browser local storage.
- Candidates remain `pending` until the user clicks an explicit publish or
  discard action.
- The UI does not silently create knowledge articles or skills. Knowledge
  Article publication requires an explicit Publish action on the preview item.
- `Publish` moves the preview candidate out of the Preview queue and refreshes
  Published. It should not leave the same knowledge visible in both top-level
  modes.
- `Publish` must not switch the active top-level tab; Preview should remain
  active so the user can keep working through the queue.
- Project name edits are applied by `Publish`; there is no standalone
  project-only keep action in this surface.
- `Discard` removes the preview candidate after the discard review succeeds.
- Published deletion applies to the selected Knowledge Article lineage. It does
  not delete source memory events or preview candidates.
- Published revision requires an explicit user instruction and a configured LLM
  path. It produces a new article version rather than mutating the previous
  version in place.
- Published revision preserves the selected article's project, topic, article
  lineage, reviewed work-session refs, memory-event refs, and provenance refs.

## Test Strategy

Tests live in
`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
and `src/apps/mirrorbrain-web-react/src/App.test.tsx`.

The tests verify:

- The panel calls the API with the selected preset and renders candidates.
- The panel does not render a standalone `Keep as project` action.
- The app exposes Preview and Published as top-level tabs, with no nested
  Preview/Published subtab inside the tree rail.
- The panel renders the selected mode with Project -> Topic -> Knowledge
  hierarchy.
- Preview topics do not expose `Publish` until the user explicitly generates
  preview knowledge.
- Generated preview knowledge renders as a complete scrollable article body
  with evidence excerpts and references inside the article, without a separate
  associated-memory or provenance metadata block.
- The panel publishes preview knowledge through review, draft generation, and
  article publication API calls, using the edited project name in the publish
  review payload.
- Publishing moves the candidate out of Preview. The published article body is
  visible from the top-level Published tab.
- Discarding candidates removes them from the Preview queue and shows explicit
  status feedback.
- Published Knowledge Article deletion calls the dedicated article delete API,
  refreshes the Published tree, and shows explicit status feedback.
- The Published tree opens the first project/topic/article by default, allows
  project and topic collapse, and switches the right panel when a knowledge
  article is clicked.
- Published revision sends the selected article lineage plus user instruction
  to the revision API, refreshes the tree, clears the request box, and displays
  the revised current-best article body.
- The app routes the top-level Preview and Published tabs to the work-session
  panel modes and no longer exposes Review or Work Sessions as separate primary
  routes.
