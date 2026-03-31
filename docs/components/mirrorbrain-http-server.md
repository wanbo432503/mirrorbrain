# MirrorBrain HTTP Server

## Summary

`mirrorbrain-http-server` is the runnable local HTTP surface for the Phase 1 MVP. It wraps the existing MirrorBrain service contract and exposes the first user-operable workflow through JSON endpoints.

## Responsibility Boundary

This component is responsible for:

- reporting service health and effective runtime config
- exposing a browser sync trigger endpoint
- exposing read endpoints for memory, knowledge, and skill drafts
- exposing write endpoints for candidate creation, review, and artifact generation

This component is not responsible for:

- core lifecycle policy
- source-specific ingestion logic
- storage details for OpenViking
- UI rendering

Those concerns remain in the service, workflow, module, and integration layers.

## Key Interfaces

- `startMirrorBrainHttpServer(...)`
- `GET /health`
- `POST /sync/browser`
- `GET /memory`
- `GET /knowledge`
- `GET /skills`
- `POST /candidate-memories`
- `POST /reviewed-memories`
- `POST /knowledge/generate`
- `POST /skills/generate`

## Data Flow

1. A caller starts the HTTP server with a MirrorBrain service object.
2. The server resolves host and port from explicit input or the runtime config.
3. Each request is routed to the corresponding service method.
4. The server serializes the domain result as JSON and returns an HTTP status that matches the action.

## Dependencies

- `src/apps/mirrorbrain-service/index.ts` for the service contract it wraps
- `src/shared/config/index.ts` for default host and port
- `src/shared/types/index.ts` for artifact payload shapes

## Failure Modes And Operational Constraints

- if the configured host or port cannot be bound, server startup fails
- malformed JSON request bodies currently surface as `500` responses and should be tightened later
- this server is intentionally local-first and not yet production-hardened
- authentication and multi-user concerns are out of scope for the Phase 1 MVP

## Test Strategy

- unit-style HTTP behavior coverage in `src/apps/mirrorbrain-http-server/index.test.ts`
- broader integration coverage through the wrapped service contract tests
- `tsc --noEmit` after TypeScript changes
