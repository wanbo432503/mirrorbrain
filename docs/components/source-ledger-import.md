# Source Ledger Import Workflow

## Summary

The source ledger import workflow scans MirrorBrain's Phase 4 daily JSONL
ledger directory, runs changed ledgers through the source ledger importer, and
persists normalized `MemoryEvent` and `SourceAuditEvent` outputs through
injected writers. It is the orchestration layer between ledger files and
MirrorBrain storage.

The workflow also provides the default polling loop used by the local runtime.
That loop runs one import immediately on startup and then repeats at the
configured scan interval. The lower-level workflow exposes a 30-minute default
schedule, while the MirrorBrain service local runtime supplies a one-minute
interval so newly captured source-ledger records are imported promptly.

The workflow keeps source acquisition behind the ledger boundary for activity
records. The ActivityWatch browser ledger bridge now tries to fetch readable
page text before writing `browser.jsonl`; this importer also keeps a fallback
for older or third-party browser ledger entries whose `page_content` is empty,
title-only, URL-only, or a title-plus-URL placeholder. In those sparse cases it
performs a best-effort readable page fetch before writing the resulting
`MemoryEvent`, so downstream review and knowledge generation have substantive
page text instead of URL-only placeholders.

## Responsibility Boundary

This workflow is responsible for:

- locating daily ledger files under `<workspaceDir>/mirrorbrain/ledgers`
- importing `*.jsonl` files in deterministic order
- reading and writing per-ledger checkpoints
- calling `importSourceLedgerText(...)` for line-level validation and
  normalization
- persisting imported `MemoryEvent` records through injected dependencies
- enriching sparse browser ledger entries with readable page text before the
  memory write
- persisting operational `SourceAuditEvent` records through injected
  dependencies
- exposing the default 30-minute scan cadence as a workflow-level configuration
  surface
- starting and stopping a runtime polling loop for scheduled imports

This workflow is not responsible for:

- source recorder execution
- broad crawling or refetching pages that already contain useful ledger text
- source-instance configuration storage
- QMD workspace persistence details
- UI presentation
- work-session analysis, knowledge generation, or skill drafting

## Key Interfaces

- `importChangedSourceLedgers(...)`
- `getSourceLedgerImportSchedule()`
- `startSourceLedgerImportPolling(...)`
- `SourceLedgerImportResult`

`importChangedSourceLedgers` accepts workspace path, authorization scope id, and
import timestamp. Persistence, audit, and checkpoint behavior are dependency
injected so the service layer can choose the durable backend.

## Data Flow

1. The local runtime starts `startSourceLedgerImportPolling(...)`.
2. The polling loop runs one import immediately and schedules later ticks.
3. Each import resolves `<workspaceDir>/mirrorbrain/ledgers`.
4. The workflow lists date subdirectories and `*.jsonl` ledger files.
5. The workflow reads each ledger's `SourceLedgerImportCheckpoint`.
6. The workflow imports only lines after the checkpoint.
7. When the caller provides a source enablement callback, the workflow checks
   each imported event's source kind and instance before memory writes.
8. Browser events with sparse `page_content` fetch readable page text from the
   ledger URL. Fetch failures fall back to the original ledger content and do
   not fail the import.
9. The workflow writes imported memory events for enabled source instances.
10. The workflow writes audit events for imported lines, malformed skipped
   lines, and disabled-source skipped events.
11. The workflow persists the next checkpoint for each scanned ledger.

## Inputs And Outputs

Inputs:

- `workspaceDir`
- `authorizationScopeId`
- `importedAt`
- checkpoint reader/writer
- memory event writer
- source audit writer
- optional browser page-content fetcher
- optional source enablement callback

Outputs:

- imported event count
- skipped bad-line count
- scanned ledger count
- changed ledger count
- per-ledger result summaries

## Failure Modes And Operational Constraints

- Missing ledger root is treated as an empty import.
- A malformed line does not fail the whole workflow because line-level failures
  are handled by the importer.
- Filesystem read failures outside a missing ledger root are surfaced to the
  caller.
- Scheduled import failures do not stop future polling ticks.
- Browser page fetch failures are non-fatal and preserve the original imported
  event.
- Browser enrichment only runs for sparse `page_content`, currently empty text,
  title-only text, URL-only text, or title-plus-URL placeholders.
- Checkpoints are currently line-number based. A later scanner can add
  file-size or mtime prefiltering without changing the workflow contract.
- The workflow does not own authorization policy, but it can enforce the
  caller's per-source-instance enablement callback before any memory write.

## Test Strategy

Unit tests live beside the workflow:

```bash
pnpm vitest run src/workflows/source-ledger-import/index.test.ts
```

The tests cover daily ledger scanning, imported memory-event writes, audit-event
writes, disabled source-instance skips before memory writes, bad-line
continuation, checkpointed manual import behavior, sparse browser page-content
enrichment, the 30-minute scan schedule, and polling start/stop behavior.
