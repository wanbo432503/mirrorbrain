# Shell Problem Narratives

## Summary

This component generates offline shell problem-solving narratives from raw shell-history `MemoryEvent` records. It clusters adjacent shell work into issue-oriented memory units and adds inferred workspace context so MirrorBrain can answer `我之前是怎么通过命令行解决这个问题的？` style questions with higher-level sequences instead of raw commands alone.

## Responsibility Boundary

- groups shell events into session-oriented problem narratives
- infers workspace context from `cd` / `pushd` transitions when explicit cwd data is unavailable
- detects operation phases such as inspect, apply, and verify
- emits stored `MemoryNarrative` artifacts for shell problem-solving sequences
- does not read shell history files or persist artifacts itself

## Key Interfaces

- `generateShellProblemNarratives(...)`

## Data Flow

1. Receive raw shell `MemoryEvent` records.
2. Sort them by timestamp and split them into sessions by time gap.
3. Infer cwd/workspace context from directory-changing commands when possible.
4. Score each session for operation phases such as inspect/apply/verify.
5. Emit a shell `MemoryNarrative` artifact per session/workspace cluster.

## Test Strategy

- focused unit coverage in `src/workflows/shell-problem-narratives/index.test.ts`
- retrieval integration coverage through `src/integrations/agent-memory-api/memory-narratives.test.ts`
- service publishing coverage through `src/apps/mirrorbrain-service/memory-narratives.test.ts`

## Known Risks And Limitations

- cwd is inferred from command sequences, so context quality depends on explicit directory-changing commands appearing in history
- session grouping is still time-gap based and does not yet use terminal/session IDs from the shell itself
- summaries are deterministic today and are structured to be replaceable by a later richer offline narrative generator
