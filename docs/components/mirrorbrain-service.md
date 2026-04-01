# MirrorBrain Service

## Summary

This component is the runnable service entrypoint for MirrorBrain. It starts the browser sync polling workflow, wires that workflow to the checkpoint store and OpenViking memory ingestion adapter, and exposes the `openclaw`-facing service contract for memory retrieval, daily candidate generation, candidate review suggestions, explicit review decisions, and reviewed-memory-driven artifact generation.

## Responsibility Boundary

- owns service startup and shutdown lifecycle
- starts background browser polling with the configured interval
- wires browser polling to checkpoint persistence and OpenViking memory ingestion
- exposes the high-level service contract used by `openclaw`
- keeps raw memory listing and `openclaw` retrieval shaping as separate concerns
- forwards `openclaw` retrieval calls to the OpenViking-backed plugin API with the configured base URL
- exposes daily candidate-memory generation and review suggestion operations
- exposes explicit candidate review decisions as service-level operations
- publishes knowledge and skill artifacts through explicit OpenViking-backed service methods
- generates knowledge and skill drafts from reviewed memories before publishing them
- does not own domain logic for memory review, knowledge generation, or skill generation

## Key Interfaces

- `startMirrorBrainService(...)`
- `createMirrorBrainService(...)`

## Data Flow

1. Load MirrorBrain config.
2. Create a file-backed sync checkpoint store and an OpenViking-backed memory writer.
3. Start the browser sync polling workflow with a real `runBrowserMemorySyncOnce(...)` callback.
4. Return a runtime service handle with `status` and `stop()`.
5. Expose the `openclaw`-facing service contract around that runtime handle.
6. List raw imported memory when review-oriented workflows need event-level records.
7. Forward `openclaw` memory retrieval calls through the configured OpenViking base URL and return shaped retrieval results.
8. Generate daily candidate streams for a requested review date.
9. Return suggestion-only AI review hints without promoting any candidate.
10. Record explicit keep or discard decisions and publish reviewed memory artifacts.
11. Forward explicit knowledge and skill publishing calls to the OpenViking ingestion adapter.
12. For reviewed-memory generation APIs, run the corresponding workflow first and then publish the resulting artifact.

## Operational Note

For MVP startup and operator usage, see the repository [README](../../README.md).

## Test Strategy

- unit tests verify polling starts during service startup
- unit tests verify `stop()` stops the background polling lifecycle
- unit tests verify the service wires workspace, bucket, scope, checkpoint store, and memory writer into browser sync execution
- unit tests verify the service forwards retrieval calls to the plugin API with the configured OpenViking base URL and retrieval input
- unit tests verify review-oriented flows still use raw memory event listing where needed
- unit and integration tests verify daily candidate memories can be created and published through the service contract
- unit and integration tests verify candidate review suggestions stay suggestion-only
- unit and integration tests verify explicit keep and discard review decisions publish reviewed memory artifacts through the service contract
- unit and integration tests verify the service forwards explicit knowledge and skill publishing calls to OpenViking ingestion with runtime configuration
- unit and integration tests verify reviewed memories can be turned into publishable knowledge and skill artifacts through the service contract
- type checks ensure the service surface composes with the workflow layer

## Known Limitations

- the service currently defaults to a single browser bucket (`aw-watcher-web-chrome`) and a single browser scope (`scope-browser`) unless overridden at startup
- the retrieval contract now accepts lightweight query and filter input, but still uses minimal result shaping rather than mature ranking
- generation remains caller-driven; the service exposes explicit methods but does not schedule daily review or skill extraction automatically
- candidate generation is still a deterministic grouping call with minimal ranking logic
- AI review suggestions are rule-based placeholders in Phase 1
- retrieval methods still lack pagination and advanced ranking
