# Source Ledger Import Workflow

## Summary

The source ledger import workflow scans MirrorBrain's Phase 4 daily JSONL
ledger directory, runs changed ledgers through the source ledger importer, and
persists normalized `MemoryEvent` and `SourceAuditEvent` outputs through
injected writers. It is the orchestration layer between ledger files and
MirrorBrain storage.

The workflow keeps source acquisition behind the ledger boundary. It reads
ledger files; it does not collect browser, file, shell, screenshot, or agent
activity.

## Responsibility Boundary

This workflow is responsible for:

- locating daily ledger files under `<workspaceDir>/mirrorbrain/ledgers`
- importing `*.jsonl` files in deterministic order
- reading and writing per-ledger checkpoints
- calling `importSourceLedgerText(...)` for line-level validation and
  normalization
- persisting imported `MemoryEvent` records through injected dependencies
- persisting operational `SourceAuditEvent` records through injected
  dependencies
- exposing the default 30-minute scan cadence as a configuration surface

This workflow is not responsible for:

- source recorder execution
- source authorization or source-instance configuration
- OpenViking or filesystem persistence details
- UI presentation
- work-session analysis, knowledge generation, or skill drafting

## Key Interfaces

- `importChangedSourceLedgers(...)`
- `getSourceLedgerImportSchedule()`
- `SourceLedgerImportResult`

`importChangedSourceLedgers` accepts workspace path, authorization scope id, and
import timestamp. Persistence, audit, and checkpoint behavior are dependency
injected so the service layer can choose the durable backend.

## Data Flow

1. Resolve `<workspaceDir>/mirrorbrain/ledgers`.
2. List date subdirectories and `*.jsonl` ledger files.
3. Read each ledger's `SourceLedgerImportCheckpoint`.
4. Import only lines after the checkpoint.
5. Write imported memory events.
6. Write audit events for imported and skipped lines.
7. Persist the next checkpoint for each scanned ledger.

## Inputs And Outputs

Inputs:

- `workspaceDir`
- `authorizationScopeId`
- `importedAt`
- checkpoint reader/writer
- memory event writer
- source audit writer

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
- Checkpoints are currently line-number based. A later scanner can add
  file-size or mtime prefiltering without changing the workflow contract.
- The workflow does not decide whether a source is authorized; the caller must
  pass only an authorization scope that is valid for the import operation.

## Test Strategy

Unit tests live beside the workflow:

```bash
pnpm vitest run src/workflows/source-ledger-import/index.test.ts
```

The tests cover daily ledger scanning, imported memory-event writes, audit-event
writes, bad-line continuation, checkpointed manual import behavior, and the
30-minute scan schedule.
