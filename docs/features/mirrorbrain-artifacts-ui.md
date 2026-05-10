# MirrorBrain Artifacts UI

## Summary

The Artifacts tab presents generated MirrorBrain outputs after review. It keeps the knowledge and skill artifact categories separate while sharing one detail surface for inspection and local edit discussion.

## Responsibility Boundary

The React artifacts UI is responsible for:

- listing already generated knowledge artifacts and skill artifacts
- listing only published knowledge artifacts; draft knowledge remains part of the review workflow and is not shown in artifact history
- keeping knowledge and skill lists in separate subtabs
- ordering each list newest first by `updatedAt`, then `reviewedAt`
- showing the selected artifact in a single right-side detail panel
- capturing local conversation notes that describe requested edits for the selected artifact
- exposing explicit delete actions for persisted knowledge and skill artifacts

It does not synthesize new knowledge, execute skills, or persist conversational edits. Generation, approval, publication, and skill execution remain backend or review workflow responsibilities. Generated knowledge and skill artifacts are written back through the artifact API by the review workflow before this tab reads them.

## Key Interfaces

- `KnowledgeArtifact`: rendered with title, summary, body, lifecycle metadata, topic/version metadata, source refs, derived refs, and provenance refs in the detail panel.
- `SkillArtifact`: rendered with id, approval state, confirmation requirement, workflow evidence refs, and optional timestamps.
- `HistoryTopics`: receives `knowledgeArtifacts` and `skillArtifacts` from `useArtifacts` and owns the local subtab, selection, and conversation-note state.

## Data Flow

`ArtifactsPanel` reads artifact arrays from `useArtifacts`. `HistoryTopics` filters knowledge to `draftState: published`, sorts the active category newest first, defaults selection to the newest visible artifact, and updates the right-side detail panel when a list item is clicked.

When the review workflow generates or regenerates knowledge or skill drafts, the hook persists the returned artifact through the save API and upserts the saved version into the shared artifact list. That keeps newly generated artifacts visible in the tab and reloadable after a page refresh.

When the review workflow approves a knowledge draft, the backend publishes the topic artifact and tombstones the source draft so future artifact reloads keep only the published knowledge. The hook replaces the approved draft in shared state with the returned published topic artifact while preserving provenance and `derivedFromKnowledgeIds` links.

When the user deletes a published knowledge artifact from the detail panel, the backend also tombstones any source draft ids recorded in `derivedFromKnowledgeIds`. The hook removes the deleted id from the shared artifact list immediately so the active timeline and detail view both advance without a manual refresh.

Conversation messages are keyed by artifact category and id, so notes for one knowledge artifact do not leak into another knowledge artifact or skill artifact.

The left timeline panel and right detail/edit panel share the same fixed height, with overflow scrolling inside each panel so the detail display and edit input stay visually aligned with the history list.

The artifact edit message row uses a single-line full-width input with a send action on the right, matching the review note revision row for consistent edit entry behavior.

## Failure Modes And Constraints

- Artifacts without timestamps sort after timestamped artifacts.
- Empty knowledge or skill lists show an empty state instead of a blank detail panel.
- Conversation notes are local UI state only. They are review/edit instructions, not published artifact mutations.
- Generated artifacts are persisted; only in-progress edit notes can be lost if the browser closes before the user saves follow-up edits.
- Delete actions remove the artifact from the persisted artifact list; deleting published knowledge also prevents its source draft from reappearing as a separate timeline item. Local conversation notes tied to that artifact id are effectively orphaned because the artifact is no longer selectable.
- Skill detail display remains conservative because current skill artifacts only expose approval state, workflow evidence refs, and confirmation metadata.

## Test Strategy

- `HistoryTopics.test.tsx` covers Knowledge / Skill subtab rendering, newest-first ordering, published-only knowledge filtering, artifact selection, full knowledge detail display, delete actions, and local conversation-note behavior.
- Broader verification uses the root Vitest suite, root TypeScript check, and the Vite app production build.
