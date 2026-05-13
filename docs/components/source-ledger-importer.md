# Source Ledger Importer

## Summary

The source ledger importer is the first Phase 4 acquisition boundary. It reads
MirrorBrain-owned daily JSONL ledger text, validates ledger entry envelopes, and
normalizes valid entries into source-attributed `MemoryEvent` records. The
implementation supports the initial Phase 4 built-in source kinds: `browser`,
`file-activity`, `screenshot`, `audio-recording`, `shell`, and `agent`.

This component is intentionally downstream of recorders. It does not collect
browser, file, shell, screenshot, audio, or agent activity. Recorders write
ledgers; the importer converts those ledgers into MirrorBrain memory evidence.

## Responsibility Boundary

This component is responsible for:

- parsing daily JSONL ledger lines
- validating the common source ledger envelope
- validating source-specific payloads for supported built-in source kinds
- deriving deterministic `sourceRef` and `MemoryEvent.id` values from stable
  source fields
- normalizing source ledger entries into `MemoryEvent.content.contentKind`
  values such as `browser-page`, `file-activity`, `screenshot`,
  `audio-recording`, `shell-command`, and `agent-session`
- emitting `SourceAuditEvent` records for imported entries and skipped bad
  lines
- advancing a line-number checkpoint so manual re-import can process only new
  ledger entries

This component is not responsible for:

- running source recorders
- writing ledger files
- scheduling 30-minute scans
- persisting `MemoryEvent` or `SourceAuditEvent` records
- authorizing source capture or source import
- generating candidate memories, work sessions, knowledge, or skills

## Key Interfaces

- `importSourceLedgerText(...)`
- `SourceLedgerEntry`
- `SourceLedgerImportCheckpoint`
- `SourceAuditEvent`

`importSourceLedgerText` accepts ledger text, ledger path, authorization scope,
optional checkpoint, and import timestamp. It returns imported `MemoryEvent`
records, operational audit events, and the next checkpoint.

## Data Flow

1. A recorder writes one source entry per JSONL line under a daily ledger path
   such as `ledgers/2026-05-12/browser.jsonl`.
2. The importer skips lines before the current checkpoint.
3. Each remaining line is parsed and validated against the common envelope.
4. Supported source payloads are normalized into `MemoryEvent` values.
5. Invalid or malformed lines are skipped with warning audit events, and later
   lines continue to import.
6. The returned checkpoint advances beyond the last processed line.

## Key Data Structures

Browser ledger payloads require:

```ts
interface BrowserLedgerPayload {
  id: string | number;
  title: string;
  url: string;
  page_content: string;
}
```

Imported browser entries become memory events with:

- `sourceType = "browser"`
- `captureMetadata.upstreamSource = "source-ledger:browser"`
- `content.contentKind = "browser-page"`
- URL entity attribution in `content.entities`
- browser payload details under `content.sourceSpecific`

Other supported payloads map into the same V2 content shape:

- file activity: file entity, optional full-content `bodyRef`, and
  `contentKind = "file-activity"`
- screenshot: app entity, optional retained-image `bodyRef`, and
  `contentKind = "screenshot"`
- audio recording: app entity, optional retained-audio `bodyRef`, and
  `contentKind = "audio-recording"`
- shell: command/cwd entities and `contentKind = "shell-command"`
- agent session: agent entity, transcript/session `bodyRef`, and
  `contentKind = "agent-session"`

## Dependencies

- Node `crypto` for deterministic SHA-256 based identity hashes.
- Shared `MemoryEvent` type from `src/shared/types`.

The module currently has no filesystem dependency. File scanning and persistence
belong in later workflow or integration layers.

## Failure Modes And Operational Constraints

- Malformed JSON lines are skipped with `schema-validation-failed` audit events.
- Schema-invalid entries are skipped with warning audit events and a truncated
  bad-line sample.
- A bad line does not block subsequent ledger entries.
- If a ledger file is truncated or rewritten and the saved checkpoint points
  beyond the current line count, import restarts from the first line for that
  ledger instead of skipping the whole file.
- Unsupported future source kinds are treated as schema failures until their
  built-in normalizers are implemented.
- Audio-recording support only imports existing authorized audio ledgers. It
  does not perform microphone capture or transcribe recordings.
- Checkpoints are line-number based for the current text importer. A later file
  scanner may add file size, mtime, or byte-offset checks without changing this
  module's memory-event boundary.

## Test Strategy

Unit tests live beside the implementation:

```bash
pnpm vitest run src/modules/source-ledger-importer/index.test.ts
```

The tests cover all initial built-in source normalizers, warning audit behavior
for bad lines, continuation after invalid input, and checkpointed manual
re-import.
