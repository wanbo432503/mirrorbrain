# MirrorBrain Phase 4 Design Draft

## Status

Draft. This document captures the current Phase 4 product and architecture
direction. It is not an implementation claim.

## Summary

Phase 4 turns MirrorBrain from the Phase 3 topic-knowledge baseline into a
multi-source project memory system.

MirrorBrain should continuously record authorized browser, file, shell, agent,
and screenshot activity through built-in recorders into daily JSONL ledgers.
An importer scans changed ledger files on a configurable interval, converts new
entries into unified `MemoryEvent` records, and leaves source acquisition
details behind the ledger boundary. The workflow-level default is 30 minutes,
while the local MirrorBrain runtime currently supplies a one-minute interval for
fresh browser-memory capture and import. Users then manually analyze 6-hour,
24-hour, or 7-day windows into reviewed work sessions. Reviewed work sessions
feed project-scoped, topic-organized, atomic Knowledge Article Drafts that can
be published as current-best Knowledge Articles with version history.

## Relationship To Phase 3

Phase 3 established the baseline for topic-oriented knowledge:

- reviewed memory could become knowledge drafts
- topic merge could promote knowledge into current-best topic artifacts
- topic history, graph views, and fixture-backed quality evaluation existed

Phase 4 inherits the knowledge-quality goal but changes the center of gravity.
The durable knowledge structure becomes:

```text
Project
└── Topic
    └── Knowledge Article
        └── versions / current-best
```

`Project` is the long-running work container. `Topic` is a branch inside a
project. `Knowledge Article` is the smallest durable article unit.

Daily review is no longer the primary knowledge entry. Phase 4 knowledge starts
from reviewed work sessions produced by multi-source clustering.

## Core Goals

1. Expand MirrorBrain's source coverage beyond browser activity.
2. Keep every source behind a unified built-in source plugin and recorder model.
3. Use daily JSONL ledgers as the internal contract between acquisition and
   downstream memory processing.
4. Continue to use `MemoryEvent` as the normalized handoff format.
5. Add user-managed source configuration and source audit UI.
6. Generate reviewed work sessions from user-triggered analysis windows.
7. Organize durable knowledge under Project -> Topic -> Knowledge Article.
8. Preserve human review before publishing durable knowledge or making skill
   evidence actionable.

## Non-Goals

- External or marketplace source plugins.
- Third-party plugin installation, signing, or sandbox distribution.
- Full data deletion and derived-artifact invalidation implementation in the
  first Phase 4 MVP.
- Default full shell output capture.
- Code diff or git-change evidence as a first-class source plugin.
- Fully autonomous skill execution.
- Automatic background work-session analysis without user initiation.

## Source Plugin Architecture

Phase 4 should support only MirrorBrain-defined built-in source plugins, but
the code shape should remain plugin-oriented so future developers can add new
built-in sources without rewriting the pipeline.

Initial built-in source plugins:

- `browser`
- `file-activity`
- `screenshot`
- `audio-recording`
- `shell`
- `agent`

Each plugin declares:

- source kind
- source instance configuration
- recorder requirements
- ledger payload schema
- deterministic identity inputs
- normalization rules into `MemoryEvent`
- redaction and summary metadata
- checkpoint behavior
- source audit events

Source plugins cannot directly create durable knowledge or executable skills.
They only produce source-attributed evidence through the ledger/import path.

## Recorder And Ledger Boundary

Recorders are MirrorBrain components. They are not external systems. The ledger
exists to decouple source acquisition from selection, clustering, and knowledge
generation.

```text
MirrorBrain source recorder
-> daily JSONL ledger
-> MirrorBrain ledger importer
-> MemoryEvent
-> analysis / work session / knowledge
```

Recorders own source acquisition:

- browser page title, URL, and page content
- file metadata and content summaries
- shell command/session metadata
- agent session metadata and summaries
- screenshot OCR/vision summaries
- authorized audio recording transcript summaries and optional retained-audio
  references

Importers own:

- ledger scanning
- schema validation
- deterministic ID generation
- duplicate detection
- bad-line handling
- `MemoryEvent` normalization
- checkpoint advancement
- source audit events

Recorders must not bypass ledgers and write `MemoryEvent` records directly.
Importers must not perform source acquisition.

## Daily Ledger Layout

All acquisition pipelines write into daily ledger folders:

```text
ledgers/
  2026-05-12/
    browser.jsonl
    file-activity.jsonl
    screenshot.jsonl
    audio-recording.jsonl
    shell.jsonl
    agent.jsonl
  2026-05-13/
    browser.jsonl
    file-activity.jsonl
    screenshot.jsonl
    audio-recording.jsonl
    shell.jsonl
    agent.jsonl
```

Every line is one ledger entry. Ledger files are acquisition inputs, not
MirrorBrain's durable product memory. After import, durable user-work evidence
lives as `MemoryEvent` records in MirrorBrain storage.

## Ledger Entry Envelope

All ledger entries use a common envelope with source-specific payloads:

```ts
interface SourceLedgerEntry<TPayload> {
  schemaVersion: string
  sourceKind:
    | 'browser'
    | 'file-activity'
    | 'screenshot'
    | 'audio-recording'
    | 'shell'
    | 'agent'
  sourceInstanceId: string
  occurredAt: string
  capturedAt?: string
  payload: TPayload
}
```

Ledger entries do not provide authoritative IDs. MirrorBrain generates
deterministic IDs from stable source fields.

```text
sourceRef = hash(sourceKind, sourceInstanceId, occurredAt, canonical payload identity)
```

The deterministic ID inputs are source-specific. Examples:

- browser: URL, source page ID, occurredAt, page content hash
- file activity: file path, occurredAt, content summary hash, file metadata hash
- screenshot: occurredAt, vision summary hash, image path/hash when retained
- audio recording: occurredAt, transcript summary hash, audio path/hash when
  retained, duration when available
- shell: session ID, command timestamp/index, cwd, redacted command hash
- agent session: transcript/session path, session ID, message range, updatedAt

## Browser Ledger

Browser memory must also use the daily JSONL ledger path in Phase 4. Browser is
not a special direct-ingestion pipeline.

The browser payload must include at least:

```ts
interface BrowserLedgerPayload {
  id: string
  title: string
  url: string
  page_content: string
}
```

The purpose is to consolidate information currently spread across browser event
records, page title/URL metadata, readable page content artifacts, and
vectorization references into one browser page evidence record before import.

Optional fields can include:

- browser name
- domain
- source event IDs
- content hash
- content summary
- access timestamps

After import, browser entries become `MemoryEvent` values with
`content.contentKind = 'browser-page'`.

## File Activity Ledger

File activity records represent files the user opened. The recorder writes
metadata and a content summary for document and image types such as PDF, PPTX,
DOCX, spreadsheets, Markdown, text, code/config text, and common image formats.

Default payload shape:

```ts
interface FileActivityPayload {
  filePath: string
  fileName: string
  fileType: string
  mimeType?: string
  openedByApp?: string
  sizeBytes?: number
  modifiedAt?: string
  contentSummary: string
  summaryModel?: string
  fullContentRef?: string
}
```

Full content is optional. UI should allow users to enable full context by path,
project, or file type and warn that it may consume more model and indexing
resources.

## Screenshot Ledger

Screenshot capture is summary-first. The recorder writes metadata plus OCR and
vision summaries. Persisting the original image is optional.

```ts
interface ScreenshotPayload {
  title?: string
  appName?: string
  windowTitle?: string
  imagePath?: string
  imageRetained: boolean
  imageSize?: { width: number; height: number }
  ocrSummary?: string
  visionSummary: string
  ocrModel?: string
  visionModel?: string
}
```

When `imageRetained` is false, MirrorBrain imports only metadata and summary.
When true, the imported `MemoryEvent` can include a body reference to the image
artifact for later review.

## Shell Source

Phase 4 shell capture should move beyond plain history-file import, but output
capture is staged.

MVP shell capture records:

- command
- timestamp
- cwd / workspace when available
- exit code
- shell session ID
- terminal app / shell type
- source instance
- redaction status

Command output is not captured in the MVP. The design should reserve a higher
permission tier for future output summary and full output modes, with truncation
and secret redaction.

## Agent Transcript Source

Agent transcripts are configured by source path. Phase 4 does not require
direct integration with a specific agent runtime as the only source of truth.

Supported source configuration should cover:

- Claw transcript directories
- Codex or coding-agent session directories
- exported agent interaction directories
- generic transcript import directories

The transcript source prioritizes:

- session ID
- user task or intent
- agent identity
- message range
- tool-call metadata summary
- final result summary
- transcript path
- redaction status

Code diffs and git-change graphs are not first-class Phase 4 source plugins.
They may appear only as transcript metadata when present.

## Import Scheduling

Recorders are long-running runtime components. Enabled recorders start with
MirrorBrain and continuously write daily ledgers.

The importer is asynchronous and independent:

- scans every 30 minutes by default
- checks ledger file size/mtime before importing
- imports only changed files
- advances checkpoints by file path and offset or line number
- supports manual "Import Now" in Source Management UI

Manual import should import only new ledger entries and must not duplicate
previous imports.

## Recorder Supervision

MirrorBrain should include a recorder supervisor.

Enabled recorders start when MirrorBrain starts or when a source instance is
enabled. Disabled sources must stop new acquisition immediately.

Failure policy:

- automatically restart failed recorders a limited number of times
- use backoff between retries
- mark a source `error` when restart attempts are exhausted
- keep checkpoint and ledger state intact across restarts
- never restart a disabled source

Recorder state changes write `SourceAuditEvent` records.

## Ledger Failure Policy

JSONL bad-line handling should be resilient and auditable:

- skip the bad line
- continue importing subsequent lines
- advance checkpoint beyond the bad line
- show warning/failure counts in Source Management UI
- save a redacted and truncated bad-line sample in audit metadata
- allow future manual rescan or reprocess flows

One malformed entry must not block an entire daily ledger file.

## Source Audit Log

`SourceAuditEvent` is a first-class operational data structure. It is not user
work evidence.

Audit events cover:

- source enabled / disabled
- source configuration changed
- recorder started / stopped / crashed / restarted
- ledger write succeeded / failed
- importer scan started / no changes detected
- ledger file changed
- entry imported
- entry skipped
- schema validation failed
- redaction applied
- duplicate skipped
- checkpoint advanced
- analysis run started
- work session candidates generated

Audit logs do not participate in:

- memory retrieval
- work-session clustering
- knowledge generation
- skill evidence

Rule:

```text
SourceAuditEvent is operational metadata.
MemoryEvent is user work evidence.
```

## Source Management UI

Phase 4 source management belongs in the MirrorBrain UI.

The standalone UI should expose a single top-level `memory sources` tab instead
of separate `memory` and `sources` tabs. The left rail starts with
`All Sources`; selecting it shows the original memory-tab list and
pagination layout without an extra subtab. The action row keeps only
`Import Sources`, with import feedback displayed to the left of that button.
Selecting an individual source keeps the source-specific management surface,
but the navigation labels should use product-facing names such as Agent,
Browser, Files, Screenshot, Audio, and Shell instead of internal `*-main`
source instance ids.

Each source instance has a detail page with tabs:

- Sources
- Ledger Format
- Settings

The `Sources` tab shows the source summary metrics first:

- enabled / disabled / running / degraded / error
- recorder status
- last ledger write time
- last importer scan time
- last imported time
- imported count
- skipped count
- latest warning/error
- checkpoint summary

Below those metrics, the `Sources` tab shows paginated imported `MemoryEvent`
records for that source.

The `Ledger Format` tab shows a read-only JSONL reference for the selected
source-ledger type so third-party applications can construct compatible ledger
files without seeing unrelated source payloads.

Settings supports:

- enable / disable
- source instance configuration
- ledger directory/status
- full-context toggle where relevant
- screenshot image retention toggle
- shell capture options
- agent session directory
- audio recording source configuration when an authorized recording recorder is
  added later
- future delete/exclude governance entry points

Disable means stop future acquisition. It does not delete existing
`MemoryEvent` records. Full historical delete, exclude-from-retrieval, and
derived-artifact handling should be designed in Phase 4 but can be implemented
after the MVP.

## MemoryEvent Content Model

Phase 4 continues to use `MemoryEvent` as the handoff between acquisition and
downstream processing. `MemoryEvent` is not the raw OS event and not the final
work session. It is normalized, source-attributed work evidence.

`MemoryEvent.content` should use common fields plus source-specific details:

```ts
interface MemoryEventContentV2 {
  title: string
  summary: string
  contentKind:
    | 'browser-page'
    | 'file-activity'
    | 'audio-recording'
    | 'shell-command'
    | 'agent-session'
    | 'screenshot'
  bodyRef?: {
    kind: 'workspace-file' | 'qmd-document' | 'external-ref'
    uri: string
    mediaType?: string
    sizeBytes?: number
  }
  entities?: Array<{
    kind: 'file' | 'url' | 'command' | 'agent' | 'app' | 'project' | 'topic'
    label: string
    ref?: string
  }>
  sourceSpecific: Record<string, unknown>
}
```

Downstream clustering and retrieval should primarily rely on `title`,
`summary`, `contentKind`, `entities`, event time, source kind, and source ref.
They should not need to understand every source-specific payload field.

## Analysis Runs And Work Sessions

Work-session clustering is user-triggered, not automatic.

The UI provides three analysis windows:

- Analyze last 6 hours
- Analyze last 24 hours
- Analyze last 7 days

An analysis run:

```text
selected analysis window
-> MemoryEvents in window
-> local/noise filtering
-> repeated-event deduplication
-> project/topic matching or fallback classification
-> topic-scoped WorkSession candidates
-> preview Project / Topic / Knowledge tree
-> user review/edit/publish
```

The 6-hour, 24-hour, and 7-day windows are candidate data ranges, not final
session boundaries. One analysis run can produce multiple WorkSession
candidates.

Hybrid scoring should only operate inside the selected window. This avoids
global over-clustering. Strong signals include workspace path, file path, shell
cwd, agent session, screenshot app/window context, browser URL/domain, repeated
entities, and summary similarity. The first usable implementation must at
least filter local browser noise, deduplicate repeated pages, and split a
single project into multiple topic-scoped candidates when the window contains
multiple knowledge-worthy topics.

In the Web UI, Work Sessions is the primary candidate-generation and review
entrypoint. The older daily `CandidateMemory -> ReviewedMemory` flow remains a
compatibility backend path, but it should not be the main Phase 4 review
surface. The combined review surface has two knowledge-tree modes:

- `Preview`: an ephemeral Project -> Topic -> Knowledge tree derived from the
  latest 6-hour, 24-hour, or 7-day work-session analysis window.
- `Published`: the durable Project -> Topic -> Knowledge tree built from all
  published Knowledge Articles and their history.

Publishing a preview knowledge item reviews the supporting WorkSession
candidate, generates a Knowledge Article Draft, and publishes it into the
durable tree. The publication intent must remain explicit because the merge may
create a new article, update an existing article with a new version, or fully
rewrite an existing article lineage.

## Reviewed Work Sessions

The review lifecycle is:

```text
WorkSession candidate
-> ReviewedWorkSession
-> Project attribution
```

Users can review, rename, edit, keep, discard, and assign sessions to a
project. A reviewed work session preserves provenance back to all source
`MemoryEvent` records.

If one WorkSession candidate appears to contain multiple unrelated article
topics, that should be treated as a clustering/sessionization quality issue.
The default response should be to split or correct the session, not to generate
many unrelated knowledge articles from one session.

## Project Model

Project is the primary Phase 4 organization object.

Minimum project fields:

```ts
interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'paused' | 'archived'
  createdAt: string
  updatedAt: string
}
```

Projects are created in two ways:

- user manually creates a project
- system suggests a new project during session or knowledge review, and the
  user confirms

The system must not silently create durable projects without user confirmation.

## Topic Model

Topic is a project-internal branch. Topic does not replace Project and does not
stand alone as the long-running work container.

Topic creation is system-driven. During Knowledge Article Draft generation, the
system can choose an existing topic under the project or create a new topic.
The UI must provide a human modification path:

- rename topic
- edit topic description
- move draft/article to another topic
- choose another existing topic
- later merge topics

Topic confirmation does not need to block every draft generation, but the user
must be able to correct the assignment before publishing durable knowledge.

## Knowledge Article Drafts

Terminology:

- use `Knowledge Article Draft`
- do not use `Knowledge Article Candidate`

A Knowledge Article Draft is generated from one or more
`ReviewedWorkSession` records.

Default rule:

- one ReviewedWorkSession should produce zero or one Knowledge Article Draft
- multiple related ReviewedWorkSessions can produce one Draft
- one ReviewedWorkSession should not routinely produce many Drafts

If multiple unrelated draft opportunities appear inside one session, the
session is probably too mixed and should be corrected.

Draft generation returns:

- draft title
- draft summary
- draft body
- suggested or confirmed project
- auto-generated or selected topic
- article operation proposal:
  - create new article
  - update existing article
  - attach as supporting evidence only
- provenance refs to ReviewedWorkSessions and MemoryEvents

Project/topic assignment is reviewed together with the draft, not as a hard
pre-generation requirement.

## Published Knowledge Articles

Published Knowledge Articles are durable, project-scoped, topic-organized, and
atomic.

Workspace persistence follows the product tree directly:

```text
mirrorbrain/knowledge/project/<project>/<topic>/<knowledge>.json
```

New projects that have reviewed work but no published knowledge use a
`preview_` project-directory prefix. Draft knowledge files use a `preview_`
filename prefix. Published projects and published knowledge files omit that
prefix. The UI should use those prefixes as the durable lifecycle signal for
Preview versus Published surfaces instead of scattering drafts, projects,
topics, and articles across separate root-level directories.

Each article has:

- stable article ID
- project ID
- topic ID
- title
- summary
- body
- version
- `isCurrentBest`
- prior version / supersedes relation
- source ReviewedWorkSession IDs
- source MemoryEvent IDs
- provenance refs
- review/publish state

Updating an existing article creates a new version. Retrieval defaults to
current-best article versions. Historical versions remain inspectable.

## Skill And Action Relationship

Phase 4 still preserves the human confirmation boundary for skills.

Reviewed work sessions and Knowledge Articles can provide better evidence for
future skill drafting, but source acquisition, work-session analysis, and
knowledge generation must not silently create executable skills.

Skill execution orchestration remains outside the Phase 4 source expansion MVP
unless a separate design defines confirmation and low-risk exception rules.

## Data Governance Semantics

Phase 4 MVP disable semantics:

- disabling a source immediately stops new acquisition
- existing ledgers and imported MemoryEvents remain
- existing MemoryEvents can still be used for retrieval, review, knowledge, and
  skill evidence
- source detail UI continues to show historical acquisition and audit state

Phase 4 design should define, but does not need to fully implement in MVP:

- delete historical source data
- exclude source data from retrieval/synthesis
- derived artifact handling when source data is deleted or excluded
- provenance invalidation on affected knowledge or skill drafts
- audit trails for delete/exclude/governance actions

## Acceptance Criteria

Phase 4 architecture is on track when:

- all Phase 4 sources write daily JSONL ledgers
- browser data is no longer a special direct-ingestion path
- importer scans changed ledgers on the configured runtime interval and
  supports manual import
- ledger bad lines are skipped with audit warnings rather than blocking import
- imported records are unified `MemoryEvent` values
- the standalone UI exposes memory retrieval and source management through one
  top-level `memory sources` tab
- `All Sources` exposes the original memory-tab list and pagination layout
  with only the `Import Sources` action
- Source Management UI exposes Sources and Settings for individual source
  instances, with summary metrics above source-specific memory history
- users can manually run 6h/24h/7d analysis windows
- analysis produces multiple WorkSession candidates where appropriate
- reviewed work sessions can be assigned to projects
- Knowledge Article Drafts are generated from reviewed work sessions
- knowledge is published under Project -> Topic -> Knowledge Article
- published articles support current-best versions and history

## Open Questions

- Exact schema migration path from current `MemoryEvent.content` to V2 fields.
- Whether the existing browser page-content folders become migration input,
  temporary compatibility storage, or are retired once browser ledgers exist.
- How recorder summaries choose model providers and store model-resource usage.
- How much source audit history to retain by default.
- Whether work-session split/merge belongs in the first UI slice or the second.
- How current Phase 3 topic knowledge migrates into Project -> Topic ->
  Knowledge Article.
