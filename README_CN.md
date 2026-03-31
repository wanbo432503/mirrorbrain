# MirrorBrain

MirrorBrain / 镜像大脑 是一个 local-first 的 Phase 1 MVP。它会导入经过授权的浏览器工作活动，将其转化为可审查的 memory，并生成 knowledge draft 和 skill draft，供 `openclaw` 使用。

当前 Phase 1 范围刻意保持很窄：

- 仅支持浏览器来源，通过 `ActivityWatch` + `aw-watcher-web`
- 使用 `OpenViking` 作为主要的本地存储和检索层
- 提供本地 HTTP 服务和一个最小可用的独立 review UI
- 支持 candidate review、knowledge draft generation 和 skill draft generation

当前仓库实现的是更大 Phase 1 产品规划中的 browser-first MVP slice。shell history、document ingestion 和 `openclaw` conversation capture 仍在规划内，但当前仓库尚未实现。

## 架构

- `src/apps/mirrorbrain-service/`: 运行时服务与轮询生命周期
- `src/apps/mirrorbrain-http-server/`: 本地 HTTP API 与静态 UI 服务
- `src/apps/mirrorbrain-web/`: 独立 MVP UI
- `src/integrations/activitywatch-browser-source/`: 浏览器来源适配器
- `src/integrations/openviking-store/`: OpenViking 持久化与检索适配器

当前 MVP 会在同一个本地 origin 下同时提供 UI 和 JSON API。

## 前置依赖

启动 MirrorBrain 前，请先准备好以下本地依赖：

- Node.js 和 `pnpm`
- 本地运行中的 ActivityWatch
- 浏览器中已安装 `aw-watcher-web`
- 本地运行中的 OpenViking

参考项目：

- ActivityWatch: `https://activitywatch.net/`
- `aw-watcher-web`: `https://github.com/ActivityWatch/aw-watcher-web`
- OpenViking: `https://github.com/volcengine/OpenViking`

E2E 验证可选依赖：

- Playwright Chromium: `pnpm exec playwright install chromium`

## 快速开始

MirrorBrain Phase 1 依赖两个本地服务：

- `ActivityWatch` 用于浏览器活动采集
- `OpenViking` 用于本地存储和检索

### 1. 安装 ActivityWatch

按官方文档安装：

- 官网：`https://activitywatch.net/`
- 官方文档：`https://docs.activitywatch.net/`
- 浏览器扩展 `aw-watcher-web`：`https://github.com/ActivityWatch/aw-watcher-web`

推荐的 MirrorBrain Phase 1 配置方式：

1. 按官方指南安装 ActivityWatch 桌面端。
2. 在本地启动 ActivityWatch。
3. 在你用于工作活动记录的浏览器中安装 `aw-watcher-web`。
4. 打开 ActivityWatch UI，确认浏览器 tab 事件已经开始采集。

预期本地端点：

- ActivityWatch UI / API: `http://127.0.0.1:5600`

### 2. 安装 OpenViking

安装服务端包：

```bash
pip install openviking --upgrade --force-reinstall
```

可选 CLI 安装：

```bash
curl -fsSL https://raw.githubusercontent.com/volcengine/OpenViking/main/crates/ov_cli/install.sh | bash
```

在 `~/.openviking/ov.conf` 创建 OpenViking 服务配置：

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
      "api_base": "http://<your-model-endpoint>/v1",
      "api_key": "<your-api-key>",
      "provider": "openai",
      "dimension": 1024,
      "model": "<your-embedding-model>"
    },
    "max_concurrent": 10
  },
  "vlm": {
    "api_base": "http://<your-model-endpoint>/v1",
    "api_key": "<your-api-key>",
    "provider": "openai",
    "model": "<your-vlm-model>",
    "max_concurrent": 32
  }
}
```

导出配置路径：

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
```

如果你使用 CLI，再创建 `~/.openviking/ovcli.conf`：

```json
{
  "url": "http://localhost:1933",
  "timeout": 60.0,
  "output": "table"
}
```

然后导出：

```bash
export OPENVIKING_CLI_CONFIG_FILE=~/.openviking/ovcli.conf
```

启动 OpenViking：

```bash
openviking-server
```

预期本地端点：

- OpenViking API: `http://127.0.0.1:1933`

可用的验证命令：

```bash
ov status
ov ls viking://resources/
```

### 3. 安装 MirrorBrain

```bash
pnpm install
```

### 4. 配置 MirrorBrain

MirrorBrain 会读取以下环境变量：

- `MIRRORBRAIN_HTTP_HOST`
- `MIRRORBRAIN_HTTP_PORT`
- `MIRRORBRAIN_WORKSPACE_DIR`
- `MIRRORBRAIN_ACTIVITYWATCH_BASE_URL`
- `MIRRORBRAIN_OPENVIKING_BASE_URL`
- `MIRRORBRAIN_SYNC_INTERVAL_MS`
- `MIRRORBRAIN_INITIAL_BACKFILL_HOURS`

启动时，`pnpm dev` 会在项目根目录存在 `.env` 时自动加载它。Shell 环境变量优先级高于 `.env` 中的值。

默认值见 [`.env.example`](./.env.example)。

默认本地端口：

- ActivityWatch: `http://127.0.0.1:5600`
- OpenViking: `http://127.0.0.1:1933`
- MirrorBrain: `http://127.0.0.1:3007`

基于 [`.env.example`](./.env.example) 创建项目根目录 `.env`：

```bash
cp .env.example .env
```

确保以下配置与你本地服务一致：

```bash
MIRRORBRAIN_ACTIVITYWATCH_BASE_URL=http://127.0.0.1:5600
MIRRORBRAIN_OPENVIKING_BASE_URL=http://127.0.0.1:1933
```

### 5. 启动 MVP

1. 启动 ActivityWatch，并确认浏览器扩展正在采集 tab。
2. 启动 OpenViking，并确认其 HTTP API 可访问。
3. 启动 MirrorBrain：

```bash
pnpm dev
```

4. 打开 `http://127.0.0.1:3007`

启动脚本会：

- 检查 ActivityWatch 可达性
- 检查 OpenViking 可达性
- 转译独立 web UI 资源
- 启动浏览器同步轮询
- 启动本地 HTTP 服务

### 6. 验证端到端流程

1. 打开 `http://127.0.0.1:3007`
2. 确认页面显示 `Service Status: running`
3. 点击 `Sync Browser Memory`
4. 点击 `Create Candidate`
5. 点击 `Keep Candidate`
6. 点击 `Generate Knowledge`
7. 点击 `Generate Skill`

页面应显示每一步的可见状态信息，以及：

- 一个 candidate memory id
- 一个 reviewed memory id
- 一个 knowledge draft id
- 一个 skill draft id

## MVP 操作流

操作流程与上面的快速验证路径一致：

1. 同步浏览器 memory
2. 基于导入的 memory 创建 candidate
3. 将 candidate 保留为 reviewed memory
4. 生成 knowledge
5. 生成 skill

## API Surface

当前本地 MVP HTTP API 暴露以下接口：

- `GET /health`
- `POST /sync/browser`
- `GET /memory`
- `GET /knowledge`
- `GET /skills`
- `POST /candidate-memories`
- `POST /reviewed-memories`
- `POST /knowledge/generate`
- `POST /skills/generate`

## 验证

运行自动化检查：

```bash
pnpm vitest run
pnpm tsc --noEmit
pnpm e2e
```

`pnpm e2e` 会通过 [`tests/e2e/fixtures/mirrorbrain-mvp-fixture.ts`](./tests/e2e/fixtures/mirrorbrain-mvp-fixture.ts) 提供的本地 fixture service 来跑文档中的 UI 流程。它验证的是操作流和 UI 行为，不要求真实的 `ActivityWatch` 和 `OpenViking` 进程同时启动。真实依赖启动路径通过 `pnpm dev` 单独验证。

## 存储说明

- 原始归一化后的 `MemoryEvent` 会被导入 OpenViking
- `CandidateMemory` 和 `ReviewedMemory` 也会作为一等 artifact 被持久化
- 本地运行时还会在启动时生成临时 web 资源目录

## 已知限制

- Phase 1 当前只支持浏览器来源
- UI 刻意保持最小化，只覆盖第一条端到端工作流
- 暂无认证与多用户支持
- shell history、document ingestion 和 `openclaw` conversation capture 尚未实现
- skill execution 不在当前 MVP 范围内

## 故障排查

`ActivityWatch is unreachable for the local MVP runtime.`

- 确认 ActivityWatch 已在配置的 base URL 上运行
- 确认 `MIRRORBRAIN_ACTIVITYWATCH_BASE_URL` 配置正确

`OpenViking is unreachable for the local MVP runtime.`

- 确认 OpenViking 已在配置的 base URL 上运行
- 确认 `MIRRORBRAIN_OPENVIKING_BASE_URL` 配置正确

同步后 UI 没有显示有用的 memory。

- 确认 `aw-watcher-web` 已安装并启用
- 确认最近在当前 backfill window 内确实有浏览器活动

`pnpm e2e` 因缺少 Chromium 失败。

- 执行 `pnpm exec playwright install chromium`
