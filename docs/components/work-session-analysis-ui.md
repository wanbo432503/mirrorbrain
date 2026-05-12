# Work Session Analysis UI

## Summary

`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.tsx`
is the Phase 4 operator UI for manual work-session analysis. It exposes the
three planned analysis windows and renders pending `WorkSessionCandidate`
results returned by the HTTP API.

## Responsibility Boundary

The component owns:

- Showing manual analysis controls for last 6 hours, last 24 hours, and last 7
  days.
- Calling `MirrorBrainWebAppApi.analyzeWorkSessions(...)`.
- Rendering the returned analysis window, excluded event count, candidate
  project hints, source types, time ranges, and provenance event counts.
- Displaying request errors without mutating candidate state.

The component does not own:

- Memory capture or source import.
- Work-session candidate generation rules.
- Reviewed work-session persistence.
- Project creation or assignment.
- Knowledge Article Draft generation or publication.
- Skill generation or execution.

## Key Interfaces

Input:

- `api: MirrorBrainWebAppApi`
  - `analyzeWorkSessions(preset)` calls `POST /work-sessions/analyze`.

Output:

- A rendered list of pending work-session candidates.
- Local loading and error state.

## Data Flow

1. The user opens the Work Sessions tab.
2. The user chooses an analysis window.
3. The browser API client posts the selected preset to
   `/work-sessions/analyze`.
4. The panel displays returned candidates as pending review inputs.
5. Follow-up review, project assignment, and knowledge publication happen in
   later surfaces.

## Failure Modes And Constraints

- A failed analysis request is shown as a local error.
- Buttons are disabled while one analysis request is in flight.
- Analysis results are not stored in browser local storage.
- Candidates remain `pending`; the UI does not silently create reviewed work
  sessions, projects, knowledge articles, or skills.

## Test Strategy

Tests live in
`src/apps/mirrorbrain-web-react/src/components/work-sessions/WorkSessionAnalysisPanel.test.tsx`
and `src/apps/mirrorbrain-web-react/src/App.test.tsx`.

The tests verify:

- The panel calls the API with the selected preset and renders candidates.
- The app exposes Work Sessions as a top-level tab and routes manual analysis
  through the browser API client.
