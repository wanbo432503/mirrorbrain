# MirrorBrain Phase 3 Knowledge Test Spec

## Summary

This document defines the verification contract for the Phase 3 knowledge-quality implementation.

Its purpose is to ensure that Phase 3 work is not judged by vague output quality alone. Each milestone must be backed by tests or structured verification that prove:

- the knowledge model is expressive enough
- provenance and version history are preserved
- merge workflows behave deterministically
- retrieval and UI expose the intended current-best topic knowledge experience
- quality improvements can be evaluated with stable fixtures and criteria

## Testing Principles

1. **Behavior over implementation detail** — tests should assert topic-knowledge behavior and lifecycle, not internal helper structure.
2. **Provenance is an invariant** — every Phase 3 milestone must directly test provenance retention.
3. **History is not optional** — current-best topic artifacts and superseded versions must be verified together.
4. **Quality needs fixtures** — readability/structure goals must be checked through repeatable inputs.
5. **`openclaw` remains a consumer** — integration tests must preserve MirrorBrain-owned generation boundaries.

## Milestone 1 Test Spec — Knowledge Artifact 2.0 Model And Lifecycle

### Unit tests

#### Type/model coverage

Add unit coverage for the upgraded `KnowledgeArtifact` representation to verify:

- topic knowledge fields are required where appropriate
- `daily-review-draft`, `topic-merge-candidate`, and `topic-knowledge` variants are distinguishable
- `isCurrentBest`, `version`, and `supersedesKnowledgeId` semantics are represented correctly

#### Lifecycle validation helpers

If lifecycle validation helpers are introduced, verify:

- current-best topic artifacts cannot omit topic identity
- superseded topic artifacts must reference the artifact they replace
- provenance fields remain non-empty for durable topic artifacts

### Integration tests

#### Storage round-trip

Add integration tests proving the storage layer can:

- persist upgraded knowledge artifacts
- retrieve current-best topic artifacts
- retrieve superseded versions with intact metadata
- preserve provenance and recency fields during round-trip

### Acceptance evidence

Milestone 1 passes when:

- all model/state tests pass
- storage round-trip tests pass
- no current-best or superseded artifact loses provenance fields in tests

---

## Milestone 2 Test Spec — Daily Review To Topic Merge Workflow

### Unit tests

Add focused tests for merge workflow decisions:

1. **creates a new topic when no matching topic exists**
2. **rewrites current-best topic when new reviewed input materially improves an existing topic**
3. **keeps weak or noisy daily-review output as draft when promotion criteria are not met**
4. **creates a superseded version chain when current-best is updated**
5. **preserves reviewed-memory provenance during merge**

### Integration tests

Add integration tests for service/workflow behavior:

- daily-review draft inputs can flow into topic merge workflow through the service boundary
- publishing a new current-best topic also leaves prior versions retrievable through history
- merge outputs remain stable for the same fixture input

### Negative-path tests

Add at least these negative/edge-case tests:

- conflicting topic candidate with insufficient evidence does not silently overwrite current-best
- merge workflow rejects or defers invalid topic identity inputs
- provenance does not collapse when multiple reviewed memories contribute to one topic update

### Acceptance evidence

Milestone 2 passes when:

- merge decisions are deterministic for fixture-backed inputs
- current-best plus history are both observable in tests
- provenance survives create/update/supersede flows

---

## Milestone 3 Test Spec — Retrieval / API / UI Minimum Loop

### Service/API integration tests

Add integration coverage for:

- `listKnowledgeTopics`
- `getKnowledgeTopic(topicKey)`
- `listKnowledgeHistory(topicKey)`
- optional merge endpoint/service method if exposed in this milestone

Verify:

- current-best topic retrieval returns the rewritten durable artifact, not raw daily-review drafts by default
- history retrieval returns superseded versions in the intended order
- provenance metadata is present in both current-best and history responses

### HTTP contract tests

Add request/response coverage for:

- topic list shape
- topic detail shape
- topic history shape
- error behavior for unknown topic keys

### UI tests

If the standalone UI is extended in this milestone, add:

- component or integration tests for topic list rendering
- component or integration tests for current-best topic detail rendering
- tests that version history and provenance references are visible

### End-to-end tests

Add or extend one end-to-end test when the UI flow becomes meaningful enough:

- open topic knowledge view
- inspect current-best artifact
- inspect version history
- inspect provenance references

### Acceptance evidence

Milestone 3 passes when:

- topic list/detail/history APIs are covered by integration tests
- UI tests prove current-best + history + provenance are exposed
- end-to-end flow passes if a user-visible topic UI is introduced

---

## Milestone 4 Test Spec — Knowledge Quality Evaluation Loop

### Fixture design

Create reusable fixtures covering at least:

1. **single-topic multi-day accumulation**
2. **multiple interleaved topics**
3. **noisy daily-review input**
4. **topic rewrite / supersede scenario**

Each fixture should include:

- reviewed memories
- any daily-review draft intermediates if needed
- expected topic grouping intent
- expected provenance shape

### Structured evaluation checks

Define repeatable checks for:

- summarization fidelity
- structural clarity
- reasoning coherence
- future usefulness
- provenance completeness
- recency clarity

These do not all need to be fully automated numeric scores, but the repo must at least encode a structured rubric and repeatable review format.

### Regression checks

For every fixture, verify:

- a current-best topic artifact is produced or intentionally withheld
- superseded history is preserved where applicable
- provenance remains intact
- no fixture regresses into append-only daily-summary output as the main durable unit

### Acceptance evidence

Milestone 4 passes when:

- all fixture pipelines complete successfully
- structured quality checks are recorded and repeatable
- regressions in provenance/history/structure would fail tests or explicit rubric checks

---

## Cross-Milestone Required Commands

Whenever TypeScript or behavior changes in Phase 3, the minimum verification command set is:

```bash
pnpm vitest run
pnpm typecheck
```

Additionally run when applicable:

```bash
pnpm e2e
```

Use `pnpm e2e` whenever:

- topic knowledge UI changes materially
- HTTP + UI end-to-end behavior is part of the milestone acceptance path

## Direct Invariants To Test Throughout Phase 3

These invariants should receive direct tests whenever touched:

1. topic knowledge never loses provenance back to reviewed memory
2. only one version is marked current-best per topic at a time
3. superseded topic versions remain retrievable through history
4. daily-review drafts do not silently become durable topic knowledge without passing the defined merge/publish path
5. `openclaw` consumes topic knowledge read surfaces without taking ownership of generation workflows

## Test File Placement Guidance

Use the repo conventions:

- unit tests colocated beside implementation files
- integration tests under `tests/integration/`
- e2e tests under `tests/e2e/`
- quality fixtures under `tests/fixtures/`

## Exit Condition For Execution Readiness

Phase 3 should not enter execution mode until:

- milestone 1–4 acceptance criteria are reflected in tests or structured verification
- the required fixtures are identified
- service/API/UI verification scope is explicit
- this test spec is referenced by the implementation plan and the main Phase 2/3 roadmap doc
