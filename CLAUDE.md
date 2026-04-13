# AGENTS.md

This file defines how Codex should design, implement, test, and document the MirrorBrain project in this repository.

## Project Context

- Project name: MirrorBrain / 镜像大脑
- Product direction: an `openclaw` plugin that provides memory, knowledge, and skill capabilities based on authorized PC work activity
- Product role inside `openclaw`: MirrorBrain is not a generic note app inside this repository. It is the memory and capability layer for `openclaw`, responsible for turning authorized user activity into reusable context and operator assistance
- product strategy priority:
  - first priority: be installable and usable through the existing `openclaw` plugin system
  - second priority: deliver clear value as a personal work memory system
  - long-term priority: evolve toward a personal AI operating system that can help continuously advance user goals
- current project stage:
  - Phase 1 MVP has already been proven in this repository as an independent local vertical slice
  - the current roadmap focus is Phase 2 integration with `openclaw`
  - after Phase 2 integration is stable, the next major focus is improving MirrorBrain's own knowledge and skill quality without breaking the integration boundary
- Core capability model:
  - memory: captured records of authorized work activity, including browser history, viewed documents, shell interaction history, and conversation history with `openclaw`; memory is the raw or lightly processed recall layer
  - knowledge: strongly reasoned notes synthesized from daily review workflows; knowledge must be readable by both humans and agents, and should help people review past work and trigger new ideas for future work
  - skill: reusable Agent Skills distilled from repeatable workflows; skills are executable guidance artifacts for AI systems and must remain explicitly confirmable by the user before activation or execution
- Product objective: help `openclaw` remember what the user did, summarize what the user learned, and operationalize repeatable work into safe, reviewable agent skills
- Source-of-truth planning docs:
  - `docs/plans/2026-03-16-mirrorbrain-design.md`
  - `docs/plans/2026-03-16-mirrorbrain-prd.md`
  - `docs/plans/2026-03-16-mirrorbrain-technical-design.md`
  - `docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md`

If implementation work conflicts with these documents, update the docs first or explicitly reconcile the difference in the same change.

If these planning docs do not exist yet in the repository, create or update them before treating any new architecture or feature behavior as settled.

## Required Technology Choices

Codex must treat the following as fixed project constraints unless the user explicitly changes them:

- frontend language: TypeScript
- backend language: TypeScript
- backend architecture: API-first and service-oriented
- frontend integration mode: both standalone app and embeddable sub-feature in other apps

This means:

- backend capabilities must be exposed through explicit APIs
- frontend code must consume backend interfaces rather than embed backend logic directly
- frontend feature areas should be designed as composable modules that can be mounted inside other applications
- plugin-facing surfaces should be designed so `openclaw` can request memory, knowledge, and skill capabilities independently

## Product Capability Boundaries

Codex must preserve the distinction between MirrorBrain's three primary outputs:

- memory output: event records, retrieval views, timelines, candidate memories, and source-linked recall artifacts
- knowledge output: curated review notes, synthesized summaries, structured insights, and other logically organized human-readable material derived from review
- skill output: draft or approved Agent Skills that encode repeatable workflows for AI execution

Codex must not blur these categories in naming, API design, storage models, or documentation unless the user explicitly requests a different abstraction.

### Memory Scope

MirrorBrain memory scope can include:

- browser records from authorized sources
- documents the user viewed through authorized collection paths
- shell interaction history captured from authorized environments
- `openclaw` conversation history and related agent interaction traces

Memory capture must remain authorization-bound, source-attributed, and reviewable by the user.

Current priority rules:

- Phase 2 memory integration should prioritize browser memory first
- shell memory is the next priority after browser integration is stable enough for `openclaw`
- `openclaw` conversation capture is not a current priority because `openclaw` already maintains its own conversation history and MirrorBrain should preserve a global-memory stance rather than biasing toward host-native traces
- when expanding sources, prefer improvements that make retrieval more useful in `openclaw` before broadening source count

### Knowledge Scope

Knowledge should be treated as a derived layer built from review, not as raw capture. By default:

- knowledge is produced through daily review or similar explicit summarization workflows
- knowledge should emphasize strong logic, structure, and explainability
- knowledge artifacts should be suitable for both agent retrieval and direct human reading
- knowledge should help with recall, understanding, and future task inspiration

Current priority rules:

- knowledge is primarily for human reading and secondarily for agent retrieval
- MirrorBrain generates knowledge; `openclaw` consumes it but should not own the knowledge-generation workflow
- after `openclaw` integration is stable, knowledge quality becomes the next major product focus
- the preferred durable reading unit is a topic- or problem-oriented knowledge artifact rather than a daily summary page
- the default evolution path is for topic knowledge to grow out of repeated daily review inputs, while the presented artifact remains a rewritten current-best version with provenance and a lightweight version history

### Skill Scope

Skill artifacts should be treated as agent-operable workflow guidance. By default:

- skills are derived from repeatable workflows observed in memory and clarified through review
- skills must be explicit artifacts, not hidden prompts embedded in unrelated code
- skill generation, approval, and execution must preserve human confirmation boundaries
- skill outputs should be portable enough to serve as reusable Agent Skills inside `openclaw`

Current priority rules:

- in `openclaw`, skill usage follows memory and knowledge integration, not the reverse
- the long-term emphasis is stronger execution capability, not just static skill-library management
- skill execution should first become useful for knowledge-work progression tasks before heavier software-operation automation
- low-risk automation exceptions must be explicitly defined in planning docs before implementation; absent that definition, explicit confirmation remains the default boundary

## Roadmap Priorities

Unless the user explicitly changes the roadmap, treat the following sequence as the default:

- Phase 2A: wrap MirrorBrain for `openclaw` plugin use and prove the minimum browser-memory demo in `openclaw` chat
- Phase 2B: improve memory retrieval quality and `openclaw` chat usefulness, while expanding carefully from browser into shell memory
- Phase 3: improve knowledge quality, especially topic- and problem-oriented knowledge artifacts derived from daily review
- later phases: make skill execution progressively stronger for knowledge-work task advancement

North-star ordering:

- first: users can reliably recover what they previously did
- second: users accumulate high-quality knowledge over time
- third: users offload more work to a growing personal AI capability layer

## OpenClaw Integration Contract

Until a more specific technical design is committed, Codex should treat the `openclaw` integration contract as follows:

- MirrorBrain is an independent service with its own standalone UI and operational surface
- MirrorBrain must still be easy to wrap as an `openclaw` plugin capability provider
- MirrorBrain is a plugin-oriented subsystem that exposes explicit capability surfaces to `openclaw`, rather than embedding business logic ad hoc inside unrelated UI or host code
- `openclaw` must be able to request memory, knowledge, and skill capabilities independently
- MirrorBrain-owned business logic should live in MirrorBrain modules and services; `openclaw`-specific code should mainly adapt host APIs, events, and transport concerns
- integration boundaries must be explicit and documented: API shape, event payloads, lifecycle hooks, auth context, and failure handling
- if the host/plugin boundary is still undecided, implementation should default to a narrow API-first adapter that can support either in-process embedding or out-of-process service calls later
- the primary transport strategy is:
  - MirrorBrain exposes a stable HTTP service surface for independent operation, testing, and debugging
  - `openclaw` consumes MirrorBrain through a thinner plugin-facing wrapper adapted to the host's tool or plugin model
- for user-facing adoption, `openclaw` is the primary interaction surface; MirrorBrain's own UI is mainly a control, debug, and demonstration surface

Minimum interface expectations for new work:

- memory queries should return source-attributed records or summaries with stable identifiers
- knowledge queries should return human-readable synthesized artifacts with enough metadata for provenance and review status
- skill queries should return draft or approved skill artifacts with approval state and execution safety metadata
- write operations from `openclaw` into MirrorBrain must preserve auditability, including who or what initiated the action

Codex must not assume hidden host state, implicit callbacks, or undocumented cross-module coupling between `openclaw` and MirrorBrain.

Default interaction policy for `openclaw` integration:

- first integrated user experience: the user asks in chat what they previously did or saw, and `openclaw` uses MirrorBrain to answer
- first integrated capability order: `memory` then `knowledge` then `skill`
- first memory retrieval mode: user-visible chat interaction backed by explicit MirrorBrain capability calls under the hood
- hidden or implicit retrieval can evolve later, but initial implementations should stay observable, explainable, and easy to debug
- `openclaw` should present natural language answers using MirrorBrain results as context, with lightweight source hints by default
- default chat retrieval should search memory first, optionally enrich with knowledge, and should not pull skills into ordinary retrieval responses
- `openclaw` should consume knowledge artifacts but should not own the workflow that generates them
- `openclaw` should consume generated skills, first through explicit selection and invocation, then later through more agent-visible recommendation flows

## Authorization And Privacy Policy

Before implementing any capture, storage, retrieval, or generation flow, Codex must preserve these rules:

- all memory capture is opt-in through explicit authorization scopes, not broad ambient access
- authorization should be representable per source category and, when relevant, per source instance or path
- users must be able to understand which sources are enabled, what is being captured, and what downstream products may be generated from that capture
- source attribution must be preserved from capture through retrieval, review, synthesis, and skill generation
- revocation must be treated as a first-class requirement: disabling a source should stop new capture immediately, and follow-up handling of already captured data must be defined in the relevant component docs
- high-risk or sensitive data must never be silently promoted into durable knowledge or executable skills

Unless explicitly approved in planning docs, treat the following as forbidden by default:

- collecting data from unauthorized apps, sites, directories, or shell contexts
- capturing secrets, credentials, tokens, or clipboard contents as a product feature
- executing workflows automatically based only on inferred user intent
- exposing private memory records to `openclaw` features that do not declare a need for them

When implementation details remain open, prefer the more restrictive privacy-preserving interpretation.

## Lifecycle Definitions

Codex should treat MirrorBrain artifacts as moving through explicit lifecycle stages instead of jumping directly from raw activity to durable outputs.

### Memory Lifecycle

- raw memory event: a source-attributed captured record from an authorized browser, document, shell, or `openclaw` interaction source
- candidate memory: a raw event or grouped set of events prepared for review, deduplication, ranking, or summarization
- reviewed memory: a candidate memory that has been explicitly kept, edited, merged, or annotated by a human

Rules:

- raw memory events should preserve provenance and timestamps
- candidate memory generation may automate ranking or grouping, but not irreversible approval
- reviewed memory status must reflect an explicit human action or a documented equivalent review workflow

Additional guidance for current roadmap:

- retrieval-oriented memory views may aggressively compress repeated browser events at upper layers as long as lower layers preserve provenance
- browser memory should prefer theme or task recall over raw navigation chronology
- shell memory should preserve raw command traces at lower layers but should primarily surface task-level memories at upper layers

### Knowledge Lifecycle

- review input: reviewed memories and other approved context selected for synthesis
- knowledge draft: a structured, strongly reasoned note produced from review input
- published knowledge: a knowledge artifact that has passed the required review gate for the use case

Rules:

- knowledge must cite or link back to its supporting reviewed inputs
- daily review is the default path for creating knowledge unless a plan explicitly defines another review workflow
- durable or high-value knowledge should not be treated as published until a human review step is completed

### Skill Lifecycle

- workflow evidence: repeated or notable reviewed activity patterns derived from memory and review
- skill draft: a proposed Agent Skill generated from workflow evidence and supporting context
- approved skill: a skill artifact explicitly accepted for reuse
- executable skill: an approved skill invoked in a context that satisfies current authorization and confirmation requirements

Rules:

- workflow evidence alone is never enough to auto-create an executable skill
- skill drafts must keep links to the evidence or rationale that produced them
- approval to create a draft is not the same as approval to execute the resulting skill
- every skill execution path must include an explicit confirmation boundary unless the user has approved a narrower exception in planning docs

## Current Delivery Focus

Unless the user explicitly changes the roadmap, assume the active planning focus is:

- Phase 2A: `openclaw` plugin integration and the minimum browser-memory retrieval demo
- Phase 2B: memory retrieval quality, browser-memory cleanup and grouping, and then shell-memory expansion
- Phase 3: topic-oriented knowledge quality improvements built from daily review

Active non-goals for the current focus:

- broad enterprise integrations
- over-expanding source coverage before retrieval quality is good enough
- shifting MirrorBrain's control plane into `openclaw`
- treating `openclaw` conversation history as the default next source before browser and shell are solid
- building aggressive autonomous skill execution before lower-risk boundaries are defined in updated planning docs

## Working Mode

Codex must use a TDD-first workflow for all feature work, bug fixes, and refactors.

### TDD Rule

No production code may be added or changed before a failing test exists for the target behavior.

Required sequence:

1. Add or update the smallest possible test that captures the desired behavior.
2. Run that test and confirm it fails for the expected reason.
3. Implement the minimum code required to make the test pass.
4. Re-run the targeted test and confirm it passes.
5. Re-run the relevant broader test suite for the affected area.
6. Refactor only while keeping tests green.

If a task cannot reasonably use TDD, Codex must state why before implementation and choose the closest test-first alternative.

## Documentation Rule

Every software component must have documentation.

For this project, a "component" includes any of the following:

- application or service
- package or module with a clear responsibility
- API surface
- background job or pipeline
- UI feature area
- shared library
- test utility with non-trivial behavior

### Documentation Requirements

Each new or materially changed component must include a docs artifact that explains:

- purpose
- responsibilities and boundaries
- inputs and outputs
- key data structures or interfaces
- dependencies
- failure modes and operational constraints
- how to test or verify the component

Acceptable locations:

- `docs/components/<component-name>.md`
- `docs/features/<feature-name>.md`
- `README.md` inside the component directory when the component is isolated enough for local documentation

If code changes behavior but the corresponding docs are not updated, the work is incomplete.

When a code change or new feature affects existing documentation, setup steps, operator flows, public APIs, or user-visible behavior described in `docs/` or any `README.md`, Codex must check those documents and update them in the same change when needed.

## Implementation Rules

### 1. Start From Existing Plans

Before writing code, read the relevant planning docs and derive the change from them. Avoid inventing scope beyond the currently active roadmap stage unless the task explicitly asks for it.

### 2. Keep Scope Narrow

Implement the smallest vertical slice that satisfies the test and the documented requirement. Do not add speculative abstractions or future-proofing without evidence from the current plan.

### 3. Preserve Boundaries

Implementation must preserve these product constraints:

- PC-first only
- strong authorization whitelist
- human-in-the-loop review for candidate memories unless a narrower reviewed-equivalent workflow is documented
- human-in-the-loop review for knowledge synthesis before high-value knowledge is treated as durable
- no silent high-risk automation without an explicitly documented low-risk exception model
- workflow skills require explicit confirmation by default
- memory sources must remain attributable to browser, document, shell, or `openclaw` conversation origins
- `openclaw` integration must not weaken privacy, authorization, or review boundaries
- MirrorBrain must remain independently runnable even when optimizing for `openclaw` integration

### 4. Prefer Clear Structure

Each component should have a single clear responsibility. When a file or module starts handling unrelated concerns, split it.

### 5. Make Behavior Explainable

Important business logic must be testable and readable. Avoid burying core product rules in opaque glue code.

## Test Expectations

All changes must include tests at the appropriate level.

### Required Testing Stack

Codex should use the following default testing stack for this repository:

- `Vitest` for unit tests
- `Vitest` for most integration tests
- `Playwright` for end-to-end and real browser interaction tests
- `tsc --noEmit` for TypeScript type verification

Do not introduce Jest or another parallel primary test runner unless the user explicitly requests it or there is a documented technical reason.

### Minimum Test Coverage by Change Type

- Pure logic: unit tests
- Data transformation or pipeline behavior: unit tests plus focused integration tests
- API behavior: request/response integration tests
- UI behavior: component tests and, when meaningful, user-flow tests
- Cross-component workflow changes: end-to-end or high-confidence integration coverage

### Test Design Rules

- Prefer behavior-oriented tests over implementation-detail tests.
- Test names should describe user-visible or system-visible behavior.
- Include at least one happy-path test and relevant edge-case tests.
- Cover failure and authorization boundaries when they are part of the feature.
- For bug fixes, add a regression test that fails before the fix.
- Treat the following as product invariants that deserve direct tests when touched:
  - unauthorized sources are rejected or ignored
  - source attribution survives transformations from memory to knowledge or skill drafts
  - knowledge publication respects review gates
  - skill execution cannot proceed without the required confirmation state

### Framework Selection Rules

- Use `Vitest` for domain logic, shared utilities, API handlers, service modules, and most cross-module integration tests.
- Use `Playwright` for frontend user flows, embeddable UI verification, browser behavior, and end-to-end validation against running services.
- Use `tsc --noEmit` as a required verification step whenever TypeScript code changes.
- If frontend component tests are added, prefer staying inside the `Vitest` ecosystem unless there is a clear reason not to.

### Verification Rule

Before claiming a task is complete, Codex must run:

1. the targeted tests for the changed behavior
2. the broader relevant suite for the touched area
3. any required lint/type/build verification if applicable

Claims of success must be backed by fresh command output.

### Commit Rule

When a single feature, bug fix, or self-contained unit of work is complete, Codex must create a `git commit` for that work.

Before creating that commit:

1. the new or changed behavior must pass the targeted tests
2. the broader relevant suite for the touched area must pass
3. any required verification such as `tsc --noEmit`, lint, or build checks must pass when applicable

Codex must not create the commit until those checks are green unless the user explicitly asks to commit a known-broken state.

## Documentation and Code Delivery Checklist

For every meaningful change, Codex should verify all of the following:

- tests were written first
- failing test was observed before implementation
- production code is minimal for the requirement
- relevant docs were added or updated
- impacted `docs/` pages and `README.md` files were checked and updated when behavior or setup changed
- public interfaces are explained in docs
- edge cases and failure modes are covered by tests or explicitly documented
- verification commands were run after the final change

## Recommended Repository Conventions

Use this structure unless the user requests otherwise:

- colocate unit tests beside the source files they verify using `*.test.ts` or `*.test.tsx`
- keep integration and end-to-end tests in dedicated root-level directories under `tests/`
- `docs/components/` for component-level documentation
- `docs/features/` for feature-level documentation

If a different structure is introduced, document the reason in the relevant component docs.

## Required Repository Layout

Codex should treat the following layout as the default project scaffold for all new code:

- `src/apps/` for runnable applications or entrypoints
- `src/components/` for reusable product or domain components
- `src/modules/` for business modules with clear bounded responsibility
- `src/shared/` for low-level shared utilities, types, and helpers
- `src/integrations/` for external system adapters and connectors
- `src/workflows/` for workflow detection, skill generation, and execution logic
- `tests/integration/` for integration tests
- `tests/e2e/` for end-to-end or user-flow tests
- `tests/fixtures/` for test fixtures and sample data
- `docs/components/` for component-level documentation
- `docs/features/` for feature-level documentation
- `docs/adr/` for architecture decisions when a structural choice needs justification

If a feature is small, Codex may omit some top-level folders, but it must not invent a parallel structure without documenting why.

Unit tests should not be placed in a separate `tests/unit/` tree in this repository.

## Directory Responsibilities

### `src/apps/`

Use for executable surfaces such as:

- frontend app entrypoints
- backend service entrypoints
- workers or jobs with a process boundary

Each app should have a local README or corresponding document in `docs/components/`.

For Phase 1, likely app surfaces include:

- a MirrorBrain backend service or plugin API surface
- a review-oriented frontend app or embeddable review feature
- optional worker processes for ingestion, ranking, or synthesis jobs

### `src/components/`

Use for reusable components that represent a cohesive product capability. Examples:

- memory-review UI
- authorization manager
- skill recommendation panel

Components should not become grab-bags. If a component grows multiple unrelated responsibilities, split it.

MirrorBrain components should usually map to one of the following product capabilities:

- memory capture, normalization, retrieval, or review
- knowledge review, synthesis, or presentation
- skill drafting, approval, or execution assistance

### `src/modules/`

Use for business/domain modules that encapsulate a clear slice of logic. Examples:

- candidate-note generation
- task clustering
- workflow detection
- daily-review knowledge synthesis
- memory source attribution

Prefer `src/modules/` for domain behavior and `src/shared/` only for genuinely generic code.

For Phase 1, prefer bounded modules named close to product capabilities, for example:

- `memory-capture`
- `memory-review`
- `daily-review-knowledge`
- `skill-draft-management`
- `authorization-scope-policy`

### `src/shared/`

Use only for code that is broadly reusable and not owned by a single domain area, such as:

- foundational types
- generic utilities
- logging wrappers
- config parsing

Do not move domain logic here just to avoid choosing a proper module boundary.

### `src/integrations/`

Use for adapters to browsers, storage systems, external services, or enterprise systems. Integration code should isolate vendor- or platform-specific details from domain logic.

This is the default home for adapters that connect MirrorBrain to:

- browser activity sources
- document observation or import paths
- shell history collection mechanisms
- `openclaw` plugin APIs, conversation streams, or host-side extension points

### `src/workflows/`

Use for logic specific to:

- workflow extraction
- reusable workflow modeling
- skill draft generation
- skill execution orchestration

Keep workflow execution safety checks close to the execution logic, not spread across unrelated modules.

## Naming Conventions

- Directories and files should use kebab-case unless the language ecosystem strongly requires otherwise.
- Test files should mirror the production structure as closely as possible.
- Documentation file names should match the component or feature name.
- Avoid vague names such as `utils`, `helpers`, `common`, `misc`, or `temp` unless the file is truly narrow and local.
- Prefer names that reveal responsibility, for example:
  - `candidate-note-ranker`
  - `daily-review-knowledge-synthesizer`
  - `openclaw-memory-plugin-api`
  - `authorization-scope-policy`
  - `workflow-skill-draft-builder`

## Test File Placement Rules

Codex should place tests according to behavior scope:

- unit tests beside the implementation file in the same source directory
- integration tests in `tests/integration/`
- end-to-end or workflow tests in `tests/e2e/`

Test paths should mirror source ownership where practical. For example:

- `src/modules/candidate-note-ranker.ts`
- `src/modules/candidate-note-ranker.test.ts`

- `src/workflows/skill-draft-builder.ts`
- `tests/integration/workflows/skill-draft-builder.test.ts`

Default framework mapping:

- colocated `*.test.ts` / `*.test.tsx` unit tests -> `Vitest`
- `tests/integration/` -> `Vitest`
- `tests/e2e/` -> `Playwright`

## Documentation Placement Rules

Codex must create or update docs alongside the code change.

Preferred mapping:

- new domain component -> `docs/components/<component-name>.md`
- new end-user capability -> `docs/features/<feature-name>.md`
- architecture-level structural choice -> `docs/adr/<decision-name>.md`

Each documentation file should include, at minimum:

- summary
- ownership or responsibility boundary
- key interfaces
- data flow or control flow
- test strategy
- known risks or limitations

## Component Completion Standard

A component is not complete unless all of the following exist:

- implementation code in `src/`
- automated unit tests beside implementation code and any broader tests in `tests/` when needed
- documentation in `docs/components/` or `docs/features/`

If one of these is missing, Codex must treat the work as partial and say so explicitly.

## Change Review Standard

When Codex reviews its own work before finishing, it should check:

- Does the implementation match the planning docs?
- Does the implementation clearly preserve the distinction between memory, knowledge, and skill?
- Is there any code without corresponding tests?
- Is there any component without corresponding docs?
- Are permissions, privacy, and human confirmation boundaries preserved?
- Is the implementation simpler than the problem requires, not more complex?

## Default Deliverables for New Features

Unless the task explicitly says otherwise, a complete feature change should include:

1. implementation code
2. automated tests
3. component or feature docs
4. any necessary updates to project-level planning docs when scope or behavior changed

## When in Doubt

Default to:

- clarifying behavior in tests
- documenting assumptions in `docs/`
- choosing the simpler implementation
- keeping the user in control
- preserving security and authorization boundaries over convenience
