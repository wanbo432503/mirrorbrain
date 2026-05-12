# MirrorBrain Phase 5 Design Draft

## Status

Draft. This document captures the agreed Phase 5 product and architecture
direction. It is not an implementation claim.

## Summary

Phase 5 turns the Phase 4 multi-source memory foundation into a high-precision
knowledge-building and public memory-context service.

Phase 4 focuses on acquiring authorized activity from multiple built-in sources,
writing daily ledgers, importing those ledgers into normalized `MemoryEvent`
records, and establishing the Project -> Topic -> Knowledge Article structure.
Phase 5 keeps that structure but sharpens the most important internal step:
generating high-quality `WorkSession Candidate` records from `MemoryEvent`
inputs.

The Phase 5 pipeline remains intentionally short:

```text
MemoryEvent
-> WorkSession Candidate
-> Knowledge Article Draft
-> human publish
-> current-best Knowledge
-> public Memory API
```

MirrorBrain should trust its own high-precision clustering enough that users do
not manually review every `WorkSession Candidate`. Human review remains at the
knowledge publish gate. Public memory consumers only read published,
current-best knowledge through a small API surface.

## Product Direction

MirrorBrain is not being optimized as the memory layer for one specific agent.
Phase 5 treats MirrorBrain as a shared memory foundation for many general
agents, coding agents, research agents, and future operators.

The external contract should therefore be simple: agents ask for useful context,
and MirrorBrain returns context that is already selected, compressed, and safe
to place into a prompt. Agents should not need to understand raw sources,
ledger files, clustering internals, work-session confidence scores, knowledge
drafts, or publication workflow state.

Internally, MirrorBrain keeps the complexity. It filters noisy data, merges near
duplicates, clusters related evidence, chooses article operations, and maintains
the Project -> Topic -> Knowledge Article system.

## Relationship To Phase 4

Phase 4 establishes:

- multi-source built-in recorders and ledgers
- ledger import into normalized `MemoryEvent` records
- source audit and source management surfaces
- the Project -> Topic -> Knowledge Article direction
- WorkSession Candidate generation as the bridge from memory to knowledge

Phase 5 does not primarily add more source coverage. It improves the quality of
the `WorkSession Candidate` generation process that Phase 4 introduced.

The main Phase 5 improvement is:

```text
lower-quality clustering
-> high-precision, topic-coherent, knowledge-worthy WorkSession Candidates
```

This means filtering low-quality inputs, reducing duplicate weight, improving
cross-source relation scoring, validating cluster coherence, and only producing
candidates that can responsibly feed Knowledge Article Draft generation.

## Core Goals

1. Improve the quality of Phase 4 `WorkSession Candidate` generation.
2. Use content quality filtering before clustering.
3. Merge near-duplicate same-source or near-same-source events before scoring.
4. Prefer high precision over recall when producing candidates.
5. Use a 24-hour default analysis window.
6. Generate at most five high-confidence candidates per 24-hour window.
7. Make every emitted candidate topic-coherent inside a work-session window.
8. Require both cluster coherence and knowledge value before draft generation.
9. Classify candidate-to-article operations before creating drafts.
10. Keep human confirmation at the knowledge publish gate, not at candidate
    review.
11. Expose a small read-only public Memory API backed only by published,
    current-best knowledge.
12. Keep raw memory, drafts, clustering scores, source audit, and history out of
    the public API.

## Non-Goals

- OpenClaw-specific API design.
- More broad source expansion as the main Phase 5 deliverable.
- Public raw `MemoryEvent` search.
- Public draft, history, source audit, or clustering APIs.
- Manual WorkSession Candidate review as a required product flow.
- Autonomous skill execution.
- Automatic publication of current-best knowledge.
- Agent-specific API variants for different caller types.
- A public search endpoint that returns article lists for agents to assemble.

## Source Priority

Phase 5 should use the following source priority when scoring evidence:

```text
browser > file-activity > agent-transcript > shell > screenshot
```

The MVP optimization effort should focus first on:

- `browser`
- `file-activity`
- `agent-transcript`

`shell` and `screenshot` can provide weak auxiliary signals, but they should
not dominate clustering. They should not pull otherwise unrelated events into a
candidate.

### Browser Role

Browser evidence is both topic evidence and project evidence, with topic
evidence first.

Browser fields such as page title, URL, domain, content summary, page content,
and extracted entities should strongly influence topic and knowledge
coherence. Browser events can also help identify projects when they reference
repositories, docs, issues, plans, or repeated project names.

### File Activity Role

File activity is primarily a project and work-object anchor. File path, file
name, repository path, document title, file type, and content summary help
prevent semantically similar but project-unrelated items from being clustered
together.

### Agent Transcript Role

Agent transcript evidence is mainly intent and process evidence. It can
contribute user goals, design decisions, unresolved questions, implementation
results, and final summaries. Transcript evidence is valuable but can be noisy,
so it should reinforce strong browser/file evidence rather than dominate it.

## WorkSession Candidate Semantics

Phase 5 keeps the `WorkSession Candidate` term but narrows its meaning.

A Phase 5 `WorkSession Candidate` is a high-confidence cluster of related
evidence inside an analysis window. It should represent a task-internal topic:
close enough to a work session to preserve temporal context, but coherent
enough to generate or update one focused Knowledge Article Draft.

Examples of good candidates:

- "MirrorBrain Phase 5 public Memory API boundary"
- "Source-ledger import bad-line handling and audit behavior"
- "Browser evidence weighting for project knowledge clustering"

Examples of poor candidates:

- a full day of unrelated work
- many repeated visits to the same low-information page
- a browser research topic mixed with an unrelated local file task
- a shell transcript cluster with no clear knowledge value

## Default Analysis Window

The default Phase 5 analysis window is 24 hours.

The 24-hour window is the main daily knowledge-building unit. It provides enough
context to connect browser reading, file activity, and agent discussion while
remaining narrow enough to support high-precision clustering.

Optional windows:

- 6 hours: a high-precision focused analysis window.
- 7 days: a future consolidation or exploration window, not the default path
  for Phase 5 MVP draft generation.

For a 24-hour window, the system should emit at most five WorkSession
Candidates. It should not fill the quota with weak clusters. If only one or two
high-confidence candidates exist, only those candidates should be produced.

## Content Quality Filtering

Phase 5 should filter low-quality `MemoryEvent` inputs before deduplication and
clustering.

Filtering only affects candidate generation. It does not delete durable
`MemoryEvent` records and does not remove provenance.

Examples of low-quality inputs:

- empty title or empty summary
- extremely short summary
- pure redirect pages
- login pages
- error pages
- repeated browser refreshes
- search-result noise without later evidence that the search result mattered
- temporary files, cache files, build outputs, and generated artifacts
- low-information transcript fragments such as greetings, empty status updates,
  or raw tool noise
- weak shell or screenshot events without meaningful semantic content
- events missing stable identity fields needed for deduplication

The first implementation should prioritize deterministic content-quality
filters. More advanced knowledge-value evaluation can happen at the candidate
level.

## Near-Duplicate Merge

Phase 5 should merge near duplicates before clustering.

Near-duplicate merge is not cross-source semantic clustering. It handles
repeated or near-repeated evidence from the same source or nearly the same
source so repeated activity does not inflate cluster confidence.

Examples:

- the same URL visited repeatedly
- the same page title and content summary repeated in a short time range
- the same file opened many times
- adjacent low-increment transcript segments from the same session
- repeated search-result pages around the same query

The dedup output should preserve one representative evidence item plus duplicate
references:

```ts
interface DeduplicatedEvidence {
  representativeEventId: string
  duplicateEventIds: string[]
  duplicateCount: number
  firstOccurredAt: string
  lastOccurredAt: string
}
```

Clustering should use the representative evidence. Provenance should retain all
duplicate refs.

## Clustering Strategy

Phase 5 clustering should use hybrid scoring:

```text
semantic similarity as the primary signal
+ time as a boundary and decay factor
+ project/file/transcript hints as anti-mixing constraints
```

Semantic similarity should use fields such as:

- title
- summary
- browser content summary
- file content summary
- URL and document terms
- extracted entities
- agent transcript intent and result summary

Time should constrain clustering inside the selected analysis window. Nearby
events can receive a relation boost, but temporal closeness must not override
semantic mismatch.

Project and file hints should prevent false positives. Shared repository paths,
document paths, project names, transcript session identity, and repeated
entities can strengthen a relation. Clear project mismatch should reduce a
relation even when vocabulary overlaps.

## Cluster Coherence

Phase 5 should validate clusters using a center-representative model.

Each candidate cluster should have a clear centroid or representative topic.
Every member evidence item must meet a minimum relevance threshold to that
center. Weak edge items should be removed rather than allowed to reduce the
quality of the candidate.

Rules:

- Every emitted candidate must have a coherent central topic.
- Every member must meet `minRelevanceToCentroid`.
- Low-relevance members are excluded.
- After exclusion, a candidate must still have at least three valid
  representative evidence items.
- Duplicate refs do not count toward the three-evidence minimum.
- Cluster confidence should be based on coherent evidence, not repeated noise.

## Knowledge Value Gate

A coherent cluster is not automatically knowledge-worthy.

Before draft generation, every WorkSession Candidate must pass both:

```text
coherence + knowledge value
```

Knowledge-value signals include:

- a clear conclusion
- a design decision
- an unresolved question
- a problem diagnosis
- a solution path
- a reusable workflow or operating pattern
- a project or topic direction change
- support for updating an existing Knowledge Article
- future usefulness for an agent trying to recover task context

Clusters that are coherent but low-value should become supporting evidence only
or be dropped from draft generation.

## Article Operation Classifier

Phase 5 should classify the article operation before creating a Knowledge
Article Draft.

Possible operations:

- `create-new-article`
- `update-existing-article`
- `attach-evidence-only`
- `no-draft`

This prevents MirrorBrain from creating a new article for every daily cluster.
The goal is a durable current-best knowledge system, not a daily-note archive.

### Create New Article

When creating a new article, the system can suggest an existing topic or create
a suggested new topic. The draft can be attached to that topic immediately.
Users can change the topic before publishing.

### Update Existing Article

When updating an existing article, the system should generate a rewritten
current-best article draft. It should not generate a patch-only draft.

The draft should combine:

- the existing current-best article
- the high-confidence WorkSession Candidate
- provenance from supporting events

The draft should include lightweight metadata such as:

- operation type
- source candidate IDs
- target article ID
- based-on article version
- change summary
- suggested title and topic
- confidence
- publish review state

Publishing the draft creates a new current-best version.

### Attach Evidence Only

Some candidates may be related and coherent but not strong enough to create or
rewrite a Knowledge Article. These candidates can be kept as supporting
evidence for future synthesis without producing a draft.

## Human Review Boundary

Phase 5 removes manual WorkSession Candidate review from the main product flow.

The main flow is:

```text
MemoryEvent
-> quality filtering
-> near-duplicate merge
-> high-precision clustering
-> WorkSession Candidate
-> article operation classifier
-> Knowledge Article Draft
-> human publish
-> current-best Knowledge
```

Users should not need to review each candidate before draft generation. The
system should be trusted to produce only high-quality candidates.

Human confirmation remains required before a draft becomes published,
current-best knowledge. The public Memory API can only read published,
current-best knowledge.

## Debug And Inspection Surface

Phase 5 should keep a debug or inspection surface for candidate quality, but it
is not a required product review flow.

The inspection surface can show:

- generated candidates for a 24-hour window
- candidate title, summary, and confidence
- representative evidence
- duplicate refs
- source composition
- filtered low-quality event counts
- excluded weak members
- article operation classification
- reasons a candidate became `attach-evidence-only` or `no-draft`

This surface supports development, tuning, and quality evaluation. It is not a
mandatory user step.

## Public Memory API Principles

Phase 5 public APIs are:

- read-only
- current-best only
- published-knowledge only
- prompt-friendly
- small in number
- not agent-specific

Public APIs must not expose:

- raw `MemoryEvent` records
- ledger entries
- source audit events
- WorkSession Candidate internals
- clustering scores
- Knowledge Article Drafts
- unpublished knowledge
- historical article versions
- source snippets from raw memory

## Tier 1 API: Memory Context

The primary public API is:

```http
POST /memory/context
```

It returns prompt-ready task context from published current-best knowledge.

### Request

```ts
interface MemoryContextRequest {
  query: string
  projectHint?: string
  topicHint?: string
  maxTokens?: number
}
```

`query` is required. `projectHint` and `topicHint` are soft hints. They increase
the weight of related project or topic knowledge but are not strict filters.
Phase 5 should not expose a strict scope parameter in the public API. A future
version can add one if needed.

### Response

```ts
interface MemoryContextResponse {
  status: 'ok' | 'insufficient_context'
  contextText: string
  citations: MemoryContextCitation[]
  reason?: string
}

interface MemoryContextCitation {
  articleId: string
  projectId: string
  topicId: string
  title: string
}
```

When `status` is `ok`, `contextText` should be directly usable in an agent
prompt.

Default `contextText` format:

```md
# Relevant Context

## Project Background

## Current Best Knowledge

## Decisions And Constraints

## Open Questions

## Useful Sources
```

The context provider should not try to answer the user's query as a chatbot. It
should provide the relevant project and knowledge context an agent needs to do
the work.

When context is insufficient:

```ts
{
  status: 'insufficient_context',
  contextText: '',
  reason: 'No published current-best knowledge matched the query.',
  citations: []
}
```

The API must not backfill insufficient context with raw memory, drafts,
reviewed sessions, or low-confidence candidates.

## Tier 2 API: Knowledge Navigation

The second public API tier supports structured navigation of published
current-best knowledge.

Initial endpoints:

```http
GET /memory/projects
GET /memory/projects/:projectId/topics
GET /memory/topics/:topicId/articles
GET /memory/articles/:articleId
```

These endpoints return only published current-best knowledge objects and enough
metadata to navigate the hierarchy.

Phase 5 should not expose a public `POST /memory/search` endpoint. Internal
retrieval, reranking, and context packing can support `POST /memory/context`
without becoming public API surfaces.

## Internal Context Retrieval

`POST /memory/context` can use internal retrieval modules:

```text
query
-> project/topic/article candidate retrieval
-> current-best filter
-> rerank
-> token-budget packing
-> Task Context formatter
```

These modules are implementation details. They should be testable, but they
should not force public API expansion.

## Acceptance Criteria

Phase 5 is on track when:

- 24-hour analysis is the default candidate generation path.
- Candidate generation prioritizes browser, file activity, and agent
  transcript evidence.
- Source weighting follows
  `browser > file-activity > agent-transcript > shell > screenshot`.
- Low-quality MemoryEvents are filtered before clustering.
- Near-duplicate same-source evidence is merged before scoring.
- Clustering uses semantic similarity as the main signal with time and
  project/file hints as constraints.
- Every emitted candidate has at least three representative evidence items.
- Duplicate refs do not count toward the evidence minimum.
- Every emitted candidate passes a center-representative coherence check.
- A 24-hour window emits at most five high-confidence candidates.
- Candidate draft generation requires both coherence and knowledge value.
- Article operation classification happens before draft generation.
- Existing articles are updated through rewritten current-best drafts.
- New articles can be attached to suggested existing or new topics.
- Manual WorkSession Candidate review is not required in the main flow.
- Human confirmation remains required before publishing current-best knowledge.
- Public Memory APIs are read-only and only expose published current-best
  knowledge.
- `POST /memory/context` returns prompt-ready task context.
- Public API insufficient-context behavior is explicit and does not fall back to
  raw memory.

## Open Questions

- Exact deterministic and semantic features for the first content-quality
  filter.
- The first threshold values for near-duplicate similarity,
  `minRelevanceToCentroid`, and candidate confidence.
- Whether article operation classification can start rule-based or should use
  an LLM-assisted evaluator.
- How the debug/inspection surface should be exposed without becoming a
  required user review flow.
- Whether 7-day topic consolidation belongs in late Phase 5 or a later phase.
- How to measure candidate quality against fixture-backed evaluation data.
- Whether published current-best knowledge needs storage-level consistency
  hardening before public API exposure.
