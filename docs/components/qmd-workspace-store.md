# QMD Workspace Store

## Summary

The QMD Workspace Store is MirrorBrain's default storage and retrieval adapter.
It uses `mirrorbrain-workspace` as the only durable workspace and keeps QMD
SQLite/vector index data inside that same workspace.

## Responsibility Boundary

The component is responsible for:

- opening a QMD store with `dbPath` at
  `<workspaceDir>/mirrorbrain/qmd/index.sqlite`
- configuring QMD collections that point at MirrorBrain-owned markdown
  directories under `<workspaceDir>/mirrorbrain/`
- updating or rebuilding the QMD index after retrieval-relevant markdown
  changes
- serving QMD-backed retrieval for memory read paths through QMD's unified
  structured search, with direct lexical fallback when needed
- mapping QMD search hits back into MirrorBrain memory, knowledge, and skill
  DTOs with provenance preserved

The component is not responsible for:

- source capture or source authorization
- memory review lifecycle policy
- knowledge publication gates
- skill approval or execution confirmation
- storing a second copy of MirrorBrain markdown outside the workspace

## Key Interfaces

Implemented interfaces:

- `getQmdWorkspacePaths(workspaceDir)`
- `createQmdWorkspaceMemoryEventRecord(event)`
- `createQmdWorkspaceMemoryEventWriter({ workspaceDir })`
- `ingestMemoryEventToQmdWorkspace(...)`
- `ingestCandidateMemoryToQmdWorkspace(...)`
- `ingestReviewedMemoryToQmdWorkspace(...)`
- `ingestMemoryNarrativeToQmdWorkspace(...)`
- `ingestBrowserPageContentToQmdWorkspace(...)`
- `ingestKnowledgeArtifactToQmdWorkspace(...)`
- `ingestSkillArtifactToQmdWorkspace(...)`
- `listMirrorBrainMemoryEventsFromQmdWorkspace(...)`
- `listMirrorBrainMemoryEventsFromQmdFiles(...)`
- `listRawMirrorBrainMemoryEventsFromQmdWorkspace(...)`
- `listRawMirrorBrainMemoryEventsFromQmdFiles(...)`
- `listMirrorBrainMemoryNarrativesFromQmdWorkspace(...)`
- `listMirrorBrainCandidateMemoriesFromQmdWorkspace(...)`
- `listMirrorBrainReviewedMemoriesFromQmdWorkspace(...)`
- `listMirrorBrainKnowledgeArtifactsFromQmdWorkspace(...)`
- `listMirrorBrainSkillArtifactsFromQmdWorkspace(...)`

The adapter should use QMD as a Node library, not as a required long-running
HTTP or MCP service.

## Data Flow

1. MirrorBrain writes durable artifacts under `<workspaceDir>/mirrorbrain/`.
2. Retrieval-relevant artifacts expose one canonical markdown projection in
   that workspace.
3. QMD indexes the workspace markdown in place through `@tobilu/qmd`.
4. QMD stores its SQLite/vector index under `<workspaceDir>/mirrorbrain/qmd/`.
5. Memory retrieval calls QMD structured lexical search with reranking
   disabled, then falls back to direct lexical search if unified search is
   unavailable or returns no hits.
6. Retrieval calls map QMD result paths back to existing MirrorBrain
   response contracts.
7. If the index is missing or stale, MirrorBrain can rebuild it from the
   workspace without consulting a second artifact store.

## Failure Modes And Operational Constraints

- Missing workspace path is a configuration error.
- QMD index files are derived state; deleting them should trigger rebuild, not
  data loss.
- Revocation and deletion apply first to MirrorBrain workspace artifacts, then
  the QMD index must be refreshed.
- Markdown projections must not duplicate large source text outside
  `<workspaceDir>/mirrorbrain/`.
- QMD search relevance must not blur memory, knowledge, and skill lifecycle
  boundaries. Search results are evidence for retrieval, not automatic approval
  or publication.

## Test Strategy

Tests cover:

- QMD db/config paths stay under the configured `workspaceDir`
- collections point at MirrorBrain workspace markdown directories
- memory writes produce JSON state and canonical markdown for QMD indexing
- browser page-content writes produce canonical markdown under the same
  workspace
- memory query results map QMD hit paths back to `MemoryEvent` records
- QMD unified structured search is preferred before direct lexical fallback
- startup diagnostics do not require a secondary storage service

Remaining coverage gaps:

- a real QMD embedding smoke test is still needed once local QMD model/build
  prerequisites are standardized
- deletion or revocation should refresh QMD-derived search visibility after the
  revocation policy is finalized
