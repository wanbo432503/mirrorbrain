# OpenViking Store

## Summary

This component is the Phase 1 storage adapter that maps MirrorBrain artifacts into OpenViking-compatible HTTP imports.

## Responsibility Boundary

- owns the record shape used to persist normalized memory events
- imports memory and knowledge as OpenViking resources
- imports skill drafts as MirrorBrain-owned OpenViking resources
- keeps ingestion metadata attached to persisted records
- does not own domain lifecycle rules for candidate memory, reviewed memory, knowledge, or skill approval

## Key Interfaces

- `createOpenVikingMemoryEventRecord(...)`
- `OpenVikingMemoryEventWriter`
- `ingestMemoryEventToOpenViking(...)`
- `ingestKnowledgeArtifactToOpenViking(...)`
- `ingestSkillArtifactToOpenViking(...)`
- `listMirrorBrainMemoryEventsFromOpenViking(...)`
- `listMirrorBrainKnowledgeArtifactsFromOpenViking(...)`
- `listMirrorBrainSkillArtifactsFromOpenViking(...)`

## Data Flow

1. MirrorBrain normalizes upstream source events into `MemoryEvent`.
2. The adapter writes artifact content to local files when the OpenViking endpoint expects file-path based import.
3. Memory, candidate, reviewed, knowledge, and skill-draft artifacts are imported through `POST /api/v1/resources`.
4. Because OpenViking may flatten imported resources at the root, MirrorBrain encodes logical namespaces into resource names such as `mirrorbrain-memory-events-...` and `mirrorbrain-skill-drafts-...` instead of assuming nested directories will exist under `viking://resources/`.
5. Retrieval uses `GET /api/v1/fs/ls` at `viking://resources/`, filters by the MirrorBrain namespace prefixes, resolves directory-backed resources to their inner files, and then loads content with `GET /api/v1/content/read`.
6. Memory retrieval also tolerates legacy flat browser resources such as `browser503` and deduplicates by `MemoryEvent.id` when both legacy and prefixed resources contain the same event.

## Operational Note

For local setup and startup expectations around OpenViking, see the repository [README](../../README.md).

## Test Strategy

- unit tests verify stable record ids
- unit tests verify payload preservation
- unit tests verify ingestion metadata remains attached
- unit tests verify HTTP request payloads for memory, candidate, reviewed, knowledge, and skill imports
- unit tests verify HTTP-based listing and content reads for memory, candidate, reviewed, knowledge, and skill retrieval
- unit tests verify legacy resource compatibility and duplicate suppression during memory reads

## Known Limitations

- imports rely on the currently documented OpenViking HTTP endpoints
- MirrorBrain classification is currently encoded into flat resource names rather than guaranteed nested directories inside OpenViking
- retrieval depends on OpenViking exposing imported resources through `fs/ls` and readable child files through `content/read`
- Phase 1 does not publish directly into OpenViking `agent/skills`; it stores skill drafts as MirrorBrain-managed resources for stable classification and retrieval
- knowledge and skill artifacts are parsed back from stored markdown conventions, so retrieval depends on that content format staying stable
