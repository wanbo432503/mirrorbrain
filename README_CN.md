# MirrorBrain

[English README](./README.md)

MirrorBrain / 镜像大脑 是一个 local-first 的全局个人记忆系统，用于记录、
导入、审核和组织经过授权的 PC 工作活动。它帮助用户恢复过去发生过什么，
把重要工作过程沉淀为可持续积累的知识，并从可重复工作流中提炼可审核的
skills。

## 项目背景

现代工作上下文分散在浏览器页面、本地文件、命令行记录、截图和 Agent 对话
里。没有专门的个人记忆系统时，这些上下文很难被系统化回顾，也很难被安全、
准确地复用。

MirrorBrain 不是通用笔记应用，也不再主要描述为 `openclaw` 的插件。它的
核心角色是把授权的个人工作活动转化为三类边界清晰、带来源归因的产物：

- `memory`：带来源归因的活动记录、召回视图、候选记忆、已审核记忆和检索
  叙事，以及 Phase 4 的 work-session candidates。
- `knowledge`：由已审核工作过程生成的人类可读知识产物，按
  Project -> Topic -> Knowledge Article 组织，并保留版本历史。
- `skill`：由可重复工作流证据生成的 draft 或 approved Agent Skill，并在
  执行前保留明确确认边界。

Phase 1 已经证明了本地垂直切片，Phase 2 / Phase 3 已经形成浏览器与 shell
记忆同步、review、topic knowledge、knowledge graph、skill draft、本地
HTTP API 和 React 控制界面的可运行基线。Phase 4 将重心转向多来源个人记忆：
内置 source recorder 写入 daily JSONL ledgers，importer 将 ledger 转为统一
`MemoryEvent`，用户按时间窗口分析出 reviewed work sessions，再沉淀为面向
Project / Topic 的 Knowledge Article。

## 产品理念

- 授权优先。任何采集都必须 opt-in、按来源限定范围、保留来源归因，并且对
  用户可检查。
- memory、knowledge、skill 是不同生命周期的产物。代码、API 和文档都不应
  混淆三者边界。
- review 是产品边界。原始活动可以成为候选记忆，但持久知识和可复用技能需
  要明确审核或批准。
- provenance 必须贯穿全流程。从来源采集到 review、知识综合、技能草稿，
  都应该可追溯。
- MirrorBrain 拥有自己的个人记忆工作流。包括 `openclaw` 在内的宿主应用可
  通过显式 API 消费 memory、knowledge 和 skill，但不定义或拥有
  MirrorBrain 的内部生命周期。
- skill 不是静默自动化。skill artifact 可以指导 Agent，但执行前必须保留
  确认边界，除非后续明确设计并文档化更窄的安全例外。

## 功能简介

### Memory

- 从 ActivityWatch 和 `aw-watcher-web` 同步经过授权的浏览器活动。
- 在显式配置后同步经过授权的 shell history 文件。
- 通过统一 source-ledger 边界导入 Phase 4 daily JSONL ledgers，覆盖
  browser、file activity、screenshot、shell 和 agent session 等来源类型。
- 记录 source status、source audit events 和 per-ledger checkpoints，方便
  查看导入与 recorder 状态。
- 捕获浏览器页面正文，以提升 review 和 synthesis 质量。
- 保留 daily candidate memories 作为兼容性的 review 路径。
- 按用户选择的时间窗口分析 work-session candidates，作为 Phase 4 的主
  candidate generation 和 review 入口。
- 保存带来源引用和审核决策的 reviewed memories。
- 通过本地 HTTP API 和可选宿主适配器查询记忆。
- 生成 browser theme narrative 和 shell problem narrative，支持“我之前
  做过什么？”、“这个问题之前怎么解决？”等召回型问题。

### Knowledge

- 在兼容流程中从 reviewed memories 生成 knowledge draft。
- 产出面向主题的 current-best knowledge artifact。
- 从 reviewed work sessions 生成 Phase 4 Knowledge Article Draft。
- 按 Project -> Topic -> Knowledge Article 组织持久知识。
- 从 reviewed memory 到生成知识保留 provenance。
- 维护 topic history 和 knowledge graph 视图。
- 支持质量检查和面向 review 的 regeneration 流程。

### Skill

- 从 reviewed workflow evidence 生成 Agent Skill draft。
- 每个 skill artifact 都保留 workflow evidence refs。
- 跟踪 approval state 和 execution safety metadata。
- 在任何后续执行能力之前保留明确确认要求。

### 操作界面

- Fastify HTTP service，提供 OpenAPI JSON 和 Swagger UI。
- React Web UI，用于本地控制、Memory Sources、work-session review、
  preview/published Project -> Topic -> Knowledge 树、知识浏览和 skill
  draft 检查。
- 本地 workspace artifacts，用于可检查记录和回退读取。
- 基于 QMD 的本地索引与检索能力，索引数据保存在同一个
  `mirrorbrain-workspace` 下。
- 可选宿主集成接口，供其他应用消费 MirrorBrain 能力。

### 当前非目标

- 尚未实现文档导入。
- file activity、screenshot、更完整 shell session 和 agent session
  directory 的真实 recorder 尚未全部完成。
- 生产部署、多用户鉴权、保留策略和网络安全加固不属于当前 local-first 基线。
- 除 draft generation 和 safety metadata 之外，尚未实现自主 skill execution。

## Quick Start / 快速开始

### 1. 前置依赖

需要准备：

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
4. 确认 ActivityWatch UI 中能看到浏览器 tab events。

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

MirrorBrain 直接读取 `MIRRORBRAIN_LLM_*` 用于 knowledge 和 title
generation。memory、knowledge 和 skill artifacts 保存在
`MIRRORBRAIN_WORKSPACE_DIR` 下，QMD 的派生 SQLite/vector 索引保存在
`<workspaceDir>/mirrorbrain/qmd/` 下。

### 4. 运行 MirrorBrain

```bash
pnpm dev
```

启动命令会校验本地配置，检查 QMD Workspace 和 ActivityWatch 是否就绪，启动
React build watcher，启动本地 HTTP service，在配置 shell history 时启用
shell sync，并输出 service address、process id 和 log path。

打开本地 UI：

```text
http://127.0.0.1:3007
```

打开 API 文档：

```text
http://127.0.0.1:3007/docs
```

### 5. 验证本地流程

在 Web UI 中：

1. 打开 `Memory Sources`，选择 `All Sources`，点击 `Import Sources`。
2. 确认导入的 memory events 出现在分页 memory list 中。
3. 进入单个 source detail 页面，查看 source status、recent memory 或 audit
   events。
4. 需要整理近期工作时，运行 work-session analysis window。
5. 在 Preview Project -> Topic -> Knowledge 树中审核并 publish 有价值的
   knowledge，使其进入持久的 Published 树。
6. 需要旧版知识浏览或 approval surface 时，打开 `Knowledge`。
7. 打开 `Skill`，从 reviewed evidence 生成 skill draft。

预期结果：

- memory events 带来源归因展示。
- daily candidates 仍可用于兼容 review 流程。
- source audit/status 视图能展示导入和 recorder 状态。
- work-session candidates 保留支持它们的 memory evidence，并先作为
  preview knowledge tree items 呈现。
- publish 后的 preview knowledge 进入持久 Project -> Topic -> Knowledge
  Article 树，并保留 provenance。
- knowledge draft 保留 reviewed-work provenance。
- 使用 Phase 4 流程时，knowledge articles 按 project 和 topic 组织。
- approved topic knowledge 出现在 topic 和 graph 视图中。
- skill draft 保留 workflow evidence refs 和 confirmation metadata。

## 架构与 API 文档

架构细节不展开在根 README 中，而是维护在 `docs/components/` 下。

建议从这里开始：

- [模块总览](./docs/components/module-reference.md)
- [MirrorBrain HTTP API](./docs/components/mirrorbrain-http-api.md)
- [MirrorBrain service](./docs/components/mirrorbrain-service.md)
- [MirrorBrain HTTP server](./docs/components/mirrorbrain-http-server.md)
- [OpenClaw plugin API](./docs/components/openclaw-plugin-api.md) 可选宿主适配器
- [QMD workspace store](./docs/components/qmd-workspace-store.md)
- [Source directory audit](./docs/components/source-directory-audit.md)
- [ActivityWatch browser source](./docs/components/activitywatch-browser-source.md)
- [Shell history source](./docs/components/shell-history-source.md)
- [Memory review](./docs/components/memory-review.md)
- [Topic knowledge merge](./docs/components/topic-knowledge-merge.md)
- [Topic knowledge read](./docs/components/topic-knowledge-read.md)
- [Skill draft builder](./docs/components/skill-draft-builder.md)

完整文档索引见 [docs/README.md](./docs/README.md)。

## 常用命令

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm e2e
```
