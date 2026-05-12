# Source Ledger Recorders

## Summary

`src/integrations/source-ledger-recorders` provides the concrete Phase 4
recorder starter used by the source recorder supervisor and wired by the
MirrorBrain runtime service. It writes captured built-in source records to daily
JSONL ledgers under
`<workspaceDir>/mirrorbrain/ledgers/YYYY-MM-DD/<source-kind>.jsonl`.

## Responsibility Boundary

The integration owns:

- Creating a `startRecorder(...)` function compatible with
  `startSourceRecorderSupervisor(...)`.
- Calling an injected built-in source capture function.
- Wrapping captured payloads in the shared source-ledger envelope.
- Appending ledger entries to the correct daily source file.
- Returning a stop handle for optional interval capture.

The integration does not own:

- Source-specific OS/browser/shell capture mechanics.
- Ledger import into `MemoryEvent` records.
- Source authorization decisions.
- Knowledge, work-session, or skill generation.
- Historical deletion or derived-artifact invalidation.

## Key Interfaces

- `createBuiltInSourceLedgerRecorderStarter(...)`
- `CapturedSourceRecord`

Input:

- `workspaceDir`
- `now()`
- `captureSourceRecord(source)`
- optional `intervalMs`

Output:

- `BuiltInSourceLedgerRecorderStarter`, a function that starts a recorder for a
  `SupervisedSourceInstance`.

## Data Flow

1. The MirrorBrain service resolves enabled source instances from defaults plus
   persisted source configuration.
2. The supervisor starts an enabled source instance.
3. The built-in starter calls `captureSourceRecord(source)`.
4. If capture returns `null`, no ledger entry is written.
5. If capture returns a record, the starter wraps it in `SourceLedgerEntry`.
6. The entry is appended to the daily JSONL ledger for the source kind.
7. Later importer workflows turn ledger entries into normalized `MemoryEvent`
   records.

## Failure Modes And Constraints

- This integration writes ledgers only; it never writes `MemoryEvent` records
  directly.
- Capture functions must already enforce source-specific authorization and
  redaction before returning payloads.
- A stopped recorder clears the optional polling interval but does not delete
  existing ledgers.

## Test Strategy

Unit tests live in `src/integrations/source-ledger-recorders/index.test.ts`.

The tests verify that a built-in browser recorder writes the expected daily
JSONL ledger envelope and can be stopped through the returned handle.
