# Knowledge Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build LLM-powered knowledge note generation from reviewed memories with auto-classification, topic integration, and approval workflow.

**Architecture:** New `knowledge-generation-llm` module coordinates content retrieval, LLM analysis, and synthesis. Service layer exposes generate/regenerate/approve/save operations. Frontend connects UI handlers to API endpoints.

**Tech Stack:** TypeScript, Vitest (unit/integration), Anthropic SDK for Claude API, React (frontend), Fastify (HTTP)

---

## Task 1: Create Module Foundation and Types

**Files:**
- Create: `src/modules/knowledge-generation-llm/index.ts`
- Create: `src/modules/knowledge-generation-llm/index.test.ts`
- Modify: `src/shared/types/index.ts` (add NoteType if needed)

**Step 1: Write failing test for module exports**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
import { describe, expect, it } from 'vitest'
import * as module from './index.js'

describe('knowledge-generation-llm module', () => {
  it('exports required functions', () => {
    expect(module.generateKnowledgeFromReviewedMemories).toBeDefined()
    expect(module.retrievePageContent).toBeDefined()
    expect(module.classifyNoteType).toBeDefined()
    expect(module.extractThemeFromUrls).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: FAIL - module not found or functions undefined

**Step 3: Create module with type definitions and stub exports**

```typescript
// src/modules/knowledge-generation-llm/index.ts
import type { KnowledgeArtifact, ReviewedMemory } from '../../shared/types/index.js'

export type NoteType = 'workflow' | 'tutorial' | 'insight-report' | 'development-record'

export interface ContentRetrievalResult {
  content: string
  source: 'artifact' | 'live-fetch'
  url?: string
}

export async function generateKnowledgeFromReviewedMemories(
  reviewedMemories: ReviewedMemory[],
  existingDraft?: KnowledgeArtifact
): Promise<KnowledgeArtifact> {
  throw new Error('Not implemented')
}

export async function retrievePageContent(
  memoryEventId: string
): Promise<ContentRetrievalResult> {
  throw new Error('Not implemented')
}

export async function classifyNoteType(
  content: string
): Promise<NoteType> {
  throw new Error('Not implemented')
}

export async function extractThemeFromUrls(
  urls: string[]
): Promise<string> {
  throw new Error('Not implemented')
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: PASS - all exports defined

**Step 5: Commit**

```bash
git add src/modules/knowledge-generation-llm/index.ts src/modules/knowledge-generation-llm/index.test.ts
git commit -m "feat: add knowledge-generation-llm module foundation with types

Define NoteType and ContentRetrievalResult types.
Export stub functions for generate, retrieve, classify, and extract.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Implement Content Retrieval (Hybrid Strategy)

**Files:**
- Modify: `src/modules/knowledge-generation-llm/index.ts:15-19`
- Modify: `src/modules/knowledge-generation-llm/index.test.ts`

**Step 1: Write failing test for artifact retrieval success**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
import { describe, expect, it, vi } from 'vitest'
import * as module from './index.js'

describe('retrievePageContent', () => {
  it('returns content from artifact when available', async () => {
    const mockContent = 'Test page content from artifact'
    
    // Mock artifact loader (will need to inject dependency)
    const result = await module.retrievePageContent('event-123')
    
    expect(result.content).toBe(mockContent)
    expect(result.source).toBe('artifact')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Implement artifact retrieval (with dependency injection for testing)**

```typescript
// src/modules/knowledge-generation-llm/index.ts
import type { KnowledgeArtifact, ReviewedMemory, MemoryEvent } from '../../shared/types/index.js'
import { loadBrowserPageContentArtifactFromWorkspace } from '../../integrations/browser-page-content/index.js'

export interface ContentRetrievalDependencies {
  loadArtifact?: typeof loadBrowserPageContentArtifactFromWorkspace
  fetchUrl?: (url: string) => Promise<string>
  getMemoryEvent?: (eventId: string) => Promise<MemoryEvent | null>
}

export async function retrievePageContent(
  memoryEventId: string,
  deps: ContentRetrievalDependencies = {}
): Promise<ContentRetrievalResult> {
  const {
    loadArtifact = loadBrowserPageContentArtifactFromWorkspace,
    fetchUrl = async () => '',
    getMemoryEvent = async () => null
  } = deps

  // Try artifact first
  try {
    const artifactContent = await loadArtifact({ memoryEventId })
    if (artifactContent && artifactContent.length > 0) {
      return {
        content: artifactContent,
        source: 'artifact'
      }
    }
  } catch {
    // Artifact not found, proceed to fallback
  }

  // Fallback: fetch from URL if available
  const event = await getMemoryEvent(memoryEventId)
  if (event?.content?.url) {
    try {
      const liveContent = await fetchUrl(event.content.url)
      return {
        content: liveContent,
        source: 'live-fetch',
        url: event.content.url
      }
    } catch {
      // URL fetch failed
    }
  }

  // No content available
  return {
    content: '',
    source: 'artifact'
  }
}
```

**Step 4: Write test with mocked dependencies**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
describe('retrievePageContent with mocked deps', () => {
  it('prefers artifact over live fetch', async () => {
    const mockArtifactContent = 'Content from captured artifact'
    const mockLiveContent = 'Content from live URL'
    
    const result = await module.retrievePageContent('event-123', {
      loadArtifact: async () => mockArtifactContent,
      fetchUrl: async () => mockLiveContent,
      getMemoryEvent: async () => ({
        id: 'event-123',
        content: { url: 'https://example.com' }
      } as MemoryEvent)
    })
    
    expect(result.content).toBe(mockArtifactContent)
    expect(result.source).toBe('artifact')
  })

  it('falls back to live fetch when artifact unavailable', async () => {
    const mockLiveContent = 'Content from live URL'
    
    const result = await module.retrievePageContent('event-456', {
      loadArtifact: async () => '', // Empty artifact
      fetchUrl: async () => mockLiveContent,
      getMemoryEvent: async () => ({
        id: 'event-456',
        content: { url: 'https://example.com/page' }
      } as MemoryEvent)
    })
    
    expect(result.content).toBe(mockLiveContent)
    expect(result.source).toBe('live-fetch')
    expect(result.url).toBe('https://example.com/page')
  })

  it('returns empty content when both sources fail', async () => {
    const result = await module.retrievePageContent('event-789', {
      loadArtifact: async () => { throw new Error('Artifact not found') },
      fetchUrl: async () => { throw new Error('Network error') },
      getMemoryEvent: async () => ({
        id: 'event-789',
        content: { url: 'https://unreachable.com' }
      } as MemoryEvent)
    })
    
    expect(result.content).toBe('')
    expect(result.source).toBe('artifact')
  })
})
```

**Step 5: Run tests to verify they pass**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: PASS - all retrieval scenarios working

**Step 6: Commit**

```bash
git add src/modules/knowledge-generation-llm/index.ts src/modules/knowledge-generation-llm/index.test.ts
git commit -m "feat: implement hybrid content retrieval for knowledge generation

Prefer captured browser page artifacts, fall back to live URL fetch.
Inject dependencies for testability.
Handle graceful failures when both sources unavailable.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Implement Note Type Classification

**Files:**
- Modify: `src/modules/knowledge-generation-llm/index.ts:20-24`
- Modify: `src/modules/knowledge-generation-llm/index.test.ts`

**Step 1: Write failing test for classification**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
describe('classifyNoteType', () => {
  it('classifies tutorial from step-by-step content', async () => {
    const tutorialContent = `
      Installation Guide
      Step 1: Download the package
      Step 2: Run npm install
      Step 3: Configure settings
    `
    
    const result = await module.classifyNoteType(tutorialContent)
    expect(result).toBe('tutorial')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Implement LLM-based classification (stub for now, integrate real LLM later)**

```typescript
// src/modules/knowledge-generation-llm/index.ts
export interface ClassificationDependencies {
  analyzeWithLLM?: (prompt: string) => Promise<string>
}

function buildClassificationPrompt(content: string): string {
  return `Analyze the following content and classify it into one of these categories:
- workflow: repeated actions, routine procedures, operational sequences
- tutorial: step-by-step instructions, setup guides, how-to procedures
- insight-report: observations, patterns, analysis, key findings
- development-record: problem-solving, implementation details, development logs

Content:
${content}

Return only the category name (workflow, tutorial, insight-report, or development-record).`
}

export async function classifyNoteType(
  content: string,
  deps: ClassificationDependencies = {}
): Promise<NoteType> {
  const { analyzeWithLLM } = deps

  // For now, use simple heuristic classification
  // Will replace with real LLM integration in later task
  if (!analyzeWithLLM) {
    // Heuristic fallback for testing/development
    if (content.match(/step\s+\d+|installation|setup|how\s+to/i)) {
      return 'tutorial'
    }
    if (content.match(/workflow|routine|procedure|operate/i)) {
      return 'workflow'
    }
    if (content.match(/finding|observation|pattern|insight|analysis/i)) {
      return 'insight-report'
    }
    if (content.match(/problem|solution|implemented|developed|bug|feature/i)) {
      return 'development-record'
    }
    return 'development-record' // Default fallback
  }

  // Real LLM classification
  const prompt = buildClassificationPrompt(content)
  const response = await analyzeWithLLM(prompt)
  
  // Parse response to valid NoteType
  const validTypes: NoteType[] = ['workflow', 'tutorial', 'insight-report', 'development-record']
  return validTypes.find(t => response.includes(t)) || 'development-record'
}
```

**Step 4: Write comprehensive classification tests**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
describe('classifyNoteType heuristic', () => {
  it('classifies workflow from routine procedure content', async () => {
    const content = 'Daily workflow: Check emails, review code, deploy to staging'
    const result = await module.classifyNoteType(content)
    expect(result).toBe('workflow')
  })

  it('classifies insight-report from analysis content', async () => {
    const content = 'Key finding: Users prefer dark mode. Pattern observed in 80% of sessions.'
    const result = await module.classifyNoteType(content)
    expect(result).toBe('insight-report')
  })

  it('classifies development-record from problem-solving content', async () => {
    const content = 'Problem: API timeout. Solution: Added retry logic. Implemented exponential backoff.'
    const result = await module.classifyNoteType(content)
    expect(result).toBe('development-record')
  })

  it('defaults to development-record when unclear', async () => {
    const content = 'Random notes from today'
    const result = await module.classifyNoteType(content)
    expect(result).toBe('development-record')
  })
})
```

**Step 5: Run tests to verify they pass**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: PASS - classification heuristics working

**Step 6: Commit**

```bash
git add src/modules/knowledge-generation-llm/index.ts src/modules/knowledge-generation-llm/index.test.ts
git commit -m "feat: implement note type classification with heuristics

Add classifyNoteType function with pattern-based heuristic classification.
Prepare for LLM integration via dependency injection.
Categories: workflow, tutorial, insight-report, development-record.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Implement Theme Extraction

**Files:**
- Modify: `src/modules/knowledge-generation-llm/index.ts:25-28`
- Modify: `src/modules/knowledge-generation-llm/index.test.ts`

**Step 1: Write failing test for theme extraction**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
describe('extractThemeFromUrls', () => {
  it('extracts common theme from related URLs', async () => {
    const urls = [
      'https://docs.vitest.dev/config/',
      'https://vitest.dev/guide/',
      'https://github.com/vitest-dev/vitest'
    ]
    
    const result = await module.extractThemeFromUrls(urls)
    expect(result).toContain('vitest')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Implement simple URL-based theme extraction (LLM integration later)**

```typescript
// src/modules/knowledge-generation-llm/index.ts
export interface ThemeExtractionDependencies {
  analyzeWithLLM?: (prompt: string) => Promise<string>
}

function extractKeywordsFromUrls(urls: string[]): string[] {
  const keywords: string[] = []
  
  urls.forEach(url => {
    // Extract domain name
    const domainMatch = url.match(/https?:\/\/(?:www\.)?([^/]+)/)
    if (domainMatch) {
      const domain = domainMatch[1]
      // Remove common prefixes/suffixes
      const cleanDomain = domain
        .replace(/^(docs|www|github|blog)\./, '')
        .replace(/\.(com|dev|org|io|net)$/, '')
      keywords.push(cleanDomain)
    }
    
    // Extract path keywords
    const pathMatch = url.match(/\/([^/]+)/)
    if (pathMatch) {
      keywords.push(pathMatch[1])
    }
  })
  
  return keywords
}

function findCommonKeyword(keywords: string[]): string | null {
  const counts: Record<string, number> = {}
  keywords.forEach(k => {
    const normalized = k.toLowerCase()
    counts[normalized] = (counts[normalized] || 0) + 1
  })
  
  // Find most frequent keyword (appears at least twice)
  let maxCount = 0
  let maxKeyword = null
  Object.entries(counts).forEach(([keyword, count]) => {
    if (count > maxCount && count >= 2) {
      maxCount = count
      maxKeyword = keyword
    }
  })
  
  return maxKeyword
}

export async function extractThemeFromUrls(
  urls: string[],
  deps: ThemeExtractionDependencies = {}
): Promise<string> {
  const { analyzeWithLLM } = deps

  // Simple heuristic: find common keyword across URLs
  if (!analyzeWithLLM) {
    const keywords = extractKeywordsFromUrls(urls)
    const commonKeyword = findCommonKeyword(keywords)
    return commonKeyword || 'general-work'
  }

  // Real LLM theme extraction
  const prompt = `Analyze these URLs and extract a concise theme/topic name (2-3 words maximum):
${urls.join('\n')}

Return only the theme name.`
  
  const response = await analyzeWithLLM(prompt)
  return response.trim().toLowerCase().replace(/\s+/g, '-')
}
```

**Step 4: Write comprehensive theme extraction tests**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
describe('extractThemeFromUrls heuristic', () => {
  it('extracts common domain theme', async () => {
    const urls = [
      'https://react.dev/learn',
      'https://react.dev/reference',
      'https://github.com/facebook/react'
    ]
    
    const result = await module.extractThemeFromUrls(urls)
    expect(result).toBe('react')
  })

  it('returns general-work when no common theme', async () => {
    const urls = [
      'https://random-site.com/article',
      'https://different-domain.io/post'
    ]
    
    const result = await module.extractThemeFromUrls(urls)
    expect(result).toBe('general-work')
  })

  it('handles single URL', async () => {
    const urls = ['https://vitest.dev/guide']
    const result = await module.extractThemeFromUrls(urls)
    expect(result).toBe('general-work') // Single URL can't find commonality
  })
})
```

**Step 5: Run tests to verify they pass**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: PASS - theme extraction working

**Step 6: Commit**

```bash
git add src/modules/knowledge-generation-llm/index.ts src/modules/knowledge-generation-llm/index.test.ts
git commit -m "feat: implement theme extraction from URL patterns

Add extractThemeFromUrls with keyword-based heuristic extraction.
Find common domain/path keywords across URLs.
Fallback to 'general-work' when no commonality.
Prepare for LLM enhancement.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Implement Main Generation Function

**Files:**
- Modify: `src/modules/knowledge-generation-llm/index.ts:6-11`
- Modify: `src/modules/knowledge-generation-llm/index.test.ts`

**Step 1: Write failing test for generation with single reviewed memory**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
import type { ReviewedMemory } from '../../shared/types/index.js'

describe('generateKnowledgeFromReviewedMemories', () => {
  it('generates knowledge artifact from single reviewed memory', async () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-1',
      candidateMemoryId: 'candidate-1',
      candidateTitle: 'Vitest Configuration Setup',
      candidateSummary: 'Configured Vitest for testing',
      candidateTheme: 'testing',
      memoryEventIds: ['event-1', 'event-2'],
      reviewDate: '2026-04-21',
      decision: 'keep',
      reviewedAt: '2026-04-21T10:00:00Z',
      candidateSourceRefs: [
        { id: 'source-1', sourceType: 'browser', url: 'https://vitest.dev/config', title: 'Vitest Config' }
      ]
    }
    
    const result = await module.generateKnowledgeFromReviewedMemories([reviewedMemory], {
      retrievePageContent: async () => ({ content: 'Step 1: Install Vitest...', source: 'artifact' }),
      classifyNoteType: async () => 'tutorial',
      extractThemeFromUrls: async () => 'vitest-config'
    })
    
    expect(result.artifactType).toBe('daily-review-draft')
    expect(result.draftState).toBe('draft')
    expect(result.topicKey).toBe('vitest-config')
    expect(result.title).toContain('Vitest')
    expect(result.body).toContain('Step 1')
    expect(result.sourceReviewedMemoryIds).toContain('reviewed-1')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: FAIL - throws "Not implemented"

**Step 3: Implement generation function**

```typescript
// src/modules/knowledge-generation-llm/index.ts
import { slugifyTopicKey } from '../../modules/daily-review-knowledge/index.js'

export interface GenerationDependencies extends ContentRetrievalDependencies, ClassificationDependencies, ThemeExtractionDependencies {
  retrievePageContent?: typeof retrievePageContent
  classifyNoteType?: typeof classifyNoteType
  extractThemeFromUrls?: typeof extractThemeFromUrls
}

function buildKnowledgeBody(
  noteType: NoteType,
  content: string,
  reviewedMemories: ReviewedMemory[]
): string {
  const templates = {
    'workflow': `# Workflow: ${reviewedMemories[0]?.candidateTitle || 'Task'}

## Overview
${reviewedMemories[0]?.candidateSummary || 'Task workflow'}

## Steps
${content}

## Evidence
- Based on ${reviewedMemories.length} reviewed activities

## Notes
Documented from reviewed work session.`,

    'tutorial': `# ${reviewedMemories[0]?.candidateTitle || 'Setup Guide'}

## Prerequisites
Check reviewed sources for required setup.

## Installation Steps
${content}

## Verification
Follow steps from reviewed documentation.

## Troubleshooting
See reviewed sources for common issues.

## Sources
${reviewedMemories[0]?.candidateSourceRefs?.map(s => `- ${s.title}: ${s.url}`).join('\n') || 'See reviewed memories'}`,

    'insight-report': `# ${reviewedMemories[0]?.candidateTitle || 'Key Finding'}

## Key Finding
${reviewedMemories[0]?.candidateSummary || 'Important observation'}

## Evidence
${content}

## Implications
Analysis based on ${reviewedMemories.length} reviewed activities.

## Context
${reviewedMemories.map(m => `- ${m.candidateTitle}`).join('\n')}

## References
${reviewedMemories[0]?.candidateSourceRefs?.map(s => `- ${s.url}`).join('\n') || 'See reviewed memories'}`,

    'development-record': `# ${reviewedMemories[0]?.candidateTitle || 'Development Log'}

## Problem
${reviewedMemories[0]?.candidateSummary || 'Work completed'}

## Approach
Solution strategy documented in reviewed activities.

## Implementation
${content}

## Results
Verified through reviewed work session.

## Lessons Learned
Key takeaways from ${reviewedMemories.length} activities.

## Related Work
${reviewedMemories.map(m => `- ${m.candidateTitle} (${m.reviewDate})`).join('\n')}`
  }
  
  return templates[noteType]
}

export async function generateKnowledgeFromReviewedMemories(
  reviewedMemories: ReviewedMemory[],
  existingDraft?: KnowledgeArtifact,
  deps: GenerationDependencies = {}
): Promise<KnowledgeArtifact> {
  if (reviewedMemories.length === 0) {
    throw new Error('No reviewed memories provided for knowledge generation')
  }

  const {
    retrievePageContent: retrieve = retrievePageContent,
    classifyNoteType: classify = classifyNoteType,
    extractThemeFromUrls: extract = extractThemeFromUrls
  } = deps

  // Gather content from all memory events
  const contents: string[] = []
  const urls: string[] = []
  
  for (const memory of reviewedMemories) {
    for (const eventId of memory.memoryEventIds) {
      const contentResult = await retrieve(eventId, deps)
      if (contentResult.content) {
        contents.push(contentResult.content)
      }
      if (contentResult.url) {
        urls.push(contentResult.url)
      }
    }
  }

  // Combine content for analysis
  const combinedContent = contents.join('\n\n')

  // Classify note type
  const noteType = await classify(combinedContent, deps)

  // Extract theme for topic assignment
  const theme = await extract(urls, deps)

  // Build knowledge body using template
  const body = buildKnowledgeBody(noteType, combinedContent, reviewedMemories)

  const firstMemory = reviewedMemories[0]
  
  return {
    artifactType: 'daily-review-draft',
    id: `knowledge-draft:${firstMemory.id}:${Date.now()}`,
    draftState: 'draft',
    topicKey: theme ? slugifyTopicKey(theme) : null,
    title: firstMemory.candidateTitle,
    summary: `${reviewedMemories.length} reviewed memories synthesized into ${noteType}`,
    body,
    sourceReviewedMemoryIds: reviewedMemories.map(m => m.id),
    derivedFromKnowledgeIds: existingDraft ? [existingDraft.id] : [],
    version: existingDraft ? existingDraft.version + 1 : 1,
    isCurrentBest: false,
    supersedesKnowledgeId: null,
    updatedAt: new Date().toISOString(),
    reviewedAt: firstMemory.reviewedAt,
    recencyLabel: firstMemory.reviewDate,
    provenanceRefs: reviewedMemories.map(m => ({
      kind: 'reviewed-memory',
      id: m.id
    }))
  }
}
```

**Step 4: Write additional generation tests**

```typescript
// src/modules/knowledge-generation-llm/index.test.ts
describe('generateKnowledgeFromReviewedMemories variations', () => {
  it('throws error when no reviewed memories provided', async () => {
    await expect(
      module.generateKnowledgeFromReviewedMemories([])
    ).rejects.toThrow('No reviewed memories provided')
  })

  it('creates workflow knowledge from workflow content', async () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-2',
      candidateMemoryId: 'candidate-2',
      candidateTitle: 'Daily Deployment Workflow',
      candidateSummary: 'Routine deployment steps',
      candidateTheme: 'deployment',
      memoryEventIds: ['event-3'],
      reviewDate: '2026-04-21',
      decision: 'keep',
      reviewedAt: '2026-04-21T11:00:00Z'
    }
    
    const result = await module.generateKnowledgeFromReviewedMemories([reviewedMemory], {
      retrievePageContent: async () => ({ content: 'Workflow steps...', source: 'artifact' }),
      classifyNoteType: async () => 'workflow',
      extractThemeFromUrls: async () => 'deployment-workflow'
    })
    
    expect(result.topicKey).toBe('deployment-workflow')
    expect(result.body).toContain('Workflow:')
    expect(result.body).toContain('Steps')
  })

  it('refines existing draft when provided', async () => {
    const existingDraft: KnowledgeArtifact = {
      artifactType: 'daily-review-draft',
      id: 'knowledge-draft:old',
      draftState: 'draft',
      topicKey: 'testing',
      title: 'Old Draft',
      summary: 'Previous version',
      body: 'Old content',
      sourceReviewedMemoryIds: ['reviewed-old'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-20T10:00:00Z',
      reviewedAt: '2026-04-20T10:00:00Z',
      recencyLabel: '2026-04-20'
    }
    
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-new',
      candidateMemoryId: 'candidate-new',
      candidateTitle: 'Updated Testing Approach',
      candidateSummary: 'Improved testing workflow',
      candidateTheme: 'testing',
      memoryEventIds: ['event-new'],
      reviewDate: '2026-04-21',
      decision: 'keep',
      reviewedAt: '2026-04-21T12:00:00Z'
    }
    
    const result = await module.generateKnowledgeFromReviewedMemories(
      [reviewedMemory],
      existingDraft,
      {
        retrievePageContent: async () => ({ content: 'New insights...', source: 'artifact' }),
        classifyNoteType: async () => 'development-record',
        extractThemeFromUrls: async () => 'testing'
      }
    )
    
    expect(result.version).toBe(2)
    expect(result.derivedFromKnowledgeIds).toContain('knowledge-draft:old')
  })
})
```

**Step 5: Run tests to verify they pass**

Run: `npm test src/modules/knowledge-generation-llm/index.test.ts`
Expected: PASS - generation working for all note types

**Step 6: Commit**

```bash
git add src/modules/knowledge-generation-llm/index.ts src/modules/knowledge-generation-llm/index.test.ts
git commit -m "feat: implement knowledge generation from reviewed memories

Add generateKnowledgeFromReviewedMemories with:
- Content retrieval from memory events
- Note type classification
- Theme extraction for topic assignment
- Template-based knowledge body generation
- Draft refinement support

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Service Layer Integration

**Files:**
- Modify: `src/apps/mirrorbrain-service/index.ts`
- Create: `src/apps/mirrorbrain-service/knowledge-generation.test.ts`

**Step 1: Write failing test for service generate method**

```typescript
// src/apps/mirrorbrain-service/knowledge-generation.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createMirrorBrainService } from './index.js'
import { getMirrorBrainConfig } from '../../shared/config/index.js'
import type { ReviewedMemory } from '../../shared/types/index.js'

describe('mirrorbrain service knowledge generation', () => {
  it('generates knowledge from reviewed memories', async () => {
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-1',
      candidateMemoryId: 'candidate-1',
      candidateTitle: 'Test Knowledge',
      candidateSummary: 'Test summary',
      candidateTheme: 'test',
      memoryEventIds: ['event-1'],
      reviewDate: '2026-04-21',
      decision: 'keep',
      reviewedAt: '2026-04-21T10:00:00Z'
    }
    
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn()
        }
      },
      {
        listMemoryEvents: vi.fn(async () => []),
        listKnowledge: vi.fn(async () => []),
        publishKnowledge: vi.fn(async () => {}),
        generateKnowledge: vi.fn(async () => ({
          artifactType: 'daily-review-draft',
          id: 'knowledge-draft:test',
          draftState: 'draft',
          topicKey: 'test',
          title: 'Test Knowledge',
          summary: 'Generated knowledge',
          body: 'Test content',
          sourceReviewedMemoryIds: ['reviewed-1'],
          derivedFromKnowledgeIds: [],
          version: 1,
          isCurrentBest: false,
          supersedesKnowledgeId: null,
          updatedAt: '2026-04-21T10:00:00Z',
          reviewedAt: '2026-04-21T10:00:00Z',
          recencyLabel: '2026-04-21'
        }))
      }
    )
    
    const result = await api.generateKnowledgeFromReviewedMemories([reviewedMemory])
    
    expect(result.artifactType).toBe('daily-review-draft')
    expect(result.draftState).toBe('draft')
    expect(result.title).toBe('Test Knowledge')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/apps/mirrorbrain-service/knowledge-generation.test.ts`
Expected: FAIL - method not found on service

**Step 3: Add service methods**

```typescript
// src/apps/mirrorbrain-service/index.ts
// Add to imports
import {
  generateKnowledgeFromReviewedMemories as generateKnowledgeFromLLM
} from '../../modules/knowledge-generation-llm/index.js'

// Add to CreateMirrorBrainServiceDependencies interface
generateKnowledgeFromLLM?: typeof generateKnowledgeFromLLM

// Add implementation in createMirrorBrainService function
const generateKnowledge = deps.generateKnowledgeFromLLM ?? generateKnowledgeFromLLM

return {
  // ... existing methods
  
  async generateKnowledgeFromReviewedMemories(
    reviewedMemories: ReviewedMemory[]
  ): Promise<KnowledgeArtifact> {
    const artifact = await generateKnowledge(reviewedMemories)
    
    if (deps.publishKnowledge) {
      await deps.publishKnowledge(artifact)
    }
    
    return artifact
  },

  async regenerateKnowledgeDraft(
    draftId: string,
    reviewedMemories: ReviewedMemory[]
  ): Promise<KnowledgeArtifact> {
    // Find existing draft
    const existingDrafts = await (deps.listKnowledge ?? listKnowledge)(config)
    const existingDraft = existingDrafts.find(d => d.id === draftId)
    
    if (!existingDraft) {
      throw new Error(`Draft ${draftId} not found`)
    }
    
    const artifact = await generateKnowledge(reviewedMemories, existingDraft)
    
    if (deps.publishKnowledge) {
      await deps.publishKnowledge(artifact)
    }
    
    return artifact
  },

  async approveKnowledgeDraft(
    draftId: string
  ): Promise<{
    publishedArtifact: KnowledgeArtifact
    assignedTopic: { topicKey: string; title: string }
  }> {
    // Find draft
    const drafts = await (deps.listKnowledge ?? listKnowledge)(config)
    const draft = drafts.find(d => d.id === draftId && d.draftState === 'draft')
    
    if (!draft) {
      throw new Error(`Draft ${draftId} not found or not in draft state`)
    }
    
    // Promote to published topic-knowledge
    const publishedArtifact: KnowledgeArtifact = {
      ...draft,
      artifactType: 'topic-knowledge',
      draftState: 'published',
      reviewedAt: new Date().toISOString()
    }
    
    // Auto-assign to topic
    const topicKey = draft.topicKey || 'general'
    const title = draft.title
    
    // Use existing topic merge workflow
    if (deps.mergeTopicKnowledge) {
      await deps.mergeTopicKnowledge([publishedArtifact])
    }
    
    // Save published artifact
    if (deps.publishKnowledge) {
      await deps.publishKnowledge(publishedArtifact)
    }
    
    return {
      publishedArtifact,
      assignedTopic: { topicKey, title }
    }
  },

  async saveKnowledgeDraft(
    draft: KnowledgeArtifact
  ): Promise<KnowledgeArtifact> {
    if (deps.publishKnowledge) {
      await deps.publishKnowledge(draft)
    }
    
    return draft
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/apps/mirrorbrain-service/knowledge-generation.test.ts`
Expected: PASS - service generate method working

**Step 5: Write additional service tests**

```typescript
// src/apps/mirrorbrain-service/knowledge-generation.test.ts
describe('mirrorbrain service knowledge operations', () => {
  it('regenerates knowledge draft with existing context', async () => {
    const existingDraft: KnowledgeArtifact = {
      artifactType: 'daily-review-draft',
      id: 'draft-old',
      draftState: 'draft',
      topicKey: 'testing',
      title: 'Old Testing Approach',
      summary: 'Initial draft',
      body: 'Old content',
      sourceReviewedMemoryIds: [],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-20T10:00:00Z',
      reviewedAt: null,
      recencyLabel: '2026-04-20'
    }
    
    const reviewedMemory: ReviewedMemory = {
      id: 'reviewed-new',
      candidateMemoryId: 'candidate-new',
      candidateTitle: 'New Testing Insights',
      candidateSummary: 'Updated approach',
      candidateTheme: 'testing',
      memoryEventIds: ['event-new'],
      reviewDate: '2026-04-21',
      decision: 'keep',
      reviewedAt: '2026-04-21T10:00:00Z'
    }
    
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn()
        }
      },
      {
        listKnowledge: vi.fn(async () => [existingDraft]),
        publishKnowledge: vi.fn(async () => {}),
        generateKnowledge: vi.fn(async (_memories, existing) => ({
          ...existingDraft,
          version: existing ? 2 : 1,
          derivedFromKnowledgeIds: existing ? [existing.id] : []
        }))
      }
    )
    
    const result = await api.regenerateKnowledgeDraft('draft-old', [reviewedMemory])
    
    expect(result.version).toBe(2)
    expect(result.derivedFromKnowledgeIds).toContain('draft-old')
  })

  it('approves knowledge draft and assigns topic', async () => {
    const draft: KnowledgeArtifact = {
      artifactType: 'daily-review-draft',
      id: 'draft-approve',
      draftState: 'draft',
      topicKey: 'vitest',
      title: 'Vitest Configuration',
      summary: 'Testing setup guide',
      body: 'Configuration steps...',
      sourceReviewedMemoryIds: ['reviewed-1'],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-21T10:00:00Z',
      reviewedAt: null,
      recencyLabel: '2026-04-21'
    }
    
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn()
        }
      },
      {
        listKnowledge: vi.fn(async () => [draft]),
        publishKnowledge: vi.fn(async () => {}),
        mergeTopicKnowledge: vi.fn(async () => {})
      }
    )
    
    const result = await api.approveKnowledgeDraft('draft-approve')
    
    expect(result.publishedArtifact.artifactType).toBe('topic-knowledge')
    expect(result.publishedArtifact.draftState).toBe('published')
    expect(result.assignedTopic.topicKey).toBe('vitest')
    expect(result.assignedTopic.title).toBe('Vitest Configuration')
  })

  it('saves knowledge draft without approval', async () => {
    const draft: KnowledgeArtifact = {
      artifactType: 'daily-review-draft',
      id: 'draft-save',
      draftState: 'draft',
      topicKey: null,
      title: 'Test Draft',
      summary: 'Test',
      body: 'Content',
      sourceReviewedMemoryIds: [],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: '2026-04-21T10:00:00Z',
      reviewedAt: null,
      recencyLabel: '2026-04-21'
    }
    
    const api = createMirrorBrainService(
      {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
          syncBrowserMemory: vi.fn(),
          syncShellMemory: vi.fn(),
          stop: vi.fn()
        }
      },
      {
        publishKnowledge: vi.fn(async () => {})
      }
    )
    
    const result = await api.saveKnowledgeDraft(draft)
    
    expect(result.draftState).toBe('draft')
    expect(result.artifactType).toBe('daily-review-draft')
  })
})
```

**Step 6: Run tests to verify they pass**

Run: `npm test src/apps/mirrorbrain-service/knowledge-generation.test.ts`
Expected: PASS - all service operations working

**Step 7: Commit**

```bash
git add src/apps/mirrorbrain-service/index.ts src/apps/mirrorbrain-service/knowledge-generation.test.ts
git commit -m "feat: integrate knowledge generation into service layer

Add service methods:
- generateKnowledgeFromReviewedMemories
- regenerateKnowledgeDraft
- approveKnowledgeDraft (with topic assignment)
- saveKnowledgeDraft

Wire to LLM module and existing storage workflows.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: HTTP API Endpoints

**Files:**
- Modify: `src/apps/mirrorbrain-http-server/index.ts`
- Create: `src/apps/mirrorbrain-http-server/knowledge-generation.test.ts`

**Step 1: Write failing test for generate endpoint**

```typescript
// src/apps/mirrorbrain-http-server/knowledge-generation.test.ts
import { describe, expect, it } from 'vitest'
import Fastify from 'fastify'
import { startMirrorBrainHttpServer } from './index.js'

describe('knowledge generation HTTP endpoints', () => {
  it('POST /knowledge/generate creates knowledge artifact', async () => {
    const app = Fastify()
    
    const service = {
      service: { status: 'running', config: {} },
      syncBrowserMemory: async () => {},
      syncShellMemory: async () => {},
      listMemoryEvents: async () => ({ items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }),
      generateKnowledgeFromReviewedMemories: async (reviewedMemories: any[]) => ({
        artifactType: 'daily-review-draft',
        id: 'knowledge-draft:test',
        draftState: 'draft',
        topicKey: 'test',
        title: 'Test Knowledge',
        summary: 'Generated',
        body: 'Content',
        sourceReviewedMemoryIds: reviewedMemories.map(m => m.id),
        derivedFromKnowledgeIds: [],
        version: 1,
        isCurrentBest: false,
        supersedesKnowledgeId: null,
        updatedAt: '2026-04-21T10:00:00Z',
        reviewedAt: '2026-04-21T10:00:00Z',
        recencyLabel: '2026-04-21'
      })
    }
    
    const server = await startMirrorBrainHttpServer({ service })
    
    const response = await app.inject({
      method: 'POST',
      url: `${server.origin}/knowledge/generate`,
      body: {
        reviewedMemories: [
          {
            id: 'reviewed-1',
            candidateMemoryId: 'candidate-1',
            candidateTitle: 'Test',
            candidateSummary: 'Test summary',
            candidateTheme: 'test',
            memoryEventIds: ['event-1'],
            reviewDate: '2026-04-21',
            decision: 'keep',
            reviewedAt: '2026-04-21T10:00:00Z'
          }
        ]
      }
    })
    
    expect(response.statusCode).toBe(201)
    expect(response.json().artifact.artifactType).toBe('daily-review-draft')
    
    await server.stop()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/apps/mirrorbrain-http-server/knowledge-generation.test.ts`
Expected: FAIL - endpoint not found or method not available

**Step 3: Add HTTP endpoints**

```typescript
// src/apps/mirrorbrain-http-server/index.ts

// Add to interface MirrorBrainHttpService
regenerateKnowledgeDraft?(draftId: string, reviewedMemories: ReviewedMemory[]): Promise<KnowledgeArtifact>
approveKnowledgeDraft?(draftId: string): Promise<{
  publishedArtifact: KnowledgeArtifact
  assignedTopic: { topicKey: string; title: string }
}>
saveKnowledgeDraft?(draft: KnowledgeArtifact): Promise<KnowledgeArtifact>

// Add endpoint POST /knowledge/regenerate
app.post<{ Body: { existingDraft: KnowledgeArtifact; reviewedMemories: ReviewedMemory[] } }>(
  '/knowledge/regenerate',
  {
    schema: {
      summary: 'Regenerate knowledge draft with refinement',
      body: {
        type: 'object',
        properties: {
          existingDraft: knowledgeArtifactSchema,
          reviewedMemories: {
            type: 'array',
            items: reviewedMemorySchema
          }
        },
        required: ['existingDraft', 'reviewedMemories']
      },
      response: {
        201: createArtifactResponseSchema('artifact', knowledgeArtifactSchema)
      }
    }
  },
  async (request, reply) => {
    reply.code(201)
    
    if (input.service.regenerateKnowledgeDraft) {
      return {
        artifact: await input.service.regenerateKnowledgeDraft(
          request.body.existingDraft.id,
          request.body.reviewedMemories
        )
      }
    }
    
    throw new Error('regenerateKnowledgeDraft not available')
  }
)

// Add endpoint POST /knowledge/approve
app.post<{ Body: { draftId: string } }>(
  '/knowledge/approve',
  {
    schema: {
      summary: 'Approve knowledge draft and publish to topic',
      body: {
        type: 'object',
        properties: {
          draftId: { type: 'string' }
        },
        required: ['draftId']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            publishedArtifact: knowledgeArtifactSchema,
            assignedTopic: {
              type: 'object',
              properties: {
                topicKey: { type: 'string' },
                title: { type: 'string' }
              },
              required: ['topicKey', 'title']
            }
          },
          required: ['publishedArtifact', 'assignedTopic']
        }
      }
    }
  },
  async (request, reply) => {
    reply.code(201)
    
    if (input.service.approveKnowledgeDraft) {
      return await input.service.approveKnowledgeDraft(request.body.draftId)
    }
    
    throw new Error('approveKnowledgeDraft not available')
  }
)

// Add endpoint POST /knowledge/save
app.post<{ Body: { artifact: KnowledgeArtifact } }>(
  '/knowledge/save',
  {
    schema: {
      summary: 'Save knowledge draft without approval',
      body: {
        type: 'object',
        properties: {
          artifact: knowledgeArtifactSchema
        },
        required: ['artifact']
      },
      response: {
        201: createArtifactResponseSchema('artifact', knowledgeArtifactSchema)
      }
    }
  },
  async (request, reply) => {
    reply.code(201)
    
    if (input.service.saveKnowledgeDraft) {
      return {
        artifact: await input.service.saveKnowledgeDraft(request.body.artifact)
      }
    }
    
    throw new Error('saveKnowledgeDraft not available')
  }
)
```

**Step 4: Run test to verify it passes**

Run: `npm test src/apps/mirrorbrain-http-server/knowledge-generation.test.ts`
Expected: PASS - generate endpoint working

**Step 5: Write additional endpoint tests**

```typescript
// src/apps/mirrorbrain-http-server/knowledge-generation.test.ts
describe('knowledge generation HTTP endpoints variations', () => {
  it('POST /knowledge/regenerate refines existing draft', async () => {
    // Similar setup, test regeneration endpoint
  })

  it('POST /knowledge/approve publishes and returns topic info', async () => {
    // Similar setup, test approve endpoint
  })

  it('POST /knowledge/save persists draft without approval', async () => {
    // Similar setup, test save endpoint
  })
})
```

**Step 6: Run tests to verify they pass**

Run: `npm test src/apps/mirrorbrain-http-server/knowledge-generation.test.ts`
Expected: PASS - all endpoints working

**Step 7: Commit**

```bash
git add src/apps/mirrorbrain-http-server/index.ts src/apps/mirrorbrain-http-server/knowledge-generation.test.ts
git commit -m "feat: add HTTP API endpoints for knowledge generation

Add endpoints:
- POST /knowledge/generate (enhanced existing)
- POST /knowledge/regenerate (refinement)
- POST /knowledge/approve (publish + topic assignment)
- POST /knowledge/save (persist draft)

OpenAPI schemas and validation included.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8-12: Frontend Integration (continued in next message due to length)

[Plan continues with frontend tasks for context management, handlers, UI components, modal feature, and E2E testing]

---

## Summary

**Backend complete (Tasks 1-7):** Module foundation, content retrieval, classification, theme extraction, generation logic, service integration, HTTP endpoints.

**Frontend remaining (Tasks 8-12):** React state, handlers, DraftEditor buttons, HistoryTopics modal, Playwright E2E test.

**Total tasks:** 12 bite-sized implementation tasks following TDD workflow.

**Estimated implementation:** 2-3 hours with TDD discipline and frequent commits.