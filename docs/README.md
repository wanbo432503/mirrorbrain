# MirrorBrain Documentation

This directory is the operating documentation surface for MirrorBrain. Planning
documents record why the product moved in a direction; component documents
record how the current code behaves.

## Current Architecture

MirrorBrain is a local-first TypeScript system that turns authorized work
activity into three distinct artifact classes:

- `memory`: source-attributed activity records, retrieval views, candidate
  memories, reviewed memories, and narrative recall artifacts.
- `knowledge`: human-readable notes derived from reviewed memory, including
  daily-review drafts, topic merge candidates, current-best topic knowledge,
  graph relationships, and provenance history.
- `skill`: reusable Agent Skill drafts derived from reviewed workflow evidence.

The implementation is API-first. Business rules live in `src/modules/`,
multi-step orchestration lives in `src/workflows/`, source and storage adapters
live in `src/integrations/`, and runnable surfaces live in `src/apps/`.
Shared domain types and HTTP DTO schemas live in `src/shared/`. The React UI
consumes the same HTTP API that an external host can use.

## Current Refactor Baseline

The current codebase has moved beyond the original browser-only MVP. Treat
these boundaries as part of the current architecture:

- memory-source sync enforces runtime authorization before upstream fetch and
  before persistence
- shell-history memory redacts common secret-bearing command fragments before
  storage and derives persisted shell identifiers from redacted commands
- browser activity capture and readable page text capture are separate
  authorization decisions; the runtime service denies page text backfill by
  default unless an explicit page-content policy is injected
- knowledge and skill artifact HTTP response schemas are shared through
  `src/shared/api-contracts/`

## Documentation Map

- [Module Reference](./components/module-reference.md): current source-code
  module catalog with responsibilities, inputs, outputs, dependencies, failure
  modes, and verification strategy.
- [Codebase Architecture Refactor Analysis](./codebase-architecture-refactor-analysis.md):
  code-level review of current structure, boundary issues, implementation risks,
  and recommended refactor sequence.
- [MirrorBrain HTTP API](./components/mirrorbrain-http-api.md): dedicated
  local HTTP API contract, endpoint payloads, examples, lifecycle rules, and
  failure modes.
- [API Contracts](./components/api-contracts.md): shared runtime DTO schemas
  for public HTTP responses.
- [Local Runtime](./components/local-runtime.md): developer startup flow,
  environment variables, readiness checks, and local service wiring.
- [Authorization Scope Policy](./components/authorization-scope-policy.md):
  runtime source-category authorization and revocation decisions.
- [Memory Source Sync](./components/memory-source-sync.md): generic
  source-plugin ingestion workflow and authorization checkpoints.
- [Source Ledger Importer](./components/source-ledger-importer.md): Phase 4
  JSONL ledger-to-`MemoryEvent` import boundary with audit warnings and
  checkpointed manual re-import.
- [Source Ledger Import Workflow](./components/source-ledger-import.md): scans
  daily JSONL ledgers, persists imported memory/audit outputs, and exposes the
  default 30-minute scan cadence.
- [Source Ledger State Store](./components/source-ledger-state-store.md): local
  checkpoint and source audit state used by Phase 4 import and Source
  Management surfaces.
- [OpenClaw Plugin API](./components/openclaw-plugin-api.md): host-facing
  memory, knowledge, and skill capability helpers.
- [Current Project Status](./features/current-project-status.md): concise
  implemented / not-yet-implemented status snapshot.
- [OpenClaw Memory Tool Example](./features/openclaw-memory-tool-example.md):
  minimum host-facing retrieval example.
- [OpenClaw Memory Demo Guide](./features/openclaw-memory-demo-guide.md):
  manual demo path for the current memory retrieval surface.
- [Phase 2 / Phase 3 Plan](./plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md):
  roadmap source of truth for openclaw integration and topic knowledge.
- [Phase 4 Design Draft](./plans/2026-05-12-mirrorbrain-phase4-design.md):
  draft direction for multi-source ledgers, work sessions, projects, and
  atomic knowledge articles.
- [Phase 5 Design Draft](./plans/2026-05-12-mirrorbrain-phase5-design.md):
  draft direction for high-precision WorkSession Candidate clustering and the
  public current-best knowledge Memory API.

## Component Documentation Policy

Every material software component should have a component document under
`docs/components/` or a local README when the component is isolated. Component
docs should explain:

- purpose and responsibility boundary
- primary inputs and outputs
- key public interfaces
- dependencies and storage paths
- failure modes and operational constraints
- test or verification strategy

When code behavior changes, update the relevant component document in the same
change. For new architecture, update the planning document first or reconcile
the implementation and plan in the same change.

## Source Layout

| Path | Responsibility |
| --- | --- |
| `src/apps/mirrorbrain-service` | Runtime service composition and product API facade. |
| `src/apps/mirrorbrain-http-server` | Fastify HTTP server, OpenAPI schema, static UI serving. |
| `src/apps/mirrorbrain-web-react` | Standalone and embeddable React control surface. |
| `src/integrations` | External source, storage, and host adapters. |
| `src/modules` | Testable domain logic and artifact lifecycle rules. |
| `src/workflows` | Orchestration across modules and integrations. |
| `src/shared` | Shared types, API contracts, config defaults, and low-level LLM HTTP helpers. |
| `tests/integration` | Cross-module Vitest coverage. |
| `tests/e2e` | Playwright user-flow coverage. |

## Runtime Data Model

The local workspace stores MirrorBrain-owned records under
`<workspaceDir>/mirrorbrain/`. The current runtime uses these primary
subdirectories:

- `memory-events/`: normalized raw memory events.
- `ledgers/YYYY-MM-DD/*.jsonl`: Phase 4 source-recorder acquisition ledgers
  before importer normalization.
- `browser-page-content/`: captured readable browser page text. Runtime page
  text capture requires a separate page-content authorization policy.
- `candidate-memories/`: generated review candidates.
- `reviewed-memories/`: user review decisions.
- `memory-narratives/`: offline browser and shell recall summaries.
- `knowledge/project/`: project -> topic -> knowledge tree. New projects and
  draft knowledge files use the `preview_` prefix; published projects and
  published knowledge files omit that prefix.
- `skill-drafts/`: generated skill artifacts.
- `state/sync-checkpoints/`: source-aware incremental sync checkpoints.
- `state/source-ledger-checkpoints/`: Phase 4 per-ledger line checkpoints.
- `source-audit-events/`: operational source audit events for Source Management
  diagnostics and importer/recorder status. These records are separate from
  user work evidence and are not used for memory retrieval, knowledge
  generation, or skill evidence.
- `cache/`: display-oriented memory event cache.
- `deleted-artifacts/`: deletion tombstones for knowledge and skills.

QMD is the current retrieval/indexing backend. It indexes markdown from this
same workspace and stores derived index data under
`<workspaceDir>/mirrorbrain/qmd/`. Source-specific upstream systems, such as
ActivityWatch, are not treated as MirrorBrain's durable store.

## Verification

Use the repository scripts unless a component document names a narrower command.
Root backend/service checks:

```bash
pnpm test
pnpm typecheck
pnpm e2e
```

React UI checks currently run from the nested app directory because this repo
does not yet define a root `pnpm` workspace:

```bash
pnpm --dir src/apps/mirrorbrain-web-react exec vitest run
pnpm --dir src/apps/mirrorbrain-web-react build
```

For documentation-only changes, at minimum run `git diff --check`, inspect
relative links that were added or changed, and run the focused tests for any
documented behavior whose contract was updated.
