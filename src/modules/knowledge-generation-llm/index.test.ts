import { describe, expect, it, vi } from 'vitest';

import type { MemoryEvent, ReviewedMemory } from '../../shared/types/index.js';
import {
  buildKnowledgeSynthesisPrompt,
  classifyNoteType,
  extractThemeFromUrls,
  generateKnowledgeFromReviewedMemories,
  retrievePageContent,
} from './index.js';

const reviewedMemory = (input: Partial<ReviewedMemory> = {}): ReviewedMemory => ({
  id: input.id ?? 'reviewed:candidate:browser:vitest',
  candidateMemoryId: input.candidateMemoryId ?? 'candidate:browser:vitest',
  candidateTitle: input.candidateTitle ?? 'Vitest setup and debugging',
  candidateSummary:
    input.candidateSummary ?? 'Reviewed Vitest docs and fixed failing test setup.',
  candidateTheme: input.candidateTheme ?? 'vitest testing',
  memoryEventIds: input.memoryEventIds ?? ['event:vitest-docs'],
  candidateSourceRefs:
    input.candidateSourceRefs ?? [
      {
        id: 'event:vitest-docs',
        sourceType: 'activitywatch-browser',
        timestamp: '2026-04-21T09:00:00.000Z',
        title: 'Vitest Config',
        url: 'https://vitest.dev/config/',
        contribution: 'primary',
      },
    ],
  reviewDate: input.reviewDate ?? '2026-04-21',
  decision: input.decision ?? 'keep',
  reviewedAt: input.reviewedAt ?? '2026-04-21T10:00:00.000Z',
});

describe('knowledge-generation-llm', () => {
  it('retrieves captured page text from memory events before fallbacks', async () => {
    const result = await retrievePageContent('event:vitest-docs', {
      getMemoryEvent: async (): Promise<MemoryEvent> => ({
        id: 'event:vitest-docs',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-04-21T09:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          title: 'Vitest Config',
          url: 'https://vitest.dev/config/',
          pageText: 'Step 1: install Vitest. Step 2: configure projects.',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-04-21T09:00:00.000Z',
        },
      }),
      loadBrowserPageContentArtifactFromWorkspace: vi.fn(),
      workspaceDir: '/tmp/mirrorbrain',
    });

    expect(result).toMatchObject({
      content: 'Step 1: install Vitest. Step 2: configure projects.',
      source: 'captured-page-text',
      url: 'https://vitest.dev/config/',
      title: 'Vitest Config',
    });
  });

  it('falls back to stored browser page content artifacts by URL', async () => {
    const loadBrowserPageContentArtifactFromWorkspace = vi.fn(async () => ({
      id: 'browser-page:url-vitest',
      url: 'https://vitest.dev/config/',
      title: 'Vitest Config',
      text: 'Configuring Vitest workspaces and setup files.',
      accessTimes: ['2026-04-21T09:00:00.000Z'],
      latestAccessedAt: '2026-04-21T09:00:00.000Z',
    }));

    const result = await retrievePageContent('event:vitest-docs', {
      getMemoryEvent: async (): Promise<MemoryEvent> => ({
        id: 'event:vitest-docs',
        sourceType: 'activitywatch-browser',
        sourceRef: 'aw-event-1',
        timestamp: '2026-04-21T09:00:00.000Z',
        authorizationScopeId: 'scope-browser',
        content: {
          title: 'Vitest Config',
          url: 'https://vitest.dev/config/',
        },
        captureMetadata: {
          upstreamSource: 'activitywatch',
          checkpoint: '2026-04-21T09:00:00.000Z',
        },
      }),
      loadBrowserPageContentArtifactFromWorkspace,
      workspaceDir: '/tmp/mirrorbrain',
    });

    expect(loadBrowserPageContentArtifactFromWorkspace).toHaveBeenCalledWith({
      workspaceDir: '/tmp/mirrorbrain',
      url: 'https://vitest.dev/config/',
    });
    expect(result).toMatchObject({
      content: 'Configuring Vitest workspaces and setup files.',
      source: 'artifact',
      url: 'https://vitest.dev/config/',
    });
  });

  it('classifies tutorial, workflow, insight, and development content', async () => {
    await expect(classifyNoteType('Step 1: Install. Step 2: Configure.')).resolves.toBe(
      'tutorial',
    );
    await expect(classifyNoteType('Daily workflow and repeatable procedure.')).resolves.toBe(
      'workflow',
    );
    await expect(classifyNoteType('Key finding and pattern from analysis.')).resolves.toBe(
      'insight-report',
    );
    await expect(classifyNoteType('Fixed a bug and implemented retry logic.')).resolves.toBe(
      'development-record',
    );
  });

  it('extracts a stable topic theme from related URLs', async () => {
    await expect(
      extractThemeFromUrls([
        'https://vitest.dev/config/',
        'https://vitest.dev/guide/',
        'https://github.com/vitest-dev/vitest',
      ]),
    ).resolves.toBe('vitest');
  });

  it('generates a structured draft grounded in source page content from all reviewed memories', async () => {
    const artifact = await generateKnowledgeFromReviewedMemories(
      [
        reviewedMemory(),
        reviewedMemory({
          id: 'reviewed:candidate:browser:playwright',
          candidateTitle: 'Playwright verification',
          candidateSummary: 'Checked browser verification steps.',
          candidateTheme: 'playwright testing',
          memoryEventIds: ['event:playwright'],
          candidateSourceRefs: [
            {
              id: 'event:playwright',
              sourceType: 'activitywatch-browser',
              timestamp: '2026-04-21T09:30:00.000Z',
              title: 'Playwright Tests',
              url: 'https://playwright.dev/docs/test-ui-mode',
              contribution: 'primary',
            },
          ],
        }),
      ],
      {
        now: () => '2026-04-21T12:00:00.000Z',
        retrievePageContent: async (eventId) => ({
          content:
            eventId === 'event:vitest-docs'
              ? 'Step 1: install Vitest. Step 2: configure projects.'
              : 'Use Playwright UI mode to inspect browser behavior.',
          source: 'captured-page-text',
          url:
            eventId === 'event:vitest-docs'
              ? 'https://vitest.dev/config/'
              : 'https://playwright.dev/docs/test-ui-mode',
          title: eventId,
        }),
      },
    );

    expect(artifact).toMatchObject({
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: 'testing',
      title: 'Vitest setup and debugging',
      sourceReviewedMemoryIds: [
        'reviewed:candidate:browser:vitest',
        'reviewed:candidate:browser:playwright',
      ],
      updatedAt: '2026-04-21T12:00:00.000Z',
    });
    expect(artifact.summary).toContain('2 reviewed memories');
    expect(artifact.body).toContain('## Source Synthesis');
    expect(artifact.body).toContain('install Vitest');
    expect(artifact.body).toContain('Playwright UI mode');
    expect(artifact.body).toContain('## Provenance');
  });

  it('uses an LLM synthesis prompt instead of dumping noisy web page text into the note body', async () => {
    const analyzeWithLLM = vi.fn(async (prompt: string) => {
      if (prompt.includes('Classify this reviewed work note')) {
        return 'development-record';
      }
      if (prompt.includes('Extract a concise')) {
        return 'email-ppt-workshop';
      }

      return [
        '# 使用AI生成PPT并处理邮件与研讨会资料',
        '',
        '## 核心结论',
        '这次工作围绕把文档转成可编辑PPT、查看网易邮箱未读邮件、准备 slidea 演进研讨会资料展开。',
        '',
        '## 可复用知识',
        '- PPT Master 可以作为文档转 PPTX 的工具候选。',
        '- 邮件页面证据较弱，登录页噪音不能当作邮件内容。',
        '',
        '## 待确认',
        '- 需要补充真实邮件正文或会议纪要后再发布为稳定知识。',
      ].join('\n');
    });

    const artifact = await generateKnowledgeFromReviewedMemories(
      [
        reviewedMemory({
          id: 'reviewed:candidate:netease-mail',
          candidateTitle: '使用AI生成PPT并处理邮件与研讨会资料',
          candidateSummary:
            '通过ChatGPT利用PPT Master工具将文档转化为可编辑PPT，并处理网易邮箱未读邮件及准备slidea演进研讨会相关内容。',
          candidateTheme: 'AI PPT 邮件 研讨会',
          memoryEventIds: ['event:ppt-master', 'event:netease-mail'],
          candidateSourceRefs: [
            {
              id: 'event:ppt-master',
              sourceType: 'activitywatch-browser',
              timestamp: '2026-04-21T09:00:00.000Z',
              title: 'PPT Master',
              url: 'https://hugohe3.github.io/ppt-master/',
              contribution: 'primary',
            },
            {
              id: 'event:netease-mail',
              sourceType: 'activitywatch-browser',
              timestamp: '2026-04-21T09:10:00.000Z',
              title: '163网易免费邮-你的专业电子邮局',
              url: 'https://mail.163.com/js6/main.jsp?sid=secret#module=read.ReadModule',
              contribution: 'supporting',
            },
          ],
        }),
      ],
      {
        now: () => '2026-04-21T12:00:00.000Z',
        analyzeWithLLM,
        retrievePageContent: async (eventId) => ({
          content:
            eventId === 'event:ppt-master'
              ? 'PPT Master — AI generates natively editable PPTX from any document'
              : [
                  '163网易免费邮-你的专业电子邮局',
                  '扫码登录',
                  '账号登录',
                  '阅读并接受 《服务条款》 和 《隐私政策》',
                  '浏览器不支持或禁止了网页脚本，导致您无法正常登录。',
                  '登录iframe',
                  '网易公司版权所有',
                  '163网易免费邮-你的专业电子邮局',
                  '扫码登录',
                  '登录iframe',
                ].join('\n'),
          source: 'captured-page-text',
          url:
            eventId === 'event:ppt-master'
              ? 'https://hugohe3.github.io/ppt-master/'
              : 'https://mail.163.com/js6/main.jsp?sid=secret#module=read.ReadModule',
          title: eventId,
        }),
      },
    );

    const synthesisPrompt = analyzeWithLLM.mock.calls
      .map(([prompt]) => prompt)
      .find((prompt) => prompt.includes('MirrorBrain knowledge draft writer'));

    expect(synthesisPrompt).toBeDefined();
    expect(synthesisPrompt).toContain('Do not paste raw page text');
    expect(synthesisPrompt).toContain('Evidence from login pages');
    expect(synthesisPrompt).not.toContain('sid=secret');
    expect(artifact.body).toContain('## 核心结论');
    expect(artifact.body).toContain('登录页噪音不能当作邮件内容');
    expect(artifact.body).not.toContain('扫码登录');
    expect(artifact.body).not.toContain('登录iframe');
  });

  it('cleans source excerpts before prompt construction', () => {
    const prompt = buildKnowledgeSynthesisPrompt({
      noteType: 'development-record',
      reviewedMemories: [
        reviewedMemory({
          candidateTitle: '网易邮箱邮件处理',
          candidateSummary: '查看未读邮件并准备研讨会资料。',
        }),
      ],
      retrievedContent: [
        {
          content: [
            '163网易免费邮-你的专业电子邮局',
            '扫码登录',
            '账号登录',
            '阅读并接受 《服务条款》 和 《隐私政策》',
            '浏览器不支持或禁止了网页脚本，导致您无法正常登录。',
            '登录iframe',
            '网易公司版权所有',
            '我的会议',
          ].join('\n'),
          source: 'captured-page-text',
          url: 'https://mail.163.com/js6/main.jsp?sid=secret#module=read.ReadModule',
          title: '163网易免费邮-你的专业电子邮局',
        },
      ],
    });

    expect(prompt).toContain('Evidence from login pages');
    expect(prompt).toContain('mail.163.com/js6/main.jsp#module=read.ReadModule');
    expect(prompt).not.toContain('sid=secret');
    expect(prompt).not.toContain('扫码登录');
    expect(prompt).not.toContain('登录iframe');
    expect(prompt).not.toContain('隐私政策');
  });
});
