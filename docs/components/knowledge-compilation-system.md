# Knowledge Compilation and Wiki-Link System

## Overview

This document describes the complete knowledge compilation pipeline and wiki-link navigation system implemented for MirrorBrain.

## System Architecture

The system consists of three main components:

1. **Backend Compilation Engine** - Generates knowledge pages with wiki-links
2. **Relation Network** - Connects related knowledge using TF-IDF similarity
3. **Frontend Wiki-Link Renderer** - Displays knowledge with interactive wiki-links and hover previews

## Backend Components

### Knowledge Compilation Engine

Location: `/src/modules/knowledge-compilation-engine/`

Two-stage compilation pipeline inspired by OpenWiki:

**Stage 1: Discovery**
- Analyzes reviewed memories
- Extracts strict noun-only tags (blacklists generic terms)
- Identifies primary topic and supporting themes
- Detects reusable patterns

**Stage 2: Execute**
- Generates knowledge page body with wiki-link syntax `[[topic-key]]`
- Creates structured markdown (title, summary, body, tags)
- Links to source reviewed memories
- Sets compilation metadata

Files:
- `discovery-stage.ts` - Memory analysis and topic detection
- `execute-stage.ts` - Knowledge page generation
- `tag-extraction.ts` - Strict noun-only tag extraction
- Tests: 42 tests passing

### Knowledge Relation Network

Location: `/src/modules/knowledge-relation-network/`

TF-IDF weighted cosine similarity system for knowledge relationships:

**TF-IDF Calculator**
- IDF formula: `ln((N+1)/(df+1))` - rare tags get higher weight
- TF: tag count in single artifact
- TF-IDF vector: TF * IDF

**Cosine Similarity**
- Formula: `dot(A, B) / (||A|| * ||B||)`
- Range: [0, 1], where 1 = identical topics

**Relation Graph Builder**
- TOP_K constraint: 5 neighbors (prevents super-nodes)
- Threshold: 0.3 similarity (filters weak edges)
- Symmetric relations stored in `relatedKnowledgeIds`

Files:
- `tfidf-calculator.ts` - IDF weighting and vector building
- `cosine-similarity.ts` - Vector similarity calculation
- `relation-graph-builder.ts` - Graph construction
- Tests: 26 tests passing

## Data Model Extensions

KnowledgeArtifact extended with:

```typescript
interface KnowledgeArtifact {
  // ... existing fields
  tags?: string[];                    // Noun-only tags for TF-IDF
  relatedKnowledgeIds?: string[];    // From relation network
  compilationMetadata?: {
    discoveryInsights: string[];
    generationMethod: 'two-stage-compilation';
    discoveryStageCompletedAt?: string;
    executeStageCompletedAt?: string;
  };
}
```

## Frontend Components

### WikiLinkHoverCard

Location: `/src/apps/mirrorbrain-web-react/src/components/artifacts/WikiLinkHoverCard.tsx`

Preview card for wiki-link hover interactions:
- Displays title, truncated summary, tags
- Shows relation strength badge (when from similarity graph)
- Positioned near cursor with fixed positioning

### KnowledgeMarkdownRenderer

Location: `/src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeMarkdownRenderer.tsx`

Markdown renderer with wiki-link support:
- Parses `[[topic-key]]` syntax using remark-wiki-link v2
- Renders clickable links with custom styling (underline, color, cursor)
- Hover preview cards appear on mouse enter
- Click triggers navigation callback `onWikiLinkClick`
- Supports GFM features (tables, strikethrough, task lists)

Dependencies:
- react-markdown@9.1.0
- remark-gfm@4.0.1
- remark-wiki-link@2.0.1

Tests: 11 tests passing

### KnowledgeDetailModal Integration

Location: `/src/apps/mirrorbrain-web-react/src/components/artifacts/KnowledgeDetailModal.tsx`

Updated modal with wiki-link integration:
- Uses KnowledgeMarkdownRenderer for body content
- Displays tags section with styled tag badges
- Shows related knowledge sidebar (max 5 items)
- Click related knowledge → navigate via `onWikiLinkClick`
- Displays compilation metadata indicator

Tests: 24 integration tests passing

## Usage Examples

### Backend: Generate Knowledge

```typescript
import { runDiscoveryStage, runExecuteStage } from './modules/knowledge-compilation-engine';
import { buildKnowledgeRelationGraph } from './modules/knowledge-relation-network';

// Stage 1: Discovery
const discovery = runDiscoveryStage(reviewedMemories);

// Stage 2: Execute
const knowledge = runExecuteStage(discovery, reviewedMemories);

// Build relation network
const artifacts = await loadAllKnowledge();
const graph = buildKnowledgeRelationGraph(artifacts);

// Update artifacts with relations
for (const [id, relatedIds] of graph.entries()) {
  artifact.relatedKnowledgeIds = relatedIds;
}
```

### Frontend: Display Knowledge

```typescript
<KnowledgeDetailModal
  knowledge={selectedKnowledge}
  onClose={() => setSelectedKnowledge(null)}
  onWikiLinkClick={(targetId) => {
    // Navigate to related knowledge
    const related = findKnowledgeById(targetId);
    setSelectedKnowledge(related);
  }}
/>
```

## Test Coverage

**Backend Tests (68 passing):**
- TF-IDF calculator: 10 tests
- Cosine similarity: 8 tests
- Relation graph builder: 8 tests
- Tag extraction: 15 tests
- Discovery stage: 13 tests
- Execute stage: 14 tests

**Frontend Tests (89 passing):**
- KnowledgeMarkdownRenderer: 11 tests
- KnowledgeDetailModal integration: 24 tests
- Existing tests: 54 tests

**Total: 157 tests passing**

## Performance Characteristics

- TF-IDF calculation: O(N * V) where N = artifacts, V = vocabulary size
- Cosine similarity: O(V) per pair comparison
- Relation graph: O(N²) pairwise comparisons, then O(N * K) for TOP_K selection
- Tag extraction: O(T) where T = text length
- Wiki-link parsing: O(B) where B = body markdown length

## Migration Strategy

For existing knowledge artifacts:

1. Run tag extraction on existing bodies
2. Build relation graph across all artifacts
3. Mark existing knowledge with `generationMethod: 'legacy'`
4. Optionally re-compile important knowledge with new pipeline

## Future Enhancements

Potential improvements:

1. **User preference matching** - Boost topics matching user interests
2. **Page content fetching** - Asynchronously fetch missing pageText
3. **Cross-day deduplication** - Prevent similar content across days
4. **Adaptive thresholds** - Adjust similarity thresholds from user feedback
5. **Machine learning patterns** - Learn valuable/junk patterns from review decisions
6. **Backend service integration** - Add compilation endpoints to mirrorbrain-service

## References

- OpenWiki `content_filter.rs`: First-stage assessment logic
- OpenWiki `wiki_engine.rs`: Content importance scoring
- MirrorBrain PRD: Phase 2B focus on memory retrieval quality
- remark-wiki-link documentation: Wiki-link syntax parsing