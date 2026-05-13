# ADR: Phase 1 Must Be A User-Runnable MVP

## Status

Accepted

## Later Storage Update

This ADR records the historical Phase 1 MVP scope. Its OpenViking storage
decision is superseded for future storage work by
`docs/adr/2026-05-13-qmd-workspace-storage.md`, which keeps
`mirrorbrain-workspace` as the only durable workspace and uses QMD as a
workspace-local retrieval index.

## Context

MirrorBrain already has a meaningful Phase 1 backend slice:

- browser memory import from `ActivityWatch`
- normalized memory persistence into `OpenViking`
- candidate and reviewed memory domain logic
- knowledge and skill draft generation
- plugin-facing retrieval APIs

That slice is valuable, but it is not enough for the product milestone the repository should call “Phase 1 MVP”. A backend-only path still leaves a new user unable to:

- start the system from repository documentation
- verify the runtime is healthy
- perform review through a real interface
- complete the end-to-end flow without reading source code

## Decision

For this repository, “Phase 1 MVP” means a user-runnable local environment, not just a code-complete service slice.

The minimum acceptable MVP must include:

- a documented local runtime for `ActivityWatch`, `OpenViking`, and MirrorBrain
- a runnable MirrorBrain service surface with health and workflow endpoints
- a minimal user-facing review and generation interface
- persistent storage for the artifacts a user must revisit during the MVP flow
- a root `README.md` that explains setup, startup, usage, verification, and limitations
- at least one end-to-end automated test that follows the documented user path

## Consequences

This decision changes the order of remaining work.

Before broadening source coverage or adding more sophisticated product behavior, the project should prioritize:

1. runnable service packaging
2. user-facing review flow
3. MVP documentation
4. end-to-end startup and usage verification

It also narrows what “done” means for future claims about Phase 1. A backend capability is not sufficient on its own unless it is reachable from the documented MVP runtime and user flow.
