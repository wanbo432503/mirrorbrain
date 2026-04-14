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
- exposes daily candidate-memory generation and review suggestion operations
- exposes explicit candidate review decisions as service-level operations
- publishes knowledge and skill artifacts through explicit OpenViking-backed service methods
- generates knowledge drafts from reviewed memories before publishing them
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
10. Generate daily task-oriented candidate streams for a requested review date, using raw workspace memory history rather than the UI display list.
11. Before candidate generation, enrich browser events with stored `browser-page-content` text when a page artifact is available in the workspace so review grouping can use page semantics instead of URL/title alone.
12. Return suggestion-only AI review hints without promoting any candidate, including keep-score and supporting reasons for the review UI.
13. Record explicit keep or discard decisions and publish reviewed memory artifacts.
14. Forward explicit knowledge and skill publishing calls to the OpenViking ingestion adapter.
15. Build topic-knowledge merge candidates from stored draft knowledge artifacts when requested.
16. Merge a daily-review draft into topic knowledge, publishing the new current-best artifact and any superseded previous version.
17. List current-best topic knowledge summaries, fetch the current-best artifact for one topic key, and return topic history in newest-first order.
18. For reviewed-memory generation APIs, run the corresponding workflow first and then publish the resulting artifact.

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
- unit and integration tests verify candidate review suggestions stay suggestion-only
- unit and integration tests verify explicit keep and discard review decisions publish reviewed memory artifacts through the service contract
- unit and integration tests verify the service forwards explicit knowledge and skill publishing calls to OpenViking ingestion with runtime configuration
- unit and integration tests verify reviewed memories can be turned into publishable Phase 3-ready knowledge artifacts through the service contract
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
- candidate generation is heuristic and bounded to at most 10 tasks per review window
- AI review suggestions are heuristic placeholders in Phase 1
- retrieval methods still lack pagination and advanced ranking
- topic-knowledge merge policy is currently a narrow rule-based baseline for Milestone 2, not the final Phase 3 quality engine
- topic merge remains workflow/service-only in this slice; HTTP/UI exposure belongs to later Phase 3 milestones
- topic quality evaluation remains a workflow/test-driven slice and is not yet exposed as a runtime operator endpoint
