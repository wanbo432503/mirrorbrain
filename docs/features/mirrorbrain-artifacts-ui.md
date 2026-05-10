# MirrorBrain Knowledge And Skill UI

## Summary

The former Artifacts tab is split into top-level Knowledge and Skill tabs. Knowledge focuses on published knowledge recall and graph exploration. Skill focuses on generated skill artifacts and keeps execution-related metadata separate from ordinary knowledge browsing.

## Responsibility Boundary

The React artifacts UI is responsible for:

- exposing generated knowledge and generated skill artifacts as separate top-level tabs
- listing only published knowledge artifacts; draft knowledge remains part of the review workflow and is not shown in artifact history
- ordering each list newest first by `updatedAt`, then `reviewedAt`
- keeping the Knowledge tab left item list stable across its `List` and `Graph` subtabs
- showing the newest approved knowledge detail by default in Knowledge `List` mode
- showing the global knowledge graph by default in Knowledge `Graph` mode, then a focused graph centered on the selected knowledge artifact after item selection
- showing the selected skill artifact in a right-side detail panel
- capturing local conversation notes that describe requested edits for the selected artifact
- exposing explicit delete actions for persisted knowledge and skill artifacts

It does not synthesize new knowledge, execute skills, or persist conversational edits. Generation, approval, publication, and skill execution remain backend or review workflow responsibilities. Generated knowledge and skill artifacts are written back through the artifact API by the review workflow before these tabs read them.

## Key Interfaces

- `KnowledgeArtifact`: rendered with title, summary, Markdown body, wiki-links, tags, related knowledge refs, lifecycle metadata, topic/version metadata, source refs, derived refs, and provenance refs in the detail panel.
- `KnowledgeGraphSnapshot`: rendered in the Knowledge `Graph` mode as either the global relation view or a selected-artifact-centered SVG graph view.
- `SkillArtifact`: rendered with id, approval state, confirmation requirement, workflow evidence refs, and optional timestamps.
- `KnowledgeTabPanel`: loads knowledge artifacts through `useArtifacts`, fetches the knowledge graph from `/knowledge/graph`, and renders `KnowledgePanel`.
- `KnowledgePanel`: owns Knowledge `List` / `Graph` subtab state, knowledge selection, and local conversation-note state.
- `SkillTabPanel`: loads skill artifacts through `useArtifacts` and renders `SkillPanel`.
- `SkillPanel`: owns skill selection and local conversation-note state.

## Data Flow

`KnowledgeTabPanel` and `SkillTabPanel` each read the relevant artifact arrays from `useArtifacts`. `KnowledgePanel` filters knowledge to `draftState: published`, sorts the list newest first, and keeps that left list unchanged when the user switches between `List` and `Graph` modes.

In Knowledge `List` mode, the right detail panel defaults to the newest approved knowledge artifact and changes when another knowledge item is clicked. The body is rendered through `KnowledgeMarkdownRenderer`, so headings, tables, links, and `[[wiki-links]]` read like a durable document rather than a raw text blob. The detail view also exposes tags, related knowledge ids, and indexed document context in a compact metadata panel inspired by the PulseOS-lite document context panel.

In Knowledge `Graph` mode, the right panel defaults to the global knowledge graph. Clicking a knowledge item in graph mode passes that artifact id into `KnowledgeGraphPanel`, which narrows the graph to the centered artifact and directly related nodes and edges. The graph renderer uses dependency-free SVG for nodes, relation lines, relation labels, selection metadata, and a legend; this mirrors the PulseOS-lite graph workspace information architecture without adding its Cytoscape dependency stack to MirrorBrain.

`SkillPanel` sorts skill artifacts newest first, defaults selection to the newest visible skill, and updates the right-side detail panel when a skill item is clicked.

When the review workflow generates or regenerates knowledge or skill drafts, the hook persists the returned artifact through the save API and upserts the saved version into the shared artifact list. That keeps newly generated artifacts visible in the tab and reloadable after a page refresh.

When the review workflow approves a knowledge draft, the backend publishes the topic artifact and tombstones the source draft so future artifact reloads keep only the published knowledge. The hook replaces the approved draft in shared state with the returned published topic artifact while preserving provenance and `derivedFromKnowledgeIds` links.

When the user deletes a published knowledge artifact from the detail panel, the backend also tombstones any source draft ids recorded in `derivedFromKnowledgeIds`. The hook removes the deleted id from the shared artifact list immediately so the active timeline and detail view both advance without a manual refresh.

Conversation messages are keyed by artifact category and id, so notes for one knowledge artifact do not leak into another knowledge artifact or skill artifact.

The left timeline panel and right detail/edit panel stretch to the available tab height, with overflow scrolling inside each panel so the detail display and edit input stay visually aligned with the history list across desktop and smaller viewport heights.

The artifact edit message row uses a single-line full-width input with a send action on the right, matching the review note revision row for consistent edit entry behavior.

## Failure Modes And Constraints

- Artifacts without timestamps sort after timestamped artifacts.
- Empty knowledge or skill lists show an empty state instead of a blank detail panel.
- The current knowledge graph UI is an SVG renderer, not a full Cytoscape workspace. It supports global/focused relation reading but does not yet provide pan, zoom, drag, force relayout, or incremental graph synchronization.
- Conversation notes are local UI state only. They are review/edit instructions, not published artifact mutations.
- Generated artifacts are persisted; only in-progress edit notes can be lost if the browser closes before the user saves follow-up edits.
- Delete actions remove the artifact from the persisted artifact list; deleting published knowledge also prevents its source draft from reappearing as a separate timeline item. Local conversation notes tied to that artifact id are effectively orphaned because the artifact is no longer selectable.
- Skill detail display remains conservative because current skill artifacts only expose approval state, workflow evidence refs, and confirmation metadata.

## Test Strategy

- `KnowledgePanel.test.tsx` covers approved-only knowledge list rendering, newest-first ordering, default detail selection, Markdown detail rendering, context metadata, stable left list across List/Graph modes, global graph default, SVG graph nodes/edges, and focused graph switching.
- `SkillPanel.test.tsx` covers newest-first skill rendering and default detail selection.
- `HistoryTopics.test.tsx` remains as legacy coverage for the previous combined artifact history component until that component is removed.
- Broader verification uses the root Vitest suite, root TypeScript check, and the Vite app production build.
