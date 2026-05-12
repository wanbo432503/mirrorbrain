# Source Recorder Supervisor

## Summary

The source recorder supervisor is the Phase 4 lifecycle component for
MirrorBrain-owned source recorders. It starts enabled source instances, skips
disabled source instances, and writes operational `SourceAuditEvent` lifecycle
records.

This supervisor does not collect activity by itself. Concrete recorder
implementations remain responsible for writing daily JSONL ledgers.

## Responsibility Boundary

This component is responsible for:

- starting enabled source recorder instances
- skipping disabled source instances
- stopping running recorder handles
- writing `recorder-started`, `recorder-stopped`, and `recorder-disabled` audit
  events

This component is not responsible for:

- browser, file, shell, screenshot, or transcript acquisition
- ledger entry schema normalization
- importing ledger files into `MemoryEvent` records
- deleting historical data when a source is disabled

## Key Interfaces

- `startSourceRecorderSupervisor(...)`
- `SupervisedSourceInstance`
- `SourceRecorderHandle`

Recorder startup is dependency injected so built-in recorder implementations can
be added without changing the supervisor lifecycle contract.

## Data Flow

1. The caller provides source instances with `enabled` state.
2. Enabled source instances are passed to `startRecorder(...)`.
3. Disabled source instances are skipped and audited.
4. On `stop()`, running recorder handles are stopped and audited.

## Failure Modes And Operational Constraints

- Disabled sources must not start recorder acquisition.
- Audit events are operational metadata and do not become memory evidence.
- Restart/backoff policy is not implemented in this first supervisor slice.

## Test Strategy

Unit tests live beside the implementation:

```bash
pnpm vitest run src/workflows/source-recorder-supervisor/index.test.ts
```

The tests cover enabled recorder startup, disabled-source skipping, lifecycle
audit events, and stop behavior.
