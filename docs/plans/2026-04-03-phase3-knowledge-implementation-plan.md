# MirrorBrain Phase 3 Knowledge Implementation Plan

## Summary

This document turns the high-level Phase 3 direction into an implementation-grade plan.

Phase 3 is not a generic “improve quality” effort. It is a bounded evolution from the current daily-review knowledge draft flow toward topic- and problem-oriented knowledge artifacts that are:

- durable for human reading
- grounded in reviewed memory provenance
- versioned as rewritten current-best artifacts rather than append-only logs
- retrievable by `openclaw` as a supplemental source, without moving the generation workflow into `openclaw`

This plan follows the agreed sequencing:

1. knowledge model and lifecycle
2. daily-review-to-topic merge workflow
3. retrieval / API / UI minimum loop
4. quality evaluation loop

## Why This Plan Exists

The existing Phase 3 text in `2026-04-01-mirrorbrain-phase2-phase3-plan.md` is directionally correct but not specific enough to implement safely. In particular, it does not yet define:

- a topic-knowledge artifact model
- explicit lifecycle stages
- merge policy from daily review into current-best topic knowledge
- API and UI boundaries
- acceptance criteria and verification shape

This plan fills that gap while preserving the current product constraints around provenance, human review, and MirrorBrain-owned knowledge generation.

## Scope

Phase 3 includes:

- upgrading `KnowledgeArtifact` beyond a thin daily-review draft container
- introducing topic- and problem-oriented current-best knowledge artifacts
- keeping lightweight version history and provenance
- adding merge workflows from daily review output into topic knowledge
- exposing read-oriented retrieval/API surfaces for topic knowledge
- adding the smallest useful standalone UI to inspect topic knowledge
- defining a fixture-based quality evaluation loop for knowledge outputs

Phase 3 does **not** include:

- moving knowledge generation into `openclaw`
- autonomous publication without review boundaries
- major changes to skill execution policy
- broad source expansion unrelated to knowledge quality
- production-grade ranking or recommendation systems for topic knowledge discovery

## Planning Principles

1. **Current-best over append-only** — the user-facing artifact should be a rewritten best version, not a raw history dump.
2. **Provenance first** — every durable topic artifact must remain traceable to reviewed inputs.
3. **Daily review remains upstream** — daily review continues to generate candidate synthesis inputs, but is no longer the final durable reading unit.
4. **MirrorBrain owns generation** — `openclaw` may read topic knowledge, but should not own merge or publication workflows.
5. **Quality must become testable** — “better knowledge” must map to concrete fixtures, criteria, and acceptance checks.

## Decision Drivers

1. The current `KnowledgeArtifact` is too thin to support topic-level current-best knowledge.
2. Topic knowledge must preserve both provenance and lightweight history.
3. The implementation must evolve from the current daily-review workflow without forcing a ground-up rewrite.

## Rejected Alternatives

### Alternative A: Quality-first without structural changes

Improve prompts/summarization first, while keeping the current thin daily-review draft model.

Why rejected:

- would create near-term readability gains but force rework once topic versioning and merge logic are introduced
- cannot express current-best rewriting or topic history cleanly
- does not make quality easier to verify long-term

### Alternative B: Full topic-knowledge system in one step

Design and implement a complete topic knowledge system, advanced UI, merge engine, retrieval ranking, and quality evaluation in a single Phase 3 push.

Why rejected:

- too broad for a safe next phase
- mixes foundational model work with user-facing quality optimization
- raises risk of architecture drift and weak verification

## Selected Approach

Use four milestones with explicit interfaces and acceptance gates.

---

## Milestone 1 — Knowledge Artifact 2.0 Model And Lifecycle

### Goal

Introduce a topic-capable knowledge model and explicit lifecycle that can represent:

- daily-review knowledge drafts
- topic merge candidates
- current-best topic knowledge
- superseded topic versions

### Deliverables

#### 1. Data model upgrade

Extend or replace the current `KnowledgeArtifact` shape to support at least:

- `artifactType`: `daily-review-draft` | `topic-knowledge` | `topic-merge-candidate`
- `topicKey`: stable topic/problem identifier
- `title`
- `summary`
- `body`
- `sourceReviewedMemoryIds`
- `derivedFromKnowledgeIds`
- `version`
- `isCurrentBest`
- `supersedesKnowledgeId`
- `updatedAt`
- `reviewedAt`
- `recencyLabel`
- `provenanceRefs` or equivalent stable provenance structure

#### 2. Lifecycle definition

Define explicit stages:

1. reviewed memory
2. daily-review knowledge draft
3. topic merge candidate
4. current-best topic knowledge
5. superseded topic knowledge version

#### 3. Storage contract update

Update OpenViking persistence and retrieval conventions so topic knowledge artifacts can be stored and read without losing:

- topic identity
- version order
- current-best marker
- provenance metadata

#### 4. Service boundary update

MirrorBrain service types and contracts should be able to read/write the new knowledge artifact shape without yet implementing the full merge workflow.

### Likely code/doc touchpoints

- `src/shared/types/`
- `src/integrations/openviking-store/`
- `src/apps/mirrorbrain-service/`
- `src/apps/mirrorbrain-http-server/`
- `docs/components/openviking-store.md`
- `docs/components/mirrorbrain-service.md`
- `docs/components/daily-review-knowledge.md`

### Acceptance Criteria

- the type model can represent current-best topic knowledge and superseded versions
- provenance can be traced back to reviewed memories
- the persistence layer can round-trip the upgraded knowledge artifact shape
- unit and integration tests cover lifecycle representation and storage round-trip

### Risks

- overfitting the model to a single topic strategy too early
- introducing topic fields that are too prompt- or UI-specific

### Sequencing note

Do not begin prompt-quality optimization before this milestone is structurally complete.

---

## Milestone 2 — Daily Review To Topic Merge Workflow

### Goal

Turn daily-review outputs into stable topic-knowledge updates instead of treating each daily draft as the final durable artifact.

### Deliverables

#### 1. Topic candidate builder

Add workflow logic to group or map daily-review outputs into topic/problem candidates.

Minimum interface target:

- `buildTopicKnowledgeCandidates(...)`

#### 2. Merge decision workflow

Add workflow logic that determines whether a daily-review artifact should:

- create a new topic
- update an existing topic by rewriting current-best
- remain a draft for manual review
- be ignored as too weak/noisy for durable topic promotion

Minimum interface target:

- `mergeDailyReviewIntoTopicKnowledge(...)`

#### 3. Topic publication workflow

Persist a new current-best topic version while preserving the previous version as superseded history.

Minimum interface target:

- `publishTopicKnowledgeVersion(...)`

#### 4. Merge policy definition

Document the first merge policy, including:

- new-topic threshold
- rewrite-current-best threshold
- manual-review-required cases
- how provenance is carried forward
- how `derivedFromKnowledgeIds` and `supersedesKnowledgeId` are assigned

### Likely code/doc touchpoints

- `src/modules/daily-review-knowledge/`
- `src/workflows/daily-review/`
- new topic-knowledge workflow area under `src/workflows/`
- `src/apps/mirrorbrain-service/`
- `docs/components/daily-review-workflow.md`
- new docs for topic merge workflow

### Acceptance Criteria

- multiple daily-review inputs can produce deterministic topic merge decisions
- the workflow can create a new current-best topic artifact
- superseded versions remain readable through history retrieval
- provenance is preserved through merge and rewrite steps
- tests cover at least: create-new-topic, update-existing-topic, keep-as-draft, and supersede-previous-version

### Risks

- merge policy may be too aggressive and prematurely overwrite useful current-best content
- merge policy may be too conservative and fail to accumulate durable topic knowledge

### Sequencing note

This milestone should remain service/workflow-first. Do not expand UI before merge semantics are stable.

---

## Milestone 3 — Topic Knowledge Retrieval, API, And Minimum UI Loop

### Goal

Make topic knowledge inspectable and consumable, not only generatable.

### Deliverables

#### 1. Read-oriented service/API contract

Add minimum read surfaces for topic knowledge:

- `listKnowledgeTopics`
- `getKnowledgeTopic(topicKey)`
- `listKnowledgeHistory(topicKey)`

Add one controlled write/merge entrypoint if needed:

- `mergeDailyReviewIntoKnowledge` or equivalent service-level operation

#### 2. HTTP exposure

Expose the topic-knowledge read contract through the HTTP server in a way that keeps MirrorBrain independently runnable.

#### 3. Standalone UI minimum loop

Add the smallest useful UI flow:

- topic list
- current-best topic detail page
- lightweight version history view
- provenance/source references

#### 4. `openclaw` consumption boundary

Document the default Phase 3 consumption rule:

- `openclaw` may retrieve topic knowledge as a supplemental source
- `openclaw` does not own generation or merge logic
- topic knowledge is not the default replacement for memory retrieval, but a complementary layer

### Likely code/doc touchpoints

- `src/apps/mirrorbrain-http-server/`
- `src/apps/mirrorbrain-web/`
- `src/apps/mirrorbrain-service/`
- `src/integrations/openclaw-plugin-api/`
- `docs/components/mirrorbrain-http-server.md`
- `docs/components/openclaw-plugin-api.md`
- new docs for topic-knowledge UI/API

### Acceptance Criteria

- API can list topics and fetch current-best topic knowledge by key
- API can return topic version history with recency and provenance metadata
- UI can show current-best content, history, and provenance without exposing raw append-only internals as the main reading experience
- `openclaw` integration docs clearly describe read-only consumption of topic knowledge

### Risks

- adding UI before the topic model is stable may create avoidable rework
- overloading `openclaw` retrieval with topic knowledge too early may blur memory vs knowledge boundaries

### Sequencing note

Keep UI narrow and read-focused in this milestone.

---

## Milestone 4 — Knowledge Quality Evaluation Loop

### Goal

Make knowledge-quality improvement explicit, repeatable, and verifiable.

### Deliverables

#### 1. Quality rubric

Define a first-pass rubric with scoring guidance for at least:

- summarization fidelity
- structure and reasoning quality
- future usefulness / idea-triggering value
- provenance completeness
- recency clarity

#### 2. Fixture set

Create repeatable fixtures for:

- single-topic multi-day accumulation
- multi-topic mixed daily input
- noisy/weak daily input
- version rewrite / supersede scenarios

#### 3. Evaluation workflow

Define how the repo verifies quality changes, for example:

- fixture-based regression checks
- snapshot/structured assertions for artifact shape
- rubric-scored manual or semi-structured review docs

#### 4. Operator guidance

Document what Phase 3 now optimizes for, and what it still does not do well.

### Likely code/doc touchpoints

- `tests/fixtures/`
- `tests/integration/`
- `docs/features/` or `docs/components/` for evaluation guidance
- possibly lightweight rubric artifacts under `docs/plans/` or `docs/features/`

### Acceptance Criteria

- each fixture path produces topic-knowledge artifacts with intact provenance and history
- current-best topic artifacts are measurably more readable than raw daily-review drafts under the rubric
- quality verification is repeatable enough to catch regressions in structure and provenance
- docs explain how to interpret quality checks and known gaps

### Risks

- rubric becomes too subjective to guide implementation
- evaluation drifts into prompt tuning without preserving system-level correctness checks

---

## Cross-Milestone Rules

### Boundary Rules

- keep memory, knowledge, and skill as distinct artifact layers
- keep MirrorBrain-owned generation inside MirrorBrain
- keep `openclaw` as a consumer of topic knowledge, not its owner

### Safety Rules

- preserve provenance end-to-end
- do not auto-publish high-value knowledge without a defined review gate
- do not weaken existing authorization and review constraints for the sake of convenience

### Documentation Rules

Each milestone must update or add:

- component docs for changed modules/services
- feature docs for new operator-visible flows
- plan docs when milestone scope shifts

---

## Verification Path

Before a milestone is complete, verification should include at least:

1. targeted unit tests for the new domain/workflow logic
2. relevant integration tests for service/storage/API behavior
3. `pnpm vitest run`
4. `pnpm typecheck`
5. `pnpm e2e` when UI or end-to-end behavior changes materially
6. documentation review for changed operator or API surfaces

## Suggested Staffing For Later Execution

### If executed via `$ralph`

Use a single-owner mainline with:

- `executor` for model/workflow changes
- `test-engineer` for fixture and verification design
- `verifier` for milestone sign-off
- `writer` for docs and operator guidance

### If executed via `$team`

Recommended lanes:

- **Lane A**: knowledge model / storage / lifecycle
- **Lane B**: merge workflow / service / API
- **Lane C**: UI / docs / verification fixtures

## Exit Condition For Planning

Phase 3 is considered fully planned for implementation only after:

- this implementation plan exists
- a matching test spec exists
- milestone acceptance criteria are agreed and testable
- the repo docs identify the Phase 3 source-of-truth plan artifacts
