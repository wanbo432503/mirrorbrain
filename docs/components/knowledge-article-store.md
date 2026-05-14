# Knowledge Article Store

## Summary

`src/integrations/knowledge-article-store` persists Phase 4 projects, topics,
Knowledge Article Drafts, and published Knowledge Article versions in the local
MirrorBrain workspace.

## Responsibility Boundary

The store owns:

- Writing project, topic, draft, and article JSON files under `mirrorbrain/`.
- Listing drafts and project-scoped topics.
- Listing article history for a project/topic pair, optionally narrowed to one
  stable `articleId`.
- Returning the current-best published article for a project/topic pair,
  optionally narrowed to one stable `articleId`.
- Returning the Published Project -> Topic -> Knowledge Article tree, excluding
  projects or topics that do not yet contain any published article lineage.

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
  - `listArticleHistory({ projectId, topicId, articleId? })`
  - `getCurrentBestArticle({ projectId, topicId, articleId? })`

## Data Flow

1. Domain modules create or update project/topic/draft/article values.
2. The service or workflow layer saves those values through the store.
3. Published article versions are read back by project and topic, with
   article-specific reads using `articleId`.
4. Current-best retrieval filters history for the version marked
   `isCurrentBest`.
5. Published tree listing filters out empty reviewed-project assignments so a
   kept work session is not presented as published knowledge until an article is
   actually published.

## Failure Modes And Constraints

- Missing directories are treated as empty lists.
- Corrupt JSON propagates as a read error.
- File writes use URL-encoded ids as filenames.
- Callers must save a new current-best article and any superseded prior version
  together when publishing updates.
- Saved projects can exist before any Knowledge Article is published. They are
  intentionally omitted from `listKnowledgeArticleTree()` until at least one
  topic contains a published article lineage.

## Test Strategy

Unit tests live in `src/integrations/knowledge-article-store/index.test.ts`.

The tests verify draft persistence, topic listing, current-best lookup, separate
article histories within one topic, newest-first article history, and omission
of kept-only reviewed projects from the Published tree.
