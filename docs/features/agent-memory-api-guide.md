# Agent Memory API Guide

## Summary

This guide is the minimum agent API manual demo path for MirrorBrain inside an agent client.

The goal is not to validate every capability. The goal is to prove one thing first:

- agent clients can successfully call MirrorBrain memory retrieval for a realistic chat question

The canonical demo question is:

- `我昨天做了什么？`

## Preconditions

Before running this demo, all of the following should already be true:

- `ActivityWatch` is running locally
- `aw-watcher-web` is installed and actively producing browser events
- MirrorBrain dependencies are configured in `.env`
- `pnpm dev` has been run successfully and reported the MirrorBrain service address

Recommended references:

- repository setup in [README.md](../../README.md)
- startup runtime details in [local-runtime.md](../components/local-runtime.md)
- minimum agent API example in [agent-memory-tool-example.md](./agent-memory-tool-example.md)

## Happy Path

### 1. Confirm MirrorBrain Is Running

Start MirrorBrain:

```bash
pnpm dev
```

Expected result:

- the startup CLI reports no blocking configuration or dependency problems
- MirrorBrain is launched as a background process
- the command prints:
  - service address
  - process id
  - log path
  - next-step hints

### 2. Confirm MirrorBrain HTTP Retrieval Surface

Open the service docs:

```text
http://127.0.0.1:3007/docs
```

At minimum, confirm these endpoints exist:

- `GET /memory`
- `POST /memory/query`

This verifies that the raw-memory surface and the theme-level retrieval surface are both available.

### 3. Wire The Minimum agent clients Tool

In an agent client, expose a `query_memory` tool that:

- accepts `query`
- optionally accepts `time_range`
- optionally accepts `source_types`
- forwards the request to MirrorBrain `POST /memory/query`

Use the example shape described in [agent-memory-tool-example.md](./agent-memory-tool-example.md).

### 4. Ask The Demo Question In Chat

In an agent client chat, ask:

```text
我昨天做了什么？
```

Expected host-side behavior:

- the agent decides this is a memory-retrieval question
- the agent calls `query_memory`
- the tool forwards the request to MirrorBrain
- MirrorBrain returns theme-level results
- the agent client summarizes those results in order
- each paragraph includes a lightweight source hint

### 5. Validate The Visible Success Signal

The primary success signal is:

- chat returns a reasonable answer informed by MirrorBrain memory retrieval

What "reasonable" means for this first demo:

- the answer reflects 1 to 3 major themes or tasks from yesterday
- the answer reads like a natural response, not a raw JSON dump
- the answer includes lightweight source attribution

## Troubleshooting

Troubleshooting priority for this guide is:

1. the agent client did not invoke `query_memory` correctly
2. MirrorBrain did not return useful memory
3. answer composition produced a poor user-facing response

### 1. Agent Client Did Not Invoke `query_memory`

Symptoms:

- the chat answer looks generic and not grounded in memory
- no retrieval request appears to reach MirrorBrain
- changing the question does not seem to affect tool usage

Checks:

- confirm the `query_memory` tool is actually registered in the agent client
- confirm the tool points at the correct MirrorBrain base URL
- confirm the tool sends `query` in the request body
- if you are using explicit source filters, confirm they do not exclude browser memory unintentionally

### 2. MirrorBrain Did Not Return Useful Memory

Symptoms:

- the tool call succeeds but returns empty or weak results
- the answer is technically grounded but obviously incomplete

Checks:

- confirm `pnpm dev` reported `ActivityWatch` and `QMD Workspace` as ready
- confirm `ActivityWatch` has browser events in the last hour
- confirm browser activity from yesterday actually exists in the underlying source
- inspect `GET /memory` to see whether raw browser memory events are present
- inspect `POST /memory/query` directly to see whether the retrieval layer returns theme-level results

### 3. Answer Composition Is Weak

Symptoms:

- retrieval results are present, but the final chat answer is awkward
- the answer repeats raw summaries without turning them into a natural reply

Checks:

- confirm the host is summarizing returned items in order
- confirm each paragraph uses `title` or `theme` plus `summary`
- confirm source hints are lightweight and not overwhelming the main answer

## Expected Output Shape

For the minimum demo, MirrorBrain retrieval should return theme-level items with:

- `theme` or `title`
- `summary`
- `timeRange`
- representative `sourceRefs`

The host should convert those into:

- one ordered paragraph per result
- a natural-language answer
- a lightweight source hint per paragraph

## Known Limitations

- this guide proves only the minimum memory-retrieval path
- it does not validate knowledge retrieval or skill usage
- it does not guarantee retrieval quality is already good enough for broad usage
- it is still a developer-installable path, not a normal-user setup flow
