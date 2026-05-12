# MirrorBrain Service

## Summary

This component is the runnable service entrypoint for MirrorBrain. It starts the browser sync polling workflow, wires memory-source sync workflows to the checkpoint store and OpenViking memory ingestion adapter, schedules stored memory narrative rebuilds after explicit browser or shell sync operations, wires Phase 4 source-ledger import to checkpoint and audit storage, and exposes the `openclaw`-facing service contract for memory retrieval, source management, user-triggered work-session analysis, daily candidate generation, candidate review suggestions, explicit review decisions, and reviewed-memory-driven artifact generation.

## Responsibility Boundary

- owns service startup and shutdown lifecycle
- starts background browser polling with the configured interval
- wires browser polling to checkpoint persistence and OpenViking memory ingestion
- exposes an explicit shell-history sync operation when a shell history path is configured
- exposes explicit Phase 4 source-ledger import for manual Import Now operations
- exposes source audit events and source instance summaries as operational state
- exposes manual Phase 4 work-session analysis windows for 6h, 24h, and 7d ranges
- wires runtime memory-source authorization policy into browser and shell sync execution
- wires separate page-content capture authorization into browser page text backfill
- exposes the high-level service contract used by `openclaw`
- keeps raw memory listing and `openclaw` retrieval shaping as separate concerns
- falls back to workspace-cached raw memory events when OpenViking-backed memory reads fail
- schedules browser theme narrative rebuilds after explicit browser sync calls through the service contract
- schedules shell problem narrative rebuilds after explicit shell sync calls through the service contract
- forwards `openclaw` retrieval calls to the OpenViking-backed plugin API with the configured base URL
- exposes daily candidate-memory generation, refresh, and review suggestion operations
- exposes explicit candidate review decisions as service-level operations
- publishes knowledge and skill artifacts through explicit OpenViking-backed service methods
- deletes persisted knowledge and skill artifacts through workspace-backed tombstones so removed ids stay hidden even if OpenViking still lists older copies
- generates source-content-aware knowledge drafts from reviewed memories before publishing them
- schedules the knowledge lint workflow after reviewed-memory knowledge generation and regeneration
- exposes topic-merge helper methods that turn daily-review drafts into topic merge candidates and publish topic knowledge artifacts
- exposes read-oriented topic knowledge helpers for listing current-best topics, reading one current-best topic, and reading topic history
- does not own domain logic for memory review, knowledge generation, or skill generation

## Key Interfaces

- `startMirrorBrainService(...)`
- `createMirrorBrainService(...)`
- `getAuthorizationScope(scopeId)` dependency for runtime authorization lookup
- `authorizePageContentCapture(...)` dependency for URL-level readable page text capture checks

## Data Flow

1. Load MirrorBrain config.
2. Create a file-backed sync checkpoint store and an OpenViking-backed memory writer.
3. Build a runtime source authorization policy from `getAuthorizationScope(...)`.
4. Build a separate page-content capture authorization callback, using the injected dependency when present and denying readable page text capture by default.
5. Start the browser sync polling workflow with a real `runBrowserMemorySyncOnce(...)` callback plus runtime source and page-content authorization policies.
6. Optionally expose a shell-history sync operation through `runShellMemorySyncOnce(...)` when a history path is configured, using the same runtime authorization policy.
7. Return a runtime service handle with `status` and `stop()`.
8. Create the Phase 4 source-ledger state store for per-ledger checkpoints and operational source audit records.
9. Expose the `openclaw`-facing service contract around that runtime handle.
10. After explicit browser or shell sync calls through the service contract, return the sync summary immediately and schedule the corresponding narrative rebuild in the background when new events were imported.
11. When source-ledger import is requested, run the Phase 4 import workflow, persist imported memory events through the memory writer, and persist audit/checkpoint state through the source-ledger state store.
12. List source audit events and source instance summaries from operational source state without mixing them into memory retrieval.
13. Run manual 6h, 24h, or 7d work-session analysis by reading stored memory events and returning pending work-session candidates without marking them reviewed.
14. List raw imported memory when review-oriented workflows need event-level records, preferring OpenViking-backed reads and falling back to workspace-cached memory-event files when storage reads fail.
15. Forward `openclaw` memory retrieval calls through the configured OpenViking base URL and return shaped retrieval results.
16. Before daily candidate generation or refresh, run an explicit browser-memory sync so the workspace raw-event cache reflects the latest ActivityWatch browser history.
13. If candidates already exist for a review date and the sync imports no new browser events, return the existing candidates without rebuilding them.
14. If candidates already exist for a review date and the sync imports new browser events, rebuild the daily candidates from current raw workspace memory history so late-day URLs are included.
15. Before rebuilding daily candidates, exclude memory events and browser URLs that are already linked through reviewed memories to published knowledge so previously synthesized work is not clustered again.
16. Generate daily task-oriented candidate streams for a requested review date, using raw workspace memory history rather than the UI display list.
17. Before candidate generation, enrich browser events with stored `browser-page-content` text when a page artifact is available in the workspace so review grouping can use page semantics instead of URL/title alone.
18. Return suggestion-only AI review hints without promoting any candidate, including keep-score and supporting reasons for the review UI.
19. Record explicit keep or discard decisions and publish reviewed memory artifacts.
20. Forward explicit knowledge and skill publishing calls to the OpenViking ingestion adapter.
21. Build topic-knowledge merge candidates from stored draft knowledge artifacts when requested.
22. Merge a daily-review draft into topic knowledge, publishing the new current-best artifact and any superseded previous version.
23. List current-best topic knowledge summaries, fetch the current-best artifact for one topic key, and return topic history in newest-first order.
24. For reviewed-memory knowledge generation APIs, resolve captured page text from reviewed memory events before creating the draft, then publish the resulting artifact.
25. After the generated artifact is published and returned, schedule asynchronous knowledge lint to refresh relation metadata, tombstone mechanically duplicated generated drafts, and publish reviewable merge candidates for similar knowledge.
26. Approve a knowledge draft or merge candidate by loading the persisted artifact by id and passing it through the existing topic-knowledge merge workflow.
27. If the caller provides a draft snapshot, approve uses that snapshot after verifying its id matches `draftId`; this preserves the visible UI draft, source reviewed-memory ids, provenance refs, and recent edits even when an older persisted draft with the same id exists. If no snapshot is provided, approve falls back to the persisted knowledge list.
28. When a knowledge or skill artifact is deleted, remove the workspace copy and record a service-level tombstone under `mirrorbrain/deleted-artifacts/` so later reads suppress both workspace and OpenViking copies of that id.
29. When a deleted artifact id is published again later, clear its tombstone before persisting the fresh artifact so it becomes visible again.

## Operational Note

For MVP startup and operator usage, see the repository [README](../../README.md).

## Test Strategy

- unit tests verify polling starts during service startup
- unit tests verify `stop()` stops the background polling lifecycle
- unit tests verify the service wires workspace, bucket, scope, checkpoint store, and memory writer into browser sync execution
- unit tests verify the service forwards runtime source authorization into browser sync execution and revoked scopes deny sync
- unit tests verify the service forwards page-content capture authorization into browser sync execution and keeps it independent from browser source authorization
- unit tests verify the service wires an authorized shell history path into shell sync execution
- unit tests verify explicit browser sync schedules browser theme narrative rebuilds
- unit tests verify explicit browser sync returns before the background narrative rebuild finishes
- unit tests verify Phase 4 source-ledger import is wired through the service facade with memory-event writes, audit writes, and checkpoint updates
- unit tests verify source audit and source instance summary reads remain operational state separate from memory retrieval
- unit tests verify manual Phase 4 work-session analysis builds pending candidates from explicit 6h, 24h, or 7d analysis windows
- unit tests verify the service forwards retrieval calls to the plugin API with the configured OpenViking base URL and retrieval input
- unit tests verify review-oriented flows still use raw memory event listing where needed
- unit tests verify raw memory reads fall back to workspace-cached events when OpenViking reads fail
- unit and integration tests verify daily candidate memories can be created and published through the service contract
- unit tests verify daily candidate generation syncs browser history before reading workspace raw events
- unit tests verify existing daily candidates are reused when sync imports no new browser events and regenerated when sync imports new browser events
- unit tests verify daily candidate regeneration excludes memory events and URLs already consumed by published knowledge
- unit and integration tests verify candidate review suggestions stay suggestion-only
- unit and integration tests verify explicit keep and discard review decisions publish reviewed memory artifacts through the service contract
- unit and integration tests verify the service forwards explicit knowledge and skill publishing calls to OpenViking ingestion with runtime configuration
- unit tests verify deleting persisted knowledge and skill artifacts removes workspace copies and suppresses later reads through tombstones
- unit and integration tests verify reviewed memories can be turned into publishable Phase 3-ready knowledge artifacts through the service contract, including captured page text in the generated body
- unit tests verify reviewed-memory knowledge generation schedules asynchronous knowledge lint after publishing the generated artifact
- unit tests verify knowledge draft approval publishes through the topic merge workflow instead of reading unstored JSON files
- unit tests verify approving a merge candidate removes the candidate from later knowledge listings
- unit tests verify knowledge draft approval can publish the caller draft snapshot when the persisted lookup has not caught up or still contains an older draft with the same id
- unit and integration tests verify topic merge candidates can be built and merged through the service contract, including superseded-history publication on update
- type checks ensure the service surface composes with the workflow layer

## Known Limitations

- the service currently defaults to automatic discovery of the most recently updated ActivityWatch browser watcher bucket and a single browser scope (`scope-browser`) unless a browser bucket is explicitly overridden at startup
- if no external authorization-scope lookup is injected at startup, the runtime service bootstraps narrow active scopes for the configured browser and shell scope ids; durable scope persistence remains outside this service component
- if no page-content capture authorization dependency is injected at startup, readable page text backfill is denied by default while browser activity memory capture can still proceed
- shell sync is currently explicit only; it does not start a shell polling loop or discover shell history paths automatically
- Phase 4 source-ledger import is available manually through the service contract and runs on the runtime scheduler every 30 minutes by default
- source enable/disable updates are persisted and audited, but recorder supervision has not yet enforced disabled state against live recorder processes
- source-ledger state derives source summaries from checkpoint and audit history; recorder supervision has not yet provided real recorder status
- the retrieval contract now accepts lightweight query and filter input, but still uses minimal result shaping rather than mature ranking
- raw memory list endpoints can fall back to workspace-cached memory-event files when OpenViking reads fail, so event history may appear before the corresponding OpenViking-backed retrieval views fully recover
- stored browser and shell narratives are rebuilt after explicit service sync operations, but the rebuild now happens in the background and may lag slightly behind the returned sync summary
- background browser polling still relies on the raw-event retrieval fallback until a later narrative-refresh hook is added there
- generation remains caller-driven; the service exposes explicit methods but does not schedule daily review or skill extraction automatically
- knowledge lint is a background maintenance workflow; it refreshes relations, deletes only mechanically duplicated generated drafts, and creates merge candidates for similar notes, while published knowledge updates still require the approval and topic-merge path
- knowledge and skill artifact deletion currently relies on service-owned tombstones rather than a documented OpenViking hard-delete path in this service layer, so upstream OpenViking resources may still exist even though MirrorBrain no longer surfaces them
- candidate deletion removes both the MirrorBrain workspace candidate file and the corresponding OpenViking resource
- candidate generation is heuristic and bounded to at most 10 tasks per review window
- work-session analysis is explicit and user-triggered; the service does not schedule background sessionization
- AI review suggestions are heuristic placeholders in Phase 1
- retrieval methods still lack pagination and advanced ranking
- topic-knowledge merge policy is currently a narrow rule-based baseline for Milestone 2, not the final Phase 3 quality engine
- topic merge remains workflow/service-only in this slice; HTTP/UI exposure belongs to later Phase 3 milestones
- topic quality evaluation remains a workflow/test-driven slice and is not yet exposed as a runtime operator endpoint
