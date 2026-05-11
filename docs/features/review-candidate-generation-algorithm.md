# Review Candidate Generation Algorithm

## Summary

This document explains how MirrorBrain turns raw browser `MemoryEvent` records into daily `CandidateMemory` objects for review.

The current algorithm is deterministic and heuristic. It does not use embeddings or an LLM. Its job is to produce a bounded list of plausible user tasks that are:

- understandable by humans
- traceable back to concrete URLs and timestamps
- stable enough for review workflows

The current output target is at most 10 candidates for one review day.

## Inputs

The algorithm consumes:

- `reviewDate`
- optional `reviewTimeZone`
- ordered browser `MemoryEvent[]`

Each event may contain:

- `url`
- `title`
- `pageTitle`
- `pageText`

`pageText` and `pageTitle` usually come from the `browser-page-content` artifact loaded by the service layer before candidate generation.

## High-Level Flow

1. Filter memory events into the requested review day and exclude local browser URLs such as `localhost`, `*.localhost`, `127.x.x.x`, `0.0.0.0`, and `::1` so historical local development pages cannot produce review candidates.
2. Sort events by timestamp ascending.
3. Build per-event descriptors:
   - host
   - page role
   - extracted tokens
   - salient task tokens
4. Greedily assign each event into the best existing group, or start a new group.
5. Recompute each group's task tokens, title, theme, and formation reasons as it grows.
6. Compress groups down to at most 10 candidates:
   - keep strong groups independent
   - merge weak groups into the best nearby stronger task
   - discard weak supporting-only noise when it does not match strongly enough
7. Emit `CandidateMemory` plus suggestion metadata.

## Event Descriptor Construction

Each browser event is normalized into an internal descriptor with:

- event payload
- parsed host
- inferred page role
- extracted tokens
- salient tokens

### Page Role Inference

Roles are inferred from URL and title:

- `search`
- `docs`
- `chat`
- `issue`
- `pull-request`
- `repository`
- `debug`
- `reference`
- `web`

These roles affect both grouping and later review suggestions.

### Token Extraction

The token pipeline prefers semantic information over raw URL shape:

1. take tokens from title
2. take tokens from page title
3. take selected tokens from page text
4. only fall back to URL/host tokens when title and page text provide nothing useful

This is intentional. URL-only grouping created too many shallow matches.

### Page Text Token Policy

The algorithm uses two different page-text strategies:

- for ordinary pages such as docs, issues, and PRs:
  - prefer repeated terms inside the page
  - keep terms echoed by the page title
  - keep some short technical-looking tokens
- for short repository/debug/web pages:
  - allow short page text to contribute more directly, because titles like `Repository overview` are too weak on their own

This split exists because repository root pages often need page text to connect to the active task, while issue/PR pages often contain generic boilerplate that would otherwise over-merge unrelated tasks.

### Salient Tokens

After all descriptors are built, token counts are compared across the review-day event set.

Salient tokens are tokens that:

- appear in more than one event
- are not so common that they look like day-wide noise

These tokens are used as the strongest grouping signal.

## Grouping Algorithm

Grouping is greedy and chronological:

1. iterate events from earliest to latest
2. score the event against each existing group
3. merge into the highest-scoring group if score is high enough
4. otherwise create a new group

### Main Scoring Signals

- salient token overlap
- any token overlap
- same host
- page-role compatibility
- time continuity

Salient overlap is weighted much more heavily than same-host overlap.

That design choice is deliberate:

- same host alone is too weak and causes false merges
- shared task vocabulary is a much better signal

### Session Boundary Rule

A hard session-gap rule prevents the algorithm from merging events that are too far apart in time.

Current rule:

- if the gap from the current group tail to the incoming event is more than `180` minutes, do not merge
- exception:
  - allow a sparse cross-gap merge when the existing group has only one event and the semantic match is very strong

This exception exists so sparse late-night and next-morning evidence for the same task can still merge, while larger multi-event sessions stay separate.

## Title Generation

Candidate titles are no longer pure token bags.

The algorithm first tries to select a representative source title:

- normalize source titles
- remove noisy suffixes like issue/PR counters
- prefer titles that already start with an action verb
- prefer stronger evidence roles such as issue, PR, debug, docs

If a representative action phrase exists, it becomes the candidate title.

Examples:

- `Fix Authentication Bug`
- `Implement Token Refresh`
- `Review Cache Migration Rollout`

If no representative action phrase exists, the algorithm falls back to task-type-aware title synthesis:

- bug-fix -> `Fix ...`
- feature-implementation -> `Implement ...`
- research -> `Review ...`
- debugging -> `Debug ...`
- code-review -> `Review ...`
- fallback -> `Work on ...`

## Task Type Inference

Suggestions and some title fallback behavior depend on inferred task type.

Current task types:

- `bug-fix`
- `feature-implementation`
- `research`
- `debugging`
- `code-review`
- `general`

Current ordering matters:

1. `code-review` if issue + PR + repository all appear together
2. `bug-fix` if issue appears
3. `feature-implementation` if PR appears
4. `debugging` if non-local debug evidence appears
5. `research` if docs/reference dominates
6. otherwise `general`

The `code-review` check must run before the simpler issue/PR checks. Otherwise review workflows collapse into bug-fix or implementation by accident.

## Summary Generation

Summaries are derived from the title and task context.

The algorithm tries to produce summary text that reads like a description of work, not a storage/debug message.

Examples:

- `Fixed Authentication Bug over about 25 minutes.`
- `Reviewed Jwt Refresh Strategy over about 20 minutes.`
- `Worked on Cache Migration across 2 related sites over about 45 minutes.`

This intentionally avoids older low-value summaries such as:

- `2 browser events connected to ...`

## Compression To 10 Candidates

After grouping, the algorithm compresses the result to at most 10 candidates.

Each group is classified as:

- `keep`
- `merge`
- `discard`

### Keep

A group tends to be kept when it has:

- multiple primary pages
- strong roles such as issue / PR / debug
- enough supporting evidence to stand on its own

### Merge

A weak group is merged into the most similar stronger task when:

- semantic overlap is decent
- host overlap helps
- timing is still reasonably nearby

Merged groups contribute:

- extra source refs
- compression count
- formation reasons

### Discard

Supporting-only noise such as isolated search/chat visits may be discarded when:

- evidence is too weak
- there is no strong matching task nearby

Discarded pages are not silently lost:

- they can be attached as `discardedSourceRefs`
- the surviving candidate can carry `discardReasons`

## Suggestion Generation

`suggestCandidateReviews(...)` runs after candidate generation and remains suggestion-only.

It computes:

- keep score
- recommendation
- confidence score
- evidence summary
- rationale
- supporting reasons

These suggestions are still heuristic. They are intended to help review, not replace it.

## Known Algorithmic Tradeoffs

### Strengths

- deterministic and testable
- explainable enough for review UI
- preserves source URLs and timestamps
- better than shallow host/path bucketing

### Current Weaknesses

- still greedy and order-sensitive
- still token-based rather than semantic-embedding-based
- session boundaries are heuristic
- title quality depends on source-title quality
- day-wide heavy browsing can still create noisy top-token competition

## Why The Recent Improvements Were Necessary

Recent fixes addressed several concrete algorithm problems:

1. candidate groups with the same synthetic key could overwrite each other
2. `code-review` inference was unreachable because earlier checks short-circuited first
3. far-apart same-topic sessions could collapse into one oversized candidate
4. repository pages were under-connected because their titles were too generic
5. titles and summaries were too often token-bag phrases instead of task-shaped phrases

## Test Strategy

The algorithm is covered by behavior-oriented tests in:

- `src/modules/memory-review/index.test.ts`

Important regression coverage includes:

- same-host different-task separation
- cross-host same-task merging
- code-review inference
- far-apart session splitting
- candidate cap enforcement
- low-evidence search-noise discard
- action-oriented title generation
- task-shaped summary generation

## Future Improvement Directions

- move from greedy grouping toward explicit session clustering + second-pass task merge
- introduce stronger repository/project identity extraction
- improve task naming with title-phrase extraction from primary sources
- optionally add embedding-based semantic similarity as a secondary signal
- calibrate keep-score logic with real reviewed-memory outcomes
