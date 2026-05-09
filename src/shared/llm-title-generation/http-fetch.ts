import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface LLMConfig {
  apiBase: string;
  apiKey: string;
  model: string;
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

function readRequiredEnvConfig(env: NodeJS.ProcessEnv): LLMConfig | null {
  const apiBase = env.MIRRORBRAIN_LLM_API_BASE?.trim();
  const apiKey = env.MIRRORBRAIN_LLM_API_KEY?.trim();
  const model = env.MIRRORBRAIN_LLM_MODEL?.trim();

  if (!apiBase || !apiKey || !model) {
    return null;
  }

  return {
    apiBase,
    apiKey,
    model,
  };
}

/**
 * Load LLM config from MirrorBrain env first, then ~/.openviking/ov.conf.
 */
export async function loadLLMConfig(): Promise<LLMConfig> {
  if (cachedConfig) return cachedConfig;

  const envConfig = readRequiredEnvConfig(process.env);
  if (envConfig !== null) {
    cachedConfig = envConfig;
    return cachedConfig;
  }

  const configPath = join(homedir(), '.openviking', 'ov.conf');
  const configContent = await readFile(configPath, 'utf-8');
  const config = JSON.parse(configContent);

  cachedConfig = {
    apiBase: config.vlm.api_base,
    apiKey: config.vlm.api_key,
    model: config.vlm.model,
  };

  return cachedConfig;
}

/**
 * Generate natural language title using LLM (HTTP fetch, no SDK dependency)
 */
export async function generateTitleWithLLM(
  input: TitleGenerationInput
): Promise<TitleGenerationOutput> {
  const config = await loadLLMConfig();

  // Prepare context
  const uniqueUrls = [...new Set(input.urls)].slice(0, 10);
  const uniqueTitles = [...new Set(input.titles.filter(Boolean))].slice(0, 10);
  const uniqueHosts = [...new Set(input.hosts)];
  const contentSnippets = input.pageContents.filter(Boolean).slice(0, 5).map(c => c.slice(0, 300));

  const durationMinutes = Math.max(1, Math.round(
    (new Date(input.timeRange.endAt).getTime() - new Date(input.timeRange.startAt).getTime()) / 60000
  ));

  // Build prompt - concise and direct
  const prompt = `为以下浏览活动生成title和summary，返回纯JSON（不要解释）：

活动: ${uniqueTitles.slice(0, 3).join('; ') || uniqueHosts[0] || 'Unknown'}
时长: ${durationMinutes}分钟
网站: ${uniqueHosts.slice(0, 3).join(', ') || 'N/A'}

要求:
- title: 50字内，动词+主题（例: "购买云服务配置", "学习API教程", "修复bug"）
- summary: 100字内，一句话说明目的或结果
- 语言匹配页面标题（中文标题用中文，英文用英文）
- 不要拼接无意义单词

只返回JSON，格式: {"title":"...", "summary":"..."}`;

  try {
    // Call OpenAI-compatible API via HTTP fetch
    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');

    // Parse JSON (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : content;
    const parsed = JSON.parse(jsonContent.trim()) as TitleGenerationOutput;

    return {
      title: parsed.title.trim().slice(0, 60),
      summary: parsed.summary?.trim().slice(0, 120) || `${parsed.title} (${durationMinutes}min)`,
    };
  } catch (error) {
    console.error('[LLM Error]', error);

    // Fallback: use first title or host
    const fallbackTitle = uniqueTitles[0]?.slice(0, 60) || `Work on ${uniqueHosts[0] || 'Unknown'}`;
    return {
      title: fallbackTitle,
      summary: `${uniqueHosts.join(' & ') || 'task'} (${durationMinutes}min)`,
    };
  }
}
