# Work Session Analysis UI

## Summary

`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`
is the Phase 4 operator UI for manual work-session analysis. It exposes the
three planned analysis windows and renders pending `WorkSessionCandidate`
results returned by the HTTP API. It also exposes the explicit human review
controls needed to keep a candidate as a reviewed project work session or
discard it.

## Responsibility Boundary

The component owns:

- Showing manual analysis controls for last 6 hours, last 24 hours, and last 7
  days.
- Calling `MirrorBrainWebAppApi.analyzeWorkSessions(...)`.
- Calling `MirrorBrainWebAppApi.reviewWorkSessionCandidate(...)`.
- Rendering the returned analysis window, excluded event count, candidate
  project hints, source types, time ranges, and provenance event counts.
- Letting the user confirm a project name before keeping a candidate.
- Letting the user discard a candidate.
- Displaying request errors without mutating candidate state.

The component does not own:

- Memory capture or source import.
- Work-session candidate generation rules.
- Reviewed work-session persistence rules.
- Project creation or assignment domain policy.
- Knowledge Article Draft generation or publication.
- Skill generation or execution.

## Key Interfaces

Input:

- `api: MirrorBrainWebAppApi`
  - `analyzeWorkSessions(preset)` calls `POST /work-sessions/analyze`.
  - `reviewWorkSessionCandidate(candidate, review)` calls
    `POST /work-sessions/reviews`.

Output:

- A rendered list of pending work-session candidates.
- Explicit keep/discard review requests sent to the service.
- Local loading and error state.

## Data Flow

1. The user opens the Work Sessions tab.
2. The user chooses an analysis window.
3. The browser API client posts the selected preset to
   `/work-sessions/analyze`.
4. The panel displays returned candidates as pending review inputs.
5. The user can edit the proposed project name.
6. The user keeps the candidate as a reviewed project work session or discards
   it.
7. Knowledge Article Draft generation and publication happen in later surfaces.

## Failure Modes And Constraints

- A failed analysis request is shown as a local error.
- Buttons are disabled while one analysis request is in flight.
- Analysis results are not stored in browser local storage.
- Candidates remain `pending` until the user clicks an explicit keep/discard
  action.
- The UI does not silently create knowledge articles or skills.

## Test Strategy

Tests live in
`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
and `src/apps/mirrorbrain-web-react/src/App.test.tsx`.

The tests verify:

- The panel calls the API with the selected preset and renders candidates.
- The panel sends explicit keep review payloads with confirmed project
  assignment.
- The app exposes Work Sessions as a top-level tab and routes manual analysis
  through the browser API client.
