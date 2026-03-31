# MirrorBrain PRD

## Summary

MirrorBrain is an `openclaw` plugin that provides three related capabilities built from authorized PC work activity:

- memory: source-attributed recall of what the user did
- knowledge: high-signal notes synthesized from daily review
- skill: reusable Agent Skills distilled from repeatable workflows

Phase 1 focuses on a narrow, safe vertical slice that proves the plugin model, preserves privacy boundaries, keeps the user in control, and is runnable by a real user end to end in a documented local environment.

## Problem Statement

Users doing substantial work on a PC leave behind fragmented evidence across browser sessions, viewed documents, shell history, and AI conversations. Important context is often lost because:

- raw activity is hard to revisit in a structured way
- insights from one day do not reliably become reusable knowledge
- repeatable workflows are rediscovered manually instead of becoming durable skills

`openclaw` needs a memory and capability layer that can turn authorized work traces into usable recall, high-quality knowledge, and explicit skill artifacts.

## Product Goals

- help users recover relevant work context with clear provenance
- help users convert reviewed activity into strong daily knowledge notes
- help users convert repeatable workflows into explicit Agent Skill drafts
- make these capabilities available to `openclaw` through explicit plugin-facing APIs
- preserve privacy, authorization, and human confirmation boundaries throughout

## Non-Goals

- becoming a general-purpose passive surveillance system
- autonomous high-risk workflow execution without confirmation
- broad enterprise integration coverage in Phase 1
- replacing the host product `openclaw`
- capturing every possible source type before review and governance are solid

## Primary Users

- individual knowledge workers using `openclaw` on a PC
- technically oriented users who want stronger recall across browser, documents, shell, and AI interaction history
- users who want reviewed summaries and repeatable workflow guidance, not just raw logs

## Core User Jobs

1. Review what I worked on and recover missing context quickly.
2. Turn daily activity into coherent notes I can revisit later.
3. Identify repeated workflows and convert them into reusable AI skills.
4. Use these outputs from inside `openclaw` without losing privacy control.

## Core Product Model

### Memory

Memory is the raw or lightly processed recall layer. It includes authorized records from:

- browser activity
- viewed documents
- shell interaction history
- `openclaw` conversation history and related agent traces

Memory must remain source-attributed, reviewable, and bounded by explicit authorization.

### Knowledge

Knowledge is a derived layer created through review. It is not a raw dump of captured events. Knowledge artifacts should:

- be strongly reasoned and structured
- cite or link to supporting reviewed memory
- remain readable by humans
- also support agent retrieval and reuse

### Skill

Skills are explicit Agent Skill artifacts derived from repeatable workflows. Skills must:

- preserve links to workflow evidence or rationale
- require explicit human approval before reuse or execution
- remain portable enough to be used by `openclaw`

## Phase 1 Scope

Phase 1 includes:

- explicit authorization for a small number of PC-first sources
- ingestion of authorized memory events with stable source attribution
- memory review flows that produce candidate and reviewed memories
- daily-review knowledge drafting from reviewed memory
- workflow evidence detection sufficient to produce skill drafts
- explicit approval states for skill drafts
- plugin-facing APIs for `openclaw` to read memory, knowledge, and skills
- a runnable local service surface for MirrorBrain
- a minimal user-facing review flow for the first vertical slice
- repository-level setup, startup, and usage documentation for a new user

### Initial Phase 1 Sources

To keep Phase 1 narrow, the initial supported sources should be:

- browser history or browser session activity from an explicitly authorized browser integration
- shell interaction history from an explicitly authorized shell environment
- `openclaw` conversation history and related host-side interaction traces

For the first browser slice:

- `ActivityWatch` with `aw-watcher-web` should be the browser activity source
- `ActivityWatch` should be treated as a source system, not the long-term storage or processing center
- MirrorBrain should import normalized browser memory into `OpenViking`, which acts as the main local storage and retrieval layer for MirrorBrain artifacts

Current repository status:

- the implemented MVP slice currently supports the browser source only
- shell history and `openclaw` conversation history remain part of the broader Phase 1 plan but are not implemented in this repository yet

Document viewing or import support is in-scope for the broader product, but should default to a later increment unless it is needed to complete the first vertical slice.

Phase 1 excludes:

- autonomous execution of skills without confirmation
- broad third-party or enterprise connectors
- fully automatic knowledge publication
- hidden background promotion of memory into durable knowledge or executable skills
- production-hardening beyond a documented local MVP environment

## User Experience Principles

- the user stays in control of capture, review, synthesis, and execution
- provenance must be visible whenever outputs are shown
- capture should be selective and explainable
- reviewed artifacts are more valuable than raw volume
- generated skills must feel inspectable, editable, and safe

## Functional Requirements

### Authorization

- users can enable or disable source categories explicitly
- source authorization can be represented per category and, when needed, per path or instance
- revoking a source stops new capture immediately

### Memory

- the system captures raw memory events from authorized sources only
- each event carries stable identifiers, timestamps, and source attribution
- the system can group, rank, and present candidate memories for review
- users can keep, edit, merge, or discard candidate memories

### Knowledge

- the system can create knowledge drafts from reviewed memory during daily review
- knowledge artifacts include provenance metadata and review state
- high-value knowledge is not treated as published until a human review step completes

### Skill

- the system can identify workflow evidence from reviewed activity
- the system can generate skill drafts tied to evidence or rationale
- skill drafts include approval state and execution safety metadata
- skill execution requires explicit confirmation

### OpenClaw Integration

- `openclaw` can request memory, knowledge, and skill capabilities independently
- reads and writes across the plugin boundary are auditable
- the integration does not depend on hidden host state

### Storage And Synchronization

- `OpenViking` is the primary local storage and retrieval layer for MirrorBrain in Phase 1
- raw normalized `MemoryEvent` records should be written into `OpenViking`, not kept only in upstream source systems
- upstream systems such as `ActivityWatch` are treated as source inputs, not as the system of record for MirrorBrain artifacts
- source imports must support an initial controlled backfill window rather than unbounded history import
- incremental synchronization must run on a configurable polling interval; an hourly interval is a reasonable default example, but the period should remain configurable

## Quality And Safety Requirements

- unauthorized sources must be rejected or ignored
- sensitive data must not be silently promoted into knowledge or skills
- no high-risk automation may happen without confirmation
- privacy-preserving behavior wins when requirements are ambiguous

## Success Criteria For Phase 1

Phase 1 is successful only if a new user can complete the first MVP flow by following repository documentation rather than reading source code.

- a user can install or start the required local dependencies for the documented MVP environment
- a user can start MirrorBrain through a documented command and verify service health
- a user can trigger browser memory import from `ActivityWatch`
- a user can review authorized memory through a user-facing review surface
- a user can produce a daily knowledge draft from reviewed memory
- a user can inspect at least one generated skill draft linked to workflow evidence
- `openclaw` can retrieve these artifacts through explicit plugin-facing interfaces
- the repository includes a root `README.md` that explains project purpose, setup, startup, testing, MVP usage, and known limitations
- the system enforces authorization and confirmation boundaries in automated tests
- the documented MVP path is covered by at least one end-to-end user-flow test

## First End-To-End Slice

The first end-to-end slice should prove the narrowest useful path through the system and be runnable locally by a user:

1. A user follows the repository documentation to start `ActivityWatch`, `OpenViking`, and MirrorBrain locally.
2. MirrorBrain exposes a local service surface that reports health and supports the first MVP workflow.
3. MirrorBrain performs an initial backfill from a controlled time window for the browser source.
4. MirrorBrain normalizes the imported events into `MemoryEvent` records and stores them in `OpenViking`.
5. MirrorBrain groups the stored events into candidate memories.
6. The user reviews at least one candidate memory through a user-facing review flow and marks it as kept.
7. A daily review flow generates a knowledge draft from reviewed memory.
8. MirrorBrain detects repeated workflow evidence from reviewed activity and produces a skill draft.
9. `openclaw` retrieves the reviewed memory, knowledge draft, and skill draft through explicit plugin APIs.

This slice is more important than broad source coverage. New source adapters should not come before this flow works end to end.

## Open Questions

- what exact transport and lifecycle model should the `openclaw` plugin boundary use
- what retention and deletion policy should apply to raw memory versus derived artifacts
