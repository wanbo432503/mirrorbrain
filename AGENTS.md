# AGENTS.md

This file defines how Codex should design, implement, test, and document the MirrorBrain project in this repository.

## Project Context

- Project name: MirrorBrain / 镜像大脑
- Product direction: a local-first unified personal memory platform for authorized PC work activity
- Product role for agent clients: MirrorBrain is not a generic note app and is no longer an agent-host-specific integration. It is the memory, knowledge, and skill platform that agent clients such as Codex and other assistants can consume through explicit APIs.
- product strategy priority:
  - first priority: deliver a reliable local personal memory platform with clear capture, review, knowledge, and skill lifecycles
  - second priority: expose stable APIs so multiple agent clients can request memory, knowledge, and skill capabilities
  - long-term priority: evolve toward a personal AI operating system that can help continuously advance user goals
- current project stage:
  - Phase 1 MVP proved an independent local vertical slice
  - Phase 2/3 explored host integration and knowledge-quality improvements
  - Phase 4 shifts the center of gravity to a unified multi-source memory platform that serves Codex and other agent clients through APIs rather than through host-specific design
- Core capability model:
  - memory: captured records of authorized work activity, including browser history, viewed documents, shell interaction history, and agent interaction traces; memory is the raw or lightly processed recall layer
  - knowledge: strongly reasoned notes synthesized from review workflows; knowledge must be readable by both humans and agents, and should help people review past work and trigger new ideas for future work
  - skill: reusable Agent Skills distilled from repeatable workflows; skills are executable guidance artifacts for AI systems and must remain explicitly confirmable by the user before activation or execution
- Product objective: help users remember what they did, summarize what they learned, and operationalize repeatable work into safe, reviewable agent skills that multiple agent clients can consume
- Source-of-truth planning docs:
  - `docs/plans/2026-03-16-mirrorbrain-design.md`
  - `docs/plans/2026-03-16-mirrorbrain-prd.md`
  - `docs/plans/2026-03-16-mirrorbrain-technical-design.md`
  - `docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md`
  - `docs/plans/2026-05-12-mirrorbrain-phase4-design.md`

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
- API-facing surfaces should be designed so multiple agent clients can request memory, knowledge, and skill capabilities independently

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
- authorized agent interaction traces

Memory capture must remain authorization-bound, source-attributed, and reviewable by the user.

Current priority rules:

- Phase 2 memory integration should prioritize browser memory first
- shell memory follows browser integration when it improves platform-wide retrieval quality
- agent conversation capture is not the default next priority; MirrorBrain should preserve a global-memory stance rather than biasing toward any single host-native trace
- when expanding sources, prefer improvements that make retrieval more useful across agent clients before broadening source count

### Knowledge Scope

Knowledge should be treated as a derived layer built from review, not as raw capture. By default:

- knowledge is produced through daily review or similar explicit summarization workflows
- knowledge should emphasize strong logic, structure, and explainability
- knowledge artifacts should be suitable for both agent retrieval and direct human reading
- knowledge should help with recall, understanding, and future task inspiration

Current priority rules:

- knowledge is primarily for human reading and secondarily for agent retrieval
- MirrorBrain generates knowledge; agent clients consume it but should not own the knowledge-generation workflow
- after the platform API and retrieval surfaces are stable, knowledge quality remains a major product focus
- the preferred durable reading unit is a topic- or problem-oriented knowledge artifact rather than a daily summary page
- the default evolution path is for topic knowledge to grow out of repeated daily review inputs, while the presented artifact remains a rewritten current-best version with provenance and a lightweight version history

### Skill Scope

Skill artifacts should be treated as agent-operable workflow guidance. By default:

- skills are derived from repeatable workflows observed in memory and clarified through review
- skills must be explicit artifacts, not hidden prompts embedded in unrelated code
- skill generation, approval, and execution must preserve human confirmation boundaries
- skill outputs should be portable enough to serve as reusable Agent Skills across agent clients

Current priority rules:

- for agent clients, skill usage follows memory and knowledge integration, not the reverse
- the long-term emphasis is stronger execution capability, not just static skill-library management
- skill execution should first become useful for knowledge-work progression tasks before heavier software-operation automation
- low-risk automation exceptions must be explicitly defined in planning docs before implementation; absent that definition, explicit confirmation remains the default boundary

## Roadmap Priorities

Unless the user explicitly changes the roadmap, treat the following sequence as the default:

- Phase 4: build MirrorBrain as a unified multi-source personal memory platform with durable local workspace storage, reviewable work sessions, and project/topic knowledge articles
- Platform API: expose stable HTTP and agent-facing capability surfaces that can be consumed by Codex and other agent clients without host-specific coupling
- Knowledge quality: improve topic- and problem-oriented knowledge artifacts derived from reviewed work sessions
- later phases: make skill execution progressively stronger for knowledge-work task advancement while preserving confirmation boundaries

North-star ordering:

- first: users can reliably recover what they previously did
- second: users accumulate high-quality knowledge over time
- third: users offload more work to a growing personal AI capability layer

## Agent Client Integration Contract

Until a more specific technical design is committed, Codex should treat the agent-client integration contract as follows:

- MirrorBrain is an independent local-first service with its own standalone UI and operational surface
- MirrorBrain exposes explicit API capability surfaces for memory, knowledge, and skill
- Codex and other agent clients consume MirrorBrain through those APIs rather than through host-specific business logic
- MirrorBrain-owned business logic should live in MirrorBrain modules and services; client-specific code should mainly adapt transport, tool schemas, and presentation concerns
- integration boundaries must be explicit and documented: API shape, event payloads, lifecycle hooks, auth context, and failure handling
- if an agent-client boundary is undecided, implementation should default to a narrow API-first adapter that can support either in-process embedding or out-of-process service calls later
- for user-facing adoption, any agent client may become an interaction surface; MirrorBrain's own UI remains the control, debug, review, and demonstration surface

Minimum interface expectations for new work:

- memory queries should return source-attributed records or summaries with stable identifiers
- knowledge queries should return human-readable synthesized artifacts with enough metadata for provenance and review status
- skill queries should return draft or approved skill artifacts with approval state and execution safety metadata
- write operations from agent clients into MirrorBrain must preserve auditability, including who or what initiated the action

Codex must not assume hidden host state, implicit callbacks, or undocumented cross-module coupling between any specific agent client and MirrorBrain.

Default interaction policy for agent-client integration:

- retrieval should be observable, explainable, and easy to debug
- agent clients should present natural language answers using MirrorBrain results as context, with lightweight source hints by default
- default chat retrieval should search memory first, optionally enrich with knowledge, and should not pull skills into ordinary retrieval responses
- agent clients may consume knowledge artifacts, but MirrorBrain owns the workflow that generates them
- agent clients may consume generated skills, first through explicit selection and invocation, then later through more agent-visible recommendation flows

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
- exposing private memory records to agent clients or features that do not declare a need for them

When implementation details remain open, prefer the more restrictive privacy-preserving interpretation.

## Lifecycle Definitions

Codex should treat MirrorBrain artifacts as moving through explicit lifecycle stages instead of jumping directly from raw activity to durable outputs.

### Memory Lifecycle

- raw memory event: a source-attributed captured record from an authorized browser, document, shell, or authorized agent interaction source
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

- Phase 4: unified multi-source memory platform, work-session review, and Project -> Topic -> Knowledge Article flows
- platform API quality: stable HTTP and agent-facing retrieval surfaces for multiple agent clients
- knowledge quality: topic-oriented knowledge quality improvements built from reviewed work sessions

Active non-goals for the current focus:

- broad enterprise integrations
- over-expanding source coverage before retrieval quality and authorization UX are good enough
- shifting MirrorBrain's control plane into any single agent host
- treating a single host's conversation history as the default next source before browser, shell, and source-ledger flows are solid
- building aggressive autonomous skill execution before lower-risk boundaries are defined in updated planning docs

## Working Mode

Codex should choose an efficient implementation workflow based on the risk and
scope of the change. Tests remain required for meaningful behavior changes, bug
fixes, and refactors, but tests do not need to be written before production code
unless the user explicitly requests a TDD workflow or the change is risky enough
that a test-first approach is clearly the safest path.

For small documentation, copy, configuration, or low-risk UI adjustments, Codex
may implement directly and then run the appropriate verification.

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
- memory sources must remain attributable to browser, document, shell, or authorized agent interaction origins
- agent-client integration must not weaken privacy, authorization, or review boundaries
- MirrorBrain must remain independently runnable even when optimizing for agent-client integration

### 4. Prefer Clear Structure

Each component should have a single clear responsibility. When a file or module starts handling unrelated concerns, split it.

### 5. Make Behavior Explainable

Important business logic must be testable and readable. Avoid burying core product rules in opaque glue code.

## Test Expectations

Meaningful behavior changes, bug fixes, refactors, and new component logic should include tests at the appropriate level. Small documentation, copy, configuration, or low-risk UI adjustments do not require new tests unless the change introduces behavior that needs automated coverage.

Testing is not a mandatory gate before every commit. Prefer targeted verification that matches the risk and scope of the completed work, and avoid running full test suites by default when a narrower check gives useful confidence.

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

### Verification Guidance

Before claiming a task is complete, Codex should choose verification that matches the risk and scope of the change.

Default verification expectations:

1. For documentation-only, copy-only, or instruction-only changes, a lightweight formatting or diff check is usually enough.
2. For small component or UI changes, prefer the narrowest relevant unit or component test when it is practical.
3. For backend behavior, API contracts, data transformations, or safety boundaries, run targeted tests for the changed behavior.
4. Run broader suites, `tsc --noEmit`, lint, build, or end-to-end checks only when the change scope justifies them, when the user asks for them, or before a release-quality handoff.

Do not run full test suites by default after every small change. If verification is skipped or intentionally narrowed, state that clearly instead of implying full validation.

### Commit Rule

When a feature, bug fix, documentation update, or self-contained component-sized unit of work is complete, Codex should create a `git commit` for that unit of work.

Commits are allowed at useful completion boundaries, including after finishing a small component, a documentation update, or an incremental vertical slice. A commit does not require the entire feature area or broader roadmap item to be finished.

Passing tests are not a hard prerequisite for creating a commit. Prefer committing a coherent checkpoint after the requested work is complete, even if only lightweight or targeted verification was run. If tests were not run, were narrowed, or are known to be failing, make that explicit in the final response and, when appropriate, in the commit message or follow-up notes.

Do not run full test suites solely because a commit is about to be created. Choose verification based on change risk, not on the existence of a commit step.

## Documentation and Code Delivery Checklist

For every meaningful change, Codex should verify all of the following:

- production code is minimal for the requirement
- relevant docs were added or updated
- impacted `docs/` pages and `README.md` files were checked and updated when behavior or setup changed
- public interfaces are explained in docs
- edge cases and failure modes are covered by targeted tests or explicitly documented when they are in scope
- verification was selected according to the size and risk of the change, without defaulting to full-suite runs for small work
- the completed feature, fix, documentation update, or component-sized checkpoint is ready to commit as its own coherent unit

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

- a MirrorBrain backend service or agent memory API surface
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
- knowledge synthesis from reviewed work
- memory source attribution

Prefer `src/modules/` for domain behavior and `src/shared/` only for genuinely generic code.

For Phase 1, prefer bounded modules named close to product capabilities, for example:

- `memory-capture`
- `memory-review`
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
- agent client APIs, conversation streams, or host-side extension points

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
  - `agent-memory-api`
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
