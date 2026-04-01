# MirrorBrain Review UI

## Summary

The Phase 1 review UI is the smallest standalone surface that lets a user inspect imported memory, generate daily candidate streams, see AI review suggestions, explicitly keep or discard a selected candidate, and then generate knowledge and skill drafts.

## Responsibility Boundary

This UI is responsible for:

- showing local service status
- showing imported memory through a dedicated tab with paging
- showing five memory records per page with first, previous, next, and last navigation controls
- exposing daily candidate generation and explicit review actions
- showing multiple candidate streams instead of a single current candidate
- showing AI review suggestions as advisory detail, not final state
- exposing knowledge and skill generation actions
- separating memory, review, and artifacts into distinct tabs instead of stacking all content on one page
- placing sync, review, and artifact actions inside their corresponding tabs instead of a single global action bar
- rendering candidate, suggestion, reviewed-memory, and artifact states with explicit field-level detail
- showing visible action feedback for success and prerequisite errors

This UI is not responsible for:

- replacing `openclaw`
- advanced search, ranking, or editing
- multi-user or remote deployment concerns

## Key Interfaces

- `renderMirrorBrainWebApp(...)`
- `createMirrorBrainWebApp(...)`

## Data Flow

1. The UI loads health, memory, knowledge, and skill data from the local service API.
2. The user browses memory through the paged memory tab.
3. The user can jump directly to the first or last memory page when the imported list is long.
4. The user triggers browser sync when needed.
5. The user generates daily candidates for the previous local day from the review tab.
6. The UI shows the active review window and the number of matched memory events before or after candidate generation.
7. The UI lists multiple candidate streams and lets the user pick one.
8. The UI shows AI review suggestions for the selected candidate without auto-reviewing it.
9. The user explicitly keeps or discards the selected candidate.
10. The user generates knowledge and skill drafts and inspects them through the artifacts tab.
11. The UI renders a visible status message after each action so the workflow is not silent.

## Test Strategy

- controller and rendering coverage in `src/apps/mirrorbrain-web/main.test.ts`
- end-to-end verification in `tests/e2e/mirrorbrain-phase1-mvp.spec.ts`

## Known Risks Or Limitations

- the current implementation is intentionally minimal and favors operational clarity over visual completeness
- the UI depends on the local HTTP service and asset preparation performed by `pnpm dev`
- memory paging is purely client-side in the current MVP and does not yet reduce backend payload size
- review window filtering is still fixed to the previous local day and does not yet provide a manual date picker
- candidate grouping still depends on backend deterministic stream rules rather than richer semantic clustering
- AI suggestions are advisory placeholders in Phase 1
- the default daily review window is currently the previous local day to make testing and morning review easier
