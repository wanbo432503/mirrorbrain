# Project Work Session

## Summary

`src/modules/project-work-session` turns a pending Phase 4 work-session
candidate into a reviewed or discarded work session. It also models the narrow
project assignment rule for the MVP: a kept session must be assigned to an
existing project or to a user-confirmed new project.

## Responsibility Boundary

The module owns:

- Reviewing a `WorkSessionCandidate` as kept or discarded.
- Preserving memory event ids, source types, time range, and relation hints.
- Assigning kept sessions to projects.
- Creating a `Project` only from an explicit `confirmed-new-project` input.

The module does not own:

- Work-session candidate analysis.
- Durable storage for projects or reviewed work sessions.
- UI review controls.
- Knowledge Article Draft generation.
- Topic assignment or article publication.

## Key Interfaces

Input:

- `WorkSessionCandidate`: pending candidate from work-session analysis.
- `ReviewWorkSessionCandidateInput`
  - `decision`: `keep` or `discard`.
  - `reviewedAt` and `reviewedBy`: audit metadata for the human review action.
  - optional title and summary edits.
  - `projectAssignment`: required when keeping a session.

Output:

- `ReviewedWorkSession`
  - keeps provenance through `memoryEventIds`, `sourceTypes`, `timeRange`, and
    `relationHints`.
  - stores `projectId` for kept sessions or `null` for discarded sessions.
- optional `Project`
  - emitted only when the user confirmed creation of a new project.
  - uses readable Unicode slug ids, so non-English project names such as
    `聚类算法` do not collapse to `project:`.

## Data Flow

1. A user reviews a pending work-session candidate.
2. If the decision is `discard`, the module records a discarded reviewed
   session without creating or assigning a project.
3. If the decision is `keep`, the caller must provide an explicit project
   assignment.
4. Existing project assignments attach the reviewed session to the supplied
   project id.
5. Confirmed new project assignments emit a new active project and attach the
   reviewed session to it.

## Failure Modes And Constraints

- Keeping a candidate without `projectAssignment` throws an error.
- Suggested or inferred projects are not enough to create a durable project.
- This module does not validate that an existing project id already exists; the
  storage or service boundary should enforce that when persistence is added.
- Review is explicit and human-attributed through `reviewedBy`.

## Test Strategy

Unit tests live in `src/modules/project-work-session/index.test.ts`.

The tests verify:

- Kept sessions preserve source provenance under existing projects.
- New projects are created only from confirmed project assignments.
- Non-ASCII project names produce durable, distinct project ids.
- Kept sessions without project assignment are rejected.
- Discarded sessions do not create projects.
