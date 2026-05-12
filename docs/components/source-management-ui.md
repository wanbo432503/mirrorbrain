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
- showing source-specific audit records from `GET /sources/audit`
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
- `MirrorBrainWebAppApi.listSourceAuditEvents`
- `MirrorBrainWebAppApi.listSourceStatuses`

Backend API surfaces consumed by the component:

- `POST /sources/import`
- `GET /sources/audit`
- `GET /sources/status`

The API responses use `SourceLedgerImportResult`, `SourceAuditEvent`, and
`SourceInstanceSummary` from the shared React type declarations.

## Data Flow

1. The user opens the top-level `sources` tab.
2. The app calls `GET /sources/status` and selects the first returned source.
3. The app calls `GET /sources/audit` with the selected source kind and
   instance id.
4. The selected source detail panel displays overview, recent memory placeholder,
   audit, and settings tabs.
5. When the user clicks `Import Now`, the app calls `POST /sources/import` and
   then reloads source statuses.

## Failure Modes And Operational Constraints

- Empty source state renders an empty operational view instead of inventing
  source records.
- Audit events are displayed as operational evidence only; they are not memory
  outputs and must not be used as reviewed memory, knowledge, or skill evidence.
- Source enablement and recorder status are read-only until recorder supervision
  and source configuration APIs are added.
- Recent memory is intentionally a placeholder until a source-filtered memory
  query endpoint exists.

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
