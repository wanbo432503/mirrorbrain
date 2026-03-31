# MirrorBrain Review UI

## Summary

The Phase 1 review UI is the smallest standalone surface that lets a user inspect imported memory, create a candidate, review it, and generate knowledge and skill drafts.

## Responsibility Boundary

This UI is responsible for:

- showing local service status
- showing imported memory through a dedicated tab with paging
- exposing candidate creation and review actions
- exposing knowledge and skill generation actions
- separating memory, review, and artifacts into distinct tabs instead of stacking all content on one page
- rendering review and artifact states with explicit field-level detail
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
4. The user creates a candidate from selected memory.
5. The user reviews the candidate through the review tab.
6. The user generates knowledge and skill drafts and inspects them through the artifacts tab.
7. The UI renders a visible status message after each action so the workflow is not silent.

## Test Strategy

- controller and rendering coverage in `src/apps/mirrorbrain-web/main.test.ts`
- end-to-end verification in `tests/e2e/mirrorbrain-phase1-mvp.spec.ts`

## Known Risks Or Limitations

- the current implementation is intentionally minimal and favors operational clarity over visual completeness
- the UI depends on the local HTTP service and asset preparation performed by `pnpm dev`
- memory paging is purely client-side in the current MVP and does not yet reduce backend payload size
