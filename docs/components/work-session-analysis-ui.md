# Work Session Analysis UI

## Summary

`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`
is the Phase 4 operator UI for the merged review and work-session flow. It
exposes the three planned analysis windows, renders pending
`WorkSessionCandidate` results as a Preview Project -> Topic -> Knowledge tree,
and lets the user publish useful preview knowledge into the durable Published
tree.

## Responsibility Boundary

The component owns:

- Showing manual analysis controls for last 6 hours, last 24 hours, and last 7
  days.
- Calling `MirrorBrainWebAppApi.analyzeWorkSessions(...)`.
- Calling `MirrorBrainWebAppApi.reviewWorkSessionCandidate(...)`.
- Calling Knowledge Article draft and publish APIs when the user publishes a
  preview knowledge item.
- Loading the Published Project -> Topic -> Knowledge tree from the API.
- Rendering the returned analysis window, excluded event count, candidate
  project hints, source types, time ranges, and provenance event counts.
- Rendering `Preview` and `Published` tree modes in the left-side navigation.
- Letting the user confirm a project name before keeping a candidate.
- Letting the user discard a candidate.
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

Output:

- A rendered list of pending work-session candidates.
- A preview Project -> Topic -> Knowledge tree for the latest analysis window.
- A published Project -> Topic -> Knowledge tree for durable articles.
- Explicit keep/discard review requests sent to the service.
- Explicit publish requests sent to the service.
- Local loading and error state.

## Data Flow

1. The user opens the merged review/work-session surface.
2. The user chooses an analysis window.
3. The browser API client posts the selected preset to
   `/work-sessions/analyze`.
4. The panel displays returned candidates in the Preview tree.
5. The user can edit the proposed project name and inspect the candidate
   evidence.
6. The user publishes a preview knowledge item.
7. The panel records the reviewed work session, generates a Knowledge Article
   Draft, publishes it, refreshes the Published tree, and removes or marks the
   preview item.

## Failure Modes And Constraints

- A failed analysis request is shown as a local error.
- Buttons are disabled while one analysis request is in flight.
- Analysis results are not stored in browser local storage.
- Candidates remain `pending` until the user clicks an explicit keep/discard
  action.
- The UI does not silently create knowledge articles or skills. Knowledge
  Article publication requires an explicit Publish action on the preview item.

## Test Strategy

Tests live in
`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
and `src/apps/mirrorbrain-web-react/src/App.test.tsx`.

The tests verify:

- The panel calls the API with the selected preset and renders candidates.
- The panel sends explicit keep review payloads with confirmed project
  assignment.
- The panel renders Preview and Published tree modes.
- The panel publishes preview knowledge through review, draft generation, and
  article publication API calls.
- The app routes the Review surface to the work-session review panel and no
  longer exposes Work Sessions as a separate primary route.
