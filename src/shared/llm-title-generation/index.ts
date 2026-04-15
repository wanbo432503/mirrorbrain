import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface LLMConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  provider: string;
}

interface TitleGenerationInput {
  urls: string[];
  titles: string[];
  pageContents: string[];
  hosts: string[];
  timeRange: {
    startAt: string;
    endAt: string;
  };
}

interface TitleGenerationOutput {
  title: string;
  summary: string;
}

let cachedConfig: LLMConfig | null = null;

/**
 * Load LLM config from ~/.openviking/ov.conf
 * Uses vlm model for text generation
 */
export async function loadLLMConfig(): Promise<LLMConfig> {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const configPath = join(homedir(), '.openviking', 'ov.conf');

  try {
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Use VLM model for text generation (qwen3-vl-235b)
    const vlmConfig = config.vlm;

    cachedConfig = {
      apiBase: vlmConfig.api_base,
      apiKey: vlmConfig.api_key,
      model: vlmConfig.model,
      provider: vlmConfig.provider,
    };

    return cachedConfig;
  } catch (error) {
    throw new Error(`Failed to load LLM config from ${configPath}: ${error}`);
  }
}

/**
 * Create OpenAI-compatible client from config
 */
export async function createLLMClient(): Promise<OpenAI> {
  const config = await loadLLMConfig();

  return new OpenAI({
    baseURL: config.apiBase,
    apiKey: config.apiKey,
  });
}

/**
 * Generate natural language title and summary using LLM
 *
 * @param input - Context data: URLs, titles, page content snippets, hosts
 * @returns Natural language title and summary
 */
export async function generateTitleWithLLM(
  input: TitleGenerationInput
): Promise<TitleGenerationOutput> {
  const client = await createLLMClient();
  const config = await loadLLMConfig();

  // Prepare context for LLM
  const uniqueUrls = Array.from(new Set(input.urls)).slice(0, 10); // Limit to avoid too large context
  const uniqueTitles = Array.from(new Set(input.titles.filter(t => t && t.trim())))
    .slice(0, 10);
  const uniqueHosts = Array.from(new Set(input.hosts));

  // Aggregate page content snippets (truncated to avoid context overflow)
  const contentSnippets = input.pageContents
    .filter(c => c && c.trim())
    .slice(0, 5)
    .map(c => c.slice(0, 500)); // 500 chars per snippet

  // Infer time duration
  const startAt = new Date(input.timeRange.startAt);
  const endAt = new Date(input.timeRange.endAt);
  const durationMinutes = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 60000));

  // Build prompt for LLM
  const prompt = `You are a memory review assistant. Generate a natural language title and summary for a cluster of browser activities.

Context:
- URLs visited: ${uniqueUrls.join(', ') || 'N/A'}
- Page titles: ${uniqueTitles.join(', ') || 'N/A'}
- Hosts: ${uniqueHosts.join(', ') || 'N/A'}
- Time range: ${durationMinutes} minutes
- Content snippets (first 500 chars of each page):
${contentSnippets.map((c, i) => `[${i + 1}] ${c}`).join('\n') || 'N/A'}

Requirements:
1. Generate a concise TITLE (max 60 chars) that describes what the user was doing
2. Generate a SUMMARY (1 sentence, max 120 chars) that explains the task purpose or outcome
3. Use the language that appears most in page titles/content (prefer Chinese if Chinese appears, English otherwise)
4. Avoid meaningless word combinations (e.g., "Agent The Your", "Hier Nach Wenn")
5. Infer task type from context: programming, shopping, entertainment, learning, reading, etc.
6. Use natural action verbs: "购买", "学习", "阅读", "修复", "实现", etc.

Examples of good titles:
- "购买华为云服务配置"
- "学习Claude API使用教程"
- "修复MirrorBrain候选者生成bug"
- "阅读Agent系统架构论文"

Examples of bad titles (avoid):
- "Review Agent The Your"
- "Enjoy Hier Nach Wenn"
- "Work on Loading"

Output format (JSON):
{
  "title": "...",
  "summary": "..."
}

Generate title and summary now:`;

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('LLM returned empty response');
    }

    // Parse JSON response
    // Handle potential markdown code blocks: ```json ... ```
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonContent.trim()) as TitleGenerationOutput;

    // Validate output
    if (!parsed.title || parsed.title.trim().length === 0) {
      throw new Error('LLM returned empty title');
    }

    if (!parsed.summary || parsed.summary.trim().length === 0) {
      parsed.summary = `${parsed.title} over ${durationMinutes} minutes.`;
    }

    return {
      title: parsed.title.trim().slice(0, 60), // Enforce max length
      summary: parsed.summary.trim().slice(0, 120),
    };
  } catch (error) {
    // Log error for debugging
    console.error('[LLM Title Generation Error]', error);

    // Fallback: use first page title or host-based title
    const fallbackTitle = uniqueTitles[0] || `Work on ${uniqueHosts[0] || 'Unknown'}`;
    const fallbackSummary = `Worked on ${uniqueHosts.join(' and ') || 'task'} over ${durationMinutes} minutes.`;

    return {
      title: fallbackTitle.slice(0, 60),
      summary: fallbackSummary.slice(0, 120),
    };
  }
}