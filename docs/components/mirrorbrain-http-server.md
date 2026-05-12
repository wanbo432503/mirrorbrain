# MirrorBrain HTTP Server

## Summary

`mirrorbrain-http-server` is the runnable local HTTP surface for the Phase 1 MVP. It now uses `Fastify` as the server framework, wraps the existing MirrorBrain service contract, and exposes both JSON endpoints and OpenAPI-backed interactive docs.

For the written endpoint contract, request/response payloads, examples, and
lifecycle semantics, see [MirrorBrain HTTP API](./mirrorbrain-http-api.md).

## Responsibility Boundary

This component is responsible for:

- reporting service health and effective runtime config
- exposing a shell sync trigger endpoint
- exposing Phase 4 source-ledger manual import, audit, and status endpoints
- exposing Phase 4 manual work-session analysis endpoints
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
- `POST /sync/shell`
- `POST /sources/import`
- `GET /sources/audit`
- `GET /sources/status`
- `POST /work-sessions/analyze`
- `POST /work-sessions/reviews`
- `GET /memory`
- `POST /memory/query`
- `GET /knowledge`
- `POST /knowledge`
- `GET /knowledge/topics`
- `GET /knowledge/topics/:topicKey`
- `GET /knowledge/topics/:topicKey/history`
- `GET /skills`
- `POST /skills`
- `POST /candidate-memories/daily`
- `POST /candidate-reviews/suggestions`
- `POST /reviewed-memories`
- `POST /knowledge/generate`
- `POST /knowledge/regenerate`
- `POST /knowledge/approve`
- `POST /knowledge-articles/drafts`
- `POST /knowledge-articles/publish`
- `GET /knowledge-articles/history`
- `POST /skills/generate`

## Data Flow

1. A caller starts the HTTP server with a MirrorBrain service object.
2. The server resolves host and port from explicit input or the runtime config.
3. `Fastify` routes each request to the corresponding service method.
4. OpenAPI metadata is registered alongside the routes and published through Swagger UI.
5. `POST /sync/shell` triggers explicit shell sync through the service layer and returns the sync summary without waiting for background narrative rebuild work.
6. `POST /sources/import` runs one immediate Phase 4 source-ledger scan/import through the service layer and returns import counts; browser activity enters the HTTP surface through this ledger import path rather than a direct browser sync route.
7. `GET /sources/audit` and `GET /sources/status` expose operational source state without adding audit records to memory retrieval.
8. `POST /work-sessions/analyze` runs an explicit 6h, 24h, or 7d analysis window and returns pending work-session candidates.
9. `POST /work-sessions/reviews` records explicit keep/discard decisions and project assignment inputs.
10. `GET /memory` returns raw memory events for the standalone MVP and review-oriented flows.
11. `POST /memory/query` forwards a query-shaped retrieval request and returns theme-level memory results.
12. `POST /knowledge` and `POST /skills` let the standalone UI save edited draft artifacts back through the service layer.
13. The server serializes the domain result as JSON and returns an HTTP status that matches the action.
14. Daily candidate creation returns task-oriented candidates with source URL refs, bounded result counts, and explicit time ranges.
15. AI review suggestions stay separate from reviewed-memory writes, and now include a keep-score plus supporting reasons so the UI can explain why a candidate exists and why it may be worth keeping.
16. Knowledge generation, regeneration, and approval routes delegate to the service layer and return structured errors when a capability is unavailable.
17. `POST /knowledge/approve` accepts the current draft snapshot along with `draftId` so the service can publish the visible draft even if the storage index has not exposed it yet.
18. Knowledge Article routes expose the Phase 4 Project -> Topic -> Knowledge Article draft, publish, and history flow.

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
- candidate payloads can include `sourceRefs` so clients can render the concrete visited URLs behind each task
- reviewed-memory writes require an explicit `reviewedAt` timestamp for auditability
- draft save endpoints trust the caller to send a full artifact payload and do not yet offer field-level patch semantics
- `POST /memory/query` is still a thin Phase 2A contract and does not yet expose pagination or mature ranking controls
- `POST /sync/shell` depends on an explicitly configured shell history path in the runtime service
- `POST /sources/import` depends on a service object that implements Phase 4 source-ledger import; otherwise it returns `501`
- source audit and source status endpoints are operational metadata surfaces, not memory retrieval endpoints
- `POST /work-sessions/analyze` depends on a service object that implements Phase 4 work-session analysis; otherwise it returns `501`
- `POST /work-sessions/reviews` depends on a service object that implements Phase 4 work-session review; otherwise it returns `501`
- Knowledge Article draft, publish, and history endpoints depend on a service object that implements Phase 4 article methods; otherwise they return `501`
- sync responses can include a recent `importedEvents` preview so standalone clients can surface newly imported memory immediately without returning the full imported event batch
- knowledge approval depends on a persisted draft id; missing ids return a request error rather than a partially shaped success payload

## Test Strategy

- unit-style HTTP behavior coverage in `src/apps/mirrorbrain-http-server/index.test.ts`
- unit-style coverage for Swagger UI and OpenAPI schema publication
- unit-style coverage for Phase 4 source import, audit, and status endpoints
- unit-style coverage for manual work-session analysis endpoint routing and serialization
- unit-style coverage for explicit work-session review endpoint routing and serialization
- unit-style coverage for Knowledge Article draft, publish, and history endpoint routing
- broader integration coverage through the wrapped service contract tests
- API client coverage verifies failed knowledge approval responses are surfaced as errors before UI state reads topic metadata
- `tsc --noEmit` after TypeScript changes
