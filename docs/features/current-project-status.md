# MirrorBrain Current Project Status

## Summary

MirrorBrain currently has its planned Phase 2 and Phase 3 baselines implemented in this repository.

The project has moved beyond the original narrow MVP. It now supports:

- explicit browser and shell memory sync
- Phase 2 retrieval-oriented memory shaping
- Phase 3 topic-oriented knowledge modeling, merge, read, and quality-evaluation baselines

This document is the concise “what is actually done now” companion to the more detailed planning docs.

## Completed Baselines

### Phase 1 MVP

- local runnable HTTP service and standalone UI
- browser memory import and review loop
- reviewed memory -> knowledge draft -> skill draft flow
- documented fixture-backed end-to-end path

### Phase 2

- `openclaw`-facing `query_memory` contract and demo docs
- browser work-recall retrieval shaping
- shell problem-solving retrieval shaping
- offline browser and shell narratives stored through OpenViking
- startup CLI and local dependency checks

### Phase 3

- Knowledge Artifact 2.0 model
- daily-review draft enrichment
- topic merge workflow with current-best / superseded history
- topic read surfaces:
  - service
  - HTTP
  - minimum standalone web UI summaries
- fixture-backed quality evaluation loop with deterministic rubric

## Not Yet Completed

- document ingestion
- `openclaw` conversation capture
- broader source authorization UX
- richer topic detail/history browsing UI
- direct `openclaw` topic list/detail/history adapter helpers
- stronger storage-level current-best consistency guarantees
- production-grade deployment and operations

## Source-Of-Truth Docs

- roadmap: `docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md`
- Phase 3 implementation plan: `docs/plans/2026-04-03-phase3-knowledge-implementation-plan.md`
- Phase 3 test spec: `docs/plans/2026-04-03-phase3-knowledge-test-spec.md`

## Recommended Next Work

1. post-Phase-3 cleanup and status harmonization
2. richer topic UI and browsing
3. direct `openclaw` topic-read adapter support
4. stronger current-best consistency guarantees
5. broader source coverage and longer-term skill execution work
