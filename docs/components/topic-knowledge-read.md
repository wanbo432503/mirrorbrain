# Topic Knowledge Read Surfaces

## Summary

This component slice is the Phase 3 Milestone 3 minimum read loop for topic knowledge. It exposes service, HTTP, and browser-facing read surfaces for:

- listing current-best topic summaries
- reading the current-best topic artifact by topic key
- reading topic version history in newest-first order

## Responsibility Boundary

This slice is responsible for:

- filtering `topic-knowledge` artifacts from the broader knowledge store
- resolving current-best topic artifacts by `topicKey`
- returning topic history in a stable order
- exposing HTTP endpoints for topic list/detail/history
- showing topic summaries in the standalone web artifacts area

This slice is not responsible for:

- generating or merging topic knowledge
- rich topic editing UI
- search/ranking across topics beyond the minimum current-best list

## Key Interfaces

- `createMirrorBrainService(...).listKnowledgeTopics()`
- `createMirrorBrainService(...).getKnowledgeTopic(topicKey)`
- `createMirrorBrainService(...).listKnowledgeHistory(topicKey)`
- `GET /knowledge/topics`
- `GET /knowledge/topics/:topicKey`
- `GET /knowledge/topics/:topicKey/history`
- `createMirrorBrainBrowserApi(...).listKnowledgeTopics()`

## Data Flow

1. The service loads all stored knowledge artifacts.
2. It filters down to `topic-knowledge` artifacts only.
3. It selects current-best artifacts for the topic summary list.
4. It resolves one current-best topic artifact or a full newest-first history list per topic key.
5. The HTTP server exposes these read models as JSON endpoints.
6. The standalone web app loads topic summaries and renders them in the artifacts area.

## Test Strategy

- service coverage in `src/apps/mirrorbrain-service/topic-knowledge-read.test.ts`
- HTTP coverage in `src/apps/mirrorbrain-http-server/topic-knowledge.test.ts`
- browser client / UI coverage in `src/apps/mirrorbrain-web-react/src/App.test.tsx`

## Known Risks And Limitations

- topic summary ordering is currently recency-based only
- the standalone UI shows a minimal topic summary list, not a full topic detail/history browser yet
- current-best resolution still depends on stored `isCurrentBest` and version metadata staying coherent
- topic quality is still evaluated separately through the Phase 3 Milestone 4 quality loop
