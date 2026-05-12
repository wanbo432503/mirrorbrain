# API Contracts

## Summary

This component owns shared runtime schemas for MirrorBrain HTTP transport DTOs. It is the first step toward a single API contract source that can be reused by the HTTP server, frontend clients, plugin wrappers, and contract tests.

## Responsibility Boundary

- defines JSON-schema-compatible DTO schemas for public API responses
- keeps transport required fields aligned with domain type required fields
- separates HTTP response compatibility from internal service implementation details
- does not own Fastify route registration or domain object generation

## Key Interfaces

- `knowledgeArtifactDtoSchema`
- `skillArtifactDtoSchema`

## Data Flow

1. Domain services return internal `KnowledgeArtifact` and `SkillArtifact` values.
2. HTTP routes reference the shared DTO schemas for response serialization.
3. Contract tests send example service values through the HTTP server and verify the serialized shape.
4. Frontend and plugin clients can later import or generate types from the same contract source.

## Test Strategy

- unit tests in [src/shared/api-contracts/index.test.ts](/Users/wanbo/Workspace/mirrorbrain/src/shared/api-contracts/index.test.ts) verify the schema required fields match the domain required fields
- HTTP contract coverage in [src/apps/mirrorbrain-http-server/index.test.ts](/Users/wanbo/Workspace/mirrorbrain/src/apps/mirrorbrain-http-server/index.test.ts) verifies minimal valid knowledge artifacts serialize through `/knowledge` while preserving optional enrichment fields such as `tags`, `relatedKnowledgeIds`, and `compilationMetadata`
- HTTP contract coverage also verifies `/skills` preserves optional skill review timestamps such as `updatedAt` and `reviewedAt`

## Known Risks Or Limitations

- only the knowledge and skill artifact response schemas have moved into this shared contract layer so far
- the schema is still handwritten JSON Schema; later work should expand this module to cover all public DTOs and use it as the source for frontend/client types
