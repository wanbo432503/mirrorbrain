# Knowledge Article Store

## Summary

`src/integrations/knowledge-article-store` persists Phase 4 projects, topics,
Knowledge Article Drafts, and published Knowledge Article versions in the local
MirrorBrain workspace as a project/topic/knowledge tree.

## Responsibility Boundary

The store owns:

- Writing project, topic, draft, and article JSON files under the
  `mirrorbrain/knowledge/project/` tree.
- Listing drafts and project-scoped topics.
- Listing article history for a project/topic pair, optionally narrowed to one
  stable `articleId`.
- Returning the current-best published article for a project/topic pair,
  optionally narrowed to one stable `articleId`.
- Returning the Published Project -> Topic -> Knowledge Article tree, excluding
  projects or topics that do not yet contain any published article lineage.
- Deleting all published versions for one stable `articleId`.

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
  - `deleteArticleLineage(articleId)`
  - `listDrafts()`
  - `listTopics(projectId?)`
  - `listArticleHistory({ projectId, topicId, articleId? })`
  - `getCurrentBestArticle({ projectId, topicId, articleId? })`

## Data Flow

1. Domain modules create or update project/topic/draft/article values.
2. The service or workflow layer saves those values through the store.
3. Drafts are written as `preview_*.json` knowledge files. New projects that
   have not published knowledge yet are written under `preview_<project>/`.
4. Publishing promotes the project to an unprefixed project directory, writes
   published article files without the `preview_` prefix, and removes the
   published draft file.
5. Published article versions are read back by project and topic, with
   article-specific reads using `articleId`.
6. Current-best retrieval filters history for the version marked
   `isCurrentBest`.
7. Published tree listing filters out empty reviewed-project assignments so a
   kept work session is not presented as published knowledge until an article is
   actually published.
8. Published article deletion removes every stored version for the selected
   stable `articleId`; subsequent tree reads omit now-empty topics and projects.

## Storage Layout

The store intentionally avoids separate root-level `projects/`, `topics/`,
`knowledge-article-drafts/`, and `knowledge-articles/` directories. Phase 4
knowledge artifacts live under one tree:

```text
mirrorbrain/
  knowledge/
    project/
      preview_<project-slug>/
        _project.json
        <topic-slug>/
          preview_<draft-slug>.json
      <project-slug>/
        _project.json
        <topic-slug>/
          _topic.json
          <published-article-version-slug>.json
```

The prefix controls lifecycle presentation:

- `preview_` project directory: a new project that has reviewed work but no
  published knowledge article yet.
- unprefixed project directory: a project with published knowledge.
- `preview_` knowledge file: draft knowledge for preview surfaces.
- unprefixed knowledge file: published knowledge for published surfaces.

## Failure Modes And Constraints

- Missing directories are treated as empty lists.
- Corrupt JSON propagates as a read error.
- File and directory names use readable Unicode slug segments, so project and
  topic names such as `聚类算法` remain recognizable on disk. The JSON payload
  remains authoritative for stable ids and display names.
- Callers must save a new current-best article and any superseded prior version
  together when publishing updates.
- Saved projects can exist before any Knowledge Article is published. They are
  intentionally omitted from `listKnowledgeArticleTree()` until at least one
  topic contains a published article lineage.
- Deleting a missing article lineage is idempotent.

## Test Strategy

Unit tests live in `src/integrations/knowledge-article-store/index.test.ts`.

The tests verify tree-shaped persistence, preview prefixes, topic listing,
current-best lookup, separate article histories within one topic, newest-first
article history, omission of kept-only reviewed projects from the Published
tree, published-draft removal, and deletion of one article lineage without
removing sibling articles.
