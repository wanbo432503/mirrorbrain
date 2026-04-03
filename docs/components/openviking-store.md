# OpenViking Store

## Summary

This component is the storage adapter that maps MirrorBrain artifacts into OpenViking-compatible HTTP imports, including the Phase 2 offline browser and shell memory narratives used by retrieval.

## Responsibility Boundary

- owns the record shape used to persist normalized memory events
- owns the JSON persistence shape used for stored memory narratives
- imports memory and knowledge as OpenViking resources
- persists Phase 3 knowledge lifecycle metadata such as `artifactType`, `topicKey`, versioning, and provenance refs
- imports skill drafts as MirrorBrain-owned OpenViking resources
- keeps ingestion metadata attached to persisted records
- does not own domain lifecycle rules for candidate memory, reviewed memory, knowledge, or skill approval

## Key Interfaces

- `createOpenVikingMemoryEventRecord(...)`
- `OpenVikingMemoryEventWriter`
- `ingestMemoryEventToOpenViking(...)`
- `ingestMemoryNarrativeToOpenViking(...)`
- `ingestKnowledgeArtifactToOpenViking(...)`
- `ingestSkillArtifactToOpenViking(...)`
- `listMirrorBrainMemoryEventsFromOpenViking(...)`
- `listMirrorBrainMemoryNarrativesFromOpenViking(...)`
- `listMirrorBrainKnowledgeArtifactsFromOpenViking(...)`
- `listMirrorBrainSkillArtifactsFromOpenViking(...)`

## Data Flow

1. MirrorBrain normalizes upstream source events into `MemoryEvent`.
2. The adapter writes artifact content to local files when the OpenViking endpoint expects file-path based import.
3. Memory, memory-narrative, candidate, reviewed, knowledge, and skill-draft artifacts are imported through `POST /api/v1/resources`.
4. Memory-event imports wait for OpenViking completion before the sync call returns so the latest browser sync is immediately queryable.
5. Because OpenViking may flatten imported resources at the root, MirrorBrain encodes logical namespaces into resource names such as `mirrorbrain-memory-events-...` and `mirrorbrain-skill-drafts-...` instead of assuming nested directories will exist under `viking://resources/`.
6. Retrieval uses `GET /api/v1/fs/ls` at `viking://resources/`, filters by the MirrorBrain namespace prefixes, resolves directory-backed resources to their inner files, and then loads content with `GET /api/v1/content/read`.
7. Memory retrieval also tolerates legacy flat browser resources such as `browser503`, deduplicates by `MemoryEvent.id` when both legacy and prefixed resources contain the same event, and suppresses near-duplicate browser page records that share the same page signature inside a short time window.
8. Some OpenViking resources may be exposed as multiple sibling content fragments such as `browser1368_1.md` and `browser1368_2.md`; retrieval concatenates these fragments in file-name order before parsing the artifact.

## Operational Note

For local setup and startup expectations around OpenViking, see the repository [README](../../README.md).

## Test Strategy

- unit tests verify stable record ids
- unit tests verify payload preservation
- unit tests verify ingestion metadata remains attached
- unit tests verify HTTP request payloads for memory, memory-narrative, candidate, reviewed, knowledge, and skill imports
- unit tests verify HTTP-based listing and content reads for memory, memory-narrative, candidate, reviewed, knowledge, and skill retrieval
- unit tests verify legacy resource compatibility, browser duplicate suppression, and duplicate-id suppression during memory reads
- unit tests verify multi-part OpenViking resource fragments are recombined before parsing

## Known Limitations

- imports rely on the currently documented OpenViking HTTP endpoints
- MirrorBrain classification is currently encoded into flat resource names rather than guaranteed nested directories inside OpenViking
- retrieval depends on OpenViking exposing imported resources through `fs/ls` and readable child files through `content/read`
- historical duplicates are suppressed at retrieval time for browser data, but the underlying OpenViking resources are still append-oriented and remain on disk until a separate cleanup path exists
- Phase 1 does not publish directly into OpenViking `agent/skills`; it stores skill drafts as MirrorBrain-managed resources for stable classification and retrieval
- knowledge artifacts are parsed back from stored markdown conventions, including Phase 3 topic-aware metadata, so retrieval depends on those content conventions staying stable
- Phase 3 knowledge markdown now carries richer topic-aware metadata and provenance sections; callers should preserve those conventions when extending storage
- memory narratives are currently stored as JSON resources that are deduplicated by narrative id at read time rather than updated in place inside OpenViking
