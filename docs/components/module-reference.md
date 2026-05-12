# MirrorBrain Module Reference

## Summary

This document describes the current MirrorBrain code architecture as implemented
under `src/`. It is intentionally code-facing: it defines each module's
responsibility, boundary, inputs, outputs, dependencies, failure modes, and
verification coverage.

MirrorBrain preserves three product surfaces:

- Memory modules capture, normalize, sync, retrieve, group, and review
  authorized work activity.
- Knowledge modules synthesize reviewed memory into readable artifacts,
  topic versions, relation graphs, and quality checks.
- Skill modules draft reusable Agent Skills from reviewed workflow evidence
  while preserving explicit confirmation requirements.

## Architectural Layers

| Layer | Path | Boundary |
| --- | --- | --- |
| Apps | `src/apps/` | Process entrypoints, service facade, HTTP transport, and UI surfaces. |
| Integrations | `src/integrations/` | Adapters for ActivityWatch, shell history, OpenViking, browser content, checkpoints, and openclaw. |
| Modules | `src/modules/` | Domain rules, artifact construction, lifecycle policy, scoring, relation logic, and shared domain transformations. |
| Workflows | `src/workflows/` | Multi-step orchestration that composes modules and integrations. |
| Shared | `src/shared/` | Cross-cutting types, API contracts, config defaults, and low-level HTTP LLM helpers. |

## Apps

### `src/apps/mirrorbrain-service`

Purpose: compose the local runtime and expose a high-level product API for the
HTTP server and tests.

Responsibilities:

- Start the runtime service with ActivityWatch browser polling, optional shell
  sync, checkpoint storage, and OpenViking writers.
- Expose memory sync, paginated memory listing, memory query, candidate review,
  knowledge generation, knowledge approval, knowledge graph, and skill draft
  operations.
- Keep OpenViking and workspace reads merged where useful, while respecting
  deletion tombstones for knowledge and skill artifacts.
- Refresh browser and shell memory narratives after explicit sync.
- Refresh knowledge relations and schedule linting after knowledge writes.

Inputs:

- `MirrorBrainConfig`, workspace directory, browser bucket, shell history path,
  source scope ids, and injected dependencies for tests.
- Reviewed memories, candidate memories, knowledge drafts, skill drafts, and
  memory query requests from the HTTP surface.

Outputs:

- `BrowserMemorySyncResult`, `ShellMemorySyncResult`, paginated memory events,
  `MemoryQueryResult`, `CandidateMemory`, `ReviewedMemory`, `KnowledgeArtifact`,
  `SkillArtifact`, topic summaries, and `KnowledgeGraphSnapshot`.

Dependencies:

- `openviking-store`, `openclaw-plugin-api`, `file-sync-checkpoint-store`,
  `activitywatch-browser-source`, `browser-page-content`.
- `memory-events-cache`, `memory-review`, `knowledge-generation-llm`,
  `knowledge-relation-network`, `knowledge-graph`.
- Browser/shell sync, narrative, topic merge, knowledge lint, and skill builder
  workflows.

Failure modes and constraints:

- Browser sync fails when no ActivityWatch browser bucket is available.
- Shell sync fails when no shell history path is configured.
- Artifact deletion validates ids to prevent path traversal.
- Knowledge approval fails when a draft id and draft snapshot do not match.
- OpenViking read failures fall back to workspace reads for several local
  surfaces.

Verification:

- Unit and integration coverage in `src/apps/mirrorbrain-service/*.test.ts`
  and `tests/integration/mirrorbrain-service-contract.test.ts`.

### `src/apps/mirrorbrain-http-server`

Purpose: provide MirrorBrain's stable local HTTP service and OpenAPI surface.

Responsibilities:

- Start Fastify with Swagger UI at `/docs` and OpenAPI JSON at
  `/openapi.json`.
- Serve the React UI build when a static directory is provided.
- Map HTTP endpoints to the service facade without embedding domain rules.
- Validate request/response shapes for memory, candidate review, knowledge,
  graph, skill, sync, and deletion operations.

Key endpoints:

- `GET /health`
- `GET /memory`, `POST /memory/query`
- `POST /sync/browser`, `POST /sync/shell`
- `GET /candidate-memories`, `POST /candidate-memories/daily`,
  `DELETE /candidate-memories/:id`
- `POST /candidate-reviews/suggestions`
- `POST /reviewed-memories`, `DELETE /reviewed-memories/:id`
- `GET /knowledge`, `POST /knowledge`, `DELETE /knowledge/:artifactId`
- `GET /knowledge/topics`, `GET /knowledge/topics/:topicKey`,
  `GET /knowledge/topics/:topicKey/history`, `GET /knowledge/graph`
- `POST /knowledge/generate`, `POST /knowledge/regenerate`,
  `POST /knowledge/approve`
- `GET /skills`, `POST /skills`, `DELETE /skills/:artifactId`,
  `POST /skills/generate`

Inputs:

- A service object implementing the MirrorBrain HTTP service contract.
- Host, port, workspace path, and optional static UI directory.

Outputs:

- JSON API responses and static web assets.

Dependencies:

- Fastify, `@fastify/swagger`, `@fastify/swagger-ui`, `@fastify/static`.
- Shared API contract schemas, shared artifact types, and service errors.

Failure modes and constraints:

- Unsupported optional operations return `501`.
- Invalid candidate/review/artifact ids return validation errors where the
  service exposes them.
- SPA static serving falls back to `index.html`.

Verification:

- `src/apps/mirrorbrain-http-server/index.test.ts`
- `src/apps/mirrorbrain-http-server/topic-knowledge.test.ts`

### `src/apps/mirrorbrain-web-react`

Purpose: provide the current standalone and embeddable MirrorBrain operator UI.

Responsibilities:

- Render the memory, review, knowledge, and skill tabs.
- Consume only the HTTP API through `src/api/client.ts`.
- Manage shared UI state with `MirrorBrainContext` and feature hooks.
- Provide sync controls, paginated memory event listing, daily candidate review,
  knowledge generation/regeneration/approval, knowledge graph visualization,
  and skill draft generation/editing.

Primary modules:

- `App.tsx`: tab orchestration, theme persistence, API construction.
- `api/client.ts`: typed browser client for the HTTP API.
- `contexts/MirrorBrainContext.tsx`: shared state provider.
- `hooks/*`: memory loading, sync operations, review workflow, artifacts,
  draft editing, and pagination.
- `components/memory/*`: memory list, event rendering, and sync actions.
- `components/review/*`: candidate list, selected candidate, review actions,
  guidance, kept candidate undo, and metrics.
- `components/artifacts/*`: knowledge panel, skill panel, history, markdown
  rendering, topic modal, graph panel, and wikilink hover cards.
- `components/common`, `components/forms`, `components/layout`: local design
  system primitives.

Inputs:

- HTTP API responses from the local MirrorBrain server.
- User operations in the control UI.

Outputs:

- API mutations for sync, review, knowledge, and skill workflows.
- A UI suitable for local debugging and future embedding.

Dependencies:

- React, Vite, local API client, and shared front-end types.

Failure modes and constraints:

- UI state should remain API-driven; no backend logic is embedded in the
  frontend.
- Knowledge and skill deletion rely on server-side validation.
- The app stores only UI theme preference in browser local storage.

Verification:

- Component and hook tests under `src/apps/mirrorbrain-web-react/src/**/*.test.tsx`.
- API client tests in `src/apps/mirrorbrain-web-react/src/api/client.test.ts`.

### `src/apps/mirrorbrain-web`

Purpose: legacy TypeScript web surface kept for compatibility and regression
coverage.

Responsibilities:

- Exercise earlier standalone UI behavior and topic knowledge display tests.
- Remain secondary to the React UI for current product development.

Verification:

- `src/apps/mirrorbrain-web/main.test.ts`
- `src/apps/mirrorbrain-web/topic-knowledge.test.ts`

## Integrations

### `src/integrations/activitywatch-browser-source`

Purpose: adapt ActivityWatch browser buckets into MirrorBrain memory source
plugins.

Responsibilities:

- Resolve the most recent `aw-watcher-web` bucket.
- Build initial and incremental browser sync plans.
- Fetch ActivityWatch browser events.
- Produce a `MemorySourcePlugin` that normalizes events through
  `memory-capture` and deduplicates near-repeat browser events.

Inputs:

- ActivityWatch base URL, bucket id, time window, sync checkpoint, and scope id.

Outputs:

- Raw `ActivityWatchBrowserEvent[]`, browser sync plans, source keys, and
  normalized `MemoryEvent` objects through the plugin interface.

Dependencies:

- `memory-capture` plugin and normalization helpers.
- Shared `MirrorBrainConfig` and `MemoryEvent` types.

Failure modes and constraints:

- ActivityWatch HTTP errors throw with status codes.
- Bucket resolution returns `null` when no browser watcher bucket exists.
- This adapter is a source integration only; it is not durable storage.

Verification:

- `src/integrations/activitywatch-browser-source/index.test.ts`

### `src/integrations/shell-history-source`

Purpose: adapt shell history files into MirrorBrain memory source plugins.

Responsibilities:

- Read configured shell history files.
- Parse command entries and timestamps where available.
- Create initial and incremental sync plans.
- Redact common secret-bearing command fragments before MirrorBrain persistence.
- Normalize redacted commands into shell `MemoryEvent` records with command
  metadata and command-derived identifiers rebuilt from redacted text.
- Expose a `shell-history:<path>` source key and plugin.

Inputs:

- Shell history path, checkpoint state, current time, and authorization scope id.

Outputs:

- Parsed `ShellHistoryEntry[]` and normalized shell memory events with redacted
  `id`, redacted `sourceRef`, redacted `content.command`, `commandName`, and
  `redactionApplied` when storage content changed.

Dependencies:

- `memory-capture` source plugin interface.
- Shared config and type definitions.

Failure modes and constraints:

- Missing or unreadable history files surface as read errors.
- Command redaction is best-effort and protects MirrorBrain-owned storage, not the user's original history file.
- Workspace/session context is inferred later by shell narrative generation; it
  is not guaranteed by this source.

Verification:

- `src/integrations/shell-history-source/index.test.ts`

### `src/integrations/browser-page-content`

Purpose: capture readable text for visited browser pages and link it back to
browser memory events.

Responsibilities:

- Skip local development URLs that should not be fetched as page content.
- Fetch HTML for HTTP(S) URLs and extract a readable primary text region.
- Build stable page-content artifact ids from URL hashes.
- Merge repeated access times for the same URL.
- Load page-content artifacts from the workspace.
- Enrich browser memory event content with page text storage references.

Inputs:

- Browser URL, title, fetch time, memory event, workspace directory, and
  optional existing page artifact.

Outputs:

- `BrowserPageContentArtifact`, event content references, and readable page
  text.

Dependencies:

- Node crypto/path/fs and OpenViking browser page content ingestion.

Failure modes and constraints:

- Fetch failures throw from `fetchBrowserPageContent`; browser sync catches and
  skips failed page fetches.
- HTML extraction is heuristic and intentionally avoids a browser runtime.

Verification:

- `src/integrations/browser-page-content/index.test.ts`

### `src/integrations/file-sync-checkpoint-store`

Purpose: persist sync cursors in local workspace files.

Responsibilities:

- Convert source keys to safe checkpoint filenames.
- Read and write JSON checkpoint records under
  `mirrorbrain/state/sync-checkpoints/`.
- Return `null` for missing checkpoints.

Inputs:

- Workspace directory and source key.

Outputs:

- `SyncCheckpoint` records with source key, last-synced timestamp, and update
  timestamp.

Failure modes and constraints:

- Malformed JSON propagates as a parse error.
- Source key sanitization is filename-oriented; source identity remains in the
  JSON payload.

Verification:

- `src/integrations/file-sync-checkpoint-store/index.test.ts`

### `src/integrations/openviking-store`

Purpose: bridge MirrorBrain artifacts to OpenViking resources and workspace
fallback files.

Responsibilities:

- Build stable `viking://resources/mirrorbrain-*` targets.
- Ingest memory events, page content, candidates, reviewed memories,
  narratives, knowledge artifacts, and skill artifacts.
- Delete candidate resources.
- List artifacts from OpenViking and from local workspace files.
- Preserve MirrorBrain-owned JSON/Markdown payloads for local inspection and
  fallback reads.

Inputs:

- OpenViking base URL, workspace directory, and MirrorBrain artifact payloads.

Outputs:

- Resource ingestion metadata, artifact lists, and raw memory event records.

Dependencies:

- OpenViking HTTP filesystem/resource APIs and local filesystem reads.

Failure modes and constraints:

- OpenViking point-lock failures are retried.
- Some service-level reads fall back to workspace files when OpenViking is
  unavailable.
- This module handles storage transport, not product lifecycle policy.

Verification:

- `src/integrations/openviking-store/*.test.ts`

### `src/integrations/openclaw-plugin-api`

Purpose: expose MirrorBrain capability helpers shaped for openclaw plugin use.

Responsibilities:

- `queryMemory`: retrieve memory in theme-level result form.
- `listKnowledge`: list knowledge artifacts for host consumption.
- `listSkillDrafts`: list skill artifacts without mixing them into ordinary
  memory answers.
- Prefer stored browser and shell narratives when available.
- Fall back to raw memory event grouping for browser work recall and shell
  problem-solving questions.
- Preserve source hints in `MemoryQueryItem.sourceRefs`.

Inputs:

- OpenViking base URL, natural-language query, optional time range, and optional
  source type filters.

Outputs:

- `MemoryQueryResult`, `KnowledgeArtifact[]`, and `SkillArtifact[]`.

Dependencies:

- OpenViking list functions and shared artifact types.

Failure modes and constraints:

- Retrieval is deterministic and heuristic; it is not an embedding-first search
  layer yet.
- Default memory retrieval does not pull skills into ordinary chat responses.

Verification:

- `src/integrations/openclaw-plugin-api/*.test.ts`

### `src/integrations/openclaw-plugin-api/query-memory-tool-example`

Purpose: document and test the minimum `query_memory` tool wrapper shape for
openclaw.

Responsibilities:

- Build a tool example around `queryMemory`.
- Compose a lightweight natural-language answer from query results and source
  hints.

Verification:

- `src/integrations/openclaw-plugin-api/query-memory-tool-example.test.ts`

## Domain Modules

### `src/modules/authorization-scope-policy`

Purpose: represent minimal authorization state for memory source categories.

Responsibilities:

- Create source-category authorization scopes.
- Check whether a non-revoked scope authorizes a category.
- Revoke a scope by setting `revokedAt`.

Inputs and outputs:

- Input: scope id and `MirrorBrainSourceCategory`.
- Output: `AuthorizationScope` and boolean authorization decisions.

Constraints:

- Current implementation is in-memory/domain-only. Broader source-instance UX
  and persisted revocation handling remain future work.

Verification:

- `src/modules/authorization-scope-policy/index.test.ts`

### `src/modules/memory-capture`

Purpose: define the source plugin contract and normalize captured source events
into MirrorBrain memory events.

Responsibilities:

- Define `MemorySourcePlugin`, `MemorySourceSyncPlan`, and
  `MemorySourceRegistry`.
- Normalize ActivityWatch browser events into source-attributed `MemoryEvent`
  records.
- Deduplicate memory events by configurable fingerprint.
- Persist memory events through an OpenViking-compatible writer.

Inputs:

- Raw source events, scope ids, sync plans, and registered source plugins.

Outputs:

- Normalized `MemoryEvent` records and persisted OpenViking memory event
  records.

Dependencies:

- OpenViking memory event record writer and shared types.

Failure modes and constraints:

- Duplicate source plugin keys throw during registry creation.
- This module normalizes and persists; it does not authorize sources by itself.

Verification:

- `src/modules/memory-capture/index.test.ts`

### `src/modules/source-ledger-importer`

Purpose: implement the Phase 4 JSONL ledger import boundary between built-in
recorders and normalized MirrorBrain memory evidence.

Responsibilities:

- Parse daily source ledger lines after the current checkpoint.
- Validate the common source ledger envelope and supported source-specific
  payloads.
- Normalize valid browser ledger entries into source-attributed `MemoryEvent`
  records with `content.contentKind = "browser-page"`.
- Emit `SourceAuditEvent` operational records for imported entries and skipped
  invalid lines.
- Advance line-number checkpoints so manual re-import handles only new lines.

Inputs:

- Ledger path, ledger text, authorization scope id, import timestamp, and an
  optional source-ledger checkpoint.

Outputs:

- Imported `MemoryEvent` records, `SourceAuditEvent` records, and the next
  `SourceLedgerImportCheckpoint`.

Dependencies:

- Shared `MemoryEvent` type and Node `crypto` hashing.

Failure modes and constraints:

- Malformed or schema-invalid lines are skipped with warning audit events.
- One bad ledger line does not block later valid lines.
- The current module supports browser ledgers only; additional Phase 4 source
  kinds require new built-in normalization branches or plugins.
- The module does not read files, schedule scans, persist outputs, or authorize
  source import.

Verification:

- `src/modules/source-ledger-importer/index.test.ts`

### `src/modules/memory-review`

Purpose: turn daily memory events into reviewable candidate streams and record
review decisions.

Responsibilities:

- Filter events to a review date and ignore local browser pages.
- Group events into task-like streams using host, title, token, and time-gap
  signals.
- Infer page roles and primary/supporting source contribution.
- Compress noisy or repeated source refs while keeping provenance fields.
- Generate candidate summaries, formation reasons, and discard reasons.
- Convert a candidate into a `ReviewedMemory` for keep/discard decisions.
- Produce deterministic review suggestions with confidence and rationale.

Inputs:

- `MemoryEvent[]`, review date, optional review timezone, candidate memories,
  and explicit review decisions.

Outputs:

- `CandidateMemory[]`, `ReviewedMemory`, and `CandidateReviewSuggestion[]`.

Dependencies:

- Shared artifact types only.

Failure modes and constraints:

- Candidate creation throws when no memory events exist for the review date.
- Candidate review is explicit; candidate generation never approves memory.

Verification:

- `src/modules/memory-review/index.test.ts`
- `src/modules/memory-review/normalize-memory-items.test.ts`

### `src/modules/memory-review/normalize-memory-items`

Purpose: normalize heterogeneous raw memory events for review UI and candidate
generation helpers.

Responsibilities:

- Convert raw events into stable display items with source category, title,
  URL/command fields, and timestamps.

Verification:

- `src/modules/memory-review/normalize-memory-items.test.ts`

### `src/modules/memory-events-cache`

Purpose: maintain a display-oriented cache of memory events for fast UI listing.

Responsibilities:

- Load and save `mirrorbrain/cache/memory-events-cache.json`.
- Initialize cache from workspace files first, then OpenViking fallback.
- Merge new sync events into the cache.
- Deduplicate browser URL events for display while preserving access times.
- Store last sync summaries and event evaluation statistics.
- Return paginated cache slices.

Inputs:

- Workspace directory, OpenViking base URL, new imported events, and source
  category.

Outputs:

- `MemoryEventsCache` and paginated event slices.

Dependencies:

- OpenViking list functions and `memory-event-evaluator`.

Failure modes and constraints:

- Invalid cache JSON is treated as a cache miss.
- Cache content is display-optimized and must not replace durable raw storage.

Verification:

- `src/modules/memory-events-cache/index.test.ts`

### `src/modules/memory-events-cache/memory-event-evaluator`

Purpose: pre-filter and score memory events before cache ingestion.

Responsibilities:

- Remove junk or too-short events.
- Score events by source type, text richness, browser page quality, URL/title
  signals, page role, and repeated access.
- Remove near-duplicates using n-gram Jaccard similarity.
- Limit retained events with source balancing.

Inputs and outputs:

- Input: `MemoryEvent[]`.
- Output: scored retained events and filter statistics.

Constraints:

- The scorer is heuristic and deterministic. It is intentionally not an
  approval gate for durable memory.

Verification:

- `src/modules/memory-events-cache/memory-event-evaluator.test.ts`

### `src/modules/daily-review-knowledge`

Purpose: produce a structured daily-review knowledge draft from reviewed
memories.

Responsibilities:

- Build `daily-review-draft` artifacts.
- Preserve source reviewed memory ids and provenance refs.
- Include candidate title, summary, time range, duration, primary/supporting
  sources, and formation reasons.
- Derive a topic key from candidate theme when available.

Inputs:

- `ReviewedMemory[]`.

Outputs:

- Draft `KnowledgeArtifact` with provenance and recency metadata.

Failure modes and constraints:

- Empty inputs produce a generic draft shape; durable publication still requires
  later review/approval.

Verification:

- `src/modules/daily-review-knowledge/index.test.ts`

### `src/modules/knowledge-generation-llm`

Purpose: synthesize richer knowledge drafts using reviewed memories and page
content.

Responsibilities:

- Retrieve source page content from memory events, cached browser page artifacts,
  optional live fetch, or degraded fallback.
- Classify note types such as workflow, tutorial, insight report, and
  development record.
- Build LLM synthesis prompts with provenance context.
- Clean noisy source content and search/login utility pages.
- Resolve stable Chinese-friendly knowledge titles.
- Generate `KnowledgeArtifact` drafts with body, topic key, provenance refs,
  tags, timestamps, and degraded fallback behavior when necessary.

Inputs:

- Reviewed memories and optional generation dependencies such as `getMemoryEvent`,
  `workspaceDir`, `fetchUrl`, and `analyzeWithLLM`.

Outputs:

- Draft `KnowledgeArtifact` objects and content retrieval metadata.

Dependencies:

- Browser page content integration and LLM HTTP config/generation helper.

Failure modes and constraints:

- Live fetch and LLM calls are dependency-injected for testability.
- Missing page content degrades to reviewed memory summaries instead of blocking
  draft generation.

Verification:

- `src/modules/knowledge-generation-llm/index.test.ts`
- Service-level knowledge generation tests.

### `src/modules/knowledge-compilation-engine`

Purpose: provide a deterministic two-stage knowledge compilation baseline.

Responsibilities:

- Extract strict, lowercased topic tags from text while filtering generic terms.
- Run discovery over reviewed memories to identify primary topic, supporting
  themes, recurring patterns, and discovery insights.
- Run execute stage to generate title, summary, wiki-linked body, tags, source
  reviewed memory ids, time range, and compilation metadata.

Inputs:

- Reviewed memories and text fields.

Outputs:

- Tags, `DiscoveryResult`, `ExecuteResult`, and generated wiki-link body.

Dependencies:

- Shared reviewed memory and knowledge artifact types.

Failure modes and constraints:

- Tagging is heuristic and noun-oriented; it is not a full NLP parser.
- Execute-stage ids are generated at runtime and are not stable semantic ids.

Verification:

- `src/modules/knowledge-compilation-engine/*.test.ts`

### `src/modules/knowledge-relation-network`

Purpose: compute related knowledge ids from artifact tag similarity.

Responsibilities:

- Calculate IDF weights across artifact tag vocabulary.
- Build TF-IDF vectors per artifact.
- Compute cosine similarity between vectors.
- Build a bounded relation graph with top-K and threshold constraints.

Inputs:

- `KnowledgeArtifact[]` with tags.

Outputs:

- `Map<string, string[]>` from artifact id to related artifact ids.

Constraints:

- Artifacts without tags have sparse/empty vectors.
- Similarity scores are used internally; current public graph edges do not
  expose exact score values.

Verification:

- `src/modules/knowledge-relation-network/*.test.ts`

### `src/modules/knowledge-graph`

Purpose: build UI-ready knowledge graph snapshots from topic knowledge.

Responsibilities:

- Extract Obsidian-style `[[topicKey]]` and `[[topicKey|display]]` wikilinks.
- Create topic nodes and knowledge-artifact version nodes.
- Add `CONTAINS` edges from topics to artifacts.
- Add `REFERENCES` edges from wikilinks.
- Add optional `SIMILAR` edges from TF-IDF relation network output.
- Return graph statistics for UI display.

Inputs:

- `KnowledgeArtifact[]` and graph options for similarity threshold/top-K.

Outputs:

- `KnowledgeGraphSnapshot`.

Dependencies:

- `knowledge-relation-network` and local wikilink extractor/types.

Failure modes and constraints:

- Artifacts without `topicKey` are skipped from graph nodes.
- Wikilinks to unknown topics are ignored.

Verification:

- `src/modules/knowledge-graph/*.test.ts`

### `src/modules/skill-draft-management`

Purpose: model skill draft creation and approval state.

Responsibilities:

- Create `SkillArtifact` drafts from workflow evidence refs.
- Require confirmation by default in execution safety metadata.
- Mark drafts as approved without changing execution safety metadata.

Inputs:

- Reviewed memory ids or other workflow evidence refs.

Outputs:

- Draft or approved `SkillArtifact`.

Constraints:

- Approval to create or approve a draft is not execution permission.
- Current module does not execute skills.

Verification:

- `src/modules/skill-draft-management/index.test.ts`

## Workflows

### `src/workflows/memory-source-sync`

Purpose: generic one-shot sync engine for source plugins.

Responsibilities:

- Check runtime source authorization before upstream fetch.
- Read source checkpoint.
- Build initial or incremental sync plan.
- Fetch raw source events.
- Normalize and sanitize events through the source plugin.
- Optionally prepare/enrich events before persistence.
- Check runtime source authorization again before persistence.
- Persist events and update checkpoint.

Inputs:

- Config, current time, source key, scope id, checkpoint store, source registry,
  source authorization dependency, optional preparation function, and writer.

Outputs:

- `MemorySourceSyncResult` with strategy, imported count, last synced time, and
  imported event preview.

Failure modes and constraints:

- Unknown source key throws.
- Unauthorized source sync throws before upstream fetch or before persistence,
  depending on when the policy rejects.
- Checkpoints are not advanced when authorization rejects before persistence.
- Checkpoint advances to the latest of prior checkpoint, current time, and event
  timestamps.

Verification:

- `src/workflows/memory-source-sync/index.test.ts`

### `src/workflows/browser-memory-sync`

Purpose: sync ActivityWatch browser events and attach browser page content.

Responsibilities:

- Register the ActivityWatch browser source plugin.
- Group events by URL during preparation.
- Load or create shared browser page content artifacts.
- Attach access times to memory events and attach page content references only
  when page-content authorization allows the URL.
- Persist normalized browser events through the generic sync engine.
- Asynchronously fetch and ingest missing page text after the separate
  page-content authorization policy allows the URL.
- Start configurable polling around `runSyncOnce`.

Inputs:

- Config, current time, bucket id, optional initial backfill start, scope id,
  workspace dir, checkpoint store, source authorization, page-content
  authorization, page fetcher, page ingester, and writer.

Outputs:

- `BrowserMemorySyncResult`.

Failure modes and constraints:

- Failed page fetches are skipped so browser event sync can continue.
- Localhost and non-HTTP(S) URLs are not fetched as page content.
- Browser event authorization and page-content capture authorization are
  separate dependencies.

Verification:

- `src/workflows/browser-memory-sync/index.test.ts`
- `tests/integration/browser-memory-sync.test.ts`

### `src/workflows/shell-memory-sync`

Purpose: sync configured shell history through the generic memory sync engine.

Responsibilities:

- Register a shell history source plugin for the configured history path.
- Delegate planning, normalization, persistence, and checkpointing to
  `memory-source-sync`.

Inputs and outputs:

- Input: config, current time, scope id, history path, checkpoint store, optional
  reader, and writer.
- Output: `ShellMemorySyncResult`.

Verification:

- `src/workflows/shell-memory-sync/index.test.ts`

### `src/workflows/browser-theme-narratives`

Purpose: build offline browser memory narratives for work-recall questions.

Responsibilities:

- Group browser events by normalized theme/title and date.
- Detect narrative kind: passive, documentation, research, comparison, or
  debugging.
- Prefer action-oriented narratives when counts tie.
- Compress representative source refs by URL.
- Generate summaries and query hints for `What did I work on yesterday?` style
  retrieval.

Inputs:

- `MemoryEvent[]`.

Outputs:

- Browser `MemoryNarrative[]`.

Constraints:

- Narrative generation is deterministic and heuristic, not LLM-based.

Verification:

- `src/workflows/browser-theme-narratives/index.test.ts`

### `src/workflows/shell-problem-narratives`

Purpose: build offline shell problem-solving narratives.

Responsibilities:

- Segment shell events into sessions by time gaps.
- Infer current working directory from `cd`/`pushd` command sequences.
- Detect operation phases: inspected state, applied changes, verified result.
- Build workspace-aware summaries, source refs, query hints, and context.

Inputs:

- `MemoryEvent[]`.

Outputs:

- Shell `MemoryNarrative[]`.

Constraints:

- Workspace context is inferred from command sequences; shell source events do
  not guarantee explicit cwd metadata.

Verification:

- `src/workflows/shell-problem-narratives/index.test.ts`

### `src/workflows/daily-review`

Purpose: preserve the original daily-review orchestration boundary.

Responsibilities:

- Convert reviewed memories into a daily-review knowledge draft through
  `daily-review-knowledge`.

Verification:

- `src/workflows/daily-review/index.test.ts`

### `src/workflows/topic-knowledge-merge`

Purpose: turn daily-review drafts into topic-oriented current-best knowledge.

Responsibilities:

- Build topic merge candidates from daily-review drafts.
- Resolve topic keys.
- Decide whether to create a new topic, update current best, or keep a weak
  draft unmerged.
- Assign version numbers and current-best markers.
- Mark superseded current-best artifacts when updating a topic.

Inputs:

- Knowledge drafts/candidates, existing knowledge artifacts, and optional merge
  timestamp.

Outputs:

- Merge decision, published topic artifact, and optional superseded artifact.

Constraints:

- Candidates without reviewed-memory provenance or with very short bodies remain
  drafts.

Verification:

- `src/workflows/topic-knowledge-merge/index.test.ts`

### `src/workflows/knowledge-lint`

Purpose: keep generated knowledge sets coherent after new writes.

Responsibilities:

- Identify duplicate generated daily-review drafts.
- Build relation tags for artifacts.
- Update `relatedKnowledgeIds`.
- Create merge candidate artifacts for similar knowledge that is not already a
  duplicate.

Inputs:

- Knowledge artifacts and seed knowledge ids.

Outputs:

- `KnowledgeLintPlan` containing artifacts to update, artifact ids to delete,
  and merge candidates to publish.

Constraints:

- Linting is scheduled asynchronously by the service; failures are logged and do
  not block the primary write.

Verification:

- `src/workflows/knowledge-lint/index.test.ts`

### `src/workflows/topic-knowledge-quality`

Purpose: evaluate topic-knowledge quality against deterministic fixtures.

Responsibilities:

- Score summarization fidelity, structure and reasoning, future usefulness,
  provenance completeness, and recency clarity.
- Verify that current-best topic knowledge is at least as readable as the draft,
  retains provenance, and retains history.

Inputs:

- Fixture name, daily-review draft, current-best topic, and topic history.

Outputs:

- `TopicKnowledgeQualityReport`.

Verification:

- `src/workflows/topic-knowledge-quality/index.test.ts`
- `tests/integration/topic-knowledge-quality-evaluation.test.ts`

### `src/workflows/skill-draft-builder`

Purpose: convert reviewed workflow evidence into a skill draft.

Responsibilities:

- Map reviewed memory ids into `workflowEvidenceRefs`.
- Delegate artifact construction to `skill-draft-management`.

Inputs:

- `ReviewedMemory[]`.

Outputs:

- Draft `SkillArtifact`.

Constraints:

- This workflow drafts only; it does not approve or execute skills.

Verification:

- `src/workflows/skill-draft-builder/index.test.ts`

## Shared Modules

### `src/shared/api-contracts`

Purpose: provide shared runtime schemas for MirrorBrain public API DTOs.

Responsibilities:

- Define JSON-schema-compatible DTO schemas used by transport surfaces.
- Keep HTTP response required fields aligned with domain type required fields.
- Provide a future source for generated or re-exported frontend/plugin client
  types.

Inputs:

- Domain object shapes from `src/shared/types`.

Outputs:

- Runtime DTO schemas such as `knowledgeArtifactDtoSchema` and
  `skillArtifactDtoSchema`.

Failure modes and constraints:

- The current slice covers knowledge and skill artifact responses; additional
  API DTOs still need migration into this shared layer.

Verification:

- `src/shared/api-contracts/index.test.ts`

### `src/shared/types`

Purpose: define cross-layer TypeScript contracts.

Responsibilities:

- Define config, source category, authorization, memory, narrative, query,
  candidate, reviewed memory, knowledge, and skill artifact types.
- Keep memory, knowledge, and skill artifact boundaries explicit.

Constraints:

- Types are shared by backend, integrations, workflows, tests, and the HTTP
  schema layer. Changes have broad blast radius and require typecheck plus
  relevant tests.

### `src/shared/config`

Purpose: provide default local runtime configuration.

Responsibilities:

- Return default sync interval, initial backfill window, ActivityWatch base URL,
  OpenViking base URL, and MirrorBrain service host/port.

Constraints:

- Environment-variable parsing currently lives in `scripts/start-mirrorbrain-dev.ts`;
  this module is a stable default config source.

Verification:

- `src/shared/config/index.test.ts`

### `src/shared/llm-title-generation`

Purpose: provide low-level HTTP helpers for configured LLM calls.

Responsibilities:

- Load LLM configuration from environment variables.
- Call a configured OpenAI-compatible chat endpoint for title/analysis
  generation.

Dependencies:

- Environment variables consumed by `http-fetch.ts`.

Verification:

- `src/shared/llm-title-generation/http-fetch.test.ts`

## Runtime Script

### `scripts/start-mirrorbrain-dev.ts`

Purpose: developer entrypoint behind `pnpm dev`.

Responsibilities:

- Parse `.env` and default config into runtime config.
- Check required environment values, ActivityWatch readiness, OpenViking
  readiness, and recent browser events.
- Spawn a detached MirrorBrain child process from the CLI mode.
- Start the React `vite build --watch` process and wait for build output.
- Start the runtime service and HTTP server with optional shell history sync.

Inputs:

- `.env`, process environment, project directory, local dependencies.

Outputs:

- Running service address, process id, log path, and next-step messages.

Failure modes and constraints:

- Startup refuses to proceed when required local dependencies are not ready.
- Child runtime logs are written to `.mirrorbrain/mirrorbrain-dev.log`.

Verification:

- Covered indirectly by service, HTTP, and integration tests; startup-specific
  behavior should remain dependency-injectable when new checks are added.
