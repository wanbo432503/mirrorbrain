# Topic Knowledge Quality Evaluation

## Summary

This component slice is the Phase 3 Milestone 4 minimum quality-evaluation loop for topic knowledge. It provides:

- a deterministic rubric
- fixture-backed evaluation inputs
- a repeatable quality report format

The goal is not to replace human judgement. The goal is to make knowledge-quality changes explicit, comparable, and regression-testable.

## Responsibility Boundary

This slice is responsible for:

- scoring current-best topic artifacts against a small first-pass rubric
- comparing current-best topic artifacts against their upstream daily-review drafts
- checking provenance and history retention
- supporting fixture-backed integration verification

This slice is not responsible for:

- generating topic knowledge artifacts
- automatically rewriting topic knowledge
- ranking knowledge quality across the full repository corpus

## Key Interfaces

- `evaluateTopicKnowledgeQuality(...)`
- fixture files under `tests/fixtures/topic-knowledge-quality/`

## Rubric Dimensions

- summarization fidelity
- structure and reasoning quality
- future usefulness
- provenance completeness
- recency clarity

## Data Flow

1. A fixture supplies a daily-review draft, a current-best topic artifact, and topic history.
2. The evaluator scores the current-best artifact across the rubric dimensions.
3. The evaluator checks three comparison invariants:
   - current-best is at least as readable as the draft
   - provenance is retained
   - history is retained
4. The evaluator returns a structured report with scores, comparisons, notes, and an overall pass/fail.

## Test Strategy

- unit coverage in `src/workflows/topic-knowledge-quality/index.test.ts`
- fixture-backed integration coverage in `tests/integration/topic-knowledge-quality-evaluation.test.ts`

## Known Risks And Limitations

- the rubric is intentionally lightweight and deterministic, not a full semantic quality judge
- all current fixture scenarios still assume the topic artifact already exists; this slice evaluates quality, not generation
- future work may need richer scoring or human-review recording, but this minimum loop is enough to catch structural/provenance regressions
