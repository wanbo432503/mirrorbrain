# API Contracts

## Summary

This component owns shared runtime schemas for MirrorBrain HTTP transport DTOs. It is the first step toward a single API contract source that can be reused by the HTTP server, frontend clients, agent client adapters, and contract tests.

## Responsibility Boundary

- defines JSON-schema-compatible DTO schemas for public API responses
- keeps transport required fields aligned with domain type required fields
- separates HTTP response compatibility from internal service implementation details
- does not own Fastify route registration or domain object generation

## Key Interfaces

- `skillArtifactDtoSchema`

Knowledge Article preview, draft, publish, tree, and revision contracts are currently defined at their route boundaries and should stay aligned with the Phase 4 `KnowledgeArticle*` domain types.

## Data Flow

1. Domain services return internal values such as `SkillArtifact`, `KnowledgeArticleDraft`, and published Knowledge Article trees.
2. HTTP routes reference shared DTO schemas where this component owns the public shape.
3. Contract tests send example service values through the HTTP server and verify the serialized shape.
4. Frontend and agent clients can later import or generate types from the same contract source.

## Test Strategy

- HTTP contract coverage in `src/apps/mirrorbrain-http-server/index.test.ts` verifies route serialization.
- Skill contract coverage verifies `/skills` preserves optional skill review timestamps such as `updatedAt` and `reviewedAt`.
- Phase 4 Knowledge Article routes are covered through `/knowledge-articles/*` tests.

## Known Risks Or Limitations

- the schema is still handwritten JSON Schema; later work should expand this module to cover all public DTOs and use it as the source for frontend/client types
