# Knowledge Article Store

## Summary

`src/integrations/knowledge-article-store` persists Phase 4 projects, topics,
Knowledge Article Drafts, and published Knowledge Article versions in the local
MirrorBrain workspace.

## Responsibility Boundary

The store owns:

- Writing project, topic, draft, and article JSON files under `mirrorbrain/`.
- Listing drafts and project-scoped topics.
- Listing article history for a project/topic pair.
- Returning the current-best published article for a project/topic pair.

The store does not own:

- Draft generation.
- Topic assignment policy.
- Publish/versioning policy.
- Work-session review.
- Retrieval ranking or search indexing.
- Knowledge Article UI.

## Key Interfaces

- `createFileKnowledgeArticleStore({ workspaceDir })`
- `KnowledgeArticleStore`
  - `saveProject(project)`
  - `saveTopic(topic)`
  - `saveDraft(draft)`
  - `saveArticles(articles)`
  - `listDrafts()`
  - `listTopics(projectId?)`
  - `listArticleHistory({ projectId, topicId })`
  - `getCurrentBestArticle({ projectId, topicId })`

## Data Flow

1. Domain modules create or update project/topic/draft/article values.
2. The service or workflow layer saves those values through the store.
3. Published article versions are read back by project and topic.
4. Current-best retrieval filters history for the version marked
   `isCurrentBest`.

## Failure Modes And Constraints

- Missing directories are treated as empty lists.
- Corrupt JSON propagates as a read error.
- File writes use URL-encoded ids as filenames.
- Callers must save a new current-best article and any superseded prior version
  together when publishing updates.

## Test Strategy

Unit tests live in `src/integrations/knowledge-article-store/index.test.ts`.

The tests verify draft persistence, topic listing, current-best lookup, and
newest-first article history.
