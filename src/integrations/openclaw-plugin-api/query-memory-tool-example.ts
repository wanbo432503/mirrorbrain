import type {
  MemoryQueryInput,
  MemoryQueryResult,
} from '../../shared/types/index.js';

interface CreateQueryMemoryToolExampleInput {
  executeQuery(input: MemoryQueryInput): Promise<MemoryQueryResult>;
}

interface QueryMemoryToolExample {
  name: 'query_memory';
  description: string;
  execute(input: MemoryQueryInput): Promise<MemoryQueryResult>;
}

export function createQueryMemoryToolExample(
  input: CreateQueryMemoryToolExampleInput,
): QueryMemoryToolExample {
  return {
    name: 'query_memory',
    description:
      'Retrieve theme-level MirrorBrain memory results for a natural-language query.',
    execute: (query) => input.executeQuery(query),
  };
}

export function composeQueryMemoryAnswer(result: MemoryQueryResult): string {
  const sections = result.items
    .map((item, index) => {
      const sourceHint = item.sourceRefs[0]
        ? ` Source: ${item.sourceRefs[0].sourceType} at ${item.sourceRefs[0].timestamp}.`
        : '';

      return `${index + 1}. ${item.title}: ${item.summary}${sourceHint}`;
    });

  if (result.explanation) {
    sections.unshift(result.explanation);
  }

  return sections.join('\n\n');
}
