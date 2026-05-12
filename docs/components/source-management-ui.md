# Source Management UI

## Summary

The Source Management UI is the React control surface for MirrorBrain Phase 4
source ledger operations. It gives the standalone MirrorBrain app a top-level
`sources` tab for inspecting source instances, reading importer audit events,
and manually triggering the ledger import workflow.

This UI is an operational surface. It does not collect activity directly and it
does not convert operational audit state into memory, knowledge, or skill
artifacts.

## Responsibility Boundary

This component is responsible for:

- exposing source status summaries from `GET /sources/status`
- showing recent imported memory records from `GET /memory` with source filters
- showing source-specific audit records from `GET /sources/audit`
- enabling or disabling source instances through `PATCH /sources/config`
- triggering manual source ledger import through `POST /sources/import`
- keeping the source management experience separate from memory review,
  knowledge review, and skill execution tabs

This component is not responsible for:

- running source recorders
- deciding source authorization or revocation policy
- normalizing ledger entries into memory events
- reviewing candidate memories
- generating knowledge or skill artifacts

## Key Interfaces

Frontend entry points:

- `SourceManagementPanel`
- `MirrorBrainWebAppApi.importSourceLedgers`
- `MirrorBrainWebAppApi.listMemory`
- `MirrorBrainWebAppApi.listSourceAuditEvents`
- `MirrorBrainWebAppApi.listSourceStatuses`
- `MirrorBrainWebAppApi.updateSourceConfig`

Backend API surfaces consumed by the component:

- `POST /sources/import`
- `GET /memory?sourceKind=...&sourceInstanceId=...`
- `GET /sources/audit`
- `GET /sources/status`
- `PATCH /sources/config`

The API responses use `SourceLedgerImportResult`, `SourceAuditEvent`,
`SourceInstanceSummary`, and `MemoryEvent` from the shared React type
declarations.

## Data Flow

1. The user opens the top-level `sources` tab.
2. The app calls `GET /sources/status` and selects the first returned source.
3. The app calls `GET /sources/audit` with the selected source kind and
   instance id.
4. The app calls `GET /memory` with the same selected source kind and instance
   id to populate Recent Memory.
5. The selected source detail panel displays overview, recent memory, audit,
   and settings tabs.
6. When the user enables or disables a source, the app calls
   `PATCH /sources/config`, writes audit-backed config through the service, and
   reloads source statuses.
7. When the user clicks `Import Now`, the app calls `POST /sources/import` and
   then reloads source statuses.

## Failure Modes And Operational Constraints

- Empty source state renders an empty operational view instead of inventing
  source records.
- Audit events are displayed as operational evidence only; they are not memory
  outputs and must not be used as reviewed memory, knowledge, or skill evidence.
- Source enablement is persisted and audited. Recorder status remains read-only
  until recorder supervision reports real runtime state.
- Recent memory shows imported `MemoryEvent` records for the selected source.
  It remains read-only; review and knowledge synthesis still happen through
  their explicit workflows.

## Test Strategy

Unit and integration-style component tests live with the React app:

```bash
pnpm --dir src/apps/mirrorbrain-web-react exec vitest run \
  src/api/client.test.ts \
  src/components/sources/SourceManagementPanel.test.tsx \
  src/App.test.tsx
```

The tests cover source API client calls, source status/audit rendering, manual
import feedback, and the top-level `sources` tab integration.
