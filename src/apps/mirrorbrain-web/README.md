# MirrorBrain Web

Minimal standalone UI shell for the Phase 1 MVP.

Current responsibility:

- render the Phase 1 review workflow state through tabbed sections
- orchestrate sync, candidate creation, review, and artifact generation through an injected API
- keep imported memory readable through client-side paging in the standalone MVP UI

Current limitation:

- this directory contains the TypeScript source and static shell files for the MVP UI
- local serving and startup wiring are handled by `pnpm dev` through `scripts/start-mirrorbrain-dev.ts`
- paging is currently local-only and does not yet request paginated memory from the backend API
