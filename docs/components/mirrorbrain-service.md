# MirrorBrain Service

## Summary

This component is the runnable service entrypoint for MirrorBrain. It starts the browser sync polling workflow, wires memory-source sync workflows to the checkpoint store and OpenViking memory ingestion adapter, schedules stored memory narrative rebuilds after explicit browser or shell sync operations, and exposes the `openclaw`-facing service contract for memory retrieval, daily candidate generation, candidate review suggestions, explicit review decisions, and reviewed-memory-driven artifact generation.

## Responsibility Boundary

- owns service startup and shutdown lifecycle
- starts background browser polling with the configured interval
- wires browser polling to checkpoint persistence and OpenViking memory ingestion
- exposes an explicit shell-history sync operation when a shell history path is configured
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
- exposes topic-merge helper methods that turn daily-review drafts into topic merge candidates and publish topic knowledge artifacts
- exposes read-oriented topic knowledge helpers for listing current-best topics, reading one current-best topic, and reading topic history
- does not own domain logic for memory review, knowledge generation, or skill generation

## Key Interfaces

- `startMirrorBrainService(...)`
- `createMirrorBrainService(...)`

## Data Flow

1. Load MirrorBrain config.
2. Create a file-backed sync checkpoint store and an OpenViking-backed memory writer.
3. Start the browser sync polling workflow with a real `runBrowserMemorySyncOnce(...)` callback.
4. Optionally expose a shell-history sync operation through `runShellMemorySyncOnce(...)` when a history path is configured.
5. Return a runtime service handle with `status` and `stop()`.
6. Expose the `openclaw`-facing service contract around that runtime handle.
7. After explicit browser or shell sync calls through the service contract, return the sync summary immediately and schedule the corresponding narrative rebuild in the background when new events were imported.
8. List raw imported memory when review-oriented workflows need event-level records, preferring OpenViking-backed reads and falling back to workspace-cached memory-event files when storage reads fail.
9. Forward `openclaw` memory retrieval calls through the configured OpenViking base URL and return shaped retrieval results.
10. Before daily candidate generation or refresh, run an explicit browser-memory sync so the workspace raw-event cache reflects the latest ActivityWatch browser history.
11. If candidates already exist for a review date and the sync imports no new browser events, return the existing candidates without rebuilding them.
12. If candidates already exist for a review date and the sync imports new browser events, rebuild the daily candidates from current raw workspace memory history so late-day URLs are included.
13. Before rebuilding daily candidates, exclude memory events and browser URLs that are already linked through reviewed memories to published knowledge so previously synthesized work is not clustered again.
14. Generate daily task-oriented candidate streams for a requested review date, using raw workspace memory history rather than the UI display list.
15. Before candidate generation, enrich browser events with stored `browser-page-content` text when a page artifact is available in the workspace so review grouping can use page semantics instead of URL/title alone.
16. Return suggestion-only AI review hints without promoting any candidate, including keep-score and supporting reasons for the review UI.
17. Record explicit keep or discard decisions and publish reviewed memory artifacts.
18. Forward explicit knowledge and skill publishing calls to the OpenViking ingestion adapter.
19. Build topic-knowledge merge candidates from stored draft knowledge artifacts when requested.
20. Merge a daily-review draft into topic knowledge, publishing the new current-best artifact and any superseded previous version.
21. List current-best topic knowledge summaries, fetch the current-best artifact for one topic key, and return topic history in newest-first order.
22. For reviewed-memory knowledge generation APIs, resolve captured page text from reviewed memory events before creating the draft, then publish the resulting artifact.
23. Approve a knowledge draft by loading the persisted draft by id and passing it through the existing topic-knowledge merge workflow.
24. If the caller provides a draft snapshot, approve uses that snapshot after verifying its id matches `draftId`; this preserves the visible UI draft, source reviewed-memory ids, provenance refs, and recent edits even when an older persisted draft with the same id exists. If no snapshot is provided, approve falls back to the persisted knowledge list.
25. When a knowledge or skill artifact is deleted, remove the workspace copy and record a service-level tombstone under `mirrorbrain/deleted-artifacts/` so later reads suppress both workspace and OpenViking copies of that id.
26. When a deleted artifact id is published again later, clear its tombstone before persisting the fresh artifact so it becomes visible again.

## Operational Note

For MVP startup and operator usage, see the repository [README](../../README.md).

## Test Strategy

- unit tests verify polling starts during service startup
- unit tests verify `stop()` stops the background polling lifecycle
- unit tests verify the service wires workspace, bucket, scope, checkpoint store, and memory writer into browser sync execution
- unit tests verify the service wires an authorized shell history path into shell sync execution
- unit tests verify explicit browser sync schedules browser theme narrative rebuilds
- unit tests verify explicit browser sync returns before the background narrative rebuild finishes
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
- unit tests verify knowledge draft approval publishes through the topic merge workflow instead of reading unstored JSON files
- unit tests verify knowledge draft approval can publish the caller draft snapshot when the persisted lookup has not caught up or still contains an older draft with the same id
- unit and integration tests verify topic merge candidates can be built and merged through the service contract, including superseded-history publication on update
- type checks ensure the service surface composes with the workflow layer

## Known Limitations

- the service currently defaults to automatic discovery of the most recently updated ActivityWatch browser watcher bucket and a single browser scope (`scope-browser`) unless a browser bucket is explicitly overridden at startup
- shell sync is currently explicit only; it does not start a shell polling loop or discover shell history paths automatically
- the retrieval contract now accepts lightweight query and filter input, but still uses minimal result shaping rather than mature ranking
- raw memory list endpoints can fall back to workspace-cached memory-event files when OpenViking reads fail, so event history may appear before the corresponding OpenViking-backed retrieval views fully recover
- stored browser and shell narratives are rebuilt after explicit service sync operations, but the rebuild now happens in the background and may lag slightly behind the returned sync summary
- background browser polling still relies on the raw-event retrieval fallback until a later narrative-refresh hook is added there
- generation remains caller-driven; the service exposes explicit methods but does not schedule daily review or skill extraction automatically
- artifact deletion currently relies on service-owned tombstones rather than a documented OpenViking hard-delete API, so upstream OpenViking resources may still exist even though MirrorBrain no longer surfaces them
- candidate generation is heuristic and bounded to at most 10 tasks per review window
- AI review suggestions are heuristic placeholders in Phase 1
- retrieval methods still lack pagination and advanced ranking
- topic-knowledge merge policy is currently a narrow rule-based baseline for Milestone 2, not the final Phase 3 quality engine
- topic merge remains workflow/service-only in this slice; HTTP/UI exposure belongs to later Phase 3 milestones
- topic quality evaluation remains a workflow/test-driven slice and is not yet exposed as a runtime operator endpoint
