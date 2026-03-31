# MirrorBrain Product Design

## Summary

MirrorBrain is designed as the memory and capability layer for `openclaw`. The product design centers on a simple progression:

1. capture authorized work activity as memory
2. review and curate that memory
3. synthesize reviewed memory into knowledge
4. turn repeated reviewed workflows into skill drafts

The design must preserve provenance, authorization, and human control at every step.

## Design Principles

- raw capture is not the product; reviewed and useful artifacts are
- provenance should be visible throughout the experience
- review is the bridge between passive traces and durable value
- the system should suggest, not silently decide, when value is ambiguous
- memory, knowledge, and skill must remain distinct product surfaces

## Artifact Model

### Memory

Memory is the recall surface. It should answer:

- what happened
- when it happened
- where it came from
- why it may matter

Memory design should favor timelines, clusters, and candidate summaries over undifferentiated logs.

### Knowledge

Knowledge is the synthesis surface. It should answer:

- what was learned
- what matters now
- how the idea connects logically to prior work

Knowledge artifacts should read like strong working notes rather than raw transcripts.

### Skill

Skill is the operationalization surface. It should answer:

- what workflow was repeated
- under what conditions it is useful
- what evidence supports it
- what the AI should do when the skill is invoked

Skill artifacts should remain inspectable, editable, and clearly marked by approval state.

## Core User Flows

### Phase 1 Source Focus

The first product slice should focus on three source families:

- browser activity
- shell interaction history
- `openclaw` conversation history

This mix is enough to prove cross-context memory value without immediately taking on the complexity of general document ingestion. Document-based memory can be added once review, provenance, and privacy flows are stable.

Current repository status:

- the implemented MVP slice currently covers the browser source only
- shell and `openclaw` conversation sources remain part of the intended Phase 1 direction but are not implemented in this repository yet

### Flow 1: Memory Capture And Review

1. The user authorizes a source category or specific source.
2. MirrorBrain captures raw memory events from that source.
3. The system groups and ranks events into candidate memories.
4. The user reviews candidates and keeps, edits, merges, or discards them.
5. Reviewed memories become eligible inputs for daily review and workflow analysis.

Design implications:

- the source and time range must be visible
- candidate ranking must not imply approval
- review actions must be explicit and reversible when practical

### Flow 2: Daily Knowledge Review

1. The user opens a daily review experience.
2. MirrorBrain proposes reviewed memories worth synthesizing.
3. The system drafts a structured knowledge note.
4. The user edits or approves the draft.
5. Approved notes become durable knowledge artifacts for retrieval and inspiration.

Design implications:

- daily review is the default synthesis entry point
- knowledge drafts must cite reviewed input
- publication state must be separate from draft state

### Flow 3: Skill Drafting

1. MirrorBrain detects repeated patterns or notable workflows in reviewed activity.
2. The system produces a skill draft tied to evidence and rationale.
3. The user reviews the draft and decides whether to approve it.
4. Only approved skills may be considered for reuse.
5. Execution still requires a separate confirmation boundary.

Design implications:

- workflow evidence must be inspectable
- draft approval and execution approval are separate decisions
- skills should not appear as hidden background behavior

### Flow 4: First End-To-End Validation Flow

The first implementation should optimize for one concrete flow instead of broad optionality:

1. The user enables capture for browser activity and either shell history or `openclaw` conversation history.
2. MirrorBrain captures memory events from both enabled source families.
3. The user sees grouped candidate memories with visible provenance.
4. The user keeps or edits at least one candidate memory.
5. A daily review generates one knowledge draft from reviewed memory.
6. MirrorBrain proposes one skill draft backed by reviewed workflow evidence.
7. `openclaw` requests and displays the resulting artifacts through plugin-facing APIs.

This should be the anchor flow for early UX decisions, API design, and end-to-end testing.

## OpenClaw Plugin Experience

`openclaw` should be able to treat MirrorBrain as a capability provider with three distinct surfaces:

- memory retrieval
- knowledge retrieval
- skill retrieval and request flows

The host should not need to know internal storage or ranking logic. It should interact through explicit contracts and receive artifacts with clear provenance and review metadata.

## Information Design

### Required Metadata

Every first-class artifact should expose enough metadata for trust and debugging:

- stable identifier
- source attribution
- timestamps
- lifecycle state
- review status
- links to supporting artifacts where applicable

### State Visibility

The UI and APIs should make the following differences visible:

- raw memory vs candidate memory vs reviewed memory
- knowledge draft vs published knowledge
- skill draft vs approved skill vs executable invocation

## Safety And Consent Design

- capture is opt-in, not ambient
- revocation must be supported and reflected in behavior immediately for future capture
- sensitive or high-risk content must not be silently escalated into durable outputs
- users should understand when generated content is a suggestion versus an approved artifact

## Phase 1 Design Slice

The initial design slice should prioritize:

- browser activity, shell history, and `openclaw` conversation history as the first source set
- a review-first memory experience
- a daily-review-driven knowledge draft flow
- a simple skill draft experience based on repeated reviewed workflows

It should avoid trying to solve every retrieval, ranking, and automation scenario up front.

## Risks

- too much raw capture with too little review support will create noise
- weak provenance will reduce trust in knowledge and skills
- blurred states will cause unsafe assumptions about what is approved
- over-coupling to `openclaw` internals will make the plugin hard to evolve
