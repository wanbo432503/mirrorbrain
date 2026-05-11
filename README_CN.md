# MirrorBrain

[English README](./README.md)

MirrorBrain / 镜像大脑 是 `openclaw` 的记忆与能力层。它作为独立本地服务运行，同时通过能力化 API 暴露给 `openclaw` 插件包装使用。

MirrorBrain 不是通用笔记应用。它的产品边界是把经过授权的工作活动转化为三类明确分离的产物：

- `memory`：带来源归因的活动记录、召回视图、候选记忆、已审核记忆和检索叙事。
- `knowledge`：由已审核记忆生成的人类可读知识产物，包括面向主题的 current-best knowledge 与版本历史。
- `skill`：由已审核工作流证据生成的 Agent Skill draft，执行前仍必须保留确认边界。

## 当前实现

这个仓库已经具备可运行的 Phase 2 和 Phase 3 基线：

- 通过 ActivityWatch 与 `aw-watcher-web` 同步浏览器记忆。
- 通过显式配置的 shell history 文件同步 shell 记忆。
- 通过 OpenViking 做本地索引与检索，并保留 workspace 文件作为可检查的本地记录和回退读路径。
- 捕获浏览器页面正文，用于更好的 review 和 knowledge generation。
- 提供面向 `openclaw` 的 `query_memory` 检索 helper 与演示文档。
- 生成用于“我之前做了什么？”类问题的离线 browser theme narrative。
- 生成用于“我之前怎么用命令行解决问题？”类问题的离线 shell problem narrative。
- 支持 daily candidate generation、review decision、reviewed memory、knowledge draft generation、topic knowledge approval 和 skill draft generation。
- 支持 topic knowledge versioning、current-best 标记和 history。
- 支持基于 wikilink 与 TF-IDF similarity 的 knowledge relation graph。
- 提供 React Web UI，用于本地控制、review、knowledge 浏览和 skill draft。
- 提供 Fastify HTTP API 与 OpenAPI 文档。

尚未完成：

- 文档导入。
- `openclaw` 对话采集。
- 完整的来源授权、撤销和管理 UI。
- 面向 `openclaw` 的 topic list/detail/history 直接 adapter helper。
- 生产部署、保留策略和运维能力。
- 超出 draft generation 与 approval-state modeling 的自主 skill execution。

## 架构

MirrorBrain 是 API-first 的 TypeScript 系统。

| 层级 | 路径 | 职责 |
| --- | --- | --- |
| Apps | `src/apps/` | Runtime service、HTTP server 和 Web UI。 |
| Integrations | `src/integrations/` | ActivityWatch、shell history、browser page content、OpenViking、checkpoint 和 openclaw adapter。 |
| Modules | `src/modules/` | 授权、采集、review、knowledge、graph、relation scoring、cache 和 skill 的领域规则。 |
| Workflows | `src/workflows/` | sync、narrative、review、topic merge、lint、quality check 和 skill drafting 的多步骤编排。 |
| Shared | `src/shared/` | 跨层类型、默认配置和底层 LLM HTTP helper。 |

详细模块目录：

- [docs/README.md](./docs/README.md)
- [docs/components/module-reference.md](./docs/components/module-reference.md)

## 运行时数据

MirrorBrain 会把本地 workspace 产物保存在
`<MIRRORBRAIN_WORKSPACE_DIR>/mirrorbrain/` 下：

- `memory-events/`
- `browser-page-content/`
- `candidate-memories/`
- `reviewed-memories/`
- `memory-narratives/`
- `knowledge/`
- `skill-drafts/`
- `state/sync-checkpoints/`
- `cache/`
- `deleted-artifacts/`

OpenViking 负责索引和检索，但 workspace 文件同样是 MirrorBrain 的可检查本地记录与回退读取面。

## 快速开始

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
3. 在目标浏览器中安装 `aw-watcher-web`。
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

设置本地值：

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

MirrorBrain 直接读取 `MIRRORBRAIN_LLM_*` 用于 knowledge/title generation。OpenViking 从 `~/.openviking/ov.conf` 读取 embedding 配置，所以需要保持两个配置文件一致。

### 5. 运行 MirrorBrain

```bash
pnpm dev
```

启动命令会：

- 校验必要 `.env` 值。
- 检查 OpenViking 是否可访问。
- 检查 ActivityWatch browser watcher 是否就绪。
- 启动 React `vite build --watch`。
- 等待第一份 React build output。
- 启动 MirrorBrain HTTP service。
- 当配置了 `MIRRORBRAIN_SHELL_HISTORY_PATH` 时启用 shell sync。
- 输出 service address、process id 和 log path。

打开 UI：

```text
http://127.0.0.1:3007
```

OpenAPI 文档：

```text
http://127.0.0.1:3007/docs
```

## 基础验证流程

在 Web UI 中：

1. 打开 `Memory` tab，执行 browser sync。
2. 如果配置了 shell history path，可以执行 shell sync。
3. 打开 `Review` tab，创建 daily candidates。
4. 审核一个 candidate 并 keep。
5. 打开 `Knowledge` tab，生成或 approve 一个 knowledge draft。
6. 打开 `Skill` tab，从 reviewed memory 生成 skill draft。

预期结果：

- memory events 带来源归因展示。
- daily candidates 展示 summary、source refs 和 review guidance。
- keep 后的 candidate 变成 reviewed memory。
- knowledge draft 保留 reviewed-memory provenance。
- approved topic knowledge 出现在 topic 和 graph 视图中。
- skill draft 保留 workflow evidence refs，并包含 requires-confirmation metadata。

## HTTP Surface

主要本地端点：

- `GET /health`
- `GET /memory`
- `POST /memory/query`
- `POST /sync/browser`
- `POST /sync/shell`
- `GET /candidate-memories`
- `POST /candidate-memories/daily`
- `POST /reviewed-memories`
- `GET /knowledge`
- `GET /knowledge/topics`
- `GET /knowledge/topics/:topicKey`
- `GET /knowledge/topics/:topicKey/history`
- `GET /knowledge/graph`
- `POST /knowledge/generate`
- `POST /knowledge/regenerate`
- `POST /knowledge/approve`
- `GET /skills`
- `POST /skills/generate`

完整 schema 在 `/openapi.json` 和 `/docs`。

## 文档

从这里开始：

- [文档索引](./docs/README.md)
- [当前模块参考](./docs/components/module-reference.md)
- [当前项目状态](./docs/features/current-project-status.md)
- [OpenClaw memory tool example](./docs/features/openclaw-memory-tool-example.md)
- [OpenClaw demo guide](./docs/features/openclaw-memory-demo-guide.md)
- [Phase 2 / Phase 3 plan](./docs/plans/2026-04-01-mirrorbrain-phase2-phase3-plan.md)

## 常用命令

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm e2e
```

仅修改文档时：

```bash
git diff --check
```
