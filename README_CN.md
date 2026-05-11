# MirrorBrain

[English README](./README.md)

MirrorBrain / 镜像大脑 是 `openclaw` 的记忆与能力层。它帮助
`openclaw` 记住经过授权的 PC 工作活动，把经过审核的工作内容转化为可持续
积累的知识，并从可重复工作流中提炼可复用的 Agent Skill。

## 项目背景

现代工作上下文分散在浏览器页面、命令行记录、本地文档和 AI 对话里。没有
专门的记忆层时，这些上下文很难被系统化回顾，也很难被 Agent 安全、准确地
复用。

MirrorBrain 被设计为面向 `openclaw` 的 local-first、API-first 子系统。它
不是通用笔记应用，而是把授权工作活动转化为三类边界清晰的产物：

- `memory`：带来源归因的活动记录、召回视图、候选记忆、已审核记忆和检索
  叙事。
- `knowledge`：由已审核记忆生成的人类可读知识产物，包括面向主题的
  current-best knowledge 和版本历史。
- `skill`：由可重复工作流证据生成的 draft 或 approved Agent Skill，并在
  执行前保留明确确认边界。

Phase 1 已经证明了本地垂直切片。当前方向是 Phase 2 的 `openclaw` 集成，
随后继续提升记忆检索质量和面向主题的知识质量。

## 产品理念

- 授权优先。任何采集都必须 opt-in、按来源限定范围、保留来源归因，并且对
  用户可检查。
- memory、knowledge、skill 是不同生命周期的产物。代码、API 和文档都不应
  混淆三者边界。
- review 是产品边界。原始活动可以成为候选记忆，但持久知识和可复用技能需
  要明确审核或批准。
- provenance 必须贯穿全流程。从来源采集到 review、知识综合、技能草稿，
  都应该可追溯。
- MirrorBrain 拥有自己的工作流。`openclaw` 通过显式能力接口消费 memory、
  knowledge 和 skill，而不是依赖隐藏的宿主状态耦合。
- skill 不是静默自动化。skill artifact 可以指导 Agent，但执行前必须保留
  确认边界，除非后续明确设计并文档化更窄的安全例外。

## 功能简介

### Memory

- 从 ActivityWatch 和 `aw-watcher-web` 同步经过授权的浏览器活动。
- 在显式配置后同步经过授权的 shell history 文件。
- 捕获浏览器页面正文，以提升 review 和 synthesis 质量。
- 生成 daily candidate memories，供人工 review。
- 保存带来源引用和审核决策的 reviewed memories。
- 通过本地 HTTP API 和面向 `openclaw` 的 helper 查询记忆。
- 生成 browser theme narrative 和 shell problem narrative，支持“我之前
  做过什么？”、“这个问题之前怎么解决？”等召回型问题。

### Knowledge

- 从 reviewed memories 生成 knowledge draft。
- 产出面向主题的 current-best knowledge artifact。
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
- React Web UI，用于本地控制、review、知识浏览和 skill draft 检查。
- 本地 workspace artifacts，用于可检查记录和回退读取。
- 基于 OpenViking 的本地索引与检索能力。

### 当前非目标

- 尚未实现文档导入。
- `openclaw` conversation capture 不是当前优先级。
- 生产部署、多用户鉴权、保留策略和网络安全加固不属于当前 local-first 基线。
- 除 draft generation 和 safety metadata 之外，尚未实现自主 skill execution。

## Quick Start / 快速开始

### 1. 前置依赖

需要准备：

- Node.js
- `pnpm`
- 本地运行中的 ActivityWatch
- 安装在目标浏览器中的 `aw-watcher-web`
- 本地运行中的 OpenViking

默认本地地址：

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

### 2. 启动 ActivityWatch

1. 从 `https://activitywatch.net/` 安装 ActivityWatch。
2. 启动 ActivityWatch。
3. 在需要授权的浏览器中安装 `aw-watcher-web`。
4. 确认 ActivityWatch UI 中能看到浏览器 tab events。

### 3. 启动 OpenViking

安装服务端：

```bash
pip install openviking --upgrade --force-reinstall
```

创建 `~/.openviking/ov.conf`：

```json
{
  "storage": {
    "workspace": "/path_to_workspace/openviking_workspace"
  },
  "log": {
    "level": "INFO",
    "output": "stdout"
  },
  "embedding": {
    "dense": {
      "api_base": "<MIRRORBRAIN_EMBEDDING_API_BASE>",
      "api_key": "<MIRRORBRAIN_EMBEDDING_API_KEY>",
      "provider": "openai",
      "dimension": 1024,
      "model": "<MIRRORBRAIN_EMBEDDING_MODEL>"
    },
    "max_concurrent": 10
  },
  "vlm": {
    "api_base": "<MIRRORBRAIN_LLM_API_BASE>",
    "api_key": "<MIRRORBRAIN_LLM_API_KEY>",
    "provider": "openai",
    "model": "<MIRRORBRAIN_LLM_MODEL>",
    "max_concurrent": 32
  }
}
```

启动 OpenViking：

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
openviking-server
```

MirrorBrain 启动前需要 OpenViking 已经可访问。

### 4. 配置 MirrorBrain

```bash
pnpm install
cp .env.example .env
```

在 `.env` 中设置本地值：

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933
MIRRORBRAIN_WORKSPACE_DIR=/path_to_workspace/mirrorbrain-workspace
MIRRORBRAIN_SHELL_HISTORY_PATH=/path_to_workspace/.zsh_history
MIRRORBRAIN_LLM_API_BASE=http://127.0.0.1:8000/v1
MIRRORBRAIN_LLM_API_KEY=replace-with-your-llm-api-key
MIRRORBRAIN_LLM_MODEL=replace-with-your-llm-model
MIRRORBRAIN_EMBEDDING_API_BASE=http://127.0.0.1:8000/v1
MIRRORBRAIN_EMBEDDING_API_KEY=replace-with-your-embedding-api-key
MIRRORBRAIN_EMBEDDING_MODEL=replace-with-your-embedding-model
MIRRORBRAIN_EMBEDDING_DIMENSION=1024
```

MirrorBrain 直接读取 `MIRRORBRAIN_LLM_*` 用于 knowledge 和 title
generation。OpenViking 从 `~/.openviking/ov.conf` 读取 embedding 配置，
所以需要保持两个配置文件一致。

### 5. 运行 MirrorBrain

```bash
pnpm dev
```

启动命令会校验本地配置，检查 OpenViking 和 ActivityWatch 是否就绪，启动
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

### 6. 验证本地流程

在 Web UI 中：

1. 打开 `Memory` tab，执行 browser sync。
2. 如果配置了 `MIRRORBRAIN_SHELL_HISTORY_PATH`，执行 shell sync。
3. 打开 `Review` tab，创建 daily candidates。
4. keep 一个 candidate，生成 reviewed memory。
5. 打开 `Knowledge` tab，生成或 approve 一个 knowledge draft。
6. 打开 `Skill` tab，从 reviewed memory 生成 skill draft。

预期结果：

- memory events 带来源归因展示。
- daily candidates 展示 summary、source refs 和 review guidance。
- keep 后的 candidate 变成 reviewed memory。
- knowledge draft 保留 reviewed-memory provenance。
- approved topic knowledge 出现在 topic 和 graph 视图中。
- skill draft 保留 workflow evidence refs 和 confirmation metadata。

## 架构与 API 文档

架构细节不展开在根 README 中，而是维护在 `docs/components/` 下。

建议从这里开始：

- [模块总览](./docs/components/module-reference.md)
- [MirrorBrain HTTP API](./docs/components/mirrorbrain-http-api.md)
- [MirrorBrain service](./docs/components/mirrorbrain-service.md)
- [MirrorBrain HTTP server](./docs/components/mirrorbrain-http-server.md)
- [OpenClaw plugin API](./docs/components/openclaw-plugin-api.md)
- [OpenViking store](./docs/components/openviking-store.md)
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
