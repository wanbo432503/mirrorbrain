# MirrorBrain Review UI

## Summary

The Phase 1 review UI is the standalone operator surface that lets a user inspect imported memory, work through daily candidate streams in a structured review workbench, see AI review suggestions, explicitly keep or discard a selected candidate, and then generate, edit, and save knowledge and skill drafts.

## Responsibility Boundary

This UI is responsible for:

- showing local service status
- showing imported memory through a dedicated tab with paging, newest-first ordering, and explicit source/name/timestamp presentation
- showing ten memory URL records per page by default, with the record list scrolling internally when it exceeds the visible tab height
- keeping first, previous, next, and last memory pagination controls anchored at the bottom of the Memory tab
- exposing future memory-source sync entry points for browser, shell, filesystems, and screenshot capture, while only browser sync currently performs a backend import
- showing not-configured info feedback for memory-source buttons whose runtime support has not been wired up yet
- showing review-window source volume as unique URLs instead of raw ActivityWatch event rows, so background tab sampling does not inflate the review metrics
- showing kept candidate source volume as unique URLs when browser source refs are available, rather than raw event counts
- deriving the default review date from the user's resolved IANA timezone, with `Asia/Shanghai` as the fallback when the browser does not report one
- rendering memory, candidate, source, reviewed-memory, and draft timestamps in the user's IANA timezone while preserving UTC ISO timestamps in persisted data
- exposing daily candidate generation and explicit review actions
- routing daily candidate creation through the service refresh endpoint instead of returning preloaded stale candidates in the browser
- refreshing existing daily candidates after browser sync imports new events, so late-day URLs are considered when the user creates candidates again
- excluding memory events and URLs already synthesized into published knowledge from later daily candidate clustering
- presenting the review flow as a clearer workbench with candidate streams, focused evidence, and decision guidance
- showing multiple candidate streams instead of a single current candidate
- showing AI review suggestions as advisory detail, not final state
- exposing knowledge and skill generation actions
- exposing editable knowledge and skill draft forms in the review tab
- persisting generated knowledge and skill drafts back through the artifact API so refresh reloads them
- showing review-generated knowledge as the final note body instead of separate title and summary fields
- collecting user revision requests in a shorter fixed input block below the generated note so the note body can be refined before save or approval
- exposing generated outputs through separate top-level Knowledge and Skill tabs
- scoping artifact generation views to the candidate currently selected in the review tab
- preserving the review tab workflow state after the user has visited it, so switching to memory, knowledge, or skill does not cancel in-flight knowledge generation or clear kept candidates
- stretching the active tab workbench to the available viewport height, with candidate lists, selected candidate details, and draft editors scrolling inside their own panels instead of relying on fixed pixel heights
- aligning the MirrorBrain brand header to the same left boundary as the tab content and exposing an explicit light/dark theme toggle
- exposing explicit save actions for edited knowledge and skill drafts in the review tab
- separating memory, review, knowledge, and skill into distinct tabs instead of stacking all content on one page
- placing sync, review, and artifact actions inside their corresponding tabs instead of a single global action bar
- rendering candidate, suggestion, reviewed-memory, and artifact states with explicit field-level detail
- showing visible action feedback for success and prerequisite errors
- preserving backend error details in knowledge approval failure feedback so operators can distinguish missing drafts, service errors, and other publish failures

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
3. The user sees up to ten memory URL records in the Memory tab list; overflow stays inside the list's scroll area.
4. The user can jump directly to the first or last memory page when the imported list is long, while the pagination controls remain at the bottom of the tab.
5. The user triggers browser sync when needed, or clicks shell/filesystem/screenshot sync entries that currently explain their not-configured runtime status.
6. The user generates daily candidates for the current local calendar day from the review tab.
7. The UI shows the active review window and the number of unique source URLs before or after candidate generation.
8. The UI lists multiple candidate streams and lets the user pick one.
9. The UI shows AI review suggestions for the selected candidate without auto-reviewing it.
10. The user explicitly keeps or discards the selected candidate.
11. Kept candidate cards display unique URL counts for browser candidates, falling back to generic source counts only when URL refs are unavailable.
12. The user opens the Knowledge or Skill tab to browse previously generated outputs in separate top-level timelines.
13. The user generates knowledge or skill drafts from the candidate currently selected in the review tab.
14. The generated drafts are immediately written back through the artifact API so the Knowledge or Skill tab and the next page load can restore them.
15. After the review tab has been opened, switching to another tab hides rather than unmounts the review workbench, preserving kept candidates, draft state, and in-flight generation status.
16. The app shell, tab panel, and review workbench form a continuous flex height chain so the active tab fills the screen while long content scrolls inside the relevant list or detail panel.
17. The app header uses the same max-width and horizontal padding as the tab content, so the MirrorBrain title and Personal Memory & Knowledge descriptor align with the Memory tab's left edge.
18. The user can toggle between light and dark themes from the header; the selected mode is stored locally and applied through `data-theme`.
19. In the review tab, generated knowledge displays the note body directly in a self-scrolling note field and accepts a one-line revision request in a full-width input row with a send action on the right.
20. The user can save the edited draft artifact back through the local service API.
21. The UI renders a visible status message after each action so the workflow is not silent.

## Test Strategy

- controller and rendering coverage in `src/apps/mirrorbrain-web/main.test.ts`
- React tab lifecycle coverage in `src/apps/mirrorbrain-web-react/src/App.test.tsx`
- end-to-end verification in `tests/e2e/mirrorbrain-phase1-mvp.spec.ts`

## Known Risks Or Limitations

- the current implementation is intentionally minimal and favors operational clarity over visual completeness
- the UI depends on the local HTTP service and asset preparation performed by `pnpm dev`
- memory paging is purely client-side in the current MVP and does not yet reduce backend payload size
- review window filtering is still fixed to the current local calendar day and does not yet provide a manual date picker
- candidate grouping still depends on backend deterministic stream rules rather than richer semantic clustering
- AI suggestions are advisory placeholders in Phase 1
- the default daily review window is currently derived from the user's local calendar day
- artifact editing currently saves whole draft payloads rather than field-level patches
- generated drafts are persisted automatically, but follow-up edits still rely on the explicit Save action
- review-tab knowledge revision requests are captured into the editable note body; they are not a separate autonomous execution path
- the review-window URL count falls back to raw event ids for non-browser candidates that do not carry source URLs
