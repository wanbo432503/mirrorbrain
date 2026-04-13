# MirrorBrain Web

Minimal standalone UI shell for the Phase 1 MVP.

Current responsibility:

- render the Phase 1 review workflow state through tabbed sections
- orchestrate browser sync, shell sync, daily candidate generation, AI review suggestions, explicit review, and artifact generation through an injected API
- keep imported memory readable through client-side paging in the standalone MVP UI
- merge a recent `importedEvents` preview from sync responses into local UI state so newly synced memory can appear immediately without waiting for a full backend re-read

Current limitation:

- this directory contains the TypeScript source and static shell files for the MVP UI
- local serving and startup wiring are handled by `pnpm dev` through `scripts/start-mirrorbrain-dev.ts`
- paging is currently local-only and does not yet request paginated memory from the backend API
- candidate selection and AI suggestions are still MVP-level and do not yet support editing, merge, or semantic regrouping
