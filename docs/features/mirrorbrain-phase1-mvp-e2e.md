# MirrorBrain Phase 1 MVP E2E

## Summary

This feature covers the documented MVP path through the standalone UI:

- open the local MirrorBrain UI
- verify service health
- trigger browser sync
- create and review a candidate memory
- generate knowledge and skill drafts

## Test Strategy

- Playwright coverage in `tests/e2e/mirrorbrain-phase1-mvp.spec.ts`
- fixture server setup in `tests/e2e/fixtures/mirrorbrain-mvp-fixture.ts`

## Known Limitations

- the automated E2E uses a local fixture service rather than real ActivityWatch and OpenViking processes
- real dependency startup is still validated separately through the local runtime path
