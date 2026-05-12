# MirrorBrain HTTP API

## Summary

This document is the written contract for MirrorBrain's local HTTP API. The API
is implemented by `src/apps/mirrorbrain-http-server` and delegates product logic
to `src/apps/mirrorbrain-service`.

The generated OpenAPI schema is available at runtime:

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`

This file complements the generated schema with product semantics, lifecycle
boundaries, expected payloads, failure modes, and client usage guidance.

## Scope And Boundary

The HTTP API is a local-first capability surface for:

- memory sync, listing, retrieval, candidate creation, and review
- Phase 4 source-ledger manual import, audit inspection, and source status
- Phase 4 manual work-session analysis windows
- knowledge listing, generation, regeneration, approval, topic reading, graph
  reading, saving, and deletion
- skill draft listing, generation, saving, and deletion
- local service health and runtime inspection

The API is not responsible for:

- direct ActivityWatch or shell-history parsing
- OpenViking storage mechanics
- knowledge synthesis policy internals
- skill execution
- production authentication or multi-user authorization

Those concerns remain in integrations, modules, workflows, or future deployment
layers.

## Base URL And Transport

Default local origin:

```text
http://127.0.0.1:3007
```

All request and response bodies are JSON unless an endpoint returns `204 No
Content`.

Common headers for write requests:

```http
content-type: application/json
```

The current API is designed for local usage. Do not expose it directly to an
untrusted network without adding authentication, authorization, rate limiting,
and deployment hardening.

## Core Data Types

The canonical domain TypeScript definitions live in `src/shared/types/index.ts`.
Runtime HTTP DTO schemas are moving into `src/shared/api-contracts/`; in the
current slice, `KnowledgeArtifact` and `SkillArtifact` response serialization
use that shared contract.

### Source Category

```ts
type MirrorBrainSourceCategory =
  | 'browser'
  | 'shell'
  | 'openclaw-conversation';
```

### Memory Event

```ts
interface MemoryEvent {
  id: string;
  sourceType: string;
  sourceRef: string;
  timestamp: string;
  authorizationScopeId: string;
  content: Record<string, unknown>;
  captureMetadata: {
    upstreamSource: string;
    checkpoint: string;
  };
}
```

### Candidate Memory

Candidate memories are generated review units. They are not approved memory.

Important fields:

- `id`
- `memoryEventIds`
- `sourceRefs`
- `discardedSourceRefs`
- `title`
- `summary`
- `theme`
- `formationReasons`
- `compressedSourceCount`
- `discardReasons`
- `reviewDate`
- `timeRange`
- `reviewState: 'pending'`

### Reviewed Memory

Reviewed memories represent explicit user review decisions.

Important fields:

- `id`
- `candidateMemoryId`
- `candidateTitle`
- `candidateSummary`
- `candidateTheme`
- `candidateSourceRefs`
- `memoryEventIds`
- `reviewDate`
- `decision: 'keep' | 'discard'`
- `reviewedAt`

### Knowledge Artifact

Knowledge artifacts are derived from reviewed memory.

Required response fields:

- `id`
- `draftState: 'draft' | 'published'`
- `sourceReviewedMemoryIds`

Additional fields may be present when the artifact has enough review, topic, or
publication metadata:

- `artifactType?: 'daily-review-draft' | 'topic-merge-candidate' | 'topic-knowledge'`
- `topicKey?: string | null`
- `title`
- `summary`
- `body`
- `derivedFromKnowledgeIds`
- `version`
- `isCurrentBest`
- `supersedesKnowledgeId`
- `updatedAt`
- `reviewedAt`
- `recencyLabel`
- `provenanceRefs`
- `tags`
- `relatedKnowledgeIds`
- `compilationMetadata`

### Skill Artifact

Skill artifacts are draft or approved Agent Skill records. They are not
automatic execution permissions.

```ts
interface SkillArtifact {
  id: string;
  approvalState: 'draft' | 'approved';
  workflowEvidenceRefs: string[];
  executionSafetyMetadata: {
    requiresConfirmation: boolean;
  };
  updatedAt?: string;
  reviewedAt?: string | null;
}
```

## Error Model

Fastify handles JSON parsing and schema validation errors. Service-level
validation errors generally return JSON shaped like:

```json
{
  "message": "Invalid candidate memory ID format: candidate-id"
}
```

Current conventions:

- `400`: validation or malformed id where explicitly handled
- `404`: requested topic or artifact-like resource is not available where the
  route exposes not-found semantics
- `501`: optional service capability is not available in the supplied service
  object
- `500`: unhandled runtime or storage error

The API is still local-first. Error bodies are practical operator responses, not
a fully normalized public error envelope.

## Service Endpoints

### `GET /health`

Returns runtime status and effective config.

Response:

```json
{
  "status": "running",
  "config": {
    "sync": {
      "pollingIntervalMs": 3600000,
      "initialBackfillHours": 24
    },
    "activityWatch": {
      "baseUrl": "http://127.0.0.1:5600"
    },
    "openViking": {
      "baseUrl": "http://127.0.0.1:1933"
    },
    "service": {
      "host": "127.0.0.1",
      "port": 3007
    }
  }
}
```

### `GET /openapi.json`

Returns the generated OpenAPI 3.0 schema.

### `GET /docs`

Serves Swagger UI for local endpoint exploration.

## Memory Endpoints

### `GET /memory`

Lists imported memory events with pagination.

Query parameters:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | number | `1` | 1-based page number. |
| `pageSize` | number | `10` | Number of memory events per page. |
| `sourceKind` | string | none | Optional Phase 4 source kind filter, such as `browser` or `shell`. |
| `sourceInstanceId` | string | none | Optional Phase 4 source instance filter, such as `chrome-main`. |

Response:

```json
{
  "items": [
    {
      "id": "browser:123",
      "sourceType": "activitywatch-browser",
      "sourceRef": "123",
      "timestamp": "2026-05-11T08:00:00.000Z",
      "authorizationScopeId": "scope-browser",
      "content": {
        "url": "https://example.com/docs",
        "title": "Example Docs"
      },
      "captureMetadata": {
        "upstreamSource": "activitywatch",
        "checkpoint": "2026-05-11T08:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

Notes:

- This endpoint uses the memory event cache when available.
- Source filters are applied before pagination. They are intended for Source
  Management Recent Memory views and match Phase 4 ledger-imported
  `MemoryEvent.sourceType` plus the source instance encoded in `sourceRef`.
- The cache is display-oriented; durable records remain in workspace/OpenViking
  storage.

### `POST /memory/query`

Returns theme-level memory retrieval results for openclaw-style questions.

Request:

```json
{
  "query": "What did I work on yesterday?",
  "timeRange": {
    "startAt": "2026-05-10T00:00:00.000Z",
    "endAt": "2026-05-11T00:00:00.000Z"
  },
  "sourceTypes": ["browser"]
}
```

Request fields:

| Name | Required | Description |
| --- | --- | --- |
| `query` | yes | Natural-language retrieval request. |
| `timeRange` | no | Optional inclusive retrieval window. |
| `sourceTypes` | no | Optional source filters: `browser`, `shell`, `openclaw-conversation`. |

Response:

```json
{
  "timeRange": {
    "startAt": "2026-05-10T00:00:00.000Z",
    "endAt": "2026-05-11T00:00:00.000Z"
  },
  "explanation": "Used stored browser work narratives.",
  "items": [
    {
      "id": "memory-narrative:browser-theme:docs",
      "theme": "docs",
      "title": "Docs",
      "summary": "You researched Docs by searching and reading documentation across 3 pages and 7 browser visits.",
      "timeRange": {
        "startAt": "2026-05-10T08:00:00.000Z",
        "endAt": "2026-05-10T09:00:00.000Z"
      },
      "sourceRefs": [
        {
          "id": "browser:123",
          "sourceType": "activitywatch-browser",
          "sourceRef": "123",
          "timestamp": "2026-05-10T08:00:00.000Z"
        }
      ]
    }
  ]
}
```

Notes:

- Stored browser and shell narratives are preferred when available.
- Raw memory event grouping is used as a deterministic fallback.
- Ordinary memory queries do not include skill artifacts.

## Sync Endpoints

### `POST /sync/browser`

Triggers explicit browser memory sync.

Response status: `202`

Response:

```json
{
  "sync": {
    "sourceKey": "activitywatch-browser:aw-watcher-web",
    "strategy": "incremental",
    "importedCount": 12,
    "lastSyncedAt": "2026-05-11T09:00:00.000Z",
    "importedEvents": []
  }
}
```

Notes:

- The response can include a bounded preview of imported events.
- Browser page-content fetching and narrative refresh may continue
  asynchronously after the sync response.

### `POST /sync/shell`

Triggers explicit shell history sync.

Response status: `202`

Response shape is the same as `/sync/browser`.

Failure mode:

- Returns an error when the runtime was started without
  `MIRRORBRAIN_SHELL_HISTORY_PATH`.

## Source Management Endpoints

### `POST /sources/import`

Triggers explicit Phase 4 source-ledger import. This is the manual Import Now
operation for changed daily JSONL ledgers under the MirrorBrain workspace.

Response status: `202`

Response:

```json
{
  "import": {
    "importedCount": 1,
    "skippedCount": 0,
    "scannedLedgerCount": 1,
    "changedLedgerCount": 1,
    "ledgerResults": [
      {
        "ledgerPath": "ledgers/2026-05-12/browser.jsonl",
        "importedCount": 1,
        "skippedCount": 0,
        "checkpoint": {
          "ledgerPath": "ledgers/2026-05-12/browser.jsonl",
          "nextLineNumber": 2,
          "updatedAt": "2026-05-12T10:31:00.000Z"
        }
      }
    ]
  }
}
```

Notes:

- Manual import is checkpointed and should not duplicate previously imported
  ledger lines.
- Malformed ledger lines are represented as source audit warnings and do not
  block later lines.
- This endpoint imports ledgers; it does not start source recorders.

### `GET /sources/audit`

Lists operational source audit events.

Query parameters:

| Name | Required | Description |
| --- | --- | --- |
| `sourceKind` | no | Source kind such as `browser`, `shell`, or `agent-transcript`. |
| `sourceInstanceId` | no | Source instance id such as `chrome-main`. |

Response:

```json
{
  "items": [
    {
      "id": "source-audit:entry-1",
      "eventType": "entry-imported",
      "sourceKind": "browser",
      "sourceInstanceId": "chrome-main",
      "ledgerPath": "ledgers/2026-05-12/browser.jsonl",
      "lineNumber": 1,
      "occurredAt": "2026-05-12T10:31:00.000Z",
      "severity": "info",
      "message": "Imported browser ledger entry."
    }
  ]
}
```

### `GET /sources/status`

Lists source instance summaries derived from operational checkpoint and audit
state.

Response:

```json
{
  "items": [
    {
      "sourceKind": "browser",
      "sourceInstanceId": "chrome-main",
      "lifecycleStatus": "enabled",
      "recorderStatus": "unknown",
      "importedCount": 1,
      "skippedCount": 0,
      "checkpointSummary": "ledgers/2026-05-12/browser.jsonl next line 2"
    }
  ]
}
```

Notes:

- Source audit/status records are operational metadata, not user work memory.
- Recorder status is `unknown` until recorder supervision is wired.

### `PATCH /sources/config`

Updates source-instance enablement configuration and writes a corresponding
source audit event.

Request:

```json
{
  "sourceKind": "browser",
  "sourceInstanceId": "chrome-main",
  "enabled": false,
  "updatedBy": "mirrorbrain-web"
}
```

Response:

```json
{
  "config": {
    "sourceKind": "browser",
    "sourceInstanceId": "chrome-main",
    "enabled": false,
    "updatedAt": "2026-05-12T11:00:00.000Z",
    "updatedBy": "mirrorbrain-web"
  }
}
```

Notes:

- Disabling a source stops future acquisition once recorder supervision honors
  the config. It does not delete existing ledgers, imported memory events, or
  derived artifacts.
- The update is auditable through `GET /sources/audit` as `source-enabled` or
  `source-disabled`.

### `POST /work-sessions/analyze`

Runs an explicit Phase 4 work-session analysis window. This endpoint is
user-triggered and returns pending `WorkSessionCandidate` values; it does not
review, keep, discard, publish knowledge, or create skills.

Request:

```json
{
  "preset": "last-6-hours"
}
```

Supported presets:

| Field | Values |
| --- | --- |
| `preset` | `last-6-hours`, `last-24-hours`, `last-7-days` |

Response `201`:

```json
{
  "analysis": {
    "analysisWindow": {
      "preset": "last-6-hours",
      "startAt": "2026-05-12T06:00:00.000Z",
      "endAt": "2026-05-12T12:00:00.000Z"
    },
    "generatedAt": "2026-05-12T12:00:00.000Z",
    "candidates": [
      {
        "id": "work-session-candidate:mirrorbrain:2026-05-12T12:00:00.000Z",
        "projectHint": "mirrorbrain",
        "title": "mirrorbrain work session",
        "summary": "Imported source ledgers.",
        "memoryEventIds": ["browser-1", "shell-1"],
        "sourceTypes": ["browser", "shell"],
        "timeRange": {
          "startAt": "2026-05-12T10:00:00.000Z",
          "endAt": "2026-05-12T10:30:00.000Z"
        },
        "relationHints": ["Phase 4 design", "Run tests"],
        "reviewState": "pending"
      }
    ],
    "excludedMemoryEventIds": []
  }
}
```

Notes:

- Analysis reads already imported `MemoryEvent` records.
- Analysis candidates are review inputs, not reviewed work sessions.
- The endpoint returns `501` when the service implementation does not expose
  work-session analysis.

### `POST /work-sessions/reviews`

Records an explicit review decision for a work-session candidate. Keeping a
candidate requires explicit project assignment; a confirmed new project may be
created as part of the review result.

Request:

```json
{
  "candidate": {
    "id": "work-session-candidate:mirrorbrain",
    "projectHint": "mirrorbrain",
    "title": "mirrorbrain work session",
    "summary": "Imported source ledgers.",
    "memoryEventIds": ["browser-1", "shell-1"],
    "sourceTypes": ["browser", "shell"],
    "timeRange": {
      "startAt": "2026-05-12T10:00:00.000Z",
      "endAt": "2026-05-12T10:30:00.000Z"
    },
    "relationHints": ["Phase 4 design"],
    "reviewState": "pending"
  },
  "review": {
    "decision": "keep",
    "reviewedBy": "user",
    "projectAssignment": {
      "kind": "confirmed-new-project",
      "name": "MirrorBrain"
    }
  }
}
```

Response `201`:

```json
{
  "project": {
    "id": "project:mirrorbrain",
    "name": "MirrorBrain",
    "status": "active",
    "createdAt": "2026-05-12T12:05:00.000Z",
    "updatedAt": "2026-05-12T12:05:00.000Z"
  },
  "reviewedWorkSession": {
    "id": "reviewed-work-session:work-session-candidate:mirrorbrain",
    "candidateId": "work-session-candidate:mirrorbrain",
    "projectId": "project:mirrorbrain",
    "title": "mirrorbrain work session",
    "summary": "Imported source ledgers.",
    "memoryEventIds": ["browser-1", "shell-1"],
    "sourceTypes": ["browser", "shell"],
    "timeRange": {
      "startAt": "2026-05-12T10:00:00.000Z",
      "endAt": "2026-05-12T10:30:00.000Z"
    },
    "relationHints": ["Phase 4 design"],
    "reviewState": "reviewed",
    "reviewedAt": "2026-05-12T12:05:00.000Z",
    "reviewedBy": "user"
  }
}
```

Notes:

- Review is an explicit human-attributed operation.
- Suggested project names do not create durable projects unless the review uses
  `confirmed-new-project`.
- The endpoint returns `501` when the service implementation does not expose
  work-session review.

## Candidate And Review Endpoints

### `GET /candidate-memories`

Lists candidate memories for a review date.

Query parameters:

| Name | Required | Description |
| --- | --- | --- |
| `reviewDate` | no | Date string such as `2026-05-11`. |

Response:

```json
{
  "candidates": []
}
```

If `reviewDate` is omitted, the current implementation returns an empty list.

### `POST /candidate-memories/daily`

Creates daily candidate memories from imported events.

Request:

```json
{
  "reviewDate": "2026-05-11",
  "reviewTimeZone": "Asia/Shanghai"
}
```

Response status: `201`

Response:

```json
{
  "candidates": [
    {
      "id": "candidate:2026-05-11:docs",
      "memoryEventIds": ["browser:123"],
      "title": "Work on Docs",
      "summary": "Reviewed 1 page across 1 host.",
      "theme": "docs",
      "reviewDate": "2026-05-11",
      "timeRange": {
        "startAt": "2026-05-11T08:00:00.000Z",
        "endAt": "2026-05-11T08:30:00.000Z"
      },
      "reviewState": "pending"
    }
  ]
}
```

Notes:

- Candidate generation may trigger browser sync first.
- Already consumed memory events are excluded when they are tied to published
  knowledge.
- Candidate creation is not review approval.

### `DELETE /candidate-memories/:id`

Deletes a candidate memory by id.

Response status: `204`

Constraints:

- Candidate ids must start with `candidate:`.
- Ids containing path traversal characters are rejected.

### `POST /candidate-reviews/suggestions`

Returns deterministic review suggestions for candidate memories.

Request:

```json
{
  "candidates": []
}
```

Response:

```json
{
  "suggestions": [
    {
      "candidateMemoryId": "candidate:2026-05-11:docs",
      "recommendation": "keep",
      "confidenceScore": 0.82,
      "keepScore": 0.82,
      "primarySourceCount": 2,
      "supportingSourceCount": 1,
      "evidenceSummary": "Multiple primary sources contributed.",
      "priorityScore": 0.9,
      "rationale": "This candidate has enough source evidence to review.",
      "supportingReasons": ["contains primary sources"]
    }
  ]
}
```

### `POST /reviewed-memories`

Records an explicit review decision for a candidate memory.

Request:

```json
{
  "candidate": {
    "id": "candidate:2026-05-11:docs",
    "memoryEventIds": ["browser:123"],
    "title": "Work on Docs",
    "summary": "Reviewed documentation.",
    "theme": "docs",
    "reviewDate": "2026-05-11",
    "timeRange": {
      "startAt": "2026-05-11T08:00:00.000Z",
      "endAt": "2026-05-11T08:30:00.000Z"
    },
    "reviewState": "pending"
  },
  "review": {
    "decision": "keep",
    "reviewedAt": "2026-05-11T09:00:00.000Z"
  }
}
```

Response status: `201`

Response:

```json
{
  "reviewedMemory": {
    "id": "reviewed:candidate:2026-05-11:docs",
    "candidateMemoryId": "candidate:2026-05-11:docs",
    "candidateTitle": "Work on Docs",
    "candidateSummary": "Reviewed documentation.",
    "candidateTheme": "docs",
    "memoryEventIds": ["browser:123"],
    "reviewDate": "2026-05-11",
    "decision": "keep",
    "reviewedAt": "2026-05-11T09:00:00.000Z"
  }
}
```

Notes:

- `reviewedAt` is required for auditability.
- `discard` is still an explicit review decision.

### `DELETE /reviewed-memories/:id`

Deletes a reviewed memory record as an undo operation.

Response status: `204`

Constraints:

- Reviewed memory ids must start with `reviewed:`.
- Ids containing path traversal characters are rejected.

## Knowledge Endpoints

### `GET /knowledge`

Lists all visible knowledge artifacts.

Response:

```json
{
  "items": []
}
```

Notes:

- Deleted knowledge tombstones suppress stale OpenViking copies.
- Workspace files can override OpenViking fallback reads.

### `POST /knowledge`

Saves an edited knowledge artifact.

Request:

```json
{
  "artifact": {
    "id": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
    "draftState": "draft",
    "artifactType": "daily-review-draft",
    "topicKey": "docs",
    "title": "Work on Docs",
    "summary": "A draft from reviewed memory.",
    "body": "# Work on Docs\n\n...",
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"],
    "derivedFromKnowledgeIds": [],
    "version": 1,
    "isCurrentBest": false,
    "supersedesKnowledgeId": null,
    "reviewedAt": "2026-05-11T09:00:00.000Z",
    "recencyLabel": "2026-05-11",
    "provenanceRefs": [
      {
        "kind": "reviewed-memory",
        "id": "reviewed:candidate:2026-05-11:docs"
      }
    ]
  }
}
```

Response status: `201`

Response:

```json
{
  "artifact": {
    "id": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
    "draftState": "draft",
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"]
  }
}
```

### `DELETE /knowledge/:artifactId`

Deletes a persisted knowledge artifact and records a deletion tombstone.

Response status: `204`

Constraints:

- Valid ids currently start with one of:
  - `knowledge-draft:`
  - `topic-knowledge:`
  - `topic-merge-candidate:`
- Ids containing path traversal characters are rejected.
- Deleting a published topic artifact may also delete source draft artifacts
  derived from it.

### `POST /knowledge/generate`

Generates a knowledge draft from reviewed memories.

Request:

```json
{
  "reviewedMemories": []
}
```

Response status: `201`

Response:

```json
{
  "artifact": {
    "id": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
    "draftState": "draft",
    "artifactType": "daily-review-draft",
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"]
  }
}
```

Notes:

- The service tries to use captured page text for richer synthesis when source
  browser events have page-content artifacts.
- Missing source content degrades to reviewed-memory summaries.

### `POST /knowledge/regenerate`

Regenerates a knowledge draft with the existing draft as context.

Request:

```json
{
  "existingDraft": {
    "id": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
    "draftState": "draft",
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"]
  },
  "reviewedMemories": []
}
```

Response status: `201`

Response:

```json
{
  "artifact": {
    "id": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
    "draftState": "draft",
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"]
  }
}
```

Failure mode:

- Returns `501` if the supplied service object does not expose regeneration.

### `POST /knowledge/approve`

Approves and publishes a knowledge draft into topic knowledge.

Request:

```json
{
  "draftId": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
  "draft": {
    "id": "knowledge-draft:reviewed:candidate:2026-05-11:docs",
    "draftState": "draft",
    "artifactType": "daily-review-draft",
    "topicKey": "docs",
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"],
    "body": "# Work on Docs\n\n..."
  }
}
```

Response status: `201`

Response:

```json
{
  "publishedArtifact": {
    "id": "topic-knowledge:docs:v1",
    "draftState": "published",
    "artifactType": "topic-knowledge",
    "topicKey": "docs",
    "version": 1,
    "isCurrentBest": true,
    "sourceReviewedMemoryIds": ["reviewed:candidate:2026-05-11:docs"]
  },
  "assignedTopic": {
    "topicKey": "docs",
    "title": "Work on Docs"
  }
}
```

Notes:

- `draft` is optional, but passing it lets the service approve the UI-visible
  draft even if storage indexing has not exposed it yet.
- If `draft` is present, `draft.id` must match `draftId`.
- Approval may supersede an existing current-best topic version.

### `GET /knowledge/topics`

Lists current-best topic knowledge summaries.

Response:

```json
{
  "items": [
    {
      "topicKey": "docs",
      "title": "Work on Docs",
      "summary": "Current best summary.",
      "currentBestKnowledgeId": "topic-knowledge:docs:v2",
      "updatedAt": "2026-05-11T09:00:00.000Z",
      "recencyLabel": "updated on 2026-05-11"
    }
  ]
}
```

### `GET /knowledge/topics/:topicKey`

Returns the current-best topic artifact for a topic key.

Response:

```json
{
  "topic": {
    "id": "topic-knowledge:docs:v2",
    "draftState": "published",
    "artifactType": "topic-knowledge",
    "topicKey": "docs",
    "isCurrentBest": true,
    "sourceReviewedMemoryIds": []
  }
}
```

Failure mode:

- `404` when the topic key has no topic knowledge.

### `GET /knowledge/topics/:topicKey/history`

Lists topic knowledge versions newest first.

Response:

```json
{
  "items": [
    {
      "id": "topic-knowledge:docs:v2",
      "artifactType": "topic-knowledge",
      "topicKey": "docs",
      "version": 2,
      "isCurrentBest": true,
      "sourceReviewedMemoryIds": []
    },
    {
      "id": "topic-knowledge:docs:v1",
      "artifactType": "topic-knowledge",
      "topicKey": "docs",
      "version": 1,
      "isCurrentBest": false,
      "sourceReviewedMemoryIds": []
    }
  ]
}
```

### `GET /knowledge/graph`

Returns a graph snapshot for topic and knowledge-artifact visualization.

Response:

```json
{
  "graph": {
    "generatedAt": "2026-05-11T09:00:00.000Z",
    "stats": {
      "topics": 1,
      "knowledgeArtifacts": 2,
      "wikilinkReferences": 0,
      "similarityRelations": 1
    },
    "nodes": [],
    "edges": []
  }
}
```

Notes:

- Graph nodes include topic nodes and knowledge artifact version nodes.
- Edges can include `CONTAINS`, `REFERENCES`, and `SIMILAR`.

## Skill Endpoints

### `GET /skills`

Lists skill artifacts.

Response:

```json
{
  "items": []
}
```

### `POST /skills`

Saves an edited skill draft.

Request:

```json
{
  "artifact": {
    "id": "skill-draft:reviewed:candidate:2026-05-11:docs",
    "approvalState": "draft",
    "workflowEvidenceRefs": ["reviewed:candidate:2026-05-11:docs"],
    "executionSafetyMetadata": {
      "requiresConfirmation": true
    }
  }
}
```

Response status: `201`

Response:

```json
{
  "artifact": {
    "id": "skill-draft:reviewed:candidate:2026-05-11:docs",
    "approvalState": "draft",
    "workflowEvidenceRefs": ["reviewed:candidate:2026-05-11:docs"],
    "executionSafetyMetadata": {
      "requiresConfirmation": true
    }
  }
}
```

### `DELETE /skills/:artifactId`

Deletes a persisted skill artifact and records a deletion tombstone.

Response status: `204`

Constraints:

- Skill artifact ids must start with `skill-draft:`.
- Ids containing path traversal characters are rejected.

### `POST /skills/generate`

Generates a skill draft from reviewed memories.

Request:

```json
{
  "reviewedMemories": []
}
```

Response status: `201`

Response:

```json
{
  "artifact": {
    "id": "skill-draft:reviewed:candidate:2026-05-11:docs",
    "approvalState": "draft",
    "workflowEvidenceRefs": ["reviewed:candidate:2026-05-11:docs"],
    "executionSafetyMetadata": {
      "requiresConfirmation": true
    }
  }
}
```

Notes:

- Generation creates a draft only.
- Execution still requires a separate confirmation boundary.

## Client Examples

### Query Memory

```bash
curl -s http://127.0.0.1:3007/memory/query \
  -H 'content-type: application/json' \
  -d '{
    "query": "What did I work on yesterday?",
    "sourceTypes": ["browser"]
  }'
```

### Sync Browser Memory

```bash
curl -s -X POST http://127.0.0.1:3007/sync/browser
```

### Create Daily Candidates

```bash
curl -s http://127.0.0.1:3007/candidate-memories/daily \
  -H 'content-type: application/json' \
  -d '{
    "reviewDate": "2026-05-11",
    "reviewTimeZone": "Asia/Shanghai"
  }'
```

### Read Topic Knowledge

```bash
curl -s http://127.0.0.1:3007/knowledge/topics
curl -s http://127.0.0.1:3007/knowledge/topics/docs
curl -s http://127.0.0.1:3007/knowledge/topics/docs/history
```

## Lifecycle And Safety Rules

- Sync endpoints import raw memory events only from configured source adapters.
- Candidate creation prepares memory for review but does not approve it.
- Reviewed memory requires an explicit review write.
- Knowledge generation produces drafts.
- Knowledge approval publishes topic knowledge and can supersede older versions.
- Skill generation produces drafts only.
- Skill execution is not exposed by this API.
- Source attribution should remain visible from memory through reviewed memory,
  knowledge, and skill evidence refs.

## Test Strategy

HTTP API behavior is covered by:

- `src/apps/mirrorbrain-http-server/index.test.ts`
- `src/apps/mirrorbrain-http-server/topic-knowledge.test.ts`
- `tests/integration/mirrorbrain-service-contract.test.ts`
- React API client tests in
  `src/apps/mirrorbrain-web-react/src/api/client.test.ts`

For API documentation-only changes, run:

```bash
git diff --check
```

For TypeScript API behavior changes, also run:

```bash
pnpm test
pnpm typecheck
```
