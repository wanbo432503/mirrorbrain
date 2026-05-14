# Work Session Analysis UI

## Summary

`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`
is the Phase 4 operator UI for the merged review and work-session flow. It
exposes the three planned analysis windows, renders pending
`WorkSessionCandidate` results as a Preview Project -> Topic -> Knowledge tree,
and lets the user publish useful preview knowledge into the durable Published
tree. Preview and Published intentionally share the same three-level mental
model, but they have different lifecycles: Preview is regenerated from the
selected analysis window, while Published is durable historical knowledge.
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
- Rendering the returned analysis window, excluded event count, and generated
  knowledge content.
- Rendering generated preview knowledge as a complete scrollable article body.
  Supporting memory-event labels, source types, and provenance ids are folded
  into the article's References section instead of being shown in a separate
  metadata block.
- Rendering `Preview` and `Published` tree modes in the left-side navigation.
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
- Showing the Published article body in the right panel when the user switches
  to the Published tree.
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
  - `generateKnowledgeArticleDraft(request)` calls
    `POST /knowledge-articles/drafts`.
  - `publishKnowledgeArticleDraft(request)` calls
    `POST /knowledge-articles/publish`.
  - `listKnowledgeArticleTree()` calls `GET /knowledge-articles/tree`.
  - `deleteKnowledgeArticle(articleId)` calls
    `DELETE /knowledge-articles/:articleId`.

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

1. The user opens the merged review/work-session surface.
2. The user chooses an analysis window.
3. The browser API client posts the selected preset to
   `/work-sessions/analyze`.
4. The panel derives a Preview Project -> Topic tree. Source-like
   hints such as browser hostnames are treated as source evidence, not as final
   project names.
5. The user can edit the proposed project name and inspect the topic evidence
   through the generated article references.
6. The user clicks `Generate` for a topic, creating one preview knowledge item
   for that topic. The generated body includes a References section built from
   the supporting memory events.
7. The user can discard the candidate. This records a discard review and removes
   the candidate from Preview.
8. The user publishes a generated preview knowledge item.
9. The panel records the reviewed work session, generates a Knowledge Article
   Draft, publishes it, refreshes the Published tree, and removes the preview
   item. After publication, the active subtab remains Preview; the user can
   switch to Published manually to inspect the durable article under the edited
   Project -> Topic -> Knowledge location.
10. In Published, the user can delete one Knowledge Article. The panel deletes
    that article lineage through the API and refreshes the Published tree.

## Failure Modes And Constraints

- A failed analysis request is shown as a local error.
- Buttons are disabled while one analysis request is in flight.
- Analysis results are not stored in browser local storage.
- Candidates remain `pending` until the user clicks an explicit publish or
  discard action.
- The UI does not silently create knowledge articles or skills. Knowledge
  Article publication requires an explicit Publish action on the preview item.
- `Publish` moves the preview candidate out of the Preview queue and refreshes
  Published. It should not leave the same knowledge visible in both tree modes.
- `Publish` must not switch the active subtab; the Review surface should remain
  in Preview so the user can keep working through the queue.
- Project name edits are applied by `Publish`; there is no standalone
  project-only keep action in this surface.
- `Discard` removes the preview candidate after the discard review succeeds.
- Published deletion applies to the selected Knowledge Article lineage. It does
  not delete source memory events or preview candidates.

## Test Strategy

Tests live in
`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
and `src/apps/mirrorbrain-web-react/src/App.test.tsx`.

The tests verify:

- The panel calls the API with the selected preset and renders candidates.
- The panel does not render a standalone `Keep as project` action.
- The panel renders Preview and Published tree modes with Project -> Topic ->
  Knowledge hierarchy.
- Preview topics do not expose `Publish` until the user explicitly generates
  preview knowledge.
- Generated preview knowledge renders as a complete scrollable article body
  with references inside the article, without a separate associated-memory or
  provenance metadata block.
- The panel publishes preview knowledge through review, draft generation, and
  article publication API calls, using the edited project name in the publish
  review payload.
- Publishing moves the candidate from Preview to Published and renders the
  published article body in the Published panel.
- Discarding candidates removes them from the Preview queue and shows explicit
  status feedback.
- Published Knowledge Article deletion calls the dedicated article delete API,
  refreshes the Published tree, and shows explicit status feedback.
- The app routes the Review surface to the work-session review panel and no
  longer exposes Work Sessions as a separate primary route.
