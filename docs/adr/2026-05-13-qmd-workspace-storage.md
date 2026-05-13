# ADR: QMD Workspace Storage And Retrieval

## Status

Accepted for the next storage-backend migration. The current implementation
still contains OpenViking-backed runtime code until the migration is completed.

## Context

MirrorBrain originally used OpenViking as the local storage and retrieval
backend. That proved the Phase 1 MVP, but it now creates two structural costs:

- a separate long-running OpenViking service is required before MirrorBrain can
  start
- MirrorBrain writes workspace artifacts and then imports overlapping text into
  OpenViking resources, creating duplicate durable text surfaces and drift risk

QMD is a better fit for the next architecture because its documented Node
library exposes `createStore({ dbPath, config })`, collection indexing,
keyword search, vector search, hybrid query, document retrieval, and explicit
embedding/update operations. QMD can be used in-process by MirrorBrain instead
of requiring MirrorBrain to depend on a separate local search service.

## Decision

MirrorBrain should migrate from OpenViking-backed storage/retrieval to a
workspace-owned QMD-backed retrieval layer.

The durable workspace rule is:

- `mirrorbrain-workspace` is the only MirrorBrain workspace
- MirrorBrain-owned markdown/json artifacts live under
  `<workspaceDir>/mirrorbrain/`
- QMD index and vector database files also live under the same workspace, under
  `<workspaceDir>/mirrorbrain/qmd/`
- no `openviking-workspace`, QMD workspace, or other second artifact workspace
  should be introduced
- QMD markdown inputs must be sourced from the MirrorBrain workspace, not copied
  into a second index-content tree

The target QMD layout is:

```text
<workspaceDir>/
  mirrorbrain/
    memory-events/
    candidate-memories/
    reviewed-memories/
    knowledge/
    skill-drafts/
    browser-page-content/
    memory-narratives/
    qmd/
      index.sqlite
      qmd.yml
```

QMD should index markdown artifacts in place. JSON files remain MirrorBrain
durable state where JSON is the right lifecycle format, but any artifact that
needs semantic retrieval should have one canonical markdown projection in the
workspace. The markdown projection is the qmd source document; the qmd sqlite
database is rebuildable derived index state.

## Target Interfaces

Introduce a new integration boundary, tentatively:

- `src/integrations/qmd-workspace-store`

Responsibilities:

- create/open the QMD store with `dbPath` inside `<workspaceDir>/mirrorbrain/qmd`
- configure QMD collections that point at MirrorBrain-owned markdown directories
- update/re-index QMD after MirrorBrain writes retrieval-relevant markdown
- run keyword/vector/hybrid retrieval for memory, knowledge, and skill read
  paths
- return MirrorBrain domain DTOs with source attribution preserved

Non-responsibilities:

- source capture
- memory lifecycle policy
- knowledge publication gates
- skill approval or execution policy
- duplicating markdown into a second workspace

## Migration Plan

1. Extract workspace artifact persistence out of the current OpenViking adapter
   so durable writes are clearly filesystem-owned.
2. Add `qmd-workspace-store` behind tests that prove db/config paths stay under
   `MIRRORBRAIN_WORKSPACE_DIR`.
3. Generate canonical markdown projections for retrieval-relevant memory events
   and narratives without duplicating source text outside the workspace.
4. Replace OpenViking read paths in `openclaw-plugin-api` with QMD-backed
   retrieval while preserving existing `MemoryQueryResult` shape.
5. Replace startup diagnostics: keep ActivityWatch checks, remove mandatory
   OpenViking reachability, and add QMD index health/rebuild guidance.
6. Retire OpenViking-specific imports, config, docs, and compatibility tests
   after all runtime reads and writes use workspace/QMD.

## Consequences

- MirrorBrain startup becomes simpler because no separate storage service is
  required.
- The workspace becomes the canonical durable source, reducing duplicated text
  and storage drift.
- QMD indexing and embedding become rebuildable derived state; deletion and
  revocation semantics should operate on MirrorBrain workspace artifacts first,
  then trigger index refresh.
- The migration must preserve memory/knowledge/skill boundaries. QMD is an
  index and retrieval engine, not a new lifecycle owner.
- Existing OpenViking tests should be replaced gradually with workspace-store
  and QMD-store contract tests rather than deleted in one unverified step.
