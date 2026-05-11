# Shell History Source

## Summary

This component is MirrorBrain's first shell-memory ingestion adapter. It reads an explicitly authorized shell history file, parses timestamped command entries, and normalizes them into source-attributed shell memory events.

## Responsibility Boundary

This component is responsible for:

- reading an authorized shell history file
- parsing supported history formats into timestamped shell entries
- redacting common secret-bearing command fragments before MirrorBrain persistence
- deriving persisted shell event identifiers from redacted command text
- filtering entries to the requested sync window
- normalizing shell entries into `MemoryEvent` records

This component is not responsible for:

- inferring shell task narratives
- reconstructing working directories or terminal output
- scanning arbitrary files outside the authorized history path

## Key Interfaces

- `parseShellHistory(...)`
- `readShellHistory(...)`
- `sanitizeShellCommand(...)`
- `normalizeShellHistoryEntry(...)`
- `createShellHistoryMemorySourcePlugin(...)`

## Data Flow

1. The caller passes an authorized history path plus a sync window.
2. The adapter reads the file and parses supported shell-history lines.
3. Parsed entries are filtered to the requested time range.
4. Each retained entry is normalized into a `MemoryEvent` with:
   - `sourceType: shell-history`
   - an `id` and `sourceRef` rebuilt from the redacted command
   - the redacted command
   - a derived `commandName`
   - `redactionApplied: true` when MirrorBrain changed the command before storage
   - provenance in `captureMetadata`

## Test Strategy

- unit tests in [src/integrations/shell-history-source/index.test.ts](/Users/wanbo/Workspace/mirrorbrain/src/integrations/shell-history-source/index.test.ts)
- workflow integration coverage in [src/workflows/shell-memory-sync/index.test.ts](/Users/wanbo/Workspace/mirrorbrain/src/workflows/shell-memory-sync/index.test.ts)

## Failure Modes And Limitations

- the first implementation only supports zsh extended history lines
- malformed or untimestamped lines are ignored
- command redaction is best-effort and protects MirrorBrain storage, including command-derived shell memory identifiers; it does not alter the user's original shell history file
- no shell-output, cwd, or session reconstruction is attempted yet
- deduplication is currently record-id based after parsing
