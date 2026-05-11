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
The React UI consumes the same HTTP API that an external host can use.

## Documentation Map

- [Module Reference](./components/module-reference.md): current source-code
  module catalog with responsibilities, inputs, outputs, dependencies, failure
  modes, and verification strategy.
- [MirrorBrain HTTP API](./components/mirrorbrain-http-api.md): dedicated
  local HTTP API contract, endpoint payloads, examples, lifecycle rules, and
  failure modes.
- [Current Project Status](./features/current-project-status.md): concise
  implemented / not-yet-implemented status snapshot.
- [OpenClaw Memory Tool Example](./features/openclaw-memory-tool-example.md):
  minimum host-facing retrieval example.
- [OpenClaw Memory Demo Guide](./features/openclaw-memory-demo-guide.md):
  manual demo path for the current memory retrieval surface.
- [Phase 2 / Phase 3 Plan](./plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md):
  roadmap source of truth for openclaw integration and topic knowledge.

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
| `src/shared` | Shared types, config defaults, and low-level LLM HTTP helpers. |
| `tests/integration` | Cross-module Vitest coverage. |
| `tests/e2e` | Playwright user-flow coverage. |

## Runtime Data Model

The local workspace stores MirrorBrain-owned records under
`<workspaceDir>/mirrorbrain/`. The current runtime uses these primary
subdirectories:

- `memory-events/`: normalized raw memory events.
- `browser-page-content/`: captured readable browser page text.
- `candidate-memories/`: generated review candidates.
- `reviewed-memories/`: user review decisions.
- `memory-narratives/`: offline browser and shell recall summaries.
- `knowledge/`: knowledge drafts, topic candidates, and topic knowledge.
- `skill-drafts/`: generated skill artifacts.
- `state/sync-checkpoints/`: source-aware incremental sync checkpoints.
- `cache/`: display-oriented memory event cache.
- `deleted-artifacts/`: deletion tombstones for knowledge and skills.

OpenViking is the retrieval/indexing backend, but the workspace files are also
used as a local durability and fallback surface. Source-specific upstream
systems, such as ActivityWatch, are not treated as MirrorBrain's durable store.

## Verification

Use the repository scripts unless a component document names a narrower command:

```bash
pnpm test
pnpm typecheck
pnpm e2e
```

For documentation-only changes, at minimum run `git diff --check` and inspect
relative links that were added or changed.
