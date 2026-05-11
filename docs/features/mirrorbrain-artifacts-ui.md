# MirrorBrain Knowledge And Skill UI

## Summary

The former Artifacts tab is split into top-level Knowledge and Skill tabs. Knowledge focuses on published knowledge recall and graph exploration. Skill focuses on generated skill artifacts and keeps execution-related metadata separate from ordinary knowledge browsing.

## Responsibility Boundary

The React artifacts UI is responsible for:

- exposing generated knowledge and generated skill artifacts as separate top-level tabs
- listing only the current-best published knowledge artifact per topic in the main Knowledge tab; draft knowledge remains part of the review workflow and is not shown in artifact history
- ordering each list newest first by `updatedAt`, then `reviewedAt`
- formatting artifact timestamps for display in the user's IANA timezone while keeping persisted artifact metadata as UTC ISO strings
- keeping the Knowledge tab left item list stable across its `List` and `Graph` subtabs
- showing the newest approved knowledge detail by default in Knowledge `List` mode
- showing the global knowledge graph by default in Knowledge `Graph` mode, then a focused graph centered on the selected knowledge artifact and its related topics/artifacts after item selection
- showing lint-generated `topic-merge-candidate` artifacts as merge suggestions that require explicit approval
- showing the selected skill artifact in a right-side detail panel
- capturing local conversation notes that describe requested edits for the selected artifact
- exposing explicit delete actions for persisted knowledge and skill artifacts

It does not synthesize new knowledge, execute skills, or persist conversational edits. Generation, approval, publication, and skill execution remain backend or review workflow responsibilities. Generated knowledge and skill artifacts are written back through the artifact API by the review workflow before these tabs read them. Lint-generated merge candidates are shown as suggestions in the Knowledge tab, but approving them still uses the existing explicit knowledge approval path.

## Key Interfaces

- `KnowledgeArtifact`: rendered with title, summary, Markdown body, wiki-links, tags, related knowledge refs, lifecycle metadata, topic/version metadata, source refs, derived refs, and provenance refs in the detail panel.
- `KnowledgeGraphSnapshot`: rendered in the Knowledge `Graph` mode as either the global relation view or a selected-artifact-centered SVG graph view.
- `SkillArtifact`: rendered with id, approval state, confirmation requirement, workflow evidence refs, and optional timestamps.
- `KnowledgeTabPanel`: loads knowledge artifacts through `useArtifacts`, fetches the knowledge graph from `/knowledge/graph`, and renders `KnowledgePanel`.
- `KnowledgePanel`: owns Knowledge `List` / `Graph` subtab state, knowledge selection, and local conversation-note state.
- `SkillTabPanel`: loads skill artifacts through `useArtifacts` and renders `SkillPanel`.
- `SkillPanel`: owns skill selection and local conversation-note state.

## Data Flow

`KnowledgeTabPanel` and `SkillTabPanel` each read the relevant artifact arrays from `useArtifacts`. When Knowledge tab mounts, it refreshes the knowledge list and graph from the backend, then performs a short delayed refresh to pick up asynchronous lint output such as newly persisted merge candidates. `KnowledgePanel` reduces the published knowledge set to the current-best artifact per topic, sorts the visible list newest first, and keeps that left list unchanged when the user switches between `List` and `Graph` modes. `topic-merge-candidate` drafts are rendered separately under `Merge Suggestions` instead of being mixed into the published knowledge list.

In Knowledge `List` mode, the right detail panel defaults to the newest approved knowledge artifact and changes when another knowledge item is clicked. The body is rendered through `KnowledgeMarkdownRenderer`, so headings, tables, links, and `[[wiki-links]]` read like a durable document rather than a raw text blob. The detail view also exposes tags, related knowledge ids, and indexed document context in a compact metadata panel inspired by the PulseOS-lite document context panel.

In Knowledge `Graph` mode, the right panel defaults to the global knowledge graph. Clicking a knowledge item in graph mode passes that artifact id into `KnowledgeGraphPanel`, which narrows the graph to the centered artifact, its containing topic, related topics, and knowledge artifacts contained by those related topics. Direct artifact-to-artifact edges are preserved for older graph snapshots. Topic nodes display the normalized `topicKey` label, while the current-best artifact title remains available in node metadata and the selection subtitle. The graph renderer uses dependency-free SVG for nodes, relation lines, relation labels, drag repositioning, and a legend; the selection block is stacked below the graph and now only shows the selected node title, subtitle, and legend rather than a Type/Topic/Artifact metadata table. This mirrors the PulseOS-lite graph workspace information architecture without adding its Cytoscape dependency stack to MirrorBrain.

`SkillPanel` sorts skill artifacts newest first, defaults selection to the newest visible skill, and updates the right-side detail panel when a skill item is clicked.

Timestamps remain UTC ISO strings in storage and API payloads. The React display layer converts `updatedAt` and `reviewedAt` through the shared user-time formatter, so users in `Asia/Shanghai` see local wall-clock times such as `2026-05-11 00:30` for `2026-05-10T16:30:00.000Z`.

When the review workflow generates or regenerates knowledge or skill drafts, the hook persists the returned artifact through the save API and upserts the saved version into the shared artifact list. That keeps newly generated artifacts visible in the tab and reloadable after a page refresh.

When the review workflow approves a knowledge draft, the backend publishes the topic artifact and tombstones the source draft so future artifact reloads keep only the published knowledge. The hook replaces the approved draft in shared state with the returned published topic artifact while preserving provenance and `derivedFromKnowledgeIds` links.

When asynchronous knowledge lint creates a `topic-merge-candidate`, the Knowledge tab renders it under `Merge Suggestions`. Selecting a suggestion shows the candidate body and provenance, and `Approve Merge` calls the same approval API used by review-generated drafts. The UI does not auto-merge similar notes. Older topic versions stay out of the main Knowledge list and graph, but history-oriented screens can still show them when they explicitly load history.

Workspace files under `mirrorbrain/knowledge` are treated as the durable local source for approved knowledge. Deletion markers are used to stop stale OpenViking copies from reappearing, but they must not hide a knowledge artifact that still exists in the workspace directory; this keeps the Knowledge tab stable after a browser refresh.

When the user deletes a published knowledge artifact from the detail panel, the backend also tombstones any source draft ids recorded in `derivedFromKnowledgeIds`. The hook removes the deleted id from the shared artifact list immediately so the active timeline and detail view both advance without a manual refresh.

Conversation messages are keyed by artifact category and id, so notes for one knowledge artifact do not leak into another knowledge artifact or skill artifact.

The left timeline panel and right detail/edit panel stretch to the available tab height, with overflow scrolling inside each panel so the detail display and edit input stay visually aligned with the history list across desktop and smaller viewport heights.

The artifact edit message row uses a single-line full-width input with a send action on the right, matching the review note revision row for consistent edit entry behavior.

## Failure Modes And Constraints

- Artifacts without timestamps sort after timestamped artifacts.
- Empty knowledge or skill lists show an empty state instead of a blank detail panel.
- The current knowledge graph UI is an SVG renderer, not a full Cytoscape workspace. It supports global/focused relation reading and drag repositioning, but does not yet provide pan, zoom, force relayout, or incremental graph synchronization.
- Conversation notes are local UI state only. They are review/edit instructions, not published artifact mutations.
- Generated artifacts are persisted; only in-progress edit notes can be lost if the browser closes before the user saves follow-up edits.
- Delete actions remove the artifact from the persisted artifact list; deleting published knowledge also prevents its source draft from reappearing as a separate timeline item. Local conversation notes tied to that artifact id are effectively orphaned because the artifact is no longer selectable.
- Merge suggestions are draft artifacts; they are visible for explicit review but are not treated as published knowledge until approved.
- Merge suggestions are produced asynchronously by knowledge lint, so they can appear shortly after the generated knowledge response rather than in the exact same UI tick.
- Skill detail display remains conservative because current skill artifacts only expose approval state, workflow evidence refs, and confirmation metadata.

## Test Strategy

- `KnowledgePanel.test.tsx` covers current-best-only knowledge list rendering, newest-first ordering, default detail selection, Markdown detail rendering, context metadata, stable left list across List/Graph modes, global graph default, SVG graph nodes/edges, focused graph switching, merge suggestion display/approval, version filtering, and user-timezone timestamp display.
- `useArtifacts.test.tsx` covers reloading the knowledge list so background lint artifacts can become visible in shared UI state.
- `KnowledgeGraphPanel.test.tsx` covers focused graph expansion from a selected knowledge artifact to related topics/artifacts and drag repositioning.
- `SkillPanel.test.tsx` covers newest-first skill rendering, default detail selection, and user-timezone timestamp display.
- `shared/user-time.test.ts` covers deterministic UTC-to-user-timezone formatting and fallback timezone behavior.
- `HistoryTopics.test.tsx` remains as legacy coverage for the previous combined artifact history component until that component is removed.
- Broader verification uses the root Vitest suite, root TypeScript check, and the Vite app production build.
