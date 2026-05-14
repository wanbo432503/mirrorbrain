# Knowledge Article Preview

## Summary

`src/modules/knowledge-article-preview` builds the non-durable Preview-tab
knowledge article shown before a work-session candidate is reviewed and
published. It is the LLM-backed bridge between source-attributed memory
evidence and human-readable preview knowledge.

## Responsibility Boundary

The module owns:

- Converting one `WorkSessionCandidate` into one preview article request.
- Preserving candidate memory-event provenance and source refs in the synthesis
  prompt.
- Passing candidate evidence excerpts to the configured LLM through the
  knowledge-generation LLM prompt builder.
- Returning a typed `KnowledgeArticlePreview` with title, summary, body,
  knowledge type, source types, and memory-event count.
- Returning an explicit fallback article when LLM synthesis is unavailable.

The module does not own:

- Work-session candidate analysis.
- Human review, project assignment, draft persistence, or publication.
- Durable Knowledge Article storage.
- Frontend rendering state.
- Skill generation or execution.

## Key Interfaces

Input:

- `GenerateKnowledgeArticlePreviewInput`
  - `candidate`: pending `WorkSessionCandidate` with optional `evidenceItems`.
  - `topicName`: optional UI topic name used as the reviewed-memory theme in
    the prompt.
  - `generatedAt`: service-provided generation timestamp.
  - `analyzeWithLLM`: optional LLM function. When omitted or failing, the module
    returns a fallback article instead of throwing away the evidence.

Output:

- `KnowledgeArticlePreview`
  - `candidateId`
  - `title`
  - `summary`
  - `body`
  - `knowledgeType`
  - `sourceTypes`
  - `memoryEventCount`

## Data Flow

1. The service receives `POST /knowledge-articles/preview` from the Preview UI.
2. The preview module maps the candidate to a temporary reviewed-memory shape.
3. Candidate `evidenceItems` become retrieved source-content entries for the
   synthesis prompt. Browser evidence can include captured page-content
   excerpts from the upstream work-session analysis pipeline.
4. `buildKnowledgeSynthesisPrompt` produces the topic-oriented knowledge prompt.
5. The configured LLM returns Markdown for a human-readable article.
6. The module strips outer Markdown fences, derives a title from the first H1
   when present, and returns the preview without writing it to durable storage.

## Failure Modes And Constraints

- LLM configuration errors and runtime failures return a fallback Markdown
  article that clearly states synthesis was unavailable.
- Preview generation is not a publication gate. The article remains non-durable
  until the user explicitly reviews the candidate, creates a draft, and
  publishes it.
- If candidate evidence excerpts are missing, the fallback and LLM prompt still
  preserve memory-event ids, but article quality will be limited.

## Test Strategy

- Unit tests verify that candidate evidence excerpts are included in the LLM
  prompt and that the preview metadata is derived from the candidate and LLM
  response.
- Service tests verify that `createMirrorBrainService` wires the configured LLM
  into preview generation.
- HTTP and frontend tests verify the `/knowledge-articles/preview` route and
  Preview-tab Generate button call path.
