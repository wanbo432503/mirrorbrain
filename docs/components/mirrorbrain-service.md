# MirrorBrain Service

## Summary

This component is the runnable service entrypoint for MirrorBrain. In Phase 1 it starts the browser sync polling workflow, wires that workflow to the checkpoint store and OpenViking memory ingestion adapter, and exposes the minimal `openclaw`-facing service contract backed by candidate generation, review handling, OpenViking retrieval, explicit artifact publishing, and reviewed-memory-driven artifact generation.

## Responsibility Boundary

- owns service startup and shutdown lifecycle
- starts background browser polling with the configured interval
- wires browser polling to checkpoint persistence and OpenViking memory ingestion
- exposes the high-level service contract used by `openclaw`
- forwards `openclaw` retrieval calls to the OpenViking-backed plugin API with the configured base URL
- exposes candidate-memory creation and review as service-level operations
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
6. Expose candidate-memory creation and review through the existing domain rules.
7. Forward retrieval calls through the configured OpenViking base URL.
8. Forward explicit knowledge and skill publishing calls to the OpenViking ingestion adapter.
9. For reviewed-memory generation APIs, run the corresponding workflow first and then publish the resulting artifact.

## Operational Note

For MVP startup and operator usage, see the repository [README](../../README.md).

## Test Strategy

- unit tests verify polling starts during service startup
- unit tests verify `stop()` stops the background polling lifecycle
- unit tests verify the service wires workspace, bucket, scope, checkpoint store, and memory writer into browser sync execution
- unit tests verify the service forwards retrieval calls to the plugin API with the configured OpenViking base URL
- unit and integration tests verify candidate memories can be created and reviewed through the service contract
- unit and integration tests verify the service forwards explicit knowledge and skill publishing calls to OpenViking ingestion with runtime configuration
- unit and integration tests verify reviewed memories can be turned into publishable knowledge and skill artifacts through the service contract
- type checks ensure the service surface composes with the workflow layer

## Known Limitations

- the service currently defaults to a single browser bucket (`aw-watcher-web-chrome`) and a single browser scope (`scope-browser`) unless overridden at startup
- runtime API methods do not yet add filtering, pagination, or richer query parameters on top of OpenViking reads
- generation remains caller-driven; the service exposes explicit methods but does not schedule daily review or skill extraction automatically
- candidate generation is still a simple grouping call with minimal ranking logic
- retrieval methods still focus on broad list operations rather than filtered or paginated queries
