# Source Management UI

## Summary

The Source Management UI is the React control surface for MirrorBrain Phase 4
source ledger operations. It gives the standalone MirrorBrain app a unified
top-level `memory sources` tab for reading global memory events, importing
source ledgers, inspecting source instances, and browsing source-specific
memory history.

This UI is an operational surface. It does not collect activity directly and it
does not convert operational audit state into memory, knowledge, or skill
artifacts.

## Responsibility Boundary

This component is responsible for:

- exposing source status summaries from `GET /sources/status`
- embedding the original memory-tab list and pagination layout under
  `All Sources`, with only the `Import Sources` action visible
- preserving a flex-based right panel layout for `All Sources`, where the
  memory list owns the vertical scrollbar and pagination remains reachable at
  the bottom of the panel
- preserving the same flex-based containment for individual source detail
  panels, where the source header and tabs stay inside the right panel and only
  source-history records scroll within the tab body
- placing source status summary metrics at the top of the individual source
  `Sources` subtab, directly below the subtab row and above the memory event
  list
- showing source-specific imported memory records from `GET /memory` with
  source filters and pagination
- presenting user-facing source labels such as `Agent`, `Browser`, `Files`,
  `Screenshot`, `Shell`, and `Audio` instead of exposing internal `*-main`
  source instance ids as navigation names
- enabling or disabling source instances through `PATCH /sources/config`
- keeping memory source management separate from memory review, knowledge
  review, and skill execution tabs

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
- `MirrorBrainWebAppApi.listSourceStatuses`
- `MirrorBrainWebAppApi.updateSourceConfig`

Backend API surfaces consumed by the component:

- `POST /sources/import`
- `GET /memory?sourceKind=...&sourceInstanceId=...`
- `GET /sources/status`
- `PATCH /sources/config`

The API responses use `SourceLedgerImportResult`, `SourceInstanceSummary`, and
`MemoryEvent` from the shared React type declarations.

## Data Flow

1. The user opens the top-level `memory sources` tab.
2. The app calls `GET /sources/status` and selects `All Sources`.
3. The right panel mounts the memory list and pagination layout directly,
   without an extra subtab.
4. The memory panel calls `GET /memory` without source filters to populate the
   global memory event list.
5. When the user clicks `Import Sources`, the memory panel calls
   `POST /sources/import`, displays feedback to the left of the button, and
   refreshes global memory events.
6. When the user selects an individual source, the app calls `GET /memory`
   with the selected source kind and instance id to populate the `Sources`
   history tab.
7. The selected source detail panel displays only `Sources` and `Settings`
   tabs.
8. The `Sources` tab first shows the source summary metrics that used to live
   in `Overview`, then shows paginated source history so the user can browse
   all imported records for that source instead of only a fixed recent subset.
9. When the user enables or disables a source, the app calls
   `PATCH /sources/config`, writes audit-backed config through the service, and
   reloads source statuses.

## Failure Modes And Operational Constraints

- Empty source state renders an empty operational view instead of inventing
  source records.
- Source enablement is persisted and audited. Recorder status remains read-only
  until recorder supervision reports real runtime state.
- The `Audio` source represents authorized audio-recording ledger imports.
  This UI only displays, imports, and configures the source; it does not start
  microphone capture.
- Legacy `agent-transcript` / `openclaw-main` source summaries are hidden from
  the left rail because the current product-facing source is the normalized
  `Agent` sessions source.
- Source history shows imported `MemoryEvent` records for the selected source.
  It remains read-only; review and knowledge synthesis still happen through
  their explicit workflows.
- The `All Sources` right panel must remain a `min-height: 0` flex column.
  The memory event list is the only vertically scrolling region; the import
  action row and pagination footer stay outside that scroll area so resizing
  the app does not hide pagination controls below the panel boundary.
- Individual source detail panels must also remain `min-height: 0` flex
  columns. The selected source header, tab row, active tab body, source-history
  summary, source-history list, and pagination footer are separate flex regions
  so records for Agent, Browser, Files, Screenshot, Audio, and Shell stay inside
  the application viewport.

## Test Strategy

Unit and integration-style component tests live with the React app. Run from
`src/apps/mirrorbrain-web-react`:

```bash
corepack pnpm vitest run \
  src/api/client.test.ts \
  src/components/sources/SourceManagementPanel.test.tsx \
  src/App.test.tsx
```

The tests cover source API client calls, source status rendering inside the
`Sources` subtab, source history pagination, removal of the single-source
overview/audit/import controls, manual global import feedback, the `All
Sources` global memory view, user-facing source labels including Screenshot and
Audio, flex right-panel scroll boundaries for both global and individual
source detail views, and the top-level `memory sources` tab integration.
