# MirrorBrain Current Project Status

## Summary

MirrorBrain currently has a runnable Phase 2 and Phase 3 baseline in this
repository. The codebase is no longer just a narrow browser-memory MVP: it now
contains browser and shell sync, source-attributed memory review, topic-oriented
knowledge, knowledge relations, skill draft generation, a local HTTP API, and a
React control UI.

The current system remains local-first and API-first. MirrorBrain owns capture,
review, storage, knowledge generation, and skill draft generation. `openclaw`
should consume MirrorBrain through explicit capability surfaces rather than
owning MirrorBrain's internal workflows.

## Implemented Baselines

### Runtime And API

- Runtime service composition in `src/apps/mirrorbrain-service`.
- Fastify HTTP server in `src/apps/mirrorbrain-http-server`.
- OpenAPI JSON and Swagger UI at `/openapi.json` and `/docs`.
- Shared runtime DTO schemas for knowledge and skill artifact HTTP responses in
  `src/shared/api-contracts`.
- React UI served by the local HTTP server.
- Developer startup CLI through `pnpm dev`.

### Memory

- ActivityWatch browser source integration.
- Shell history source integration.
- Generic source-plugin sync workflow with file checkpoints.
- Initial Phase 4 source-ledger importer for browser, file activity,
  screenshot, audio recording, shell, and agent transcript JSONL ledgers, including
  deterministic memory-event normalization, bad-line audit warnings, and
  checkpointed manual re-import behavior.
- Initial Phase 4 source-ledger import workflow that scans daily JSONL ledgers,
  persists imported memory/audit outputs through injected writers, and exposes
  the default 30-minute scan cadence.
- ActivityWatch browser-to-ledger bridge for the default Phase 4 browser
  recorder, so new `aw-watcher-web` events are converted into daily
  `browser.jsonl` entries before MirrorBrain imports them as `MemoryEvent`
  records.
- Local Phase 4 source-ledger state store for per-ledger checkpoints,
  operational source audit events, and derived source instance summaries.
- Service and HTTP API methods for manual Phase 4 source-ledger import,
  source audit listing, and source status summaries.
- Runtime source authorization checks before source fetch and before
  persistence.
- Best-effort shell command secret redaction before MirrorBrain storage,
  including command-derived shell memory identifiers.
- Browser page-content capture and workspace/QMD storage, gated by a
  separate page-content authorization dependency.
- QMD-backed artifact persistence and workspace fallback reads.
- Memory event display cache with filtering, deduplication, and pagination.
- Daily candidate memory generation.
- Candidate review suggestions.
- Explicit reviewed-memory creation and undo support.
- Browser theme narratives for work-recall queries.
- Shell problem narratives for command-line problem-solving recall.
- `openclaw`-facing `queryMemory` helper and minimum tool example.

### Knowledge

- Daily-review draft generation from reviewed memories.
- LLM-assisted knowledge generation using captured source content when
  available.
- Topic merge candidates.
- Topic knowledge publication with versioning, current-best markers, and
  superseded history.
- Knowledge relation refresh using tags and TF-IDF similarity.
- Knowledge lint plan for duplicate drafts, relation updates, and merge
  candidates.
- Knowledge graph snapshots with topic nodes, artifact nodes, wikilink
  references, and similarity relations.
- Fixture-backed topic knowledge quality evaluation.

### Skill

- Skill draft creation from reviewed memory evidence.
- Skill approval-state modeling.
- Execution safety metadata with confirmation required by default.
- Skill draft list, save, delete, and generate HTTP/UI paths.

### UI

- Memory tab for sync and paginated event review.
- Review tab for daily candidate creation, suggestions, keep/discard decisions,
  and undo.
- Knowledge tab for draft generation/regeneration, approval, topic browsing,
  history, markdown rendering, and graph view.
- Skill tab for draft generation and editing.
- Local component, hook, context, and API-client tests.

## Not Yet Implemented

- Document ingestion.
- Full real source recorders for file activity, screenshot, shell session
  output modes, and agent transcript directories.
- `openclaw` conversation capture.
- Durable authorization and revocation UX across source instances.
- Source-instance and domain/path allowlists beyond the current injected
  runtime policies.
- Direct `openclaw` helpers for topic list/detail/history consumption.
- Stronger storage-level current-best consistency guarantees.
- Production deployment, retention, deletion policy, and operations runbooks.
- Skill execution orchestration beyond draft and approval metadata.

## Current Architecture Reference

The authoritative current-code module catalog is:

- `docs/components/module-reference.md`

Use it for:

- module responsibilities and boundaries
- key inputs and outputs
- dependencies and storage paths
- failure modes and operational constraints
- test coverage mapping

## Source-Of-Truth Planning Docs

- Product design: `docs/plans/2026-03-16-mirrorbrain-design.md`
- Technical design: `docs/plans/2026-03-16-mirrorbrain-technical-design.md`
- Phase 2 / Phase 3 roadmap:
  `docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md`

## Current Implementation Docs

- Module reference: `docs/components/module-reference.md`
- HTTP API contract: `docs/components/mirrorbrain-http-api.md`
- API contracts: `docs/components/api-contracts.md`
- Authorization scope policy: `docs/components/authorization-scope-policy.md`
- Memory source sync: `docs/components/memory-source-sync.md`
- Topic knowledge merge: `docs/components/topic-knowledge-merge.md`
- Topic knowledge read surface: `docs/components/topic-knowledge-read.md`
- Topic knowledge quality: `docs/components/topic-knowledge-quality.md`

## Recommended Next Work

1. Strengthen topic detail/history browsing and openclaw topic adapters.
2. Improve current-best consistency guarantees in storage and service logic.
3. Expand source authorization UX before adding broader source coverage.
4. Add document ingestion only after source authorization and retrieval quality
   are stable.
5. Advance skill execution capability only after confirmation and exception
   boundaries are explicitly documented.
