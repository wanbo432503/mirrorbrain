# MirrorBrain HTTP Server

## Summary

`mirrorbrain-http-server` is the runnable local HTTP surface for the Phase 1 MVP. It now uses `Fastify` as the server framework, wraps the existing MirrorBrain service contract, and exposes both JSON endpoints and OpenAPI-backed interactive docs.

## Responsibility Boundary

This component is responsible for:

- reporting service health and effective runtime config
- exposing a browser sync trigger endpoint
- exposing a shell sync trigger endpoint
- exposing raw read endpoints for memory, knowledge, and skill drafts
- exposing a theme-level memory retrieval endpoint for `openclaw`-style queries
- exposing write endpoints for daily candidate creation, candidate review suggestions, explicit review decisions, and artifact generation
- exposing OpenAPI schema output and Swagger UI docs for local exploration

This component is not responsible for:

- core lifecycle policy
- source-specific ingestion logic
- storage details for OpenViking
- UI rendering

Those concerns remain in the service, workflow, module, and integration layers.

## Key Interfaces

- `startMirrorBrainHttpServer(...)`
- `GET /docs`
- `GET /openapi.json`
- `GET /health`
- `POST /sync/browser`
- `POST /sync/shell`
- `GET /memory`
- `POST /memory/query`
- `GET /knowledge`
- `GET /knowledge/topics`
- `GET /knowledge/topics/:topicKey`
- `GET /knowledge/topics/:topicKey/history`
- `GET /skills`
- `POST /candidate-memories/daily`
- `POST /candidate-reviews/suggestions`
- `POST /reviewed-memories`
- `POST /knowledge/generate`
- `POST /skills/generate`

## Data Flow

1. A caller starts the HTTP server with a MirrorBrain service object.
2. The server resolves host and port from explicit input or the runtime config.
3. `Fastify` routes each request to the corresponding service method.
4. OpenAPI metadata is registered alongside the routes and published through Swagger UI.
5. `POST /sync/browser` and `POST /sync/shell` trigger explicit source sync operations through the service layer and return the sync summary without waiting for background narrative rebuild work.
6. `GET /memory` returns raw memory events for the standalone MVP and review-oriented flows.
7. `POST /memory/query` forwards a query-shaped retrieval request and returns theme-level memory results.
8. The server serializes the domain result as JSON and returns an HTTP status that matches the action.
9. Daily candidate creation and AI suggestions stay separate so suggestion reads cannot silently write reviewed memory.

## Dependencies

- `src/apps/mirrorbrain-service/index.ts` for the service contract it wraps
- `src/shared/config/index.ts` for default host and port
- `src/shared/types/index.ts` for artifact payload shapes
- `fastify`
- `@fastify/swagger`
- `@fastify/swagger-ui`

## Failure Modes And Operational Constraints

- if the configured host or port cannot be bound, server startup fails
- malformed JSON or schema-invalid request bodies are rejected by `Fastify`
- this server is intentionally local-first and not yet production-hardened
- authentication and multi-user concerns are out of scope for the Phase 1 MVP
- daily candidate creation expects an explicit `reviewDate`
- reviewed-memory writes require an explicit `reviewedAt` timestamp for auditability
- `POST /memory/query` is still a thin Phase 2A contract and does not yet expose pagination or mature ranking controls
- `POST /sync/shell` depends on an explicitly configured shell history path in the runtime service
- sync responses can include a recent `importedEvents` preview so standalone clients can surface newly imported memory immediately without returning the full imported event batch

## Test Strategy

- unit-style HTTP behavior coverage in `src/apps/mirrorbrain-http-server/index.test.ts`
- unit-style coverage for Swagger UI and OpenAPI schema publication
- broader integration coverage through the wrapped service contract tests
- `tsc --noEmit` after TypeScript changes
