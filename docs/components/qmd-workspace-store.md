# QMD Workspace Store

## Summary

The QMD Workspace Store is the target storage/retrieval adapter that will
replace MirrorBrain's OpenViking-backed adapter. It uses `mirrorbrain-workspace`
as the only durable workspace and keeps QMD index/vector data inside that same
workspace.

This document describes the target component. Runtime code still uses the
OpenViking adapter until the migration is implemented.

## Responsibility Boundary

The component is responsible for:

- opening a QMD store with `dbPath` under `<workspaceDir>/mirrorbrain/qmd/`
- configuring QMD collections that point at MirrorBrain-owned markdown
  directories under `<workspaceDir>/mirrorbrain/`
- updating or rebuilding the QMD index after retrieval-relevant markdown
  changes
- serving keyword, vector, and hybrid retrieval for MirrorBrain read paths
- mapping QMD search hits back into MirrorBrain memory, knowledge, and skill
  DTOs with provenance preserved

The component is not responsible for:

- source capture or source authorization
- memory review lifecycle policy
- knowledge publication gates
- skill approval or execution confirmation
- storing a second copy of MirrorBrain markdown outside the workspace

## Key Interfaces

Planned interfaces:

- `createQmdWorkspaceStore({ workspaceDir })`
- `ensureQmdWorkspaceIndex({ workspaceDir })`
- `rebuildQmdWorkspaceIndex({ workspaceDir })`
- `queryQmdWorkspaceMemory(...)`
- `queryQmdWorkspaceKnowledge(...)`
- `queryQmdWorkspaceSkills(...)`
- `getQmdWorkspaceDocument(...)`

The adapter should use QMD as a Node library, not as a required long-running
HTTP or MCP service.

## Data Flow

1. MirrorBrain writes durable artifacts under `<workspaceDir>/mirrorbrain/`.
2. Retrieval-relevant artifacts expose one canonical markdown projection in
   that workspace.
3. QMD indexes the workspace markdown in place.
4. QMD stores its sqlite/vector index under `<workspaceDir>/mirrorbrain/qmd/`.
5. Retrieval calls query QMD and map results back to existing MirrorBrain
   response contracts.
6. If the index is missing or stale, MirrorBrain can rebuild it from the
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

Migration tests should cover:

- QMD db/config paths stay under the configured `workspaceDir`
- collections point at MirrorBrain workspace markdown directories
- index rebuild works from workspace markdown only
- missing index state can be recreated
- memory query results preserve existing `MemoryQueryResult` shape
- deletion or revocation refreshes QMD-derived search visibility
- startup diagnostics no longer require OpenViking reachability
