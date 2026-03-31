# MirrorBrain Technical Design

## Summary

MirrorBrain should be implemented as an API-first, service-oriented TypeScript system that can operate as an `openclaw` plugin capability layer. The technical design preserves three distinct artifact classes:

- memory artifacts
- knowledge artifacts
- skill artifacts

Phase 1 should implement the narrowest viable slice that proves authorized ingestion, review, synthesis, and skill drafting in a user-runnable local MVP.

## Architecture Overview

### Logical Layers

- integrations: adapters for browser activity, document observation/import, shell history capture, and `openclaw` host interfaces
- modules: domain logic for authorization, memory capture, memory review, knowledge synthesis, and skill draft management
- workflows: orchestration for daily review, workflow evidence extraction, and skill generation
- apps: runnable surfaces such as backend service entrypoints, review UIs, and optional workers

### Boundary Rules

- integrations isolate source-specific and host-specific behavior
- modules own business logic and lifecycle rules
- workflows coordinate multi-step operations but should not hide core policy
- apps expose explicit APIs or user-facing surfaces and delegate to modules

### Phase 1 MVP Runtime Requirement

The Phase 1 slice is not complete as a backend-only code path. It must include:

- a runnable local HTTP surface for MirrorBrain
- a minimal standalone review UI or equivalent operator-facing interface
- documented startup steps for `ActivityWatch`, `OpenViking`, and MirrorBrain
- an end-to-end automated test that follows the documented user flow

## Recommended Phase 1 Module Map

- `src/modules/authorization-scope-policy`
- `src/modules/memory-capture`
- `src/modules/memory-review`
- `src/modules/daily-review-knowledge`
- `src/modules/skill-draft-management`
- `src/workflows/daily-review`
- `src/workflows/skill-draft-builder`
- `src/integrations/openclaw-plugin-api`

These names are defaults, not a rigid requirement, but new code should stay close to these responsibilities.

## Initial Source Adapter Recommendation

Phase 1 should start with adapters for:

- one browser activity source
- one shell history source
- the `openclaw` conversation or interaction history surface

For the first browser source:

- use `ActivityWatch` as the upstream browser activity source
- use `aw-watcher-web` as the initial browser capture mechanism
- treat `ActivityWatch` as a source integration only, not as MirrorBrain's primary storage layer

Current repository status:

- the implemented MVP slice currently includes only the browser source adapter
- shell and `openclaw` conversation adapters remain planned but are not implemented in this repository yet

Document observation adapters should come later unless they are required to complete the first end-to-end slice.

## Core Domain Entities

### MemoryEvent

Represents a raw, source-attributed event from an authorized source.

Suggested fields:

- `id`
- `sourceType`
- `sourceRef`
- `timestamp`
- `contentRef` or normalized payload
- `authorizationScopeId`
- `captureMetadata`

### CandidateMemory

Represents ranked or grouped memory prepared for review.

Suggested fields:

- `id`
- `memoryEventIds`
- `summary`
- `rankingSignals`
- `reviewState`

### ReviewedMemory

Represents memory that has passed a human review step.

Suggested fields:

- `id`
- `candidateMemoryId`
- `decision`
- `editedSummary`
- `annotations`
- `reviewedAt`

### KnowledgeArtifact

Represents a synthesized knowledge note produced from reviewed input.

Suggested fields:

- `id`
- `title`
- `body`
- `sourceReviewedMemoryIds`
- `draftState`
- `publishedAt`

### SkillArtifact

Represents a draft or approved Agent Skill.

Suggested fields:

- `id`
- `title`
- `instructionBody`
- `workflowEvidenceRefs`
- `approvalState`
- `executionSafetyMetadata`

## Lifecycle Enforcement

### Memory

- only authorized integrations may emit `MemoryEvent`
- candidate generation may rank or group events but must not imply approval
- a `ReviewedMemory` requires an explicit human action or documented review equivalent

### Knowledge

- knowledge generation consumes reviewed inputs, not arbitrary raw memory by default
- published knowledge requires a review gate
- provenance links to reviewed input must be preserved

### Skill

- workflow evidence may suggest a draft but may not directly create an executable skill
- skill approval and skill execution are separate state transitions
- execution requires current authorization and confirmation checks

## OpenClaw Plugin API Guidance

Until a stricter interface is chosen, design the plugin boundary around explicit capability-oriented APIs such as:

- `queryMemory(...)`
- `listKnowledge(...)`
- `getKnowledgeArtifact(...)`
- `listSkillDrafts(...)`
- `approveSkillDraft(...)`
- `recordReviewDecision(...)`

Guidance:

- requests should carry enough context to evaluate authorization and auditability
- responses should include provenance and lifecycle metadata
- host integration code should stay thin and defer policy decisions to MirrorBrain modules

## First End-To-End Technical Slice

The first implementation slice should prove this sequence:

1. start the documented local runtime for `ActivityWatch`, `OpenViking`, and MirrorBrain
2. expose a local HTTP API for health, sync, review, and artifact retrieval
3. controlled initial backfill from the browser source
4. normalization and ingestion into `MemoryEvent`
5. persistence of `MemoryEvent` into `OpenViking`
6. candidate generation into `CandidateMemory`
7. explicit review transition into `ReviewedMemory`
8. daily review generation into `KnowledgeArtifact` draft state
9. workflow evidence conversion into `SkillArtifact` draft state
10. retrieval through `openclaw`-facing query APIs and the standalone MVP surface

The preferred order of implementation is to make this slice pass end to end with minimal adapters before expanding source coverage or storage sophistication.

## Data And Storage Guidance

Phase 1 should use `OpenViking` as the primary local storage and retrieval layer for MirrorBrain artifacts.

Implementations should preserve:

- stable identifiers across retrieval and review flows
- provenance links from derived artifacts back to reviewed inputs
- explicit lifecycle state fields rather than inferred status
- room for retention and deletion rules to be enforced later without schema rewrites

Guidance:

- import upstream source data into MirrorBrain-owned normalized records before downstream processing
- store normalized raw `MemoryEvent` records in `OpenViking` rather than depending on upstream systems for later queries
- treat upstream source identifiers and sync checkpoints as part of ingestion metadata
- when uncertain, prefer append-friendly event capture plus explicit derived artifact records over mutating away provenance

## Synchronization Strategy

For source systems such as `ActivityWatch`, Phase 1 should use:

- an initial backfill over a controlled time window rather than unbounded historical import
- incremental polling after initial import
- configurable polling intervals; for example, every hour is a reasonable default, but the period must be configurable
- idempotent imports using source-aware checkpoints such as timestamps, event ids, or equivalent cursors when available

This keeps first-run behavior predictable while allowing the sync cadence to be tuned for performance, freshness, and privacy expectations.

## Security And Privacy Constraints

- deny capture from unauthorized sources by default
- keep authorization scope attached to captured and derived artifacts where relevant
- do not treat secrets, credentials, or tokens as valid product content
- preserve auditable records for plugin writes and approval actions

## Testing Strategy

### Unit Tests

Use Vitest for:

- authorization policy decisions
- memory grouping and ranking logic
- knowledge synthesis input selection
- skill draft state transitions

### Integration Tests

Use Vitest integration tests for:

- plugin API request and response behavior
- end-to-end flow from authorized capture to reviewed memory
- daily-review synthesis from reviewed memory to knowledge draft
- workflow evidence to skill draft generation with approval gating

### End-To-End Tests

Use Playwright where a UI or embeddable host flow is involved, especially for:

- review interactions
- daily review flows
- approval and confirmation boundaries
- the documented Phase 1 MVP startup and usage path

### Required Verification

For TypeScript changes, run:

- targeted Vitest coverage for changed behavior
- broader relevant Vitest suite
- `tsc --noEmit`

## Phase 1 Delivery Sequence

1. Define the user-runnable MVP acceptance path in docs and ADRs.
2. Implement a runnable local HTTP surface for the existing service contract.
3. Persist review artifacts needed by the MVP flow.
4. Implement a minimal standalone review UI.
5. Add startup scripts, environment templates, and local runtime checks.
6. Add Playwright coverage for the documented MVP path.
7. Finalize the root `README.md` and local usage instructions.
8. Broaden source support only after the runnable MVP path is stable.

## Open Questions

- should the first host integration remain in-process behind a local HTTP wrapper or later move to another IPC mechanism
- what exact normalized shape should source payloads use in Phase 1
- what retention and deletion semantics should be enforced on raw and derived artifacts
