# MirrorBrain Codebase Architecture Refactor Analysis

Date: 2026-05-11

## Summary

This document records a code-level architecture review of the current MirrorBrain repository. It is meant to support future refactoring work, not to define new product scope.

The current codebase has successfully grown past the original Phase 1 vertical slice. It now contains browser sync, shell sync, memory review, Agent Client-facing memory retrieval, knowledge generation, topic knowledge merge, knowledge graph display, skill draft generation, a Fastify HTTP API, a legacy vanilla web UI, and a newer React web UI.

The main problem is that the implementation has accumulated capability faster than boundaries. Several files now act as mixed-purpose hubs:

- `src/apps/mirrorbrain-service/index.ts` is both runtime composer, product facade, storage coordinator, deletion/tombstone manager, cache updater, knowledge relation refresher, narrative publisher, candidate generator, and knowledge/skill workflow host.
- `src/apps/mirrorbrain-http-server/index.ts` is both transport layer, OpenAPI schema registry, input normalization layer, static UI server, route implementation, and partial error handling layer.
- `src/integrations/openviking-store/index.ts` is both OpenViking HTTP client, workspace file writer, Markdown/JSON serializer, Markdown parser, display deduplicator, and fallback read model.
- `src/integrations/agent-memory-api/index.ts` contains agent-facing API helpers, but also owns retrieval ranking, natural language summaries, shell problem clustering, browser query intent detection, and source-specific heuristics.
- `src/modules/memory-review/index.ts` contains the core candidate-generation algorithm, but also includes broad source classification, task-type inference, scoring policy, copy generation, local URL filtering, token extraction, and many product-language heuristics.

The most important refactor is not a rewrite. It should be a staged boundary extraction that makes behavior easier to test, keeps privacy rules enforceable, and prevents the Agent Client integration surface from depending on incidental implementation details.

## Review Scope

Reviewed areas:

- Planning docs:
  - `docs/plans/2026-03-16-mirrorbrain-design.md`
  - `docs/plans/2026-03-16-mirrorbrain-prd.md`
  - `docs/plans/2026-03-16-mirrorbrain-technical-design.md`
  - `docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md`
- Root runtime and tooling:
  - `package.json`
  - `tsconfig.json`
  - `vitest.config.ts`
  - `scripts/start-mirrorbrain-dev.ts`
  - `scripts/build-react-webui.ts`
- Core backend:
  - `src/apps/mirrorbrain-service/index.ts`
  - `src/apps/mirrorbrain-http-server/index.ts`
  - `src/shared/types/index.ts`
  - `src/shared/config/index.ts`
- Domain modules and workflows:
  - `src/modules/authorization-scope-policy/index.ts`
  - `src/modules/memory-capture/index.ts`
  - `src/modules/memory-review/index.ts`
  - `src/modules/memory-events-cache/index.ts`
  - `src/modules/knowledge-generation-llm/index.ts`
  - `src/modules/knowledge-graph/graph-builder.ts`
  - `src/workflows/memory-source-sync/index.ts`
  - `src/workflows/browser-memory-sync/index.ts`
  - `src/workflows/shell-memory-sync/index.ts`
- Integrations:
  - `src/integrations/activitywatch-browser-source/index.ts`
  - `src/integrations/browser-page-content/index.ts`
  - `src/integrations/shell-history-source/index.ts`
  - `src/integrations/openviking-store/index.ts`
  - `src/integrations/agent-memory-api/index.ts`
- Frontend surfaces:
  - `src/apps/mirrorbrain-web/main.ts`
  - `src/apps/mirrorbrain-web-react/src/api/client.ts`
  - `src/apps/mirrorbrain-web-react/src/types/index.ts`
  - `src/apps/mirrorbrain-web-react/src/contexts/MirrorBrainContext.tsx`

The review was evidence-based and focused on design and implementation risks that make future architecture work harder.

## Current Code Structure

The repository roughly follows the intended layout:

- `src/apps/` contains runnable surfaces:
  - `mirrorbrain-service`: in-process product service facade.
  - `mirrorbrain-http-server`: Fastify HTTP service and static UI host.
  - `mirrorbrain-web`: legacy vanilla TypeScript UI.
  - `mirrorbrain-web-react`: React UI with its own package, lockfile, `tsconfig`, and test config.
- `src/modules/` contains domain logic:
  - authorization policy
  - memory capture
  - memory review
  - memory events cache
  - knowledge generation
  - knowledge relation/graph logic
  - skill draft management
- `src/workflows/` contains orchestration:
  - source sync
  - browser sync
  - shell sync
  - daily review
  - narrative generation
  - knowledge lint
  - topic merge
  - topic quality
  - skill draft builder
- `src/integrations/` contains adapters:
  - ActivityWatch browser source
  - shell history source
  - browser page content fetch/extraction
  - OpenViking storage
  - Agent memory API
  - file sync checkpoint store
- `src/shared/` contains types, config, and low-level LLM HTTP helpers.
- `tests/integration/` and `tests/e2e/` contain broader coverage.

The structure is directionally aligned with the technical design, but responsibilities inside several directories are blurred.

## Key Findings

### P0: Authorization Is Modeled But Not Enforced As A Runtime Boundary

Evidence:

- `src/modules/authorization-scope-policy/index.ts:11` creates an `AuthorizationScope`, `:21` checks category authorization, and `:32` revokes a scope.
- Searches for `isSourceCategoryAuthorized` show usage only in tests and docs, not in sync, service, or HTTP runtime code.
- `src/apps/mirrorbrain-service/index.ts:317` and `:319` default to string scope IDs such as `scope-browser` and `scope-shell`.
- `src/workflows/memory-source-sync/index.ts:66` normalizes raw events with `scopeId`, but does not verify that the source is still authorized.
- `src/integrations/shell-history-source/index.ts:121` reads a configured history file directly, then normalizes commands with `authorizationScopeId` at `:140`.

Why this is unreasonable:

The product requirements treat authorization as a first-class privacy boundary. The current implementation attaches an authorization scope ID to events, but the scope is mostly metadata. Revocation is not connected to source sync, and source category/path authorization is not checked before capture.

Impact:

- A disabled source cannot reliably stop capture because the runtime has no active source authorization store.
- Shell history capture has no policy layer for allowed paths or shell contexts.
- Browser capture has no per-source or per-domain authorization check beyond selecting an ActivityWatch bucket.
- Derived artifacts can be built from events whose scope state is no longer known.

Refactor direction:

- Introduce an `authorization-scope-registry` or `capture-policy-service` that is called by `runMemorySourceSyncOnce` before fetch and before persist.
- Model source category, source instance, and path/domain allowlists explicitly.
- Make sync inputs carry a `sourceAuthorization` object rather than a naked `scopeId` string.
- Add direct tests that revoked browser and shell scopes prevent new capture.
- Add service-level tests that `syncBrowserMemory()` and `syncShellMemory()` reject unauthorized sources before reading upstream data.

### P0: Shell Memory Captures Raw Commands Without A Secret Redaction Boundary

Evidence:

- `src/integrations/shell-history-source/index.ts:92` parses zsh extended history lines.
- `src/integrations/shell-history-source/index.ts:132` normalizes each command into `MemoryEvent.content.command`.
- No redaction or denylist is applied before `runMemorySourceSyncOnce` persists events at `src/workflows/memory-source-sync/index.ts:79`.

Why this is unreasonable:

The project policy says credentials, tokens, and secrets must not be captured as a product feature. Shell commands often contain secrets in flags, env assignments, URLs, curl headers, Git remote URLs, and CLI login flows. The current code keeps the full command.

Impact:

- Tokens can be persisted into workspace JSON files and OpenViking.
- Later review, knowledge generation, and retrieval flows may expose those commands.
- This blocks safe expansion of shell memory beyond local experimentation.

Refactor direction:

- Add a `shell-command-sanitizer` module before persistence.
- Redact common secret patterns: `KEY=value`, `--token`, `--password`, `Authorization: Bearer`, URL credentials, API keys, private key material, and known provider token prefixes.
- Store both `redactionApplied` and coarse command metadata.
- Consider preserving raw shell traces only behind a separate, explicitly authorized, encrypted/debug-only path.
- Add regression tests for common secret formats.

### P0: Browser Page Content Fetching Re-Captures Live Web Content Outside A Clear Authorization Model

Evidence:

- `src/workflows/browser-memory-sync/index.ts:216` starts a fire-and-forget background task to fetch and ingest page content for URLs seen in browser history.
- `src/workflows/browser-memory-sync/index.ts:223` calls `fetchPage({ url })` for those URLs.
- `src/integrations/browser-page-content/index.ts:125` performs a generic `fetch(input.url)`.
- `src/integrations/browser-page-content/index.ts:39` skips only localhost-like URLs.

Why this is unreasonable:

The user authorized browser activity capture, but live HTTP fetching is a different capture behavior. It fetches current public web content, not necessarily the content the user saw at the time. It also broadens collection from metadata to page text without a dedicated source policy.

Impact:

- Provenance is weaker because page text may not match the user's viewed version.
- Privacy expectations are unclear: browser history sync now performs network reads.
- Errors are swallowed, so the user cannot tell which pages have content and which do not.
- The background task may race with candidate generation that expects page artifacts.

Refactor direction:

- Split browser event sync from page content enrichment.
- Add explicit authorization for page text capture, including domain/path allowlists and a visible UI state.
- Record content source and fetch time as provenance distinct from browser access time.
- Return enrichment status from sync instead of hiding it in a background task.
- Prefer captured browser content from an authorized browser extension path over live refetch when available.

### P1: Service Layer Has Become A God Object

Evidence:

- `src/apps/mirrorbrain-service/index.ts` is 1,438 lines.
- It imports nearly every module and workflow in the system at `:1-75`.
- It builds runtime sync at `:308`, service facade at `:429`, deletion/tombstone logic at `:601`, knowledge relation refresh at `:751`, lint scheduling at `:836`, cache loading at `:882`, knowledge approval at `:1226`, candidate review at `:1286`, and candidate generation at `:1320`.
- It owns fallback read behavior from both OpenViking and workspace files at `:691`, `:707`, and `:912`.

Why this is unreasonable:

An application service can coordinate, but this file now owns multiple independent policies. Changes to knowledge graph behavior, deletion semantics, cache strategy, browser candidate creation, and Agent Client query behavior all touch one facade. That increases regression risk and makes it unclear where lifecycle rules actually live.

Impact:

- Test setup requires large dependency bags instead of small component contracts.
- Business rules are hard to reuse from agent client adapters without importing the entire service.
- Failure handling is inconsistent because local functions catch and swallow errors differently.
- New capability work tends to add another dependency and method to the same file.

Refactor direction:

Extract service-level components in this order:

1. `memory-sync-service`: browser/shell sync, checkpoint usage, cache update, narrative refresh scheduling.
2. `artifact-store-service`: load/publish/delete knowledge, skills, candidates, reviewed memories, tombstones.
3. `knowledge-service`: generate, regenerate, approve, merge topic knowledge, refresh relations, schedule lint.
4. `review-service`: create candidates, review candidates, undo review, delete candidate.
5. `mirrorbrain-service` facade: thin composition layer only.

Each extracted service should have a small interface and colocated tests.

### P1: HTTP API Schemas Are Handwritten And Drift From TypeScript Types

Evidence:

- `src/apps/mirrorbrain-http-server/index.ts` is 1,396 lines.
- `src/shared/types/index.ts:190` defines `KnowledgeArtifact` with optional `artifactType`, `title`, `summary`, `body`, `version`, `isCurrentBest`, `reviewedAt`, `recencyLabel`, and `provenanceRefs`.
- `src/apps/mirrorbrain-http-server/index.ts:317` defines `knowledgeArtifactSchema`.
- `src/apps/mirrorbrain-http-server/index.ts:359` requires `artifactType`, `title`, `summary`, `body`, `version`, `isCurrentBest`, `reviewedAt`, `recencyLabel`, and `provenanceRefs`.
- `src/apps/mirrorbrain-http-server/index.ts:461` defines a skill schema that omits optional `updatedAt` and `reviewedAt` from the shared type.

Why this is unreasonable:

The API contract should be the most stable integration surface. Today the canonical shape exists in at least three forms: backend TypeScript interfaces, Fastify JSON schemas, and frontend TypeScript interfaces. Optionality and field presence can drift silently.

Impact:

- A valid internal `KnowledgeArtifact` may fail HTTP response serialization.
- Frontend code can compile against a shape that is not actually guaranteed by the server schema.
- Agent Client wrapper code has no single contract source to import.

Refactor direction:

- Introduce shared runtime schemas for API DTOs. Use a single schema source for validation, TypeScript inference, OpenAPI emission, and frontend/client types.
- Separate internal domain types from transport DTOs where optional fields differ.
- Add contract tests that assert example objects from domain services serialize through the HTTP schemas.
- Generate or re-export frontend types from the shared API contract instead of copying them into the React app.

### P1: The Frontend Has Two Application Surfaces With Duplicated API Clients

Evidence:

- `src/apps/mirrorbrain-web/main.ts` is a 1,552-line vanilla TypeScript UI.
- It defines `createMirrorBrainBrowserApi` at `src/apps/mirrorbrain-web/main.ts:1103`.
- The React app defines another `createMirrorBrainBrowserApi` at `src/apps/mirrorbrain-web-react/src/api/client.ts:74`.
- Both clients implement the same endpoints, but not always with the same error handling. For example, the React client uses `readJson` for several endpoints but directly casts JSON for suggestions and review at `src/apps/mirrorbrain-web-react/src/api/client.ts:169` and `:181`; the vanilla client does similar direct casts at `src/apps/mirrorbrain-web/main.ts:1189`, `:1206`, and `:1222`.

Why this is unreasonable:

The project now has a newer React UI, but the legacy UI still contains its own state model, API client, and behavior. Every API change risks updating two UIs, and inconsistent error handling creates different user behavior for the same backend.

Impact:

- UI refactors have unclear target surface.
- Tests may pass for one UI while the served or documented UI uses another path.
- API client improvements are duplicated or missed.

Refactor direction:

- Decide whether the vanilla UI is still an active product surface.
- If not active, freeze it as a fixture/demo or remove it after migration.
- Extract a shared `mirrorbrain-api-client` package/module used by React and any remaining vanilla UI.
- Make all client methods use one response/error parser.
- Ensure the served static UI in dev/runtime is the intended UI.

### P1: React App Is A Separate TypeScript Island

Evidence:

- Root `tsconfig.json` excludes `src/apps/mirrorbrain-web-react/**`.
- The React app has its own `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, and `vitest.config.ts`.
- Root `package.json` exposes `pnpm test` and `pnpm typecheck`, but those commands do not typecheck the React app.
- `src/apps/mirrorbrain-web-react/src/types/index.ts` duplicates most of `src/shared/types/index.ts`.
- `src/apps/mirrorbrain-web-react/src/api/client.ts:39` types `syncShell()` as returning `BrowserSyncSummary`.

Why this is unreasonable:

The frontend is a first-class integration mode, but the root verification path excludes it. That makes shared API drift likely. The nested package may be useful, but it needs to be an explicit workspace package or an intentionally isolated artifact with documented verification.

Impact:

- Root `pnpm typecheck` cannot catch React/client contract drift.
- Dependency versions diverge: root uses TypeScript 5.9/Vitest 4, React app uses TypeScript 5.4/Vitest 1.
- A contributor may think the whole repository is green while the React UI is broken.

Refactor direction:

- Convert the repo to a pnpm workspace, or move the React app into the root toolchain.
- Add root scripts:
  - `test:backend`
  - `test:web`
  - `typecheck:backend`
  - `typecheck:web`
  - `build:web`
  - `verify`
- Replace copied frontend types with generated/shared API DTO types.
- Rename sync summary types so shell sync is not typed as browser sync.

### P1: Agent Memory API Contains Retrieval Domain Logic Instead Of Thin Host Adaptation

Evidence:

- `src/integrations/agent-memory-api/index.ts` defines source-specific query intent detection at `:144` and `:175`.
- It clusters shell problem-solving sequences at `:269`.
- It classifies browser narrative kinds at `:312`.
- It builds natural language summaries at `:428`.
- It performs ranking and grouping in `queryMemory` at `:580`.

Why this is unreasonable:

The planning docs say Agent Client-specific code should mainly adapt host APIs, events, and transport concerns. This file is named as an integration adapter, but it now owns core retrieval behavior.

Impact:

- Retrieval behavior cannot be reused cleanly by the HTTP service or future UI without importing an integration module.
- Agent Client-specific naming encourages putting more business logic in the host adapter.
- Testing retrieval quality is tied to Agent Client API helper tests instead of a retrieval module.

Refactor direction:

- Extract `src/modules/memory-retrieval` or `src/workflows/memory-retrieval`.
- Move query intent detection, narrative selection, grouping, source filtering, summary generation, and ranking into that module/workflow.
- Keep `agent-memory-api` as a thin adapter that calls retrieval and maps results to agent/tool DTOs.
- Add explicit retrieval-quality tests independent of Agent Client.

### P1: OpenViking Store Adapter Mixes Storage, Serialization, Parsing, Display Deduplication, And Fallback Semantics

Evidence:

- `src/integrations/openviking-store/index.ts` is 1,500 lines.
- It writes workspace files with synchronous `mkdirSync` and `writeFileSync` inside async functions at `:180`, `:406`, `:480`, and `:522`.
- It serializes knowledge artifacts to Markdown at `:452`.
- It parses knowledge Markdown back into `KnowledgeArtifact` at `:663`.
- It parses skills from Markdown at `:788`.
- It deduplicates memory events for display at `:938`.
- It reads both OpenViking resources and workspace files.

Why this is unreasonable:

An integration adapter should isolate OpenViking I/O. This file also defines the durable file format, Markdown round-trip semantics, and display read model. That makes storage behavior hard to change and hard to reason about.

Impact:

- Markdown parsing is fragile. A title, summary, or body line that resembles metadata can affect parsing.
- Fields not written into Markdown, such as `tags`, `relatedKnowledgeIds`, and `compilationMetadata`, are lost when parsed back.
- Display deduplication in the storage adapter makes it unclear whether callers are reading raw records or presentation records.
- Sync file writes can block the event loop.

Refactor direction:

- Split into:
  - `openviking-client`: HTTP calls only.
  - `workspace-artifact-store`: file paths, JSON/Markdown read/write, tombstones.
  - `artifact-serializers`: JSON/Markdown codec tests.
  - `memory-display-read-model`: deduplicated display records.
- Prefer JSON sidecars as canonical machine-readable artifacts; keep Markdown only as human-readable projection.
- Add round-trip tests for every artifact field that must survive persistence.

### P1: Delete Semantics Are Inconsistent Across Artifact Types And Stores

Evidence:

- Candidate deletion removes a workspace JSON file and calls `deleteCandidateMemoryFromOpenViking` at `src/apps/mirrorbrain-service/index.ts:496`.
- Knowledge deletion removes workspace Markdown and records a tombstone at `src/apps/mirrorbrain-service/index.ts:537`.
- Skill deletion removes workspace Markdown and records a tombstone at `src/apps/mirrorbrain-service/index.ts:556`.
- `loadKnowledgeArtifacts` filters OpenViking results by tombstones but then merges workspace knowledge as fallback at `src/apps/mirrorbrain-service/index.ts:691`.
- `loadSkillArtifacts` filters both OpenViking and workspace items by tombstones at `src/apps/mirrorbrain-service/index.ts:707`; knowledge and skill behavior differ.

Why this is unreasonable:

Deletion is a lifecycle operation and should be consistent, auditable, and store-aware. Current semantics vary by artifact kind and rely on tombstones rather than deleting OpenViking resources for knowledge and skills.

Impact:

- Deleted OpenViking resources remain present and must always be filtered correctly.
- Knowledge deletion can resurrect workspace artifacts if the merge logic does not consistently apply tombstones to both sources.
- Users cannot easily understand whether deletion removed data, hid it, or marked it deleted.

Refactor direction:

- Define deletion policy per artifact class in docs and code: hard delete, soft delete, tombstone, or retention.
- Centralize deletion in `artifact-store-service`.
- Apply tombstones consistently to OpenViking and workspace reads.
- Add tests for delete/list behavior across OpenViking-only, workspace-only, and both-source states.

### P1: Background Work Is Fire-And-Forget And Often Swallows Errors

Evidence:

- Browser page content enrichment starts a `void (async () => { ... })()` at `src/workflows/browser-memory-sync/index.ts:216` and catches individual fetch/ingest failures by continuing at `:233` and `:244`.
- Knowledge relation refresh publishes non-critical artifacts in a `void Promise.all(...).catch(...)` at `src/apps/mirrorbrain-service/index.ts:816`.
- Knowledge lint is scheduled with `void (async () => { ... })().catch(...)` at `src/apps/mirrorbrain-service/index.ts:839`.
- Cache updates after sync are started with `void updateCacheWithNewEvents(...).catch(() => undefined)` at `src/apps/mirrorbrain-service/index.ts:1332`.

Why this is unreasonable:

Background work is sometimes correct, but here it changes data that users later rely on. Silent or log-only failures make state inconsistent and hard to debug.

Impact:

- A sync response can claim imported events before page content enrichment and cache updates settle.
- Knowledge relation graph and lint results may be stale with no visible status.
- Tests cannot reliably assert final state unless they bypass production scheduling.

Refactor direction:

- Introduce explicit job records or operation results for enrichment, relation refresh, lint, and cache updates.
- Return `queued`, `completed`, or `failed` status where user-visible behavior depends on it.
- Keep truly optional background work behind an injected scheduler interface with test hooks.
- Avoid swallowing errors unless the failure is recorded in an operation log.

### P1: Candidate Memory Logic Is Too Broad For One Module

Evidence:

- `src/modules/memory-review/index.ts` is 1,649 lines.
- It contains a large stop-word list at `:66`.
- Candidate creation starts at `:164`.
- Candidate review scoring and recommendation starts at `:280`.
- Task inference begins at `:469`.
- Copy/rationale generation begins at `:531`.
- Browser page role inference begins at `:1528`.

Why this is unreasonable:

Memory review is a core domain module, but one file now contains multiple independently testable concerns: tokenization, source classification, stream grouping, scoring, copy generation, and candidate lifecycle transitions.

Impact:

- Small scoring changes require navigating unrelated token and page-role logic.
- Source classification is duplicated elsewhere.
- Product copy is mixed with ranking policy.
- Adding shell-specific candidate generation will make the module harder to maintain.

Refactor direction:

- Split into:
  - `memory-event-tokenizer`
  - `memory-source-classifier`
  - `candidate-stream-grouper`
  - `candidate-memory-ranker`
  - `candidate-review-suggester`
  - `candidate-summary-writer`
  - `reviewed-memory-transition`
- Keep `memory-review/index.ts` as a small public facade.
- Move browser-specific classification to a shared source-classification module reused by retrieval and review.

### P1: Source Classification Heuristics Are Duplicated And Brittle

Evidence:

- Browser page role inference exists in `src/modules/memory-review/index.ts:1528`.
- Browser narrative kind inference exists in `src/integrations/agent-memory-api/index.ts:312`.
- Localhost filtering exists in `src/modules/memory-review/index.ts:238`, `src/integrations/activitywatch-browser-source/index.ts:186`, and `src/integrations/browser-page-content/index.ts:39`.
- Shell phase classification exists in `src/integrations/agent-memory-api/index.ts:100`, `:110`, `:121`, and `:131`, while shell narrative generation also has its own workflow.

Why this is unreasonable:

Heuristics are expected in an MVP, but duplicated heuristics drift quickly. Different parts of the system can disagree on whether the same event is debug, docs, shell verification, or local noise.

Impact:

- Retrieval and review can produce contradictory summaries.
- Fixing a classification bug requires finding every duplicate.
- Tests only protect the local copy they cover.

Refactor direction:

- Create shared classifiers:
  - `browser-event-classifier`
  - `shell-command-classifier`
  - `local-url-policy`
- Make both candidate generation and retrieval depend on those classifiers.
- Add fixture-backed tests for source classification.

### P1: Knowledge Artifact Persistence Loses Data

Evidence:

- `KnowledgeArtifact` includes optional `tags`, `relatedKnowledgeIds`, and `compilationMetadata` in `src/shared/types/index.ts:210`.
- `ingestKnowledgeArtifactToOpenViking` writes Markdown metadata at `src/integrations/openviking-store/index.ts:452`.
- The Markdown writer does not serialize `tags`, `relatedKnowledgeIds`, or `compilationMetadata`.
- `parseKnowledgeArtifact` reconstructs only the subset it knows at `src/integrations/openviking-store/index.ts:663`.

Why this is unreasonable:

The project is moving into Phase 3 knowledge quality. Losing relation and compilation metadata across persistence weakens the current-best knowledge model and graph features.

Impact:

- A knowledge artifact can have relation metadata in memory but lose it after reload.
- Graph and related-knowledge behavior may depend on whether the artifact was freshly generated or parsed from storage.
- Future knowledge-quality work will keep adding fields unless persistence is made schema-driven.

Refactor direction:

- Store a canonical JSON artifact for machine reads.
- Optionally store Markdown as a projection for human reading.
- Version artifact schemas and migrate old Markdown-only records.
- Add persistence round-trip tests for all current `KnowledgeArtifact` fields.

### P1: API Error Handling Is Inconsistent

Evidence:

- Some HTTP routes catch `ValidationError`, such as candidate delete at `src/apps/mirrorbrain-http-server/index.ts:1077`.
- Many routes rely on Fastify default error handling.
- React client methods sometimes use `readJson`, but methods such as `suggestCandidateReviews` and `reviewCandidateMemory` directly cast JSON at `src/apps/mirrorbrain-web-react/src/api/client.ts:169` and `:181`.
- Vanilla UI has similar direct casts at `src/apps/mirrorbrain-web/main.ts:1189`, `:1206`, and `:1222`.

Why this is unreasonable:

As the system becomes a API-facing API, errors need stable shapes. Mixed default Fastify errors, route-local catches, and client-local parsers make UX and integration behavior unpredictable.

Impact:

- Agent Client wrapper code cannot depend on consistent error codes.
- Frontend methods may treat failed JSON responses as successful typed data.
- Operational diagnosis is harder because errors are logged or hidden in different places.

Refactor direction:

- Add a central Fastify error handler.
- Define API error DTOs with stable `code`, `message`, `details`, and `requestId`.
- Make clients parse every response through the same helper.
- Add tests for validation, upstream unavailable, not found, and internal error responses.

### P2: Memory Events Cache Is A Presentation Cache But Is Used Near Source Sync

Evidence:

- `src/modules/memory-events-cache/index.ts` stores `events`, pagination totals, and sync summaries.
- It performs display deduplication at `:228`.
- It runs ingestion evaluation at `:240`.
- Service calls `updateCacheWithNewEvents` after sync at `src/apps/mirrorbrain-service/index.ts:1332`.

Why this is unreasonable:

The cache mixes source ingestion statistics, display deduplication, and persisted read optimization. It sits under `modules`, but is operationally a read model.

Impact:

- It is unclear whether a cached event is raw memory, filtered memory, or display memory.
- Candidate generation reads raw workspace events, while memory listing can read cache, so UI and review may disagree.
- Cache invalidation rules are implicit.

Refactor direction:

- Rename and reframe as `memory-events-read-model`.
- Keep raw memory storage authoritative.
- Store cache metadata that describes transformation policy.
- Add rebuild/invalidate operations and tests.

### P2: Knowledge Generation Has Silent Degraded Fallbacks

Evidence:

- `analyzeKnowledgeWithConfiguredLLM` throws on provider errors at `src/modules/knowledge-generation-llm/index.ts:606`.
- `synthesizeKnowledgeBody` catches errors and falls back at `src/modules/knowledge-generation-llm/index.ts:652`.
- `classifyNoteType` catches LLM errors and falls back to local classification at `src/modules/knowledge-generation-llm/index.ts:330`.
- The fallback text says the draft is degraded at `src/modules/knowledge-generation-llm/index.ts:592`.

Why this is partly unreasonable:

Fallbacks are useful, but they should be first-class artifact state, not only text inside the body. A degraded scaffold should not be confused with a high-quality knowledge artifact.

Impact:

- UI and Agent Client may treat degraded drafts like normal drafts unless they parse body text.
- Approval gates cannot easily prevent publishing degraded outputs.
- Knowledge-quality evaluation can be polluted by fallback scaffolds.

Refactor direction:

- Add structured generation metadata:
  - `generationStatus: "llm-synthesized" | "degraded-fallback"`
  - `generationErrors`
  - `sourceCoverage`
- Enforce approval warnings or blockers for degraded drafts.
- Add tests that degraded drafts cannot be silently treated as published knowledge.

### P2: Knowledge Graph Edges Do Not Carry Similarity Scores

Evidence:

- `src/modules/knowledge-graph/graph-builder.ts:164` calls `buildKnowledgeRelationGraph`.
- At `:205`, the similarity value is set to `undefined` with a comment saying the relation builder would need modification.

Why this is unreasonable:

Graph display and retrieval explainability need edge strength. A `SIMILAR` edge without a score is hard to rank, inspect, or tune.

Impact:

- UI graph cannot explain why two topics are similar.
- Threshold tuning is opaque.
- Future retrieval over graph relations lacks confidence data.

Refactor direction:

- Change relation graph builder to return `{ id, score }` pairs.
- Store scores in graph edges.
- Add tests for threshold and top-K behavior with score preservation.

### P2: The Sync Checkpoint Strategy Can Advance Past Failed Persistence

Evidence:

- `runMemorySourceSyncOnce` persists each prepared event in a loop at `src/workflows/memory-source-sync/index.ts:79`.
- It writes the checkpoint after persistence at `:91`.
- This protects against checkpoint advancement when an exception is thrown, but persistence is not transactional across workspace and OpenViking.
- Browser page content enrichment is outside the sync transaction entirely at `src/workflows/browser-memory-sync/index.ts:216`.

Why this is partially unreasonable:

The event loop itself is simple and acceptable for MVP, but the storage backend writes workspace files and then OpenViking resources. Partial success can leave mismatched state.

Impact:

- A memory event may exist in workspace but not in OpenViking, or vice versa depending on failure point.
- Incremental checkpoints may not reflect all derived enrichment work.
- Replays may duplicate or miss enrichment.

Refactor direction:

- Define per-source sync state machine:
  - fetched
  - normalized
  - persisted locally
  - indexed in OpenViking
  - enriched
  - checkpointed
- Make checkpoint semantics explicitly raw-event-only or full-enrichment.
- Add repair/reindex commands for workspace-to-OpenViking drift.

### P2: Ingestion And Retrieval Treat Raw And Display Memory Differently Without Clear Naming

Evidence:

- `listMirrorBrainMemoryEventsFromWorkspace` returns deduplicated display events at `src/integrations/openviking-store/index.ts:1079`.
- `listRawMirrorBrainMemoryEventsFromWorkspace` returns raw events at `:1111`.
- Service uses display events for listing and raw events for candidate generation at `src/apps/mirrorbrain-service/index.ts:1341`.

Why this is unreasonable:

The distinction is valid, but the naming and type are too similar. Both return `MemoryEvent[]`, so callers can accidentally choose the wrong one.

Impact:

- Review, retrieval, and UI can disagree on event counts and source refs.
- Future lifecycle logic may accidentally operate on deduplicated display records instead of raw records.

Refactor direction:

- Introduce explicit types:
  - `RawMemoryEvent`
  - `MemoryEventDisplayRecord`
  - `MemoryEventReadModel`
- Make display deduplication a named transformation with tests.
- Use raw events for lifecycle transitions and read models for UI only.

### P2: Source-Specific Product Language Is Embedded Deep In Logic

Evidence:

- Candidate summaries generate English sentences in `src/modules/memory-review/index.ts:744`.
- Retrieval summaries generate English sentences in `src/integrations/agent-memory-api/index.ts:428`.
- Knowledge fallback body text is embedded in `src/modules/knowledge-generation-llm/index.ts:587`.

Why this is unreasonable:

Copy generation is part of the product experience and should be testable, localizable, and adjustable without touching ranking/storage logic.

Impact:

- Future Chinese UI/agent responses will require editing core ranking code.
- Tests may lock implementation details rather than behavior.
- Product voice changes become risky.

Refactor direction:

- Extract summary writers and rationale writers.
- Keep ranking/scoring output structured.
- Have presentation layers render structured decisions into text.

### P2: Test Coverage Is Large But Mostly Protects Existing Shape, Not Boundaries

Evidence:

- The repository has substantial tests, including large files:
  - `src/apps/mirrorbrain-service/index.test.ts`: 2,306 lines.
  - `src/integrations/openviking-store/index.test.ts`: 2,082 lines.
  - `src/integrations/agent-memory-api/index.test.ts`: 2,066 lines.
  - `src/modules/memory-review/index.test.ts`: 1,520 lines.
- The largest tests mirror the largest files.
- Authorization policy tests exist, but runtime authorization enforcement is not integrated.

Why this is unreasonable:

Large tests can be valuable, but here they reinforce monoliths. Refactoring is harder because tests are coupled to broad facades instead of smaller contracts.

Impact:

- Extracting one behavior requires updating broad tests.
- Boundary regressions are less visible than snapshot-like behavior regressions.
- Privacy invariants are not tested where data is actually captured.

Refactor direction:

- Add narrow contract tests before extraction.
- Prioritize invariant tests:
  - unauthorized source capture is blocked
  - secrets are redacted before persistence
  - raw provenance survives derived artifacts
  - degraded knowledge cannot be silently published
  - skill execution remains confirmation-gated
- Keep broad integration tests, but move detailed heuristics into smaller module tests.

### P2: Developer Tooling Does Not Express Whole-Repo Verification

Evidence:

- Root `package.json` exposes `test`, `typecheck`, and `e2e`.
- Root `tsconfig.json` excludes `src/apps/mirrorbrain-web-react/**`.
- React app has its own scripts in `src/apps/mirrorbrain-web-react/package.json`.
- `scripts/build-react-webui.ts` directly executes `src/apps/mirrorbrain-web-react/node_modules/.bin/vite`.

Why this is unreasonable:

The project has two TypeScript toolchains, but root commands look like whole-repo commands. This makes completion checks ambiguous.

Impact:

- Backend changes can break frontend API assumptions without root verification failing.
- Build scripts assume nested dependencies were installed.
- Contributors may not know which command proves the UI is healthy.

Refactor direction:

- Add a root `verify` script that runs backend tests/typecheck and React tests/typecheck/build.
- Prefer a pnpm workspace so nested dependencies are managed explicitly.
- Document which verification commands are required by change type.

## Suggested Refactor Sequence

### Step 1: Stabilize Contracts And Safety Boundaries

Goal: reduce privacy and API drift risk before moving code.

Recommended work:

- Add runtime authorization enforcement to source sync.
- Add shell command redaction before persistence.
- Define a shared API schema/DTO layer.
- Make frontend types consume shared/generated DTOs.
- Add contract tests for HTTP DTOs and source authorization.

Why first:

These are product invariants. Refactoring around unsafe or drifting contracts risks preserving the wrong behavior.

### Step 2: Extract Storage Boundaries

Goal: make persistence predictable and reduce OpenViking coupling.

Recommended work:

- Split OpenViking HTTP client from workspace artifact store.
- Define canonical JSON records for machine-readable artifacts.
- Keep Markdown as a projection.
- Centralize tombstone/delete behavior.
- Add artifact round-trip tests.

Why second:

Service, retrieval, and knowledge flows all depend on storage. Clear storage boundaries make later service extraction easier.

### Step 3: Extract Retrieval And Review Domain Modules

Goal: remove core business logic from host/integration adapters.

Recommended work:

- Move retrieval grouping/ranking from `agent-memory-api` into a domain module.
- Split memory review into classifier, grouper, ranker, summary writer, and review transition modules.
- Share browser and shell classifiers.

Why third:

This directly supports Phase 2B retrieval quality without further coupling to Agent Client.

### Step 4: Break Up The Service Facade

Goal: make app service composition thin and testable.

Recommended work:

- Extract memory sync service.
- Extract artifact store service.
- Extract knowledge service.
- Extract review service.
- Keep `createMirrorBrainService` as a small dependency composition layer.

Why fourth:

After contracts, storage, and retrieval are stable, the service extraction can mostly move code rather than redesigning behavior in place.

### Step 5: Consolidate Frontend Surfaces

Goal: reduce duplicate UI/API behavior.

Recommended work:

- Decide whether the vanilla UI remains supported.
- Move shared API client to a common package/module.
- Add root-level web verification.
- Retire duplicated type definitions.

Why fifth:

Frontend consolidation benefits from stable DTOs and service routes.

## Proposed Target Boundaries

### Source Capture

New or clarified components:

- `src/modules/authorization-scope-registry`
- `src/modules/source-capture-policy`
- `src/modules/shell-command-sanitizer`
- `src/modules/browser-url-policy`
- `src/workflows/source-sync`

Responsibilities:

- authorize source category and instance
- redact or reject sensitive raw content
- normalize raw events
- persist raw events with provenance
- update checkpoints only under documented conditions

### Memory Review And Retrieval

New or clarified components:

- `src/modules/memory-event-classification`
- `src/modules/candidate-memory-generation`
- `src/modules/candidate-review-suggestion`
- `src/modules/memory-retrieval`
- `src/modules/memory-summary-writing`

Responsibilities:

- classify browser/shell evidence consistently
- group raw events into candidate memories
- recommend review decisions
- answer memory queries from raw events and narrative artifacts
- render structured retrieval outputs into summaries

### Artifact Storage

New or clarified components:

- `src/integrations/openviking-client`
- `src/integrations/workspace-artifact-store`
- `src/modules/artifact-codecs`
- `src/modules/artifact-lifecycle-store`

Responsibilities:

- keep OpenViking HTTP concerns isolated
- persist canonical machine-readable artifacts
- generate human-readable Markdown projections
- apply tombstones and deletion policy consistently
- support reindex/repair workflows

### Knowledge

New or clarified components:

- `src/modules/knowledge-generation`
- `src/modules/knowledge-generation-status`
- `src/modules/topic-knowledge-publication`
- `src/modules/knowledge-relation-refresh`

Responsibilities:

- generate drafts from reviewed memory
- preserve structured generation status
- merge topic knowledge
- refresh relations with observable operation status
- prevent degraded fallback publication without review visibility

### HTTP And Agent Client

New or clarified components:

- `src/shared/api-contract`
- `src/apps/mirrorbrain-http-server/routes/*`
- `src/integrations/agent-memory-api`

Responsibilities:

- HTTP server validates DTOs and maps errors.
- Agent Client adapter calls capability services and maps results to host tools.
- Neither layer owns retrieval, review, or lifecycle policy.

## Concrete Refactor Task Backlog

1. Add runtime authorization tests for browser and shell sync.
2. Add shell secret redaction tests and a sanitizer module.
3. Introduce API DTO schemas and make HTTP routes use them.
4. Replace React copied types with shared/generated DTO types.
5. Extract `openviking-client` from `openviking-store`.
6. Extract `workspace-artifact-store` from `openviking-store`.
7. Add knowledge artifact JSON canonical persistence and Markdown projection.
8. Add round-trip tests for `KnowledgeArtifact` fields including `tags`, `relatedKnowledgeIds`, and `compilationMetadata`.
9. Centralize delete/tombstone behavior.
10. Extract browser and shell classifiers.
11. Move memory retrieval logic out of `agent-memory-api`.
12. Split `memory-review/index.ts` into grouper, ranker, classifier, summary writer, and transition modules.
13. Add visible operation status for page content enrichment, relation refresh, cache update, and knowledge lint.
14. Extract service facade responsibilities into memory sync, review, knowledge, and artifact services.
15. Decide whether to remove or freeze `src/apps/mirrorbrain-web`.
16. Add root `verify` scripts that include React app verification.

## Red Flags To Avoid During Refactor

- Do not replace handwritten schemas with another duplicated schema layer. The point is one contract source.
- Do not move all extracted code into `src/shared`. Domain ownership should remain explicit.
- Do not make Agent Client the owner of retrieval policy. It should consume MirrorBrain capabilities.
- Do not keep shell raw command capture unchanged while improving shell retrieval.
- Do not treat Markdown as the only machine-readable durable format for knowledge artifacts.
- Do not remove broad integration tests before smaller replacement tests exist.
- Do not silently change lifecycle semantics while moving files. For example, candidate deletion, knowledge deletion, and reviewed-memory undo need explicit migration tests.

## Recommended First Pull Request

The best first refactor PR should be small and safety-oriented:

1. Add a shell command sanitizer module.
2. Wire it into shell history normalization or source sync before persistence.
3. Add tests for redacting common token/password patterns.
4. Document the shell memory redaction boundary in `docs/components/shell-history-source.md` or a new component doc.

Reason:

It improves a real privacy invariant, has a narrow blast radius, and establishes the pattern for turning product policy into runtime enforcement.

The second PR should address authorization enforcement for browser and shell sync. Once capture safety is real, API contracts and service extraction can proceed with less risk.
