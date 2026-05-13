# Source Directory Audit

## Summary

This document records the current `src/` directory ownership after removing
legacy frontend and OpenViking storage code. The active source tree is now
QMD-backed and React-UI-first.

## Responsibility Boundary

This audit is responsible for identifying whether source folders are active,
legacy, or generated. It does not define product behavior by itself; component
documents remain the source of operational detail.

## Current Decisions

| Directory | Status | Reason |
| --- | --- | --- |
| `src/apps/mirrorbrain-http-server` | active | Serves the HTTP API and static React build output. |
| `src/apps/mirrorbrain-service` | active | Owns service orchestration and API behavior. |
| `src/apps/mirrorbrain-web-react` | active | Current Vite/React Web UI used by startup scripts and tests. |
| `src/apps/mirrorbrain-web-react/dist` | generated | React build output, not hand-authored source. |
| `src/apps/mirrorbrain-web-react/node_modules` | dependency install | Local dependency folder for the nested React app package. |
| `src/integrations/activitywatch-browser-source` | active | Authorized browser source adapter. |
| `src/integrations/browser-page-content` | active | Browser page text extraction and QMD storage metadata shaping. |
| `src/integrations/file-sync-checkpoint-store` | active | Local sync checkpoint persistence. |
| `src/integrations/knowledge-article-store` | active | Knowledge article storage. |
| `src/integrations/openclaw-plugin-api` | active | Plugin-facing capability adapter. |
| `src/integrations/qmd-workspace-store` | active | Default workspace storage and retrieval adapter. |
| `src/integrations/shell-history-source` | active | Authorized shell history source adapter. |
| `src/integrations/source-ledger-recorders` | active | Source ledger capture helpers. |
| `src/integrations/source-ledger-state-store` | active | Source ledger state and audit persistence. |
| `src/modules/*` | active | Domain modules for memory, knowledge, authorization, and skills. |
| `src/shared/*` | active | Shared contracts, config, LLM title helpers, and types. |
| `src/workflows/*` | active | Capture, sync, review, knowledge, and skill workflows. |

Removed folders:

- `src/apps/mirrorbrain-web`: legacy vanilla TypeScript Web UI replaced by
  `src/apps/mirrorbrain-web-react`.
- `src/integrations/openviking-store`: legacy OpenViking storage adapter
  replaced by `src/integrations/qmd-workspace-store`.

## Key Interfaces

- Runtime startup uses `scripts/start-mirrorbrain-dev.ts`.
- React Web UI build uses `scripts/build-react-webui.ts`.
- Durable storage interfaces live in `src/integrations/qmd-workspace-store`.

## Verification

Run these checks after source-tree cleanup:

```bash
pnpm vitest run
pnpm typecheck
pnpm --dir src/apps/mirrorbrain-web-react exec vitest run
pnpm --dir src/apps/mirrorbrain-web-react build
```

## Risks And Constraints

- Do not reintroduce a second durable workspace for storage/indexing.
- Historical planning docs may still mention OpenViking as prior Phase 1
  context; current runtime docs should point to QMD.
- Generated React `dist` output and nested `node_modules` are not source
  ownership boundaries.
