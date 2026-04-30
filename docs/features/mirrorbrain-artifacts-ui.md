# MirrorBrain Artifacts UI

## Summary

The Artifacts tab presents generated MirrorBrain outputs after review. It keeps the knowledge and skill artifact categories separate while sharing one detail surface for inspection and local edit discussion.

## Responsibility Boundary

The React artifacts UI is responsible for:

- listing already generated knowledge artifacts and skill artifacts
- keeping knowledge and skill lists in separate subtabs
- ordering each list newest first by `updatedAt`, then `reviewedAt`
- showing the selected artifact in a single right-side detail panel
- capturing local conversation notes that describe requested edits for the selected artifact

It does not synthesize new knowledge, execute skills, or persist conversational edits. Generation, approval, publication, and skill execution remain backend or review workflow responsibilities.

## Key Interfaces

- `KnowledgeArtifact`: rendered with title, summary, body, state, source count, and timestamps.
- `SkillArtifact`: rendered with id, approval state, confirmation requirement, workflow evidence refs, and optional timestamps.
- `HistoryTopics`: receives `knowledgeArtifacts` and `skillArtifacts` from `useArtifacts` and owns the local subtab, selection, and conversation-note state.

## Data Flow

`ArtifactsPanel` reads artifact arrays from `useArtifacts`. `HistoryTopics` sorts the active category newest first, defaults selection to the newest visible artifact, and updates the right-side detail panel when a list item is clicked.

Conversation messages are keyed by artifact category and id, so notes for one knowledge artifact do not leak into another knowledge artifact or skill artifact.

The left timeline panel and right detail/edit panel share the same fixed height, with overflow scrolling inside each panel so the detail display and edit input stay visually aligned with the history list.

The artifact edit message row uses a single-line full-width input with a send action on the right, matching the review note revision row for consistent edit entry behavior.

## Failure Modes And Constraints

- Artifacts without timestamps sort after timestamped artifacts.
- Empty knowledge or skill lists show an empty state instead of a blank detail panel.
- Conversation notes are local UI state only. They are review/edit instructions, not published artifact mutations.
- Skill detail display remains conservative because current skill artifacts only expose approval state, workflow evidence refs, and confirmation metadata.

## Test Strategy

- `HistoryTopics.test.tsx` covers Knowledge / Skill subtab rendering, newest-first ordering, artifact selection, detail display, and local conversation-note behavior.
- Broader verification uses the root Vitest suite, root TypeScript check, and the Vite app production build.
