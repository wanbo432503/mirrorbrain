# MirrorBrain

[English README](./README.md)

MirrorBrain / 镜像大脑 是一个 local-first 的个人记忆系统，用于处理经过授权的 PC 工作活动。它帮助用户把分散的工作痕迹转化为三类边界清晰的产物：

- **Memory / 记忆**：带来源归因的活动记录，以及用于回忆“发生过什么”的召回视图。
- **Knowledge / 知识**：经过审核、面向人类阅读的知识文章，按项目和主题组织。
- **Skill / 技能**：从可重复工作流证据中提炼出的 draft 或 approved Agent Skill artifacts。

MirrorBrain 是 API-first 和 local-first 的。它可以作为独立本地服务运行，并提供 React 控制界面；`openclaw` 等宿主应用可以通过显式 API 消费它的 memory、knowledge 和 skill 能力。

## 当前状态

当前仓库已经包含一个可运行的本地基线，主要包括：

- ActivityWatch 浏览器记忆同步。
- 显式配置后的 shell history 同步，并对命令内容做 best-effort redaction。
- Phase 4 source-ledger import：从 browser、file activity、screenshot、audio recording、shell、agent 等来源类型的 daily JSONL records 中导入数据。
- Source status 和 source audit 视图。
- 针对用户选择时间窗口的 work-session analysis。
- Preview 和 Published 两套 Project -> Topic -> Knowledge 树。
- Knowledge Article draft、revision、publication 和 history 流程。
- 早期阶段的 topic knowledge、knowledge graph 和质量 / lint 工作流。
- 从 reviewed evidence 生成 skill draft。
- Fastify HTTP API、OpenAPI 文档和 React 本地操作 UI。
- MirrorBrain workspace 内的 QMD 索引与检索能力。

更详细的当前实现快照见 [Current Project Status](./docs/features/current-project-status.md)。

## 产品模型

MirrorBrain 在整个生命周期中都明确区分 memory、knowledge 和 skill。

### Memory / 记忆

Memory 是召回层。它包含经过授权、带来源归因的活动记录，以及从这些记录派生出来的 review 视图。

典型 memory 输入包括：

- 来自 ActivityWatch / `aw-watcher-web` 的浏览器事件
- 来自显式配置 shell history path 的 shell history
- Phase 4 source-ledger JSONL records
- 未来在授权和 review 边界完善后接入的 document 与 host-agent 来源

Memory 不会被自动视为持久知识。它必须保持可归因、可检查、可 review。

### Knowledge / 知识

Knowledge 是经过 review 后的综合层。在当前 Phase 4 流程中，reviewed work sessions 会生成 project-scoped knowledge article drafts，然后用户可以 preview、revise 和 publish。

持久阅读模型是：

```text
Project -> Topic -> Knowledge Article -> Revision History
```

Knowledge artifacts 会保留 provenance，能够追溯到 reviewed work 和支持它们的 memory evidence。

### Skill / 技能

Skill artifacts 是从 reviewed workflow evidence 生成的可复用 Agent Skill drafts。它们会保留 evidence references 和 approval metadata。MirrorBrain 不会静默执行 skills；除非后续明确设计并文档化更窄的安全例外，执行仍然需要确认边界。

## 本地主流程

典型的本地 MirrorBrain 流程是：

```text
Authorized sources
  -> source sync / source-ledger import
  -> normalized MemoryEvent records
  -> work-session analysis
  -> human review
  -> preview knowledge tree
  -> published Project -> Topic -> Knowledge Article
```

在 UI 中通常对应：

1. 打开 **Memory Sources**，运行 source import 或 sync。
2. 检查导入的 memory events，以及 source audit/status 信息。
3. 打开 review / work-session 界面，分析 6 小时、24 小时或 7 天的时间窗口。
4. Review 生成的 work-session candidates。
5. 检查 Preview Project -> Topic -> Knowledge tree。
6. 将有价值的 reviewed knowledge 发布到 durable Published tree。
7. 需要时使用旧的 Knowledge 和 Skill tabs，查看 topic knowledge、graph 和 skill draft 工作流。

## 架构速览

| 层级 | 路径 | 职责 |
| --- | --- | --- |
| Service facade | `src/apps/mirrorbrain-service` | 组合 runtime dependencies，并暴露高层 MirrorBrain 操作。 |
| HTTP server | `src/apps/mirrorbrain-http-server` | Fastify API、OpenAPI docs、静态 UI serving、request/response validation。 |
| React UI | `src/apps/mirrorbrain-web-react` | 只通过 HTTP API 访问后端的本地控制 UI。 |
| Domain modules | `src/modules` | Memory、knowledge、skill、authorization、graph、article、review 等领域规则。 |
| Workflows | `src/workflows` | Sync、import、analysis、narrative、merge、lint、skill-draft 等多步骤编排。 |
| Integrations | `src/integrations` | ActivityWatch、shell history、QMD workspace、source-ledger state、page content 和 host adapters。 |
| Shared | `src/shared` | Types、API contracts、config 和跨领域工具。 |

完整模块目录见 [Module Reference](./docs/components/module-reference.md)。

## Quick Start / 快速开始

### 1. 前置依赖

需要安装或准备：

- Node.js
- `pnpm`
- 本地运行中的 ActivityWatch
- 安装在目标浏览器中的 `aw-watcher-web`

默认本地地址：

- ActivityWatch: `http://127.0.0.1:5600`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. 启动 ActivityWatch

1. 从 `https://activitywatch.net/` 安装 ActivityWatch。
2. 启动 ActivityWatch。
3. 在需要授权的浏览器中安装 `aw-watcher-web`。
4. 确认 ActivityWatch UI 中能看到 browser tab events。

### 3. 配置 MirrorBrain

```bash
pnpm install
pnpm --dir src/apps/mirrorbrain-web-react install
cp .env.example .env
```

在 `.env` 中设置本地值：

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_BROWSER_BUCKET_ID=aw-watcher-web-chrome_laptop
MIRRORBRAIN_WORKSPACE_DIR=/path_to_workspace/mirrorbrain-workspace
MIRRORBRAIN_SHELL_HISTORY_PATH=/path_to_workspace/.zsh_history
MIRRORBRAIN_LLM_API_BASE=http://127.0.0.1:8000/v1
MIRRORBRAIN_LLM_API_KEY=replace-with-your-llm-api-key
MIRRORBRAIN_LLM_MODEL=replace-with-your-llm-model
```

MirrorBrain 会把 memory、knowledge 和 skill artifacts 存放在 `MIRRORBRAIN_WORKSPACE_DIR` 下。QMD 会把可重建的 SQLite/vector 索引存放在：

```text
<workspaceDir>/mirrorbrain/qmd/
```

`MIRRORBRAIN_LLM_*` 用于 knowledge 和 title generation 流程。Memory sync 和基础本地检查可以独立运行，但 knowledge generation 的质量依赖可用的 LLM 配置。

### 4. 运行 MirrorBrain

```bash
pnpm dev
```

该命令会校验本地配置，检查 QMD workspace readiness 和 ActivityWatch availability，启动 React build watcher，启动 HTTP service，启用已配置的 sync/import loops，并输出 service address、process id 和 log path。

打开本地 UI：

```text
http://127.0.0.1:3007
```

打开 API 文档：

```text
http://127.0.0.1:3007/docs
```

打开 OpenAPI JSON：

```text
http://127.0.0.1:3007/openapi.json
```

## 验证本地流程

在 Web UI 中：

1. 打开 **Memory Sources**。
2. 选择 **All Sources**，运行 **Import Sources**。
3. 确认导入的 memory events 出现在分页 memory list 中。
4. 打开 source detail 页面，检查 source status、recent memory 和 audit events。
5. 运行一个 work-session analysis window。
6. Review 生成的 work-session candidates。
7. 检查 Preview Project -> Topic -> Knowledge tree。
8. 将有价值的 knowledge 发布到 durable Published tree。
9. 需要时打开 **Skill**，从 reviewed evidence 生成 skill draft。

预期结果：

- 导入的 memory events 保留 source attribution。
- Source audit/status 视图展示 import 和 recorder state。
- Work-session candidates 保留 supporting memory evidence。
- Preview knowledge 可以发布为 durable Project -> Topic -> Knowledge Article content。
- Knowledge articles 保留 provenance 和 revision history。
- Skill drafts 保留 workflow evidence refs 和 confirmation metadata。

## API 和文档

架构和组件细节维护在 `docs/` 中，而不是展开在根 README 里。

建议从这里开始：

- [Documentation index](./docs/README.md)
- [Current Project Status](./docs/features/current-project-status.md)
- [Module Reference](./docs/components/module-reference.md)
- [MirrorBrain HTTP API](./docs/components/mirrorbrain-http-api.md)
- [MirrorBrain service](./docs/components/mirrorbrain-service.md)
- [MirrorBrain HTTP server](./docs/components/mirrorbrain-http-server.md)
- [Work Session Analysis UI](./docs/components/work-session-analysis-ui.md)
- [Knowledge Article](./docs/components/knowledge-article.md)
- [Knowledge Article Revision](./docs/components/knowledge-article-revision.md)
- [QMD workspace store](./docs/components/qmd-workspace-store.md)
- [OpenClaw plugin API](./docs/components/openclaw-plugin-api.md)

## 常用命令

本地运行：

```bash
pnpm dev
```

根目录后端 / service 检查：

```bash
pnpm test
pnpm typecheck
pnpm e2e
git diff --check
```

React UI 检查：

```bash
pnpm --dir src/apps/mirrorbrain-web-react exec vitest run
pnpm --dir src/apps/mirrorbrain-web-react build
```

## 当前非目标

- 尚未实现 document ingestion。
- file activity、screenshot、更完整 shell sessions 和 agent session directories 的真实 recorders 尚未完全完成。
- durable authorization-scope management UI、source-instance allowlists 和 revocation workflows 尚未完成。
- production deployment、multi-user auth、retention policy 和 network hardening 不属于当前 local-first baseline。
- 除 draft generation 和 safety metadata 外，尚未实现 autonomous skill execution。

## 安全原则

- Capture 必须 opt-in，并按 source 限定范围。
- Source attribution 必须贯穿 capture、review、knowledge synthesis 和 skill drafting。
- Review 是产品边界：raw memory 不会自动成为 durable knowledge 或 executable skill。
- Sensitive data 不应被静默提升为 durable artifacts。
- 宿主应用可以通过 API 消费 MirrorBrain 能力，但 MirrorBrain 拥有自己的 capture、review 和 synthesis 工作流。
