# MirrorBrain Review UI

## Summary

The Phase 1 review UI is the smallest standalone surface that lets a user inspect imported memory, generate daily candidate streams, see AI review suggestions, explicitly keep or discard a selected candidate, and then generate knowledge and skill drafts.

## Responsibility Boundary

This UI is responsible for:

- showing local service status
- showing imported memory through a dedicated tab with paging
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
3. The user triggers browser sync when needed.
4. The user generates daily candidates for the current day from the review tab.
5. The UI lists multiple candidate streams and lets the user pick one.
6. The UI shows AI review suggestions for the selected candidate without auto-reviewing it.
7. The user explicitly keeps or discards the selected candidate.
8. The user generates knowledge and skill drafts and inspects them through the artifacts tab.
9. The UI renders a visible status message after each action so the workflow is not silent.

## Test Strategy

- controller and rendering coverage in `src/apps/mirrorbrain-web/main.test.ts`
- end-to-end verification in `tests/e2e/mirrorbrain-phase1-mvp.spec.ts`

## Known Risks Or Limitations

- the current implementation is intentionally minimal and favors operational clarity over visual completeness
- the UI depends on the local HTTP service and asset preparation performed by `pnpm dev`
- memory paging is purely client-side in the current MVP and does not yet reduce backend payload size
- candidate grouping still depends on backend deterministic stream rules rather than richer semantic clustering
- AI suggestions are advisory placeholders in Phase 1
