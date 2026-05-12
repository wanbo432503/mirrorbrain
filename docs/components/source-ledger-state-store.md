# Source Ledger State Store

## Summary

The source ledger state store is the local durable state layer for Phase 4
ledger import operations. It stores per-ledger import checkpoints, operational
`SourceAuditEvent` records, and source-instance configuration under the
MirrorBrain workspace.

This store keeps operational source metadata separate from user work evidence.
Audit events are not memory events and must not be used directly for memory
retrieval, work-session clustering, knowledge generation, or skill evidence.

## Responsibility Boundary

This component is responsible for:

- reading and writing `SourceLedgerImportCheckpoint` records by ledger path
- writing `SourceAuditEvent` records
- listing audit events with source-kind and source-instance filters
- reading and writing source-instance enablement configuration
- deriving source instance summaries for Source Management views

This component is not responsible for:

- importing ledger files
- normalizing ledger entries into `MemoryEvent` records
- deciding source authorization
- running recorders or import schedules
- persisting user-work memory evidence

## Storage Layout

All files live under `<workspaceDir>/mirrorbrain/`:

- `state/source-ledger-checkpoints/*.json`: per-ledger line checkpoints
- `source-audit-events/*.json`: operational audit event records
- `source-instance-configs/*.json`: source enablement and update metadata

File names are encoded from ledger paths or event ids. The JSON payload remains
the authoritative record.

## Key Interfaces

- `createFileSourceLedgerStateStore(...)`
- `readCheckpoint(ledgerPath)`
- `writeCheckpoint(checkpoint)`
- `writeSourceAuditEvent(event)`
- `listSourceAuditEvents(filter)`
- `writeSourceInstanceConfig(config)`
- `listSourceInstanceConfigs()`
- `listSourceInstanceSummaries()`

## Data Flow

1. The source ledger import workflow asks the store for a checkpoint.
2. The workflow imports new ledger lines.
3. The workflow writes imported memory events elsewhere and writes audit events
   to this store.
4. The workflow writes the next checkpoint.
5. Source Management writes source enablement configuration through this store.
6. Source Management callers list audit records and derived summaries from this
   store.

## Failure Modes And Operational Constraints

- Missing checkpoint, audit, or config directories are treated as empty state.
- Corrupt JSON files surface as read errors to the caller.
- Source summaries are derived from available audit/checkpoint records and
  therefore may be incomplete before any import or recorder audit has occurred.
- A disabled source summary reports `lifecycleStatus: disabled` and
  `recorderStatus: stopped`; this does not delete existing memory events.
- Recorder status is currently `unknown` until recorder supervision is wired.

## Test Strategy

Unit tests live beside the implementation:

```bash
pnpm vitest run src/integrations/source-ledger-state-store/index.test.ts
```

The tests cover checkpoint persistence, audit filtering, audit ordering,
source-instance config persistence, and derived source status summaries.
