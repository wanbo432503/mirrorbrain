# Agent Memory Tool Example

## Summary

This feature doc describes the minimum agent-client-side example for consuming MirrorBrain memory retrieval in agent API.

The example stays intentionally narrow:

- expose a single `query_memory` tool
- forward `query`, optional `time_range`, and optional `source_types`
- call MirrorBrain's theme-level memory retrieval contract
- compose the final chat answer by summarizing returned results in order
- append a lightweight source hint to each result paragraph

## Responsibility Boundary

This example is for:

- demonstrating the minimum host-side wiring shape
- documenting the tool surface MirrorBrain expects
- showing how to turn ordered retrieval results into a user-facing answer

It is not for:

- defining the full agent-client runtime
- prescribing advanced agent policies
- replacing the eventual host-native implementation

## Key Interfaces

- `src/integrations/agent-memory-api/query-memory-tool-example.ts`
- `createQueryMemoryToolExample(...)`
- `composeQueryMemoryAnswer(...)`
- MirrorBrain `POST /memory/query`

## Example Flow

1. The user asks a chat question such as `我昨天做了什么？`
2. The host agent decides this is a memory-retrieval question.
3. The host calls `query_memory` with:
   - `query`
   - optional `time_range`
   - optional `source_types`
4. The example tool forwards that request to MirrorBrain.
5. MirrorBrain returns theme-level memory results.
6. If MirrorBrain returns a top-level explanation, the example answer composer keeps it as a short preface.
7. The example answer composer then summarizes those results in order and attaches a short source hint to each paragraph.

## Output Shape

The example expects each returned memory result to include at least:

- `theme` or `title`
- `summary`
- `timeRange`
- a small list of representative `sourceRefs`
- optionally a top-level `explanation`

The example answer then emits one paragraph per result, preserving order.

## Test Strategy

- unit coverage in `src/integrations/agent-memory-api/query-memory-tool-example.test.ts`
- broader retrieval contract coverage in `src/integrations/agent-memory-api/index.test.ts`

## Known Limitations

- the example does not cover knowledge or skill usage
- the answer composer currently assumes result order is already meaningful
- the answer composer only prepends explanation text and does not yet rewrite it into host-native phrasing
- source hints are intentionally lightweight and do not expand into full evidence blocks
