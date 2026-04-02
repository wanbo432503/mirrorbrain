# OpenClaw Plugin API

## Summary

This component is MirrorBrain's plugin-facing retrieval surface for `openclaw`. It exposes async read operations for memory, knowledge, and skill artifacts by loading them from OpenViking-backed storage, and now shapes memory reads into theme- or task-level retrieval results rather than returning only raw memory events.

## Responsibility Boundary

- exposes the retrieval contract consumed by `openclaw`
- delegates storage access to the OpenViking adapter
- returns domain-shaped artifacts rather than raw filesystem responses
- keeps the retrieval contract thin while shaping memory events into higher-level results that are easier for `openclaw` to use in chat
- does not own sync, review, knowledge generation, or skill generation

## Key Interfaces

- `queryMemory(...)`
- `listKnowledge(...)`
- `listSkillDrafts(...)`
- `createQueryMemoryToolExample(...)`
- `composeQueryMemoryAnswer(...)`

## Data Flow

1. `openclaw` calls a MirrorBrain retrieval method with the OpenViking base URL and, for memory, a natural-language query plus optional filters.
2. The plugin API delegates raw storage reads to the OpenViking store adapter.
3. The store adapter lists MirrorBrain artifact URIs and reads their content.
4. For memory retrieval, the plugin API filters and groups raw `MemoryEvent` records into theme-level results with time ranges, representative source refs, and source-aware summaries.
5. When multiple grouped themes match, the plugin API currently prefers repeated themes ahead of one-off pages based on grouped event count, with recency as a tie-breaker.
6. For browser sources, repeated visits to the same URL are compressed into a single representative source ref inside each grouped theme.
7. Browser themes use a slightly more human-readable summary that reflects unique pages and repeated visits.
8. Browser theme grouping also strips common site-title suffixes such as ` - Site` or ` | Site` before grouping.
9. Browser grouping keys are matched case-insensitively after title normalization so search-result titles and content-page titles can collapse into the same theme more often.
10. When a grouped browser theme includes obvious search-result pages, the summary shifts toward a `researched ...` phrasing instead of a generic page-review phrasing.
11. When a grouped browser theme is clearly made of documentation pages, the summary shifts toward a `read documentation about ...` phrasing.
12. When a grouped browser theme includes obvious comparison pages, the summary shifts toward a `compared information about ...` phrasing.
13. Shell-history events are grouped by `commandName` so retrieval can return command-oriented shell themes instead of one result per raw command.
14. For shell-history themes, the summary currently reports command-count activity such as `ran 2 shell commands with git`.
15. If a shell-history theme is made of obvious inspection commands such as `status`, `diff`, or `log`, the summary shifts toward an `inspected state ...` phrasing.
16. If a shell-history theme is made of obvious test or typecheck commands, the summary shifts toward a `verified changes with ...` phrasing.
17. If a shell-history theme is made of obvious patch-application or inline-edit commands, the summary shifts toward an `applied changes with ...` phrasing.
18. For knowledge and skill retrieval, the plugin API returns parsed `KnowledgeArtifact` and `SkillArtifact` objects.
19. The example tool wrapper shows how an `openclaw`-side `query_memory` tool can forward retrieval input and then turn ordered results into a lightweight chat answer.

## Test Strategy

- unit tests verify each retrieval method delegates to the correct loader
- unit tests verify memory retrieval shapes raw memory events into theme-level results
- unit tests verify the example `query_memory` tool forwards input and formats ordered answers with light source hints
- integration coverage verifies the overall Phase 1 slice can return stored artifacts through this API

## Known Limitations

- retrieval currently reads from fixed Phase 1 URI namespaces
- memory retrieval currently uses lightweight grouping rules rather than a mature ranking or theme-clustering system
- repeated-theme prioritization is still a simple heuristic based on grouped event count and recency
- browser source-ref compression currently deduplicates by exact URL only
- browser title normalization only strips a small set of common suffix separators
- browser display-title cleanup is still minimal and only fixes obvious lowercase-only cases
- search-page detection is heuristic and currently only looks for obvious search-style URLs or query parameters
- documentation-page detection is heuristic and currently only looks for obvious docs-style hosts or paths
- comparison-page detection is heuristic and currently only looks for obvious compare/comparison/vs markers
- browser summaries are still heuristic and do not yet model richer task-level narratives
- shell retrieval currently groups by command name only and does not yet infer higher-level issue or workflow narratives
- shell phase hints are still heuristic and currently only recognize a small set of obvious inspection commands
- shell verification hints are still heuristic and currently only recognize obvious test and typecheck commands
- shell apply-phase hints are still heuristic and currently only recognize a small set of obvious patch or inline-edit commands
- there is no pagination yet
- the example tool is intentionally minimal and does not model the full `openclaw` plugin host
